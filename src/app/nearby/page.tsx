import BackHomeHeader from "@/components/BackHomeHeader";
import NearbyFinder from "@/components/NearbyFinder";

export const dynamic = "force-dynamic";

export default function NearbyPage() {
  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="주변" />
      <NearbyFinder />
    </main>
  );
}
