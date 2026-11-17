import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cn, tagClasses } from "@/lib/ui";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PrintButton, RotateKey } from "./poster-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Door posters", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function siteOrigin(): Promise<{ origin: string; fromEnv: boolean }> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (env) return { origin: env, fromEnv: true };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { origin: `${proto}://${host}`, fromEnv: false };
}

/** Printable A5 door posters (owner only). The only place a door key is ever rendered. */
export default async function PostersPage() {
  await requireOwnerPage();
  const t = await getTranslations("posters");
  const supabase = await createClient();
  const [apartments, keysRes, site] = await Promise.all([
    getApartments(),
    supabase.from("beehive_door_keys").select("apartment, door_key"),
    siteOrigin(),
  ]);
  const keys = new Map((keysRes.data ?? []).map((k: { apartment: string; door_key: string }) => [k.apartment, k.door_key]));

  const posters = await Promise.all(
    apartments.map(async (a) => {
      const key = keys.get(a.id);
      if (!key) return { apt: a, svg: null as string | null };
      const url = `${site.origin}/checkin/${encodeURIComponent(a.id)}?k=${encodeURIComponent(key)}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      return { apt: a, svg };
    }),
  );

  return (
    <div className="min-h-dvh bg-bg pb-10">
      <style>{`
        @page { size: A5 portrait; margin: 0; }
        .bh-poster { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .bh-qr svg { width: 100%; height: 100%; display: block; }
        @media print {
          html, body { background: white !important; }
          .bh-sheet { padding: 0 !important; gap: 0 !important; }
          .bh-poster { width: 148mm !important; height: 210mm !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; }
          .bh-break { break-after: page; page-break-after: always; }
        }
      `}</style>

      <header className="no-print gutter mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/checkins" className={buttonClass("secondary", "md")} aria-label={t("back")}>
            <Icon name="chevronLeft" size={18} /> <span className="max-[420px]:hidden">{t("back")}</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
            <p className="text-[13px] text-muted">{t("subtitle")}</p>
          </div>
        </div>
        {posters.some((p) => p.svg) ? <PrintButton label={t("print")} /> : null}
      </header>

      {!site.fromEnv ? (
        <div className="no-print gutter mx-auto mb-4 max-w-[960px]">
          <ErrorBox>{t("siteWarning", { origin: site.origin })}</ErrorBox>
        </div>
      ) : null}
      {keysRes.error ? (
        <div className="no-print gutter mx-auto mb-4 max-w-[960px]">
          <ErrorBox>{t("loadError")}</ErrorBox>
        </div>
      ) : null}

      {apartments.length === 0 ? (
        <div className="gutter mx-auto max-w-[960px]">
          <EmptyState title={t("empty")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="bh-sheet gutter mx-auto flex max-w-[960px] flex-col items-center gap-8">
          {posters.map(({ apt, svg }, i) => {
            const c = tagClasses(apt.tag_colour);
            const breakAfter = posters.slice(i + 1).some((p) => p.svg);
            return (
              <div key={apt.id} className="contents">
                {svg ? (
                  <article
                    className={cn("bh-poster flex aspect-[148/210] w-full max-w-[420px] flex-col overflow-hidden rounded-[24px] bg-white text-black shadow-card", breakAfter && "bh-break")}
                    aria-label={t("posterFor", { name: apt.name })}
                  >
                    <div className={cn("flex flex-col items-center gap-[2%] px-[8%] pb-[5%] pt-[5%]", c.bg, c.text)}>
                      <span aria-hidden className="h-[22px] w-[22px] rounded-full border-[3.5px] border-current bg-white" />
                      <span className="font-display text-[clamp(30px,11vw,52px)] font-extrabold leading-none tracking-[-0.04em]">{apt.code}</span>
                      <span className="text-center text-[clamp(12px,3.6vw,16px)] font-semibold">{apt.name}</span>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-between gap-[3%] px-[8%] py-[5%]">
                      <span className="font-display text-[clamp(14px,4.4vw,20px)] font-extrabold tracking-[-0.02em]">{t("posterHeading")}</span>
                      <div className="bh-qr aspect-square w-[58%]" role="img" aria-label={t("qrAlt", { name: apt.name })} dangerouslySetInnerHTML={{ __html: svg }} />
                      <ol className="flex w-full flex-col gap-[6px] text-[clamp(10.5px,3vw,13.5px)] leading-snug">
                        <li lang="en" className="flex gap-2"><span className="w-6 flex-none font-bold">EN</span><span>{t("lineEn")}</span></li>
                        <li lang="ml" className="flex gap-2"><span className="w-6 flex-none font-bold">ML</span><span>{t("lineMl")}</span></li>
                        <li lang="hi" className="flex gap-2"><span className="w-6 flex-none font-bold">HI</span><span>{t("lineHi")}</span></li>
                      </ol>
                      <span className="text-[clamp(9px,2.6vw,11.5px)] font-semibold opacity-70">{t("footer")}</span>
                    </div>
                  </article>
                ) : (
                  <div className="no-print flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[24px] bg-surface p-6 text-center">
                    <span className={cn("rounded-[10px] px-3 py-1 font-display text-[18px] font-extrabold", c.bg, c.text)}>{apt.code}</span>
                    <p className="text-[14px] text-muted">{t("noKey")}</p>
                  </div>
                )}
                <div className="no-print -mt-4 flex w-full max-w-[420px] justify-center">
                  <RotateKey apartmentId={apt.id} code={apt.code} hasKey={!!svg} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
