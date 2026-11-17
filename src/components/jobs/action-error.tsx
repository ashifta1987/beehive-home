"use client";

import { useTranslations } from "next-intl";
import { ErrorBox } from "@/components/ui/card";

const GENERIC = "We could not save that. Check your connection and try again.";
const OFFLINE = "We could not reach the server. Check your connection and try again.";
const NOT_ALLOWED = "You do not have permission to do that.";

/**
 * Turns a server-action error into the user's language. The work module's actions throw
 * UserError("errors.<key>") with keys from messages/<locale>/jobs.json; the shared
 * generic messages map to the common namespace. Anything else is shown as it came.
 */
export function useErrorText() {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  return (e: string | null | undefined): string | null => {
    if (!e) return null;
    if (e.startsWith("errors.") && t.has(e)) return t(e);
    if (e === GENERIC || e === OFFLINE) return tc("errorGeneric");
    if (e === NOT_ALLOWED) return tc("notAllowed");
    return e;
  };
}

export function ActionError({ error }: { error: string | null | undefined }) {
  const text = useErrorText()(error);
  return <ErrorBox>{text}</ErrorBox>;
}
