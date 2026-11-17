import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { HousekeeperApartment, OwnerApartment } from "./apartment-cards";

export default async function ApartmentsPage() {
  const { staff } = await requireStaffPage();
  const isOwner = staff.role === "owner";
  const t = await getTranslations("apartments");
  const apartments = await getApartments();

  return (
    <>
      <PageHeader title={t("title")} subtitle={isOwner ? t("subtitleOwner") : t("subtitleHk")} />
      {apartments.length === 0 ? (
        <EmptyState icon={<Icon name="building" size={34} />} title={t("emptyTitle")} body={isOwner ? t("emptyBodyOwner") : t("emptyBodyHk")} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 min-[960px]:grid-cols-2">
          {apartments.map((a) =>
            isOwner ? <OwnerApartment key={a.id} apartment={a} /> : <HousekeeperApartment key={a.id} apartment={a} />,
          )}
        </div>
      )}
    </>
  );
}
