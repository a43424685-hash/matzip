import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import BankAccountForm from "@/components/BankAccountForm";
import RealNameForm from "@/components/RealNameForm";
import { decryptField, maskAccountNumber } from "@/lib/fieldCrypto";

export const metadata: Metadata = { title: "정산 계좌" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const acc = await prisma.user.findUnique({
    where: { id: user.id },
    select: { legalName: true, bankName: true, accountNumber: true, accountHolder: true },
  });

  // 실명은 가입 때 받지 않으므로(Apple 가이드라인 4) 정산이 필요한 여기서 먼저 등록.
  const legalName = acc?.legalName ?? user.legalName ?? "";
  if (!legalName) {
    return (
      <main className="pb-10">
        <MeSubPageHeader title="정산 계좌" />
        <div className="px-5 pt-2">
          <p className="mb-2 text-[13px] leading-relaxed text-ink-muted">
            판매 수익을 정산받으려면 먼저 <b className="text-ink">실명</b>을 등록해야 해요. 정산 계좌의{" "}
            <b className="text-ink">예금주명과 일치하는지 확인</b>하는 용도로만 쓰이고, 화면에는 닉네임만 보여요.
          </p>
          <RealNameForm />
        </div>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <MeSubPageHeader title="정산 계좌" />
      <div className="px-5 pt-2">
        <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
          판매 수익을 정산받을 계좌예요. <b className="text-ink">예금주명은 본인 실명과 일치</b>해야 등록되고, 출금은 등록된
          계좌로만 입금돼요.
        </p>
        <BankAccountForm
          legalName={legalName}
          initial={
            acc
              ? {
                  bankName: acc.bankName,
                  maskedNumber: acc.accountNumber ? maskAccountNumber(decryptField(acc.accountNumber)) : null,
                  accountHolder: acc.accountHolder,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
