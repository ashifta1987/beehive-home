"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Apartment, TagColour } from "@/lib/types";
import { fmtTime } from "@/lib/dates";
import { cn, tagClasses } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, ErrorBox } from "@/components/ui/card";
import { Field, Input, TextField, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { saveApartment } from "./actions";

const TAGS: TagColour[] = ["tag1", "tag2", "tag3", "tag4"];
const PLACEHOLDERS = ["guest", "apartment", "checkin", "checkout", "checkinTime", "checkoutTime", "nights", "guests", "extras"] as const;

type Section = "details" | "cleaning" | "arrival" | "rules" | "welcome" | "hk";

// ---------------------------------------------------------------------------
// Key tag
// ---------------------------------------------------------------------------
export function KeyTag({ apartment: a, children }: { apartment: Apartment; children?: ReactNode }) {
  const t = useTranslations("apartments");
  const c = tagClasses(a.tag_colour);
  return (
    <article className="overflow-hidden rounded-[26px] bg-surface shadow-tag">
      <div className={cn("flex flex-col gap-2 px-5 pb-5 pt-4", c.bg, c.text)}>
        <span aria-hidden className="tag-hole self-center" />
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.04em]">{a.code}</span>
            <span className="mt-1 text-[14px] font-semibold">{a.name}</span>
            {a.location ? <span className="text-[12.5px] opacity-85">{a.location}</span> : null}
          </div>
        </div>
        {a.features.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={t("features")}>
            {a.features.map((f, i) => (
              <li key={i} className="rounded-full bg-surface/25 px-2.5 py-1 text-[12px] font-semibold shadow-[inset_0_0_0_1px_currentColor]">
                {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <dl className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
          <Fact label={t("bedrooms")} value={a.bedrooms ?? t("notSet")} />
          <Fact label={t("maxGuests")} value={a.max_guests ?? t("notSet")} />
          <Fact label={t("checkIn")} value={fmtTime(a.check_in_time)} />
          <Fact label={t("checkOut")} value={fmtTime(a.check_out_time)} />
        </dl>
        {children}
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col rounded-[14px] bg-surface-2 px-3 py-2.5">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="tabular text-[15px] font-bold">{value}</dd>
    </div>
  );
}

function WifiBox({ apartment: a }: { apartment: Apartment }) {
  const t = useTranslations("apartments");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!a.wifi_password) return;
    try {
      await navigator.clipboard.writeText(a.wifi_password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the password is on screen
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-3 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="text-[11.5px] text-muted">{t("wifiName")}</span>
        <span className="break-all text-[14.5px] font-semibold">{a.wifi_name || t("notSet")}</span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11.5px] text-muted">{t("wifiPassword")}</span>
        <span className="break-all text-[14.5px] font-semibold">{a.wifi_password || t("notSet")}</span>
      </span>
      {a.wifi_password ? (
        <button type="button" onClick={copy} className="min-h-11 px-1 text-[13px] font-bold text-accent" aria-live="polite">
          {copied ? t("copied") : t("copy")}
        </button>
      ) : null}
    </div>
  );
}

function NumberedList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-[14px] text-muted">{empty}</p>;
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex min-h-11 items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2 text-[14.5px]">
          <span className="tabular w-5 flex-none text-right text-[13px] font-bold text-muted">{i + 1}</span>
          <span className="min-w-0 flex-1">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function SectionCard({ title, onEdit, children, hint }: { title: string; onEdit?: () => void; children: ReactNode; hint?: string }) {
  const t = useTranslations("apartments");
  return (
    <Card>
      <CardTitle
        action={
          onEdit ? (
            <Button size="sm" variant="secondary" onClick={onEdit} aria-label={`${t("edit")}: ${title}`}>
              <Icon name="edit" size={15} /> {t("edit")}
            </Button>
          ) : null
        }
      >
        {title}
      </CardTitle>
      {hint ? <p className="-mt-2 mb-3 text-[12.5px] text-muted">{hint}</p> : null}
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Housekeeper: read only
// ---------------------------------------------------------------------------
export function HousekeeperApartment({ apartment: a }: { apartment: Apartment }) {
  const t = useTranslations("apartments");
  return (
    <div className="flex flex-col gap-3">
      <KeyTag apartment={a}>
        <WifiBox apartment={a} />
      </KeyTag>
      <SectionCard title={t("hkNotes")}>
        {a.hk_notes ? <p className="whitespace-pre-wrap text-[14.5px]">{a.hk_notes}</p> : <p className="text-[14px] text-muted">{t("noNotes")}</p>}
      </SectionCard>
      <SectionCard title={t("cleaning")}>
        <NumberedList items={a.cleaning_checklist} empty={t("emptyListRead")} />
      </SectionCard>
      <SectionCard title={t("arrival")}>
        <NumberedList items={a.arrival_checklist} empty={t("emptyListRead")} />
      </SectionCard>
      <SectionCard title={t("rules")}>
        <NumberedList items={a.house_rules} empty={t("emptyListRead")} />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner: view + edit sheets
// ---------------------------------------------------------------------------
export function OwnerApartment({ apartment: a }: { apartment: Apartment }) {
  const t = useTranslations("apartments");
  const [section, setSection] = useState<Section | null>(null);
  const close = () => setSection(null);
  return (
    <div className="flex flex-col gap-3">
      <KeyTag apartment={a}>
        <WifiBox apartment={a} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setSection("details")}>
            <Icon name="edit" size={17} /> {t("editDetails")}
          </Button>
          <Button variant="secondary" onClick={() => setSection("hk")}>
            {t("editWifiNotes")}
          </Button>
        </div>
      </KeyTag>
      <SectionCard title={t("cleaning")} onEdit={() => setSection("cleaning")}>
        <NumberedList items={a.cleaning_checklist} empty={t("emptyList")} />
      </SectionCard>
      <SectionCard title={t("arrival")} onEdit={() => setSection("arrival")}>
        <NumberedList items={a.arrival_checklist} empty={t("emptyList")} />
      </SectionCard>
      <SectionCard title={t("rules")} hint={t("rulesHint")} onEdit={() => setSection("rules")}>
        <NumberedList items={a.house_rules} empty={t("emptyList")} />
      </SectionCard>
      <SectionCard title={t("welcome")} onEdit={() => setSection("welcome")}>
        {a.welcome_message ? <p className="whitespace-pre-wrap rounded-[14px] bg-surface-2 p-3 text-[14px]">{a.welcome_message}</p> : <p className="text-[14px] text-muted">{t("noWelcome")}</p>}
      </SectionCard>
      <SectionCard title={t("hkNotes")} onEdit={() => setSection("hk")}>
        {a.hk_notes ? <p className="whitespace-pre-wrap text-[14.5px]">{a.hk_notes}</p> : <p className="text-[14px] text-muted">{t("noNotes")}</p>}
      </SectionCard>

      {section === "details" ? <DetailsSheet apartment={a} onClose={close} /> : null}
      {section === "cleaning" ? <ListSheet apartment={a} field="cleaning_checklist" title={t("cleaning")} max={60} onClose={close} /> : null}
      {section === "arrival" ? <ListSheet apartment={a} field="arrival_checklist" title={t("arrival")} max={40} onClose={close} /> : null}
      {section === "rules" ? <ListSheet apartment={a} field="house_rules" title={t("rules")} hint={t("rulesHint")} max={30} onClose={close} /> : null}
      {section === "welcome" ? <WelcomeSheet apartment={a} onClose={close} /> : null}
      {section === "hk" ? <HkSheet apartment={a} onClose={close} /> : null}
    </div>
  );
}

function SheetFooter({ onClose, onSave, pending }: { onClose: () => void; onSave: () => void; pending: boolean }) {
  const t = useTranslations("apartments");
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
      <Button variant="primary" onClick={onSave} disabled={pending}>{pending ? t("saving") : t("save")}</Button>
    </>
  );
}

/** Editable list of short lines: edit, reorder, remove, add. */
function ListEditor({ items, onChange, max, addLabel, label }: { items: string[]; onChange: (v: string[]) => void; max: number; addLabel: string; label: string }) {
  const t = useTranslations("apartments");
  const [keys, setKeys] = useState(() => items.map((_, i) => i));
  const [nextKey, setNextKey] = useState(items.length);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const it = [...items];
    const ks = [...keys];
    [it[i], it[j]] = [it[j], it[i]];
    [ks[i], ks[j]] = [ks[j], ks[i]];
    setKeys(ks);
    onChange(it);
  };
  const remove = (i: number) => {
    setKeys(keys.filter((_, j) => j !== i));
    onChange(items.filter((_, j) => j !== i));
  };
  const add = () => {
    setKeys([...keys, nextKey]);
    setNextKey(nextKey + 1);
    onChange([...items, ""]);
  };
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      {items.length === 0 ? <p className="text-[14px] text-muted">{t("emptyList")}</p> : null}
      {items.map((it, i) => (
        <div key={keys[i] ?? i} className="flex items-center gap-1.5">
          <span className="tabular w-5 flex-none text-right text-[13px] font-bold text-muted">{i + 1}</span>
          <Input
            value={it}
            maxLength={200}
            aria-label={t("lineN", { n: i + 1 })}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="min-w-0 flex-1 py-2.5 text-[15px]"
          />
          <div className="flex flex-none">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("moveUp", { n: i + 1 })} className="flex h-11 w-11 items-center justify-center rounded-[11px] text-muted hover:bg-surface-2">
              <Icon name="chevron" size={18} className="-rotate-90" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t("moveDown", { n: i + 1 })} className="flex h-11 w-11 items-center justify-center rounded-[11px] text-muted hover:bg-surface-2">
              <Icon name="chevron" size={18} className="rotate-90" />
            </button>
            <button type="button" onClick={() => remove(i)} aria-label={t("removeN", { n: i + 1 })} className="flex h-11 w-11 items-center justify-center rounded-[11px] text-bad hover:bg-bad-soft">
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>
      ))}
      {items.length < max ? (
        <Button variant="secondary" size="sm" onClick={add} className="self-start">
          <Icon name="plus" size={16} /> {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

function DetailsSheet({ apartment: a, onClose }: { apartment: Apartment; onClose: () => void }) {
  const t = useTranslations("apartments");
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState(a.name);
  const [code, setCode] = useState(a.code);
  const [tag, setTag] = useState<TagColour>(a.tag_colour);
  const [location, setLocation] = useState(a.location ?? "");
  const [bedrooms, setBedrooms] = useState(a.bedrooms?.toString() ?? "");
  const [maxGuests, setMaxGuests] = useState(a.max_guests?.toString() ?? "");
  const [features, setFeatures] = useState<string[]>(a.features);
  const [checkIn, setCheckIn] = useState(a.check_in_time.slice(0, 5));
  const [checkOut, setCheckOut] = useState(a.check_out_time.slice(0, 5));

  const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));
  const save = () => {
    if (!name.trim() || !code.trim()) return setError(t("errNameCode"));
    const b = toInt(bedrooms);
    const g = toInt(maxGuests);
    if ((b !== null && (Number.isNaN(b) || b < 0 || b > 20)) || (g !== null && (Number.isNaN(g) || g < 1 || g > 50))) return setError(t("errNumbers"));
    if (!checkIn || !checkOut) return setError(t("errTimes"));
    run(
      () => saveApartment({ id: a.id, name, code, tag_colour: tag, location, bedrooms: b, max_guests: g, features, check_in_time: checkIn, check_out_time: checkOut }),
      { success: t("saved"), onDone: onClose },
    );
  };

  return (
    <Sheet open onClose={onClose} wide title={t("editDetailsTitle", { code: a.code })} footer={<SheetFooter onClose={onClose} onSave={save} pending={pending} />}>
      <div className="grid grid-cols-1 gap-3.5 min-[520px]:grid-cols-2">
        <TextField label={t("name")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        <TextField label={t("code")} hint={t("codeHint")} value={code} maxLength={12} onChange={(e) => setCode(e.target.value)} required />
        <fieldset className="min-[520px]:col-span-2">
          <legend className="mb-1.5 text-[12.5px] font-semibold text-muted">{t("tag")}</legend>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tg) => {
              const c = tagClasses(tg);
              return (
                <label key={tg} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", tag === tg ? "bg-ink text-surface" : "bg-surface-2")}>
                  <input type="radio" name="tag" value={tg} checked={tag === tg} onChange={() => setTag(tg)} className="sr-only" />
                  <span aria-hidden className={cn("h-5 w-5 rounded-full", c.bg)} />
                  {t(`tags.${tg}`)}
                </label>
              );
            })}
          </div>
        </fieldset>
        <TextField className="min-[520px]:col-span-2" label={t("location")} value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} />
        <TextField label={t("bedrooms")} type="number" inputMode="numeric" min={0} max={20} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        <TextField label={t("maxGuests")} hint={t("maxGuestsHint")} type="number" inputMode="numeric" min={1} max={50} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
        <TextField label={t("checkIn")} type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        <TextField label={t("checkOut")} type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
        <Field label={t("features")} className="min-[520px]:col-span-2">
          <ListEditor items={features} onChange={setFeatures} max={30} addLabel={t("addFeature")} label={t("features")} />
        </Field>
        <div className="min-[520px]:col-span-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      </div>
    </Sheet>
  );
}

function ListSheet({
  apartment: a,
  field,
  title,
  hint,
  max,
  onClose,
}: {
  apartment: Apartment;
  field: "cleaning_checklist" | "arrival_checklist" | "house_rules";
  title: string;
  hint?: string;
  max: number;
  onClose: () => void;
}) {
  const t = useTranslations("apartments");
  const { run, pending, error } = useAction();
  const [items, setItems] = useState<string[]>(a[field]);
  const save = () => run(() => saveApartment({ id: a.id, [field]: items }), { success: t("saved"), onDone: onClose });
  return (
    <Sheet open onClose={onClose} wide title={`${title} · ${a.code}`} footer={<SheetFooter onClose={onClose} onSave={save} pending={pending} />}>
      <div className="flex flex-col gap-3">
        {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
        <ListEditor items={items} onChange={setItems} max={max} addLabel={t("addLine")} label={title} />
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}

function WelcomeSheet({ apartment: a, onClose }: { apartment: Apartment; onClose: () => void }) {
  const t = useTranslations("apartments");
  const { run, pending, error } = useAction();
  const [text, setText] = useState(a.welcome_message ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (ph: string) => {
    const el = ref.current;
    const token = `{${ph}}`;
    if (!el) return setText((v) => v + token);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const save = () => run(() => saveApartment({ id: a.id, welcome_message: text }), { success: t("saved"), onDone: onClose });
  return (
    <Sheet open onClose={onClose} wide title={`${t("welcome")} · ${a.code}`} footer={<SheetFooter onClose={onClose} onSave={save} pending={pending} />}>
      <div className="flex flex-col gap-3">
        <Field label={t("welcome")} htmlFor={`wm-${a.id}`}>
          <Textarea id={`wm-${a.id}`} ref={ref} rows={7} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-semibold text-muted">{t("placeholders")}</span>
          <p className="text-[12.5px] text-muted">{t("placeholdersHint")}</p>
          <ul className="flex flex-col gap-1.5">
            {PLACEHOLDERS.map((ph) => (
              <li key={ph} className="flex items-center gap-2">
                <button type="button" onClick={() => insert(ph)} className="min-h-10 flex-none rounded-full bg-accent-soft px-3 font-mono text-[13px] font-semibold text-accent">
                  {`{${ph}}`}
                </button>
                <span className="text-[13px] text-muted">{t(`ph.${ph}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}

function HkSheet({ apartment: a, onClose }: { apartment: Apartment; onClose: () => void }) {
  const t = useTranslations("apartments");
  const { run, pending, error } = useAction();
  const [notes, setNotes] = useState(a.hk_notes ?? "");
  const [wifiName, setWifiName] = useState(a.wifi_name ?? "");
  const [wifiPassword, setWifiPassword] = useState(a.wifi_password ?? "");
  const save = () =>
    run(() => saveApartment({ id: a.id, hk_notes: notes, wifi_name: wifiName, wifi_password: wifiPassword }), { success: t("saved"), onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={`${t("editWifiNotes")} · ${a.code}`} footer={<SheetFooter onClose={onClose} onSave={save} pending={pending} />}>
      <div className="flex flex-col gap-3.5">
        <TextField label={t("wifiName")} value={wifiName} maxLength={64} autoComplete="off" onChange={(e) => setWifiName(e.target.value)} />
        <TextField label={t("wifiPassword")} hint={t("wifiHint")} value={wifiPassword} maxLength={64} autoComplete="off" onChange={(e) => setWifiPassword(e.target.value)} />
        <Field label={t("hkNotes")} htmlFor={`hk-${a.id}`}>
          <Textarea id={`hk-${a.id}`} rows={5} maxLength={2000} placeholder={t("hkNotesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}
