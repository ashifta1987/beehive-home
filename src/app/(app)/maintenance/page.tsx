import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { fmtStamp } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Booking, Issue } from "@/lib/types";
import { EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, Pill } from "@/components/ui/pill";
import { FilterChips } from "@/components/jobs/apt-filter";
import { CHARGE_NAME } from "@/components/jobs/constants";
import {
  DeleteIssueButton,
  IssueFormButton,
  ReopenIssueButton,
  ResolveButton,
  type ChargeInfo,
} from "./maintenance-client";

type Show = "open" | "resolved" | "all";
const PRIORITY_RANK = { urgent: 0, normal: 1, low: 2 } as const;

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; new?: string; apt?: string }>;
}) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [t, tc, sp, apartments] = await Promise.all([
    getTranslations("maintenance"),
    getTranslations("common"),
    searchParams,
    getApartments(),
  ]);
  const apts = aptMap(apartments);
  const show: Show = sp.show === "resolved" || sp.show === "all" ? sp.show : "open";
  const autoOpen = sp.new === "1";
  const defaultApt = sp.apt && apts[sp.apt] ? sp.apt : null;

  const supabase = await createClient();
  const [issuesRes, staffRes] = await Promise.all([
    supabase.from("beehive_issues").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("beehive_staff").select("user_id, name, email"),
  ]);
  const all = (issuesRes.data ?? []) as Issue[];
  const names = new Map(
    ((staffRes.data ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>).map((s) => [
      s.user_id,
      s.user_id === session.userId ? t("you") : (s.name ?? s.email ?? null),
    ]),
  );

  // Owner only: booking facts for issues that can be charged to the guest.
  // Housekeepers never query bookings (RLS would return nothing anyway).
  const charges = new Map<string, ChargeInfo>();
  if (isOwner) {
    const ids = [
      ...new Set(all.filter((i) => i.status === "open" && i.booking_id && CHARGE_NAME[i.category]).map((i) => i.booking_id as string)),
    ];
    if (ids.length) {
      const { data } = await supabase.from("beehive_bookings").select("id, guest_name, deposit, deposit_status").in("id", ids);
      for (const b of (data ?? []) as Array<Pick<Booking, "id" | "guest_name" | "deposit" | "deposit_status">>) {
        charges.set(b.id, { guest_name: b.guest_name, deposit: b.deposit, deposit_status: b.deposit_status });
      }
    }
  }

  const open = all
    .filter((i) => i.status === "open")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.created_at.localeCompare(a.created_at));
  const resolved = all
    .filter((i) => i.status === "resolved")
    .sort((a, b) => (b.resolved_at ?? b.created_at).localeCompare(a.resolved_at ?? a.created_at));
  const rows = show === "open" ? open : show === "resolved" ? resolved : [...open, ...resolved];
  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<IssueFormButton apartments={aptOptions} defaultApt={defaultApt} autoOpen={autoOpen} />}
      />

      {issuesRes.error ? <ErrorBox>{t("loadError")}</ErrorBox> : null}

      {all.length ? (
        <FilterChips
          basePath="/maintenance"
          param="show"
          current={show}
          label={t("filterLabel")}
          options={[
            { value: "open", label: t("filter.open"), count: open.length },
            { value: "resolved", label: t("filter.resolved"), count: resolved.length },
            { value: "all", label: t("filter.all"), count: all.length },
          ]}
        />
      ) : null}

      {!issuesRes.error && all.length === 0 ? (
        <EmptyState icon={<Icon name="wrench" size={32} />} title={t("empty.title")} body={t("empty.body")} />
      ) : null}

      {all.length > 0 && rows.length === 0 ? (
        <p className="rounded-[24px] bg-surface px-4 py-6 text-center text-[14px] text-muted">
          {show === "open" ? t("noneOpen") : t("noneResolved")}
        </p>
      ) : null}

      {rows.length ? (
        <ul className="grid gap-3 min-[960px]:grid-cols-2 min-[960px]:items-start">
          {rows.map((i) => {
            const apt = i.apartment_id ? apts[i.apartment_id] : null;
            const own = i.reported_by === session.userId;
            const charge = i.booking_id ? (charges.get(i.booking_id) ?? null) : null;
            const reporter = i.reported_by ? names.get(i.reported_by) : null;
            const resolver = i.resolved_by ? names.get(i.resolved_by) : null;
            return (
              <li key={i.id} className="flex flex-col gap-2 rounded-[24px] bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={i.category === "missing" || i.category === "damage" ? "bad" : i.category === "mess" ? "warn" : "neutral"}>
                    {t(`category.${i.category}`)}
                  </Pill>
                  {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill>{tc("both")}</Pill>}
                  {i.priority === "urgent" ? <Pill tone="bad">{t("priority.urgent")}</Pill> : null}
                  {i.priority === "low" ? <Pill>{t("priority.low")}</Pill> : null}
                  {i.status === "resolved" ? <Pill tone="ok">{t("resolvedPill")}</Pill> : null}
                </div>
                <p className="whitespace-pre-line text-[15px]">{i.text}</p>
                {i.guest_name || i.extra_hours ? (
                  <p className="text-[13px]">
                    {i.guest_name ? t("guest", { name: i.guest_name }) : null}
                    {i.guest_name && i.extra_hours ? " · " : null}
                    {i.extra_hours ? t("extraHours", { hours: Number(i.extra_hours) }) : null}
                  </p>
                ) : null}
                <p className="text-[12.5px] text-muted">
                  {reporter ? t("reportedBy", { when: fmtStamp(i.created_at), who: reporter }) : t("reported", { when: fmtStamp(i.created_at) })}
                </p>
                {i.status === "resolved" ? (
                  <p className="rounded-[14px] bg-ok-soft px-3 py-2 text-[13.5px] text-ok">
                    {resolver ? t("resolvedBy", { when: fmtStamp(i.resolved_at), who: resolver }) : t("resolvedAt", { when: fmtStamp(i.resolved_at) })}
                    {i.resolution ? `: ${i.resolution}` : ""}
                    {/* Repair costs are owner-only money. */}
                    {i.cost && isOwner ? <span className="tabular"> · {inr(i.cost)}</span> : null}
                  </p>
                ) : null}
                {isOwner && i.status === "open" && charge && CHARGE_NAME[i.category] ? (
                  <p className="text-[13px] font-semibold text-warn">{t("decideCharge", { guest: charge.guest_name })}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && i.status === "open" ? <ResolveButton issue={i} charge={charge} /> : null}
                  {isOwner && i.status === "resolved" ? <ReopenIssueButton id={i.id} /> : null}
                  {isOwner || (own && i.status === "open") ? <IssueFormButton issue={i} apartments={aptOptions} /> : null}
                  {isOwner ? <DeleteIssueButton id={i.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
