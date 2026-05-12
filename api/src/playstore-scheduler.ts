import { inspect } from "node:util";

import schedule from "node-schedule";

import {
  playstorePackageName,
  playstoreRawDir,
  runPlaystoreReportDownload,
} from "./services/playstore/download-reports.ts";
import { runPlaystoreIngest } from "./services/playstore/ingest-csv.ts";

const LOG = "[playstore-scheduler]";

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

  const cronExpr = process.env.PLAYSTORE_DOWNLOAD_CRON?.trim();
  if (!cronExpr) {
    console.warn(
      `${LOG} PLAYSTORE_DOWNLOAD_SCHEDULE_ENABLED is set but PLAYSTORE_DOWNLOAD_CRON is missing; scheduler not started. Set it in env (see .env.example).`,
    );
    return;
  }

  const tz = process.env.PLAYSTORE_DOWNLOAD_TZ?.trim();
  if (!tz) {
    console.warn(
      `${LOG} PLAYSTORE_DOWNLOAD_TZ unset; cron runs in the server's local timezone. Set PLAYSTORE_DOWNLOAD_TZ for wall-clock zones (e.g. Asia/Kolkata).`,
    );
  }

  const job = tz
    ? schedule.scheduleJob({ rule: cronExpr, tz }, () => void runScheduledDownload())
    : schedule.scheduleJob(cronExpr, () => void runScheduledDownload());

  if (!job) {
    console.error(`${LOG} Invalid cron expression: ${cronExpr}`);
    return;
  }

  const next =
    typeof job.nextInvocation === "function" ? job.nextInvocation() : null;
  const nextHint =
    next instanceof Date && !Number.isNaN(next.getTime())
      ? ` Next run: ${next.toISOString()} (${tz ?? "server local"}).`
      : "";

  console.log(
    `${LOG} Registered: cron "${cronExpr}"${tz ? ` in ${tz}` : " (server local)"}.${nextHint} Play bulk report download.`,
  );
}

async function runScheduledDownload(): Promise<void> {
  try {
    await runPlaystoreReportDownload();
    await runPlaystoreIngest(playstoreRawDir(), playstorePackageName());
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
