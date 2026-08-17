import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { sendDueReminders } from '../lib/due-reminders';

/**
 * Background job infrastructure (docs/PLAN.md §5 — one queue module owns all jobs).
 *
 * Automated Dues Reminders: a repeatable daily job that finds unpaid invoices
 * coming due within each society's configured window and fires a DUE_REMINDER
 * notification for each (invoice, dueDate) pair exactly once.
 *
 * Resilience: if REDIS_URL is not set or Redis is unreachable, the queue starts
 * in a safe "disabled" mode — the API keeps working normally, the job simply
 * does not run. Admins can still trigger a run manually via
 * POST /api/v1/settings/run-reminders.
 */

const JOB_NAME = 'due-reminders';
const SCHEDULER_ID = 'due-reminders-scheduler';
const DEFAULT_CRON = '0 9 * * *'; // 09:00 UTC every day
const CRON = process.env.DUE_REMINDER_CRON || DEFAULT_CRON;

const REDIS_URL = process.env.REDIS_URL;

let connection: IORedis | null = null;
let queue: Queue | null = null;
let worker: Worker | null = null;
let warned = false;

function getConnection(): IORedis | null {
  if (!REDIS_URL) return null;
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    });
    connection.on('error', (err) => {
      if (!warned) {
        warned = true;
        console.error(
          `[Queue] Redis connection error (${err instanceof Error ? err.message : err}) — automated due reminders disabled; the API keeps working. Fix REDIS_URL and restart to re-enable.`
        );
      }
    });
  }
  return connection;
}

/** True when the scheduled queue is actually running (used in logs/tests). */
export function isReminderQueueRunning(): boolean {
  return queue !== null && worker !== null;
}

async function processJob(job: Job): Promise<{ scanned: number; reminded: number }> {
  const result = await sendDueReminders();
  return { scanned: result.scanned, reminded: result.reminded };
}

/**
 * Start the scheduled due-reminders job. Safe to call on every boot; if Redis
 * is unavailable the queue simply never activates.
 */
export async function startReminderQueue(): Promise<void> {
  try {
    const conn = getConnection();
    if (!conn) {
      console.log('[Queue] REDIS_URL not set — automated due reminders disabled (manual trigger still available)');
      return;
    }

    queue = new Queue(JOB_NAME, { connection: conn });
    worker = new Worker(JOB_NAME, processJob, { connection: conn });

    // BullMQ 6: repeatable jobs are defined via job schedulers (the `repeat`
    // option on add() was removed).
    await queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: CRON },
      { name: JOB_NAME, data: {} }
    );

    worker.on('completed', (job) => {
      console.log(`[Queue] due-reminders completed — scanned ${job.returnvalue?.scanned ?? 0}, reminded ${job.returnvalue?.reminded ?? 0}`);
    });
    worker.on('failed', (job, err) => {
      console.error(`[Queue] due-reminders failed: ${err instanceof Error ? err.message : err}`);
    });

    console.log(`[Queue] Automated due reminders scheduled (${CRON}, ${process.env.TZ || 'UTC'})`);
  } catch (err) {
    console.error(
      `[Queue] Could not start due reminders (${err instanceof Error ? err.message : err}) — automated job disabled; API unaffected`
    );
  }
}

/** Graceful shutdown — closes the worker and queue so in-flight jobs finish. */
export async function stopReminderQueue(): Promise<void> {
  try {
    await worker?.close();
  } catch {
    /* ignore */
  }
  worker = null;
  try {
    await queue?.close();
  } catch {
    /* ignore */
  }
  queue = null;
  try {
    await connection?.quit();
  } catch {
    /* ignore */
  }
  connection = null;
}
