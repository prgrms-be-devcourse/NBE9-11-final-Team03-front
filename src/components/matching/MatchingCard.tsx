"use client";

import { useRouter } from "next/navigation";
import type { MatchingRecommendation, Profile } from "@/types/domain";

interface MatchingCardProps {
  recommendation: MatchingRecommendation;
  profile: Profile | null;
}

export function MatchingCard({ recommendation, profile }: MatchingCardProps) {
  const router = useRouter();
  const offeredTags = recommendation.offeredTalentTags;
  const wantedTags = recommendation.wantedTalentTags;

  function openDetail() {
    router.push(`/matchings/${recommendation.id}`);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      className="flex h-[356px] cursor-pointer flex-col rounded-lg border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100"
    >
      <div className="flex h-14 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-black text-zinc-950">
            {profile?.nickname ?? "추천 사용자"}
          </p>
          <p className="mt-1 truncate text-sm text-zinc-500">
            완료 {recommendation.completedExchangeCount}건 · 신뢰 {recommendation.trustScore.totalScore}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-600 px-3 py-1 text-sm font-black text-white">
          {recommendation.matchScore}%
        </span>
      </div>

      <div className="mt-3 h-28 space-y-2 overflow-hidden">
        {recommendation.reasons.length > 0 ? (
          recommendation.reasons.map((reason) => (
          <p
            key={reason}
            className="line-clamp-2 text-sm leading-5 text-zinc-700"
          >
            · {reason}
          </p>
          ))
        ) : (
          <p className="text-sm leading-5 text-zinc-400">추천 이유가 아직 없어요.</p>
        )}
      </div>

      <div className="mt-3 h-[72px]">
        <p className="text-sm font-bold">상대가 보유한 재능</p>
        <div className="mt-2 flex h-8 gap-2 overflow-hidden">
          {offeredTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-[132px] shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
            >
              <span className="truncate">{tag}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="h-[72px]">
        <p className="text-sm font-bold">상대가 원하는 재능</p>
        <div className="mt-2 flex h-8 gap-2 overflow-hidden">
          {wantedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-[132px] shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700"
            >
              <span className="truncate">{tag}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
