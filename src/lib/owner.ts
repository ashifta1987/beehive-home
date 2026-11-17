import "server-only";

/** Emails (from OWNER_EMAILS) that become the owner on first sign-in. */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
