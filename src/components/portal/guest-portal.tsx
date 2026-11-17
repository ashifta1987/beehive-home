"use client";

import { CheckinFlow } from "./checkin-flow";
import type { GuestApartment, PortalLocale } from "./checkin-schema";
import { PortalProblem, PortalProvider, type PortalMessages } from "./portal-ui";
import { useTranslations } from "next-intl";

export function GuestPortal({
  apartment,
  doorKey,
  hostWhatsapp,
  messages,
  initialLocale,
}: {
  apartment: GuestApartment | null;
  doorKey: string;
  hostWhatsapp: string | null;
  messages: PortalMessages;
  initialLocale: PortalLocale;
}) {
  return (
    <PortalProvider messages={messages} initialLocale={initialLocale}>
      {(locale, setLocale) =>
        apartment ? (
          <Flow apartment={apartment} doorKey={doorKey} hostWhatsapp={hostWhatsapp} locale={locale} setLocale={setLocale} />
        ) : (
          <PortalProblem kind="invalid" locale={locale} setLocale={setLocale} />
        )
      }
    </PortalProvider>
  );
}

export function PortalUnavailable({ messages, initialLocale }: { messages: PortalMessages; initialLocale: PortalLocale }) {
  return (
    <PortalProvider messages={messages} initialLocale={initialLocale}>
      {(locale, setLocale) => <PortalProblem kind="unavailable" locale={locale} setLocale={setLocale} />}
    </PortalProvider>
  );
}

function Flow(props: {
  apartment: GuestApartment;
  doorKey: string;
  hostWhatsapp: string | null;
  locale: PortalLocale;
  setLocale: (l: PortalLocale) => void;
}) {
  const t = useTranslations("portal");
  return <CheckinFlow {...props} location={t("location")} />;
}
