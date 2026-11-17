import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/card";

export default async function Page() {
  await requireStaffPage();
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("jobs")} />
      <EmptyState title="Coming soon" body="This section is being built." />
    </>
  );
}
