import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { sendDueReminders } from '../lib/due-reminders';
import { generateRecurringInvoices } from '../lib/recurring-billing';
import { generatePlatformInvoices, markOverduePlatformInvoices } from '../lib/platform-billing';

/**
 * Background job infrastructure (docs/PLAN.md §5 - one queue module owns all jobs).
 *
 * Automated Dues Reminders: a repeatable daily job that finds unpaid invoices
 * coming due within each society's configured window and fires a DUE_REMINDER
 * notification for each (invoice, dueDate) pair exactly once.
 *
 * Resilience: if REDIS_URL is not set or Redis is unreachable, the queue starts
 * in a safe "disabled" mode - the API keeps working normally, the job simply
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
          `[Queue] Redis connection error (${err instanceof Error ? err.message : err}) - automated due reminders disabled; the API keeps working. Fix REDIS_URL and restart to re-enable.`
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
      console.log('[Queue] REDIS_URL not set - automated due reminders disabled (manual trigger still available)');
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
      console.log(`[Queue] due-reminders completed - scanned ${job.returnvalue?.scanned ?? 0}, reminded ${job.returnvalue?.reminded ?? 0}`);
    });
    worker.on('failed', (job, err) => {
      console.error(`[Queue] due-reminders failed: ${err instanceof Error ? err.message : err}`);
    });

    console.log(`[Queue] Automated due reminders scheduled (${CRON}, ${process.env.TZ || 'UTC'})`);
  } catch (err) {
    console.error(
      `[Queue] Could not start due reminders (${err instanceof Error ? err.message : err}) - automated job disabled; API unaffected`
    );
  }
}

/** Graceful shutdown - closes the worker and queue so in-flight jobs finish. */
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

// ── Recurring Billing Job (Phase 8, slice 5) ──────────────────────────────
const BILLING_JOB_NAME = 'recurring-billing';
const BILLING_SCHEDULER_ID = 'recurring-billing-scheduler';
const BILLING_DEFAULT_CRON = '0 8 1 * *'; // 08:00 UTC on the 1st of every month
const BILLING_CRON = process.env.RECURRING_BILLING_CRON || BILLING_DEFAULT_CRON;

let billingQueue: Queue | null = null;
let billingWorker: Worker | null = null;

async function processBillingJob(job: Job): Promise<{ created: number; skipped: number; errors: number }> {
  const result = await generateRecurringInvoices();
  return { created: result.created, skipped: result.skipped, errors: result.errors.length };
}

/**
 * Start the scheduled recurring billing job. Safe to call on every boot;
 * if Redis is unavailable the queue simply never activates.
 */
export async function startBillingQueue(): Promise<void> {
  try {
    const conn = getConnection();
    if (!conn) {
      console.log('[Queue] REDIS_URL not set - recurring billing disabled (manual trigger still available)');
      return;
    }

    billingQueue = new Queue(BILLING_JOB_NAME, { connection: conn });
    billingWorker = new Worker(BILLING_JOB_NAME, processBillingJob, { connection: conn });

    await billingQueue.upsertJobScheduler(
      BILLING_SCHEDULER_ID,
      { pattern: BILLING_CRON },
      { name: BILLING_JOB_NAME, data: {} }
    );

    billingWorker.on('completed', (job) => {
      console.log(`[Queue] recurring-billing completed - created ${job.returnvalue?.created ?? 0}, skipped ${job.returnvalue?.skipped ?? 0}, errors ${job.returnvalue?.errors ?? 0}`);
    });
    billingWorker.on('failed', (job, err) => {
      console.error(`[Queue] recurring-billing failed: ${err instanceof Error ? err.message : err}`);
    });

    console.log(`[Queue] Recurring billing scheduled (${BILLING_CRON}, ${process.env.TZ || 'UTC'})`);
  } catch (err) {
    console.error(
      `[Queue] Could not start recurring billing (${err instanceof Error ? err.message : err}) - automated job disabled; API unaffected`
    );
  }
}

/** Graceful shutdown for billing queue. */
export async function stopBillingQueue(): Promise<void> {
  try {
    await billingWorker?.close();
  } catch { /* ignore */ }
  billingWorker = null;
  try {
    await billingQueue?.close();
  } catch { /* ignore */ }
  billingQueue = null;
}

// ── Platform Billing Jobs (Phase 9, ADR 006) ───────────────────────────────
// Monthly generation (societies paying the platform) + daily overdue check.
// Same resilience model: Redis unavailable → queues disabled, API unaffected,
// manual triggers still work via /api/v1/platform-billing/run-*.

const PLATFORM_BILLING_JOB_NAME = 'platform-billing';
const PLATFORM_BILLING_SCHEDULER_ID = 'platform-billing-scheduler';
// 08:00 UTC on the 1st of every month. First real runs should use the manual
// dry-run trigger first (execution rule: don't generate wrong invoices day one).
const PLATFORM_BILLING_DEFAULT_CRON = '0 8 1 * *';
const PLATFORM_BILLING_CRON = process.env.PLATFORM_BILLING_CRON || PLATFORM_BILLING_DEFAULT_CRON;

const PLATFORM_OVERDUE_JOB_NAME = 'platform-overdue';
const PLATFORM_OVERDUE_SCHEDULER_ID = 'platform-overdue-scheduler';
const PLATFORM_OVERDUE_DEFAULT_CRON = '0 9 * * *'; // daily, 09:00 UTC
const PLATFORM_OVERDUE_CRON = process.env.PLATFORM_OVERDUE_CRON || PLATFORM_OVERDUE_DEFAULT_CRON;

let platformBillingQueue: Queue | null = null;
let platformBillingWorker: Worker | null = null;
let platformOverdueQueue: Queue | null = null;
let platformOverdueWorker: Worker | null = null;

async function processPlatformBillingJob(job: Job): Promise<{ created: number; skipped: number }> {
  const result = await generatePlatformInvoices();
  return {
    created: result.created,
    skipped: result.skippedFree + result.skippedExisting,
  };
}

async function processPlatformOverdueJob(job: Job): Promise<{ markedOverdue: number }> {
  const result = await markOverduePlatformInvoices();
  return { markedOverdue: result.markedOverdue };
}

export async function startPlatformBillingQueue(): Promise<void> {
  try {
    const conn = getConnection();
    if (!conn) {
      console.log('[Queue] REDIS_URL not set - platform billing jobs disabled (manual trigger still available)');
      return;
    }

    platformBillingQueue = new Queue(PLATFORM_BILLING_JOB_NAME, { connection: conn });
    platformBillingWorker = new Worker(PLATFORM_BILLING_JOB_NAME, processPlatformBillingJob, { connection: conn });
    await platformBillingQueue.upsertJobScheduler(
      PLATFORM_BILLING_SCHEDULER_ID,
      { pattern: PLATFORM_BILLING_CRON },
      { name: PLATFORM_BILLING_JOB_NAME, data: {} }
    );
    platformBillingWorker.on('completed', (job) => {
      console.log(`[Queue] platform-billing completed - created ${job.returnvalue?.created ?? 0}, skipped ${job.returnvalue?.skipped ?? 0}`);
    });
    platformBillingWorker.on('failed', (_job, err) => {
      console.error(`[Queue] platform-billing failed: ${err instanceof Error ? err.message : err}`);
    });

    platformOverdueQueue = new Queue(PLATFORM_OVERDUE_JOB_NAME, { connection: conn });
    platformOverdueWorker = new Worker(PLATFORM_OVERDUE_JOB_NAME, processPlatformOverdueJob, { connection: conn });
    await platformOverdueQueue.upsertJobScheduler(
      PLATFORM_OVERDUE_SCHEDULER_ID,
      { pattern: PLATFORM_OVERDUE_CRON },
      { name: PLATFORM_OVERDUE_JOB_NAME, data: {} }
    );
    platformOverdueWorker.on('completed', (job) => {
      console.log(`[Queue] platform-overdue completed - markedOverdue ${job.returnvalue?.markedOverdue ?? 0}`);
    });
    platformOverdueWorker.on('failed', (_job, err) => {
      console.error(`[Queue] platform-overdue failed: ${err instanceof Error ? err.message : err}`);
    });

    console.log(`[Queue] Platform billing scheduled (${PLATFORM_BILLING_CRON}); overdue check scheduled (${PLATFORM_OVERDUE_CRON}, ${process.env.TZ || 'UTC'})`);
  } catch (err) {
    console.error(
      `[Queue] Could not start platform billing jobs (${err instanceof Error ? err.message : err}) - automated jobs disabled; API unaffected`
    );
  }
}

export async function stopPlatformBillingQueue(): Promise<void> {
  try { await platformBillingWorker?.close(); } catch { /* ignore */ }
  platformBillingWorker = null;
  try { await platformBillingQueue?.close(); } catch { /* ignore */ }
  platformBillingQueue = null;
  try { await platformOverdueWorker?.close(); } catch { /* ignore */ }
  platformOverdueWorker = null;
  try { await platformOverdueQueue?.close(); } catch { /* ignore */ }
  platformOverdueQueue = null;
}
