export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

const archiveSizeMb = Number(process.env.NEXT_PUBLIC_MAX_ARCHIVE_SIZE_MB || "50");
if (!Number.isSafeInteger(archiveSizeMb) || archiveSizeMb <= 0) {
  throw new Error("NEXT_PUBLIC_MAX_ARCHIVE_SIZE_MB must be a positive whole number.");
}

export const MAX_ARCHIVE_SIZE_BYTES = archiveSizeMb * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 120_000;
