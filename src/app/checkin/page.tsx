import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { GuestPortal } from "@/components/portal/guest-portal";
import { portalMessages } from "@/components/portal/messages";
import { PORTAL_LOCALES, type PortalLocale } from "@/components/portal/checkin-schema";

export const metadata: Metadata = {
  title: "Guest check-in",
  robots: { index: false, follow: false },
};

/** /checkin without an apartment: same friendly "scan the QR" message. */
export default async function CheckinIndex() {
  const locale = await getLocale();
  const initialLocale: PortalLocale = (PORTAL_LOCALES as readonly string[]).includes(locale) ? (locale as PortalLocale) : "en";
  return <GuestPortal apartment={null} doorKey="" hostWhatsapp={null} messages={portalMessages()} initialLocale={initialLocale} />;
}
