"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";

/** "Delete" that asks first in its own sheet (used by Marketing and Licences). */
export function DeleteButton({
  title,
  body,
  onConfirm,
  success,
  onDone,
}: {
  title: string;
  body: string;
  onConfirm: () => Promise<ActionResult>;
  success: string;
  onDone?: () => void;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();
  return (
    <>
      <Button variant="ghost" size="sm" className="self-start text-bad" onClick={() => setOpen(true)}>
        <Icon name="trash" size={16} />
        {tc("delete")}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(onConfirm, {
                  success,
                  onDone: () => {
                    setOpen(false);
                    onDone?.();
                  },
                })
              }
            >
              {tc("delete")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[15px]">{body}</p>
          <ErrorBox>{error}</ErrorBox>
        </div>
      </Sheet>
    </>
  );
}
