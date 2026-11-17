"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { rotateDoorKey } from "./actions";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="honey" onClick={() => window.print()}>
      <Icon name="print" size={18} /> {label}
    </Button>
  );
}

export function RotateKey({ apartmentId, code, hasKey }: { apartmentId: string; code: string; hasKey: boolean }) {
  const t = useTranslations("posters");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { run, pending, error, setError } = useAction();

  const confirm = () =>
    run(() => rotateDoorKey(apartmentId), {
      onDone: () => {
        setOpen(false);
        setDone(true);
      },
    });

  if (!hasKey) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={confirm} disabled={pending}>
          <Icon name="key" size={18} /> {pending ? t("working") : t("createKey")}
        </Button>
        <ErrorBox>{error}</ErrorBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="secondary" onClick={() => { setError(null); setOpen(true); }}>
        <Icon name="refresh" size={18} /> {t("rotate")}
      </Button>
      {done ? <p role="status" className="text-[13px] font-semibold text-ok">{t("rotated")}</p> : null}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("rotateTitle", { code })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>{t("cancel")}</Button>
            <Button variant="danger" onClick={confirm} disabled={pending}>{pending ? t("working") : t("rotateConfirm")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[14.5px]">
          <p>{t("rotateBody")}</p>
          <ErrorBox>{error}</ErrorBox>
        </div>
      </Sheet>
    </div>
  );
}
