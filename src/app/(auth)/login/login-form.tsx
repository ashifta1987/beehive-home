"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendMagicLink, type LoginState } from "../actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { ErrorBox } from "@/components/ui/card";

export function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-[24px] bg-surface p-6 text-center">
        <p className="font-display text-[17px] font-bold">✉️</p>
        <p className="mt-2 text-[15px]">{t("sent")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-[24px] bg-surface p-5">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-1 text-[14px] text-muted">{t("subtitle")}</p>
      </div>
      {expired ? <ErrorBox>{t("linkExpired")}</ErrorBox> : null}
      <input type="hidden" name="next" value={next} />
      <TextField label={t("email")} name="email" type="email" autoComplete="email" inputMode="email" required
        error={state.status === "error" && state.error ? t(state.error as "failed") : null} />
      <Button type="submit" size="lg" disabled={pending}>{pending ? t("sending") : t("send")}</Button>
    </form>
  );
}
