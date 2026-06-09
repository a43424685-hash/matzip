"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { key: "overall", label: "전체" },
  { key: "region", label: "지역" },
  { key: "weekly", label: "이번 주 인기" },
];

export default function RankingControls({
  activeTab,
  regionId,
  regions,
}: {
  activeTab: string;
  regionId: string;
  regions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function replace(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setTab(tab: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overall") {
      next.delete("tab");
      next.delete("regionId");
    } else {
      next.set("tab", tab);
      if (tab === "region" && !next.get("regionId") && regions[0]) {
        next.set("regionId", regions[0].id);
      }
    }
    replace(next);
  }

  function setRegion(nextRegionId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextRegionId) next.set("regionId", nextRegionId);
    else next.delete("regionId");
    replace(next);
  }

  const showRegionPicker = activeTab === "region" || activeTab === "weekly";

  return (
    <section className="mb-5 mt-6 space-y-3">
      <div className="flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={tab.key === activeTab ? "chip-on" : "chip-off"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showRegionPicker && (
        <select value={activeTab === "weekly" ? regionId : regionId || regions[0]?.id || ""} onChange={(e) => setRegion(e.target.value)} className="input">
          {activeTab === "weekly" && <option value="">전국</option>}
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}
