import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import WithdrawPanel from "@/components/WithdrawPanel";

export const dynamic = "force-dynamic";

export default async function WithdrawPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="회원 탈퇴" />
      <WithdrawPanel />
    </main>
  );
}
