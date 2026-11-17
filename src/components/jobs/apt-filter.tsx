import Link from "next/link";
import type { Apartment } from "@/lib/types";
import { AptSquare } from "@/components/ui/pill";
import { cn } from "@/lib/ui";

/** Chip links that filter a page by apartment (?apt=). Works in server components. */
export function AptFilter({
  basePath,
  apartments,
  current,
  allLabel,
  label,
  extra,
}: {
  basePath: string;
  apartments: Array<Pick<Apartment, "id" | "code" | "tag_colour">>;
  current: string | null;
  allLabel: string;
  label: string;
  /** other query params to keep */
  extra?: Record<string, string | undefined>;
}) {
  const href = (apt: string | null) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(extra ?? {})) if (v) p.set(k, v);
    if (apt) p.set("apt", apt);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition",
      active ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-surface-2",
    );
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      <Link href={href(null)} className={chip(!current)} aria-current={!current ? "page" : undefined}>
        {allLabel}
      </Link>
      {apartments.map((a) => (
        <Link key={a.id} href={href(a.id)} className={chip(current === a.id)} aria-current={current === a.id ? "page" : undefined}>
          <AptSquare tag={a.tag_colour} />
          {a.code}
        </Link>
      ))}
    </nav>
  );
}

/** Generic chip links for a status filter (?show=). */
export function FilterChips<T extends string>({
  basePath,
  param,
  options,
  current,
  label,
  extra,
}: {
  basePath: string;
  param: string;
  options: Array<{ value: T; label: string; count?: number }>;
  current: T;
  label: string;
  extra?: Record<string, string | undefined>;
}) {
  const href = (v: T) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(extra ?? {})) if (val) p.set(k, val);
    p.set(param, v);
    return `${basePath}?${p.toString()}`;
  };
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          aria-current={current === o.value ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition",
            current === o.value ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-surface-2",
          )}
        >
          {o.label}
          {o.count != null ? <span className="tabular text-[12.5px] opacity-75">{o.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
