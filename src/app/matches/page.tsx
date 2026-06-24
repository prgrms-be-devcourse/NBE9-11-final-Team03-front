"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SectionTitle } from "@/components/common/SectionTitle";
import { MatchProposalInbox } from "@/components/match/MatchProposalInbox";
import { MatchRecommendationPanel } from "@/components/match-recommendation-panel";

type MatchTab = "recommend" | "received" | "sent";

const tabs: { value: MatchTab; label: string }[] = [
  { value: "recommend", label: "추천 조회" },
  { value: "received", label: "받은 제안" },
  { value: "sent", label: "보낸 제안" },
];

function getMatchTab(value: string | null): MatchTab {
  if (value === "received" || value === "sent") {
    return value;
  }

  return "recommend";
}

export default function MatchesPage() {
  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="자동 매칭 추천"
        description="내 재능과 같은 카테고리에 속한 추천 상대를 확인하고 제안을 보내보세요."
      />
      <Suspense fallback={<MatchesTabLoading />}>
        <MatchesTabContent />
      </Suspense>
    </div>
  );
}

function MatchesTabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getMatchTab(searchParams.get("tab"));

  function handleTabChange(nextTab: MatchTab) {
    router.push(nextTab === "recommend" ? "/matches" : `/matches?tab=${nextTab}`, {
      scroll: false,
    });
  }

  return (
    <>
      <div className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-white p-1">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={`h-10 flex-1 cursor-pointer rounded-md px-4 text-sm font-bold transition ${
                isActive
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "recommend" ? <MatchRecommendationPanel /> : null}
      {activeTab === "received" ? <MatchProposalInbox type="received" /> : null}
      {activeTab === "sent" ? <MatchProposalInbox type="sent" /> : null}
    </>
  );
}

function MatchesTabLoading() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
      매칭 화면을 불러오는 중입니다...
    </div>
  );
}
