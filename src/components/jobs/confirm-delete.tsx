"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions";
import { ActionError } from "./action-error";

/** "Delete" button that asks first, in a sheet. Shared by the work module pages. */
export function ConfirmDelete({
  title,
  body,
  onConfirm,
  label,
  success,
  size = "sm",
  children,
}: {
  title: string;
  body: string;
  onConfirm: () => Promise<ActionResult<unknown>>;
  label?: string;
  success?: string;
  size?: "sm" | "md";
  children?: ReactNode;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();
  return (
    <>
      <Button size={size} variant="ghost" className="text-bad" onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <Icon name="trash" size={16} /> {label ?? tc("delete")}
          </>
        )}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button variant="danger" disabled={pending} onClick={() => run(onConfirm, { success, onDone: () => setOpen(false) })}>
              {tc("delete")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[15px]">{body}</p>
          <ActionError error={error} />
        </div>
      </Sheet>
    </>
  );
}

/** Collect a form's fields into a plain object for a server action. */
export function formObject(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

/** Stable id for a sheet's form so the footer submit button can target it. */
export function useFormId() {
  return useId();
}
