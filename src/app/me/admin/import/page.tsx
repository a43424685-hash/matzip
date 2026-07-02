import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import BulkImportWizard from "@/components/BulkImportWizard";

export const metadata: Metadata = { title: "운영자 일괄등록 · 먹고핀" };
export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  const cats = await prisma.category.findMany({
    where: { isActive: true, type: { in: ["food", "situation"] } },
    select: { id: true, name: true, type: true },
    orderBy: { sortOrder: "asc" },
  });
  const foodCats = cats.filter((c) => c.type === "food").map((c) => ({ id: c.id, name: c.name }));
  const situationCats = cats.filter((c) => c.type === "situation").map((c) => ({ id: c.id, name: c.name }));

  return <BulkImportWizard foodCats={foodCats} situationCats={situationCats} />;
}
