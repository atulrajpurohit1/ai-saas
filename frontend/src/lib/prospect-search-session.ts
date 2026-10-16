import type {
  DiscoverProspectsRequest,
  ProspectDiscoveryResult,
} from '@/lib/prospect-search';

/**
 * Keeps a Prospect Search alive across navigation, tab switches and reloads.
 *
 * The search itself already runs server-side: /discover submits a BlackPearl
 * job and returns a job id, and nothing about that job depends on a browser
 * staying open. What was lost on leaving the page was purely the *handle* --
 * the job id lived in React state, so unmounting meant nobody ever polled the
 * job again and a finished search had nowhere to land.
 *
 * Parking the job id (and the last completed result) here means a remount can
 * pick the same job back up, or show what already finished while the user was
 * elsewhere.
 *
 * Scoped to one user id: a shared browser must never show one account the
 * prospects another account paid for.
 */
const STORAGE_KEY = 'prospect-search:session:v1';

/**
 * How long a parked job id is still worth resuming. Comfortably past both the
 * page's own watching window and BlackPearl's observed ~15 minute worst case,
 * so a search the page gave up watching can still be collected on a later
 * visit. Past this the job is either long finished or dead, and the hourly
 * server-side sweep will have returned its held credits anyway.
 */
const RESUMABLE_JOB_MS = 45 * 60 * 1000;

/**
 * How long a finished result keeps being restored on return. Prospect data
 * ages -- a day-old result is still useful to come back to, a week-old one is
 * a stale surprise.
 */
const RESTORABLE_RESULT_MS = 12 * 60 * 60 * 1000;

export interface InFlightDiscoveryJob {
  jobId: string;
  request: DiscoverProspectsRequest;
  /** When the job was submitted, not when polling last resumed. */
  startedAt: number;
}

export interface CompletedDiscovery {
  request: DiscoverProspectsRequest;
  result: ProspectDiscoveryResult;
  completedAt: number;
}

interface StoredSession {
  userId: string | null;
  job?: InFlightDiscoveryJob | null;
  completed?: CompletedDiscovery | null;
}

function readRaw(): StoredSession | null {
  // Server-rendered first paint has no localStorage, and a browser in private
  // mode (or with site data blocked) throws on access rather than returning
  // null -- neither is an error worth surfacing, the page just starts empty.
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function writeRaw(session: StoredSession) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A full or blocked store costs the resume, nothing else.
  }
}

function isRequest(value: unknown): value is DiscoverProspectsRequest {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as DiscoverProspectsRequest).objective === 'string'
  );
}

function isResult(value: unknown): value is ProspectDiscoveryResult {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as ProspectDiscoveryResult).prospects)
  );
}

/**
 * What is worth restoring for this user right now. Anything belonging to
 * another user, malformed, or past its age is reported as absent -- and a
 * foreign user's entry is cleared outright rather than left to linger.
 */
export function loadProspectSearchSession(userId: string | null): {
  job: InFlightDiscoveryJob | null;
  completed: CompletedDiscovery | null;
} {
  const empty = { job: null, completed: null };
  const stored = readRaw();
  if (!stored) return empty;

  if ((stored.userId ?? null) !== (userId ?? null)) {
    clearProspectSearchSession();
    return empty;
  }

  const now = Date.now();

  const job =
    stored.job &&
    typeof stored.job.jobId === 'string' &&
    typeof stored.job.startedAt === 'number' &&
    isRequest(stored.job.request) &&
    now - stored.job.startedAt < RESUMABLE_JOB_MS
      ? stored.job
      : null;

  const completed =
    stored.completed &&
    typeof stored.completed.completedAt === 'number' &&
    isRequest(stored.completed.request) &&
    isResult(stored.completed.result) &&
    now - stored.completed.completedAt < RESTORABLE_RESULT_MS
      ? stored.completed
      : null;

  return { job, completed };
}

/** Parks a just-submitted job so a remount can pick the polling back up. */
export function saveInFlightDiscoveryJob(
  userId: string | null,
  job: InFlightDiscoveryJob,
) {
  // A new search replaces whatever was shown: keeping the old result would
  // restore it next to a running search it has nothing to do with.
  writeRaw({ userId: userId ?? null, job, completed: null });
}

/** Records a finished search and retires its job id in one write. */
export function saveCompletedDiscovery(
  userId: string | null,
  request: DiscoverProspectsRequest,
  result: ProspectDiscoveryResult,
) {
  writeRaw({
    userId: userId ?? null,
    job: null,
    completed: { request, result, completedAt: Date.now() },
  });
}

/**
 * Drops the job id while leaving any restored result alone -- for a job that
 * reached a terminal state without a result of its own (failed, timed out, or
 * errored), which must not be polled again on the next visit.
 */
export function clearInFlightDiscoveryJob(userId: string | null) {
  const stored = readRaw();
  writeRaw({
    userId: userId ?? null,
    job: null,
    completed:
      stored && (stored.userId ?? null) === (userId ?? null)
        ? stored.completed ?? null
        : null,
  });
}

export function clearProspectSearchSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the entry is scoped and ages out on its own.
  }
}
