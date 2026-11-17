"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-[24px] bg-surface p-6">
      <p className="font-display text-[17px] font-bold">{t("errorTitle")}</p>
      <p className="text-[14px] text-muted">{t("errorGeneric")}</p>
      <Button onClick={reset}>{t("errorRetry")}</Button>
    </div>
  );
}
