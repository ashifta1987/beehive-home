import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { createAnonClient } from "@/components/portal/anon-client";
import { GuestPortal, PortalUnavailable } from "@/components/portal/guest-portal";
import { portalMessages } from "@/components/portal/messages";
import { PORTAL_LOCALES, type GuestApartment, type PortalLocale } from "@/components/portal/checkin-schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest check-in",
  robots: { index: false, follow: false },
  // The door key is in the URL: never send it to other sites as a referrer.
  referrer: "no-referrer",
};

const APT_RE = /^[a-z0-9-]{1,40}$/;
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ apartment: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ apartment }, sp, locale] = await Promise.all([params, searchParams, getLocale()]);
  const key = typeof sp.k === "string" ? sp.k.trim() : "";
  const initialLocale: PortalLocale = (PORTAL_LOCALES as readonly string[]).includes(locale) ? (locale as PortalLocale) : "en";
  const messages = portalMessages();

  let apt: GuestApartment | null = null;
  let unavailable = false;
  if (APT_RE.test(apartment) && KEY_RE.test(key)) {
    try {
      const { data, error } = await createAnonClient().rpc("beehive_guest_apartment", { p_apartment: apartment, p_key: key });
      if (error) {
        console.error("[checkin] guest_apartment failed", error.code);
        unavailable = true;
      } else if (data && typeof data === "object") {
        apt = data as GuestApartment;
      }
    } catch {
      console.error("[checkin] guest_apartment unreachable");
      unavailable = true;
    }
  }
  if (unavailable) return <PortalUnavailable messages={messages} initialLocale={initialLocale} />;

  const host = process.env.NEXT_PUBLIC_HOST_WHATSAPP?.trim() || null;
  return (
    <GuestPortal
      apartment={apt}
      doorKey={apt ? key : ""}
      hostWhatsapp={host}
      messages={messages}
      initialLocale={initialLocale}
    />
  );
}
