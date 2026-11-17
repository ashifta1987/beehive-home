"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/ui";

const inputBase =
  "w-full rounded-[13px] border-[1.5px] border-transparent bg-surface-2 px-3.5 py-3 text-[16px] text-ink outline-none transition focus:border-accent focus:bg-surface placeholder:text-muted/70";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && !error ? <span className="text-[12px] text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-[12.5px] font-medium text-bad">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(inputBase, "resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputBase, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...props}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    >
      {children}
    </select>
  );
}

/** Labelled field with an input in one go. */
export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={props.id ?? id} className={className}>
      <Input id={props.id ?? id} aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"textarea"> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={props.id ?? id} className={className}>
      <Textarea id={props.id ?? id} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={props.id ?? id} className={className}>
      <Select id={props.id ?? id} {...props}>
        {children}
      </Select>
    </Field>
  );
}

/** Checkbox row, 44 px tall. */
export function CheckRow({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] bg-surface-2 px-3 text-[15px]", className)}>
      <input type="checkbox" className="h-[22px] w-[22px] flex-none accent-[var(--accent)]" {...props} />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
}

/** Single-choice pills (radio group). Controlled. */
export function PillChoice<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  className,
}: {
  label?: ReactNode;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; activeClass?: string }>;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      {label ? <legend className="mb-1.5 text-[12.5px] font-semibold text-muted">{label}</legend> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[14px] font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                active ? (o.activeClass ?? "bg-ink text-surface") : "bg-surface-2 text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** − n + stepper. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-muted">{label}</span>
      <div className="flex items-center justify-between rounded-[14px] bg-surface-2 p-1">
        <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
          className="h-10 w-10 rounded-[11px] bg-surface text-[20px] leading-10">−</button>
        <span className="tabular text-[18px] font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
          className="h-10 w-10 rounded-[11px] bg-surface text-[20px] leading-10">+</button>
      </div>
    </div>
  );
}

/** On/off switch row. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  name,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  name?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-3 py-2">
      <span className="flex flex-col">
        <span className="text-[14.5px] font-medium">{label}</span>
        {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
      </span>
      <input type="checkbox" role="switch" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={cn("relative h-7 w-12 flex-none rounded-full transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent", checked ? "bg-ok" : "bg-line")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all", checked ? "left-6" : "left-1")} />
      </span>
    </label>
  );
}

