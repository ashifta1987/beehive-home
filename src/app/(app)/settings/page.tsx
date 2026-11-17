import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PeopleCard, ProfileCard, ThemeCard } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { staff: me, email, userId } = await requireStaffPage();
  const isOwner = me.role === "owner";
  const t = await getTranslations("settings");

  let staff: Staff[] = [];
  let staffError = false;
  if (isOwner) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("beehive_staff").select("*").order("role", { ascending: false }).order("created_at");
    staff = (data ?? []) as Staff[];
    staffError = !!error;
  }

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid grid-cols-1 items-start gap-4 min-[960px]:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ProfileCard me={me} email={email} />
          <ThemeCard />
          {isOwner ? (
            <Card>
              <CardTitle>{t("checkinTitle")}</CardTitle>
              <p className="mb-3 text-[14px] text-muted">{t("checkinBody")}</p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/posters" variant="secondary">
                  <Icon name="print" size={17} /> {t("posters")}
                </ButtonLink>
                <ButtonLink href="/checkins" variant="secondary">
                  <Icon name="qr" size={17} /> {t("checkins")}
                </ButtonLink>
              </div>
            </Card>
          ) : null}
        </div>
        {isOwner ? (
          <div className="flex flex-col gap-3">
            {staffError ? <ErrorBox>{t("loadError")}</ErrorBox> : null}
            <PeopleCard staff={staff} meId={userId} />
          </div>
        ) : null}
      </div>
    </>
  );
}
