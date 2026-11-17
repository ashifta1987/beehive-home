import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui";

type Variant = "primary" | "secondary" | "honey" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-surface hover:opacity-90",
  secondary: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:bg-surface-2",
  honey: "bg-tag1 text-tag1-ink hover:brightness-95",
  danger: "bg-bad text-on-bad hover:opacity-90",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
};
const SIZE: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[13.5px] rounded-[11px] gap-1.5",
  md: "min-h-11 px-4 text-[14.5px] rounded-[14px] gap-2",
  lg: "min-h-[58px] px-5 text-[16px] rounded-[20px] gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold select-none transition whitespace-nowrap",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2", className)}
      {...props}
    >
      {children}
    </button>
  );
}

