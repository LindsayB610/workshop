export const updateScheduleStorageKey = "workshop.updateSchedule.v1";
export const automaticUpdateCheckIntervalMs = 24 * 60 * 60 * 1000;

export type UpdateScheduleRecord = {
  version: 1;
  lastAttemptAt: number;
  lastSuccessfulCheckAt?: number;
};

export function resolveUpdateSchedule(value: unknown): UpdateScheduleRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<UpdateScheduleRecord>;
  if (record.version !== 1 || !isTimestamp(record.lastAttemptAt)) return null;
  if (record.lastSuccessfulCheckAt !== undefined && !isTimestamp(record.lastSuccessfulCheckAt)) return null;
  return { version: 1, lastAttemptAt: record.lastAttemptAt, ...(record.lastSuccessfulCheckAt === undefined ? {} : { lastSuccessfulCheckAt: record.lastSuccessfulCheckAt }) };
}

export function shouldRunAutomaticUpdateCheck(record: UpdateScheduleRecord | null, now: number): boolean {
  return !record || record.lastAttemptAt > now || now - record.lastAttemptAt >= automaticUpdateCheckIntervalMs;
}

export function delayUntilAutomaticUpdateCheck(record: UpdateScheduleRecord | null, now: number): number {
  if (!record || shouldRunAutomaticUpdateCheck(record, now)) return 0;
  return automaticUpdateCheckIntervalMs - (now - record.lastAttemptAt);
}

export function recordUpdateCheckAttempt(previous: UpdateScheduleRecord | null, now: number, successful: boolean): UpdateScheduleRecord {
  return {
    version: 1,
    lastAttemptAt: now,
    ...(successful ? { lastSuccessfulCheckAt: now } : previous?.lastSuccessfulCheckAt === undefined ? {} : { lastSuccessfulCheckAt: previous.lastSuccessfulCheckAt }),
  };
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
