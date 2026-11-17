"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { Staff } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, ErrorBox } from "@/components/ui/card";
import { PillChoice, TextField, Toggle } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { useAction, useToast } from "@/components/ui/toast";
import { THEME_KEY } from "@/components/portal/theme-script";
import { inviteHousekeeper, removeStaff, setMyLanguage, updateMyProfile, updateStaff } from "./actions";

type Lang = "en" | "ml";
type Theme = "light" | "dark" | "system";

// ---------------------------------------------------------------------------
// Profile + language
// ---------------------------------------------------------------------------
export function ProfileCard({ me, email }: { me: Staff; email: string | null }) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(me.name ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const { run, pending, error, setError } = useAction();
  const lang = useAction();

  const openSheet = () => {
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setError(null);
    setOpen(true);
  };
  const save = () => {
    if (!name.trim()) return setError(t("errName"));
    run(() => updateMyProfile({ name, phone }), { success: t("saved"), onDone: () => setOpen(false) });
  };

  return (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="secondary" onClick={openSheet}>
            <Icon name="edit" size={15} /> {t("edit")}
          </Button>
        }
      >
        {t("profile")}
      </CardTitle>
      <dl className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
        <div className="flex flex-col">
          <dt className="text-[11.5px] text-muted">{t("name")}</dt>
          <dd className="text-[14.5px] font-medium">{me.name || t("notSet")}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[11.5px] text-muted">{t("phone")}</dt>
          <dd className="tabular text-[14.5px] font-medium">{me.phone || t("notSet")}</dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-[11.5px] text-muted">{t("email")}</dt>
          <dd className="break-all text-[14.5px] font-medium">{email || t("notSet")}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <PillChoice<Lang>
          label={t("language")}
          name="my-lang"
          value={me.lang}
          onChange={(v) => {
            if (v !== me.lang && !lang.pending) lang.run(() => setMyLanguage(v), { success: v === "ml" ? t("langChangedMl") : t("langChangedEn") });
          }}
          options={[
            { value: "en", label: "English" },
            { value: "ml", label: "മലയാളം" },
          ]}
        />
        {lang.pending ? <span className="text-[12.5px] text-muted">{t("saving")}</span> : null}
        <ErrorBox>{lang.error}</ErrorBox>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("editProfile")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>{t("cancel")}</Button>
            <Button onClick={save} disabled={pending}>{pending ? t("saving") : t("save")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <TextField label={t("name")} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} required />
          <TextField label={t("phone")} hint={t("phoneHint")} type="tel" inputMode="tel" value={phone} maxLength={30} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
          <ErrorBox>{error}</ErrorBox>
        </div>
      </Sheet>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Theme (stored in this browser only)
// ---------------------------------------------------------------------------
const THEME_EVENT = "bh-theme-change";

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}

function applyTheme(v: Theme) {
  try {
    if (v === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, v);
  } catch {
    // private mode: still apply for this page view
  }
  if (v === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", v);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeCard() {
  const t = useTranslations("settings");
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return (
    <Card>
      <CardTitle>{t("theme")}</CardTitle>
      <PillChoice<Theme>
        name="theme"
        value={theme}
        onChange={applyTheme}
        options={[
          { value: "light", label: t("themeLight") },
          { value: "dark", label: t("themeDark") },
          { value: "system", label: t("themeSystem") },
        ]}
      />
      <p className="mt-2 text-[12.5px] text-muted">{t("themeHint")}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// People (owner)
// ---------------------------------------------------------------------------
export function PeopleCard({ staff, meId }: { staff: Staff[]; meId: string }) {
  const t = useTranslations("settings");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState<Staff | null>(null);

  return (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="honey" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> {t("addHousekeeper")}
          </Button>
        }
      >
        {t("people")}
      </CardTitle>
      {staff.filter((s) => s.role === "housekeeper").length === 0 ? (
        <p className="mb-3 rounded-[14px] bg-surface-2 p-3 text-[14px] text-muted">{t("noHousekeepers")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {staff.map((s) => (
          <li key={s.user_id} className="flex flex-wrap items-center gap-3 rounded-[16px] bg-surface-2 p-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold">
                {s.name || s.email || t("notSet")} {s.user_id === meId ? <span className="font-normal text-muted">({t("you")})</span> : null}
              </span>
              <span className="truncate text-[12.5px] text-muted">{[s.email, s.phone].filter(Boolean).join(" · ") || t("notSet")}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill tone={s.role === "owner" ? "ink" : "info"}>{t(`roles.${s.role}`)}</Pill>
                <Pill tone="neutral">{s.lang === "ml" ? "മലയാളം" : "English"}</Pill>
                {!s.active ? <Pill tone="bad">{t("inactive")}</Pill> : null}
              </span>
            </span>
            <span className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setEditing(s)} aria-label={t("editPerson", { name: s.name || s.email || "" })}>
                <Icon name="edit" size={15} /> {t("edit")}
              </Button>
              {s.role !== "owner" && s.user_id !== meId ? (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(s)} aria-label={t("removePerson", { name: s.name || s.email || "" })} className="text-bad">
                  <Icon name="trash" size={15} />
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {adding ? <AddSheet onClose={() => setAdding(false)} /> : null}
      {editing ? <EditSheet person={editing} isMe={editing.user_id === meId} onClose={() => setEditing(null)} /> : null}
      {removing ? <RemoveSheet person={removing} onClose={() => setRemoving(null)} /> : null}
    </Card>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings");
  const { run, pending, error, setError } = useAction();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lang, setLang] = useState<Lang>("ml");
  const save = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t("errEmail"));
    if (!name.trim()) return setError(t("errName"));
    run(() => inviteHousekeeper({ email, name, phone, lang }), {
      onDone: (d) => {
        toast(d?.invited ? t("invited") : t("addedExisting"));
        onClose();
      },
    });
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("addHousekeeper")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
          <Button onClick={save} disabled={pending}>{pending ? t("sending") : t("sendInvite")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <p className="text-[13.5px] text-muted">{t("addHelp")}</p>
        <TextField label={t("email")} type="email" inputMode="email" autoComplete="off" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label={t("name")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        <TextField label={t("phone")} type="tel" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
        <PillChoice<Lang>
          label={t("appLanguage")}
          name="new-lang"
          value={lang}
          onChange={setLang}
          options={[
            { value: "ml", label: "മലയാളം" },
            { value: "en", label: "English" },
          ]}
        />
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}

function EditSheet({ person, isMe, onClose }: { person: Staff; isMe: boolean; onClose: () => void }) {
  const t = useTranslations("settings");
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState(person.name ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [lang, setLang] = useState<Lang>(person.lang);
  const [active, setActive] = useState(person.active);
  const save = () => {
    if (!name.trim()) return setError(t("errName"));
    run(() => updateStaff({ userId: person.user_id, name, phone, lang, active }), { success: t("saved"), onDone: onClose });
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("editPerson", { name: person.name || person.email || "" })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
          <Button onClick={save} disabled={pending}>{pending ? t("saving") : t("save")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {person.email ? <p className="break-all text-[13.5px] text-muted">{person.email}</p> : null}
        <TextField label={t("name")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        <TextField label={t("phone")} type="tel" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
        <PillChoice<Lang>
          label={t("appLanguage")}
          name="edit-lang"
          value={lang}
          onChange={setLang}
          options={[
            { value: "en", label: "English" },
            { value: "ml", label: "മലയാളം" },
          ]}
        />
        {!isMe ? <Toggle label={t("active")} hint={t("activeHint")} checked={active} onChange={setActive} /> : null}
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}

function RemoveSheet({ person, onClose }: { person: Staff; onClose: () => void }) {
  const t = useTranslations("settings");
  const { run, pending, error } = useAction();
  const who = person.name || person.email || "";
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("removeTitle", { name: who })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
          <Button variant="danger" disabled={pending} onClick={() => run(() => removeStaff(person.user_id), { success: t("removed"), onDone: onClose })}>
            {pending ? t("saving") : t("remove")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[14.5px]">
        <p>{t("removeBody")}</p>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}
