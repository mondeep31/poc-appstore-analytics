import { inspect } from "node:util";

import schedule from "node-schedule";

import { runPlaystoreReportDownload } from "./services/playstore/download-reports.ts";

const LOG = "[playstore-scheduler]";

/** Default: 6:05 PM IST daily (minute hour dom month dow). */
const DEFAULT_CRON = "5 18 * * *";
/** India Standard Time — matches Play Console-friendly reporting cadence for Indian ops. */
const DEFAULT_TZ = "Asia/Kolkata";

function hasPlaystoreCredentials(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
}

function isScheduleEnabled(): boolean {
  const v =
    process.env.PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Registers an in-process cron (node-schedule) to mirror Play bulk reports.
 * Call once at API startup. Use only on a single instance to avoid duplicate downloads.
 */
export function startPlaystoreDownloadScheduler(): void {
  if (!isScheduleEnabled()) {
    console.info(
      `${LOG} Disabled — set PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED=true (and bucket + GOOGLE_APPLICATION_CREDENTIALS) to enable daily GCS mirror.`,
    );
    return;
  }

  if (!process.env.PLAYSTORE_GCS_BUCKET?.trim()) {
    console.warn(
      `${LOG} PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED is set but PLAYSTORE_GCS_BUCKET is missing; scheduler not started.`,
    );
    return;
  }

  if (!hasPlaystoreCredentials()) {
    console.warn(
      `${LOG} PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED is set but GOOGLE_APPLICATION_CREDENTIALS is missing; scheduler not started.`,
    );
    return;
  }

  const cronExpr = process.env.PLAYSTORE_DOWNLOAD_CRON?.trim() || DEFAULT_CRON;
  const tz = process.env.PLAYSTORE_DOWNLOAD_TZ?.trim() || DEFAULT_TZ;

  const job = schedule.scheduleJob(
    { rule: cronExpr, tz },
    () => void runScheduledDownload(),
  );

  if (!job) {
    console.error(`${LOG} Invalid cron expression: ${cronExpr}`);
    return;
  }

  const next =
    typeof job.nextInvocation === "function" ? job.nextInvocation() : null;
  const nextHint =
    next instanceof Date && !Number.isNaN(next.getTime())
      ? ` Next run: ${next.toISOString()} (${tz}).`
      : "";

  console.log(
    `${LOG} Registered: cron "${cronExpr}" in ${tz}.${nextHint} Play bulk report download.`,
  );
}

async function runScheduledDownload(): Promise<void> {
  try {
    await runPlaystoreReportDownload();
  } catch (err) {
    console.error(`${LOG} Scheduled run failed`);
    console.error(
      inspect(err, {
        depth: 8,
        maxArrayLength: 20,
        breakLength: 120,
        getters: true,
      }),
    );
  }
}
