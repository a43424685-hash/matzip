import NearbyMapScreen from "@/components/NearbyMapScreen";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "내 주변 맛집" };

export const dynamic = "force-dynamic";

export default function NearbyPage() {
  return <NearbyMapScreen />;
}
