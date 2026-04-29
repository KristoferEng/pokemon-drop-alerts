import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";

export type PhoneParseResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

export function parseUSPhone(input: string): PhoneParseResult {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Phone number required" };
  }
  const trimmed = input.trim();
  if (!isValidPhoneNumber(trimmed, "US")) {
    return { ok: false, error: "Please enter a valid US phone number" };
  }
  const parsed = parsePhoneNumberFromString(trimmed, "US");
  if (!parsed || parsed.country !== "US") {
    return { ok: false, error: "US phone numbers only" };
  }
  return { ok: true, e164: parsed.number };
}
