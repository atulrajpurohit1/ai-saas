import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { createReadStream, existsSync, statSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { Readable } from 'stream';

/**
 * Durable storage for uploaded files, in an S3-compatible bucket (Backblaze B2
 * in production).
 *
 * The host's disk is ephemeral -- on Render's free plan it is wiped on every
 * deploy AND whenever the instance sleeps -- so a file that only lives in an
 * upload directory is eventually lost while its database row survives. Multer
 * still writes each upload to its local directory first, because the services
 * validate the file there; persistUpload() then copies it to the bucket and
 * drops the local copy.
 *
 * Objects are keyed `<upload dir name>/<stored file name>`, both of which the
 * database already records, so no schema change was needed and a row maps to
 * its object without a lookup.
 *
 * With no S3_* configuration everything falls back to the local disk exactly
 * as before, which keeps local development and tests working without a bucket.
 */

const logger = new Logger('ObjectStorage');

interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function objectStorageConfig(): ObjectStorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

export function isObjectStorageEnabled(): boolean {
  return objectStorageConfig() !== null;
}

let cachedClient: { key: string; client: S3Client } | null = null;

function client(config: ObjectStorageConfig): S3Client {
  const key = `${config.endpoint}|${config.region}|${config.accessKeyId}`;
  if (cachedClient?.key !== key) {
    cachedClient = {
      key,
      client: new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        // B2 rejects the CRC32 checksums the SDK now adds to every upload by
        // default; only send them when an operation actually requires one.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      }),
    };
  }
  return cachedClient.client;
}

function objectKey(uploadDir: string, storedFileName: string): string {
  return `${basename(uploadDir)}/${basename(storedFileName)}`;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404)
  );
}

/**
 * Moves a validated upload from its local directory into the bucket. Call it
 * after the file has passed validation and BEFORE the database row that points
 * at it is written, so a row never references a file that is not stored.
 *
 * On failure the local copy is removed and the request fails with a 503: a
 * file accepted only onto the ephemeral disk would look saved and then vanish.
 */
export async function persistUpload(
  uploadDir: string,
  storedFileName: string,
): Promise<void> {
  const config = objectStorageConfig();
  if (!config) return;

  const filePath = join(uploadDir, basename(storedFileName));
  try {
    // Size first: opening a stream on a missing file emits an unhandled error.
    const size = statSync(filePath).size;
    await client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(uploadDir, storedFileName),
        Body: createReadStream(filePath),
        ContentLength: size,
      }),
    );
  } catch (error) {
    removeLocalQuietly(filePath);
    logger.error(
      `Upload of ${objectKey(uploadDir, storedFileName)} failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    throw new ServiceUnavailableException(
      'File storage is unavailable. Please try the upload again.',
    );
  }

  removeLocalQuietly(filePath);
}

/**
 * Opens a stored file for streaming. The local copy wins when present (files
 * uploaded before the bucket existed, or local development); otherwise it is
 * read from the bucket. Null when the file exists in neither place.
 */
export async function openStoredFile(
  uploadDir: string,
  storedFileName: string,
): Promise<Readable | null> {
  const filePath = join(uploadDir, basename(storedFileName));
  if (existsSync(filePath)) return createReadStream(filePath);

  const config = objectStorageConfig();
  if (!config) return null;

  try {
    const result = await client(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(uploadDir, storedFileName),
      }),
    );
    return (result.Body as Readable | undefined) ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Reads a stored file fully into memory. Same lookup order as openStoredFile. */
export async function readStoredFile(
  uploadDir: string,
  storedFileName: string,
): Promise<Buffer | null> {
  const filePath = join(uploadDir, basename(storedFileName));
  if (existsSync(filePath)) return readFile(filePath);

  const config = objectStorageConfig();
  if (!config) return null;

  try {
    const result = await client(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(uploadDir, storedFileName),
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Best-effort delete from both the local directory and the bucket. Never
 * throws: a file that cannot be removed must not block the database change
 * that made it obsolete. The bucket delete runs in the background and only
 * logs on failure.
 */
export function removeStoredFile(
  uploadDir: string,
  storedFileName: string,
): void {
  removeLocalQuietly(join(uploadDir, basename(storedFileName)));

  const config = objectStorageConfig();
  if (!config) return;

  const key = objectKey(uploadDir, storedFileName);
  client(config)
    .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    .catch((error: unknown) => {
      logger.warn(
        `Could not delete ${key} from storage: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    });
}

function removeLocalQuietly(filePath: string) {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Best-effort cleanup.
  }
}
