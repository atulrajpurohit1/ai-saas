// Keeps tests off the real upload bucket. @prisma/client loads backend/.env on
// import, which would otherwise hand every test the production S3_* settings;
// dotenv never overrides a variable that is already set, so blanking them here
// first makes uploads fall back to the local disk, as the tests expect.
for (const key of [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
]) {
  process.env[key] = '';
}
