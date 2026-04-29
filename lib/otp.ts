import { createHash, randomInt } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOTP(code: string, phone: string): string {
  // Salt with phone so codes can't be replayed across numbers
  return createHash("sha256").update(`${phone}|${code}`).digest("hex");
}

export function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}
