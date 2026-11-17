import { getLocale, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { daysBetween, fmtDate, fmtStamp, todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Asset, Issue, Task } from "@/lib/types";
import { Card, CardTitle, EmptyState, ErrorBox, PageHeader, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, Pill } from "@/components/ui/pill";
import { AptFilter, FilterChips } from "@/components/jobs/apt-filter";
import { intlLocale } from "@/components/jobs/constants";
import { AssetFormButton, DeleteAssetButton } from "./assets-client";

type Group = "room" | "category";
type CheckRow = Pick<Task, "id" | "apartment_id" | "guest_first_name" | "date" | "inventory_at" | "missing_count">;

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ apt?: string; group?: string }> }) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [t, locale, sp, apartments] = await Promise.all([getTranslations("assets"), getLocale(), searchParams, getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const apts = aptMap(apartments);
  const aptFilter = sp.apt && apts[sp.apt] ? sp.apt : null;
  const group: Group = sp.group === "category" ? "category" : "room";

  const supabase = await createClient();
  let assetsQ = supabase.from("beehive_assets").select("*").order("name");
  if (aptFilter) assetsQ = assetsQ.eq("apartment_id", aptFilter);
  let missingQ = supabase
    .from("beehive_issues")
    .select("id, apartment_id, status, text, created_at, guest_name")
    .eq("category", "missing")
    .order("created_at", { ascending: false })
    .limit(6);
  if (aptFilter) missingQ = missingQ.eq("apartment_id", aptFilter);
  let checksQ = supabase
    .from("beehive_tasks")
    .select("id, apartment_id, guest_first_name, date, inventory_at, missing_count")
    .not("inventory_at", "is", null)
    .order("inventory_at", { ascending: false })
    .limit(8);
  if (aptFilter) checksQ = checksQ.eq("apartment_id", aptFilter);

  const [assetsRes, missingRes, checksRes] = await Promise.all([assetsQ, missingQ, checksQ]);
  const assets = (assetsRes.data ?? []) as Asset[];
  const missing = (missingRes.data ?? []) as Array<Pick<Issue, "id" | "apartment_id" | "status" | "text" | "created_at" | "guest_name">>;
  const checks = (checksRes.data ?? []) as CheckRow[];

  const value = assets.reduce((s, a) => s + (a.value ?? 0) * a.qty, 0);
  const counted = assets.filter((a) => a.count_on_checkout);
  const warrantySoon = assets.filter((a) => a.warranty_until && a.warranty_until >= today && daysBetween(today, a.warranty_until) <= 60).length;
  const rooms = [...new Set(assets.map((a) => a.room).filter((r): r is string => !!r))].sort();
  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name }));
  const shownApts = apartments.filter((a) => !aptFilter || a.id === aptFilter);

  const groupKey = (a: Asset) => (group === "room" ? (a.room?.trim() || "") : a.category);
  const groupLabel = (k: string) => (group === "room" ? k || t("noRoom") : t(`category.${k}`));

  const warrantyPill = (a: Asset) => {
    if (!a.warranty_until) return null;
    if (a.warranty_until < today) return <Pill>{t("warrantyEnded", { date: fmtDate(a.warranty_until, loc) })}</Pill>;
    const soon = daysBetween(today, a.warranty_until) <= 60;
    return <Pill tone={soon ? "warn" : "ok"}>{t("warrantyUntil", { date: fmtDate(a.warranty_until, loc) })}</Pill>;
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={apartments.length ? <AssetFormButton apartments={aptOptions} defaultApt={aptFilter} rooms={rooms} /> : null}
      />

      <div className="flex flex-col gap-2">
        {apartments.length > 1 ? (
          <AptFilter basePath="/assets" apartments={apartments} current={aptFilter} allLabel={t("allApartments")} label={t("filterLabel")}
            extra={{ group: group === "category" ? "category" : undefined }} />
        ) : null}
        {assets.length ? (
          <FilterChips
            basePath="/assets"
            param="group"
            current={group}
            label={t("groupLabel")}
            extra={{ apt: aptFilter ?? undefined }}
            options={[
              { value: "room", label: t("group.room") },
              { value: "category", label: t("group.category") },
            ]}
          />
        ) : null}
      </div>

      {assetsRes.error ? <ErrorBox>{t("loadError")}</ErrorBox> : null}

      {assets.length ? (
        <Card className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4">
          <Stat label={t("stat.items")} value={assets.length} />
          <Stat label={t("stat.counted")} value={counted.length} />
          <Stat label={t("stat.value")} value={inr(value)} />
          <Stat label={t("stat.warranty")} value={warrantySoon} tone={warrantySoon ? "warn" : undefined} />
        </Card>
      ) : null}

      {!assetsRes.error && assets.length === 0 ? (
        <EmptyState
          icon={<Icon name="box" size={32} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={apartments.length ? <AssetFormButton apartments={aptOptions} defaultApt={aptFilter} rooms={rooms} /> : null}
        />
      ) : null}

      {assets.length
        ? shownApts.map((apt) => {
            const list = assets.filter((a) => a.apartment_id === apt.id);
            const aptValue = list.reduce((s, a) => s + (a.value ?? 0) * a.qty, 0);
            const groups = new Map<string, Asset[]>();
            for (const a of list) {
              const k = groupKey(a);
              groups.set(k, [...(groups.get(k) ?? []), a]);
            }
            const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : groupLabel(a).localeCompare(groupLabel(b))));
            return (
              <Card key={apt.id}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <AptChip tag={apt.tag_colour} code={apt.code} />
                  <h2 className="font-display text-[14px] font-bold">{apt.name}</h2>
                  <span className="tabular text-[12.5px] text-muted">
                    {t("aptSummary", { count: list.length, value: inr(aptValue) })}
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="text-[14px] text-muted">{t("noItemsApt")}</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {keys.map((k) => (
                      <section key={k || "none"} aria-label={groupLabel(k)}>
                        <h3 className="mb-1.5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">{groupLabel(k)}</h3>
                        <ul className="flex flex-col gap-1.5">
                          {groups.get(k)!.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-surface-2 px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-semibold">
                                  {a.name} <span className="tabular font-normal text-muted">× {a.qty}</span>
                                </p>
                                <p className="text-[12.5px] text-muted">
                                  {[
                                    group === "room" ? t(`category.${a.category}`) : a.room,
                                    a.value ? t("valueEach", { each: inr(a.value), total: inr(a.value * a.qty) }) : null,
                                    a.serial ? t("serial", { serial: a.serial }) : null,
                                    a.purchased ? t("bought", { date: fmtDate(a.purchased, loc) }) : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {a.note ? <p className="whitespace-pre-line text-[13px]">{a.note}</p> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {a.count_on_checkout ? <Pill tone="info">{t("countedPill")}</Pill> : null}
                                {warrantyPill(a)}
                                <AssetFormButton asset={a} apartments={aptOptions} rooms={rooms} />
                                {isOwner ? <DeleteAssetButton asset={a} /> : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        : null}

      {/* Theft control */}
      <Card>
        <CardTitle>{t("theft.title")}</CardTitle>
        <p className="mb-4 text-[14px] text-muted">{t("theft.intro")}</p>
        <div className="grid gap-5 min-[960px]:grid-cols-3">
          <section aria-labelledby="theft-counted">
            <h3 id="theft-counted" className="mb-2 text-[13px] font-bold">{t("theft.counted")}</h3>
            {counted.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {counted.map((a) => {
                  const apt = apts[a.apartment_id];
                  return (
                    <li key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold">
                      {!aptFilter && apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : null}
                      {a.name} <span className="tabular text-muted">{a.qty}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">{t("theft.noCounted")}</p>
            )}
          </section>
          <section aria-labelledby="theft-missing">
            <h3 id="theft-missing" className="mb-2 text-[13px] font-bold">{t("theft.missing")}</h3>
            {missingRes.error ? (
              <p className="text-[14px] text-bad">{t("loadError")}</p>
            ) : missing.length ? (
              <ul className="flex flex-col gap-2">
                {missing.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1 rounded-[14px] bg-surface-2 px-3 py-2 text-[13.5px]">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {i.status === "resolved" ? <Pill tone="ok">{t("theft.resolved")}</Pill> : <Pill tone="bad">{t("theft.open")}</Pill>}
                      <span className="text-[12px] text-muted">{fmtStamp(i.created_at)}</span>
                    </span>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">{t("theft.noneMissing")}</p>
            )}
          </section>
          <section aria-labelledby="theft-checks">
            <h3 id="theft-checks" className="mb-2 text-[13px] font-bold">{t("theft.checks")}</h3>
            {checks.length ? (
              <ul className="flex flex-col gap-2">
                {checks.map((c) => {
                  const apt = apts[c.apartment_id];
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-1.5 rounded-[14px] bg-surface-2 px-3 py-2 text-[13.5px]">
                      {c.missing_count ? (
                        <Pill tone="bad">{t("theft.missingCount", { count: c.missing_count })}</Pill>
                      ) : (
                        <Pill tone="ok">{t("theft.complete")}</Pill>
                      )}
                      {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : null}
                      <span>{c.guest_first_name || t("theft.guest")}</span>
                      <span className="text-[12px] text-muted">· {fmtStamp(c.inventory_at)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">{t("theft.noChecks")}</p>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
