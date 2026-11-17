import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/card";

export default async function Page() {
  await requireOwnerPage();
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("foreign")} />
      <EmptyState title="Coming soon" body="This section is being built." />
    </>
  );
}
