import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import ProfileEditForm from "@/components/ProfileEditForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="프로필 수정" />
      <ProfileEditForm initialNickname={user.nickname} initialAvatar={user.avatarUrl} />
    </main>
  );
}
