"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MatchProposalInbox } from "@/components/match/MatchProposalInbox";
import { MatchRecommendationPanel } from "@/components/match-recommendation-panel";

type MatchTab = "recommend" | "received" | "sent";

const tabs: { value: MatchTab; label: string; description: string }[] = [
  {
    value: "recommend",
    label: "추천 조회",
    description: "같은 카테고리의 교환 가능 재능",
  },
  {
    value: "received",
    label: "받은 제안",
    description: "상대가 보낸 매칭 요청",
  },
  {
    value: "sent",
    label: "보낸 제안",
    description: "내가 보낸 교환 요청",
  },
];

function getMatchTab(value: string | null): MatchTab {
  if (value === "received" || value === "sent") {
    return value;
  }

  return "recommend";
}

export default function MatchesPage() {
  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="text-center">
          <h1 className="baton-page-title mt-3 !font-bold">
            MATCH YOUR TALENT
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            등록한 재능의 카테고리를 기준으로 교환 가능성이 높은 상대를 추천합니다.
            <br />
            상세를 확인한 뒤 바로 제안 메시지를 보낼 수 있어요.
          </p>
        </header>

        <Suspense fallback={<MatchesTabLoading />}>
          <MatchesTabContent />
        </Suspense>
      </div>
    </main>
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
      <nav
        aria-label="매칭 메뉴"
        className="mt-12 grid grid-cols-1 gap-3 border-b border-slate-400/55 pb-6 sm:mt-16 md:grid-cols-3 lg:mt-20"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={`group min-h-[76px] cursor-pointer rounded-lg border px-5 py-4 text-left transition hover:-translate-y-0.5 sm:min-h-[82px] ${isActive
                ? "border-[#8c5bff] bg-[#8c5bff] text-white shadow-lg shadow-violet-400/20"
                : "border-[#ded6ff] bg-white/90 text-zinc-600 shadow-sm shadow-violet-950/[0.03] hover:border-[#d9ccff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] hover:shadow-lg hover:shadow-violet-950/[0.06]"
                }`}
            >
              <span className="block text-base font-black">{tab.label}</span>
              <span
                className={`mt-1 block text-xs font-semibold ${isActive ? "text-white/75" : "text-zinc-400 group-hover:text-[#8c5bff]/70"
                  }`}
              >
                {tab.description}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="mt-10">
        {activeTab === "recommend" ? <MatchRecommendationPanel /> : null}
        {activeTab === "received" ? <MatchProposalInbox type="received" /> : null}
        {activeTab === "sent" ? <MatchProposalInbox type="sent" /> : null}
      </section>
    </>
  );
}

function MatchesTabLoading() {
  return (
    <div className="mt-10 border border-[#ded6ff] bg-white/90 p-8 text-center text-sm font-black text-zinc-500 shadow-sm shadow-violet-950/[0.04]">
      매칭 화면을 불러오는 중입니다...
    </div>
  );
}
