"use client";

import { Code2, FileText, Palette, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { UserProfileModal } from "@/components/profile/UserProfileModal";
import {
  ApiError,
  matchApi,
  talentApi,
  type MatchRecommendationDetailRes,
  type MatchRecommendationRes,
  type TalentListRes,
} from "@/lib/api";
import {
  getStoredUserId,
  hasStoredAccessToken,
  setStoredLastTalentId,
} from "@/lib/auth";
import {
  formatCredit,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

interface RecommendationItem {
  requesterTalentId: number;
  requesterTalentTitle: string;
  requesterCategoryName: string;
  recommendation: MatchRecommendationRes;
}

interface SelectedRecommendationContext {
  requesterTalentId: number;
  requesterTalentTitle: string;
}

const RECOMMENDATION_API_ERROR_MESSAGE =
  "내 재능과 매칭 추천 목록을 불러오는 중 문제가 발생했습니다.";
const MY_TALENTS_API_ERROR_MESSAGE =
  "내가 등록한 재능 목록을 불러오지 못했습니다. 현재 백엔드 API 기준으로 전체 재능 목록에서 내 작성 재능을 찾아 추천을 조회합니다.";

const categoryVisuals = {
  development: {
    Icon: Code2,
    tile: "from-[#fff8e7] via-[#fff3d6] to-[#fef7ed]",
    panel: "from-[#f59e0b] to-[#ea580c]",
    accent: "bg-[#0f766e]",
    badge: "text-[#b45309]",
    hover: "group-hover:text-[#c2410c]",
    label: "개발",
    headline: "개발",
  },
  design: {
    Icon: Palette,
    tile: "from-[#f7fee7] via-[#ecfccb] to-[#f0fdfa]",
    panel: "from-[#84cc16] to-[#10b981]",
    accent: "bg-[#f59e0b]",
    badge: "text-[#3f6212]",
    hover: "group-hover:text-[#4d7c0f]",
    label: "디자인",
    headline: "디자인",
  },
  document: {
    Icon: FileText,
    tile: "from-[#fff1f2] via-[#ffe4e6] to-[#fff7ed]",
    panel: "from-[#e11d48] to-[#fb7185]",
    accent: "bg-[#f59e0b]",
    badge: "text-[#9f1239]",
    hover: "group-hover:text-[#be123c]",
    label: "문서 정리",
    headline: "문서",
  },
  default: {
    Icon: Sparkles,
    tile: "from-[#fff7ed] via-[#fefce8] to-[#ecfeff]",
    panel: "from-[#f59e0b] to-[#0f766e]",
    accent: "bg-[#f97316]",
    badge: "text-[#9a3412]",
    hover: "group-hover:text-[#b45309]",
    label: "재능",
    headline: "재능",
  },
};

function getCategoryVisual(categoryName: string) {
  const normalized = categoryName.replace(/\s/g, "").toLowerCase();

  if (normalized.includes("개발") || normalized.includes("dev")) {
    return categoryVisuals.development;
  }

  if (normalized.includes("디자인") || normalized.includes("design")) {
    return categoryVisuals.design;
  }

  if (
    normalized.includes("문서") ||
    normalized.includes("정리") ||
    normalized.includes("글")
  ) {
    return categoryVisuals.document;
  }

  return categoryVisuals.default;
}

export function MatchRecommendationPanel() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [myTalents, setMyTalents] = useState<TalentListRes[]>([]);
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItem[]>([]);
  const [selectedRecommendationContext, setSelectedRecommendationContext] =
    useState<SelectedRecommendationContext | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<MatchRecommendationDetailRes | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingDetailKey, setLoadingDetailKey] = useState<string | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const hasLoadedMyTalents = isHydrated && myTalents.length > 0;

  const loadAutoRecommendations = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage("");
    setIsLoadingList(true);

    try {
      const myTalentsResponse = await talentApi.getMyList({ size: 50 });
      const activeMyTalents = Array.isArray(myTalentsResponse.content)
        ? myTalentsResponse.content
        : [];

      setMyTalents(activeMyTalents);

      if (activeMyTalents.length === 0) {
        setRecommendationItems([]);
        setSelectedRecommendationContext(null);
        return;
      }

      const recommendationResults = await Promise.allSettled(
        activeMyTalents.map(async (myTalent) => {
          const recommendations = await matchApi.getRecommendations({
            talentId: myTalent.talentId,
          });

          return recommendations.map((recommendation) => ({
            requesterTalentId: myTalent.talentId,
            requesterTalentTitle: myTalent.title,
            requesterCategoryName: myTalent.categoryName,
            recommendation,
          }));
        }),
      );

      const rejectedResult = recommendationResults.find(
        (result) => result.status === "rejected",
      );

      if (rejectedResult?.status === "rejected") {
        throw rejectedResult.reason;
      }

      const nextItems = recommendationResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );

      const userId = getStoredUserId();
      if (userId !== null) {
        setStoredLastTalentId(userId, activeMyTalents[0].talentId);
      }

      setRecommendationItems(nextItems);
      setStatusMessage("");
    } catch (error) {
      setMyTalents([]);
      setRecommendationItems([]);
      setSelectedRecommendationContext(null);
      setStatusMessage("");
      setErrorMessage(
        error instanceof ApiError && error.status === 404
          ? MY_TALENTS_API_ERROR_MESSAGE
          : error instanceof Error
            ? error.message || RECOMMENDATION_API_ERROR_MESSAGE
            : RECOMMENDATION_API_ERROR_MESSAGE,
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsHydrated(true);

      if (!hasStoredAccessToken()) {
        setErrorMessage("로그인 후 이용해 주세요.");
        return;
      }

      void loadAutoRecommendations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAutoRecommendations]);

  async function handleOpenDetail(item: RecommendationItem) {
    setErrorMessage(null);
    setStatusMessage("");
    setLoadingDetailKey(getRecommendationItemKey(item));
    setSelectedRecommendationContext({
      requesterTalentId: item.requesterTalentId,
      requesterTalentTitle: item.requesterTalentTitle,
    });

    try {
      const response = await matchApi.getRecommendationDetail({
        providerTalentId: item.recommendation.talentId,
        requesterTalentId: item.requesterTalentId,
      });

      setSelectedDetail(response);
      setIsProfileModalOpen(false);
      setRequestMessage("");
    } catch (error) {
      setSelectedRecommendationContext(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "매칭 추천 상세를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingDetailKey(null);
    }
  }

  async function handleCreateProposal() {
    if (!selectedRecommendationContext || !selectedDetail) {
      return;
    }

    const trimmedMessage = requestMessage.trim();

    if (!trimmedMessage) {
      setErrorMessage("제안 메시지를 입력해 주세요.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage("");
    setIsSubmittingProposal(true);

    try {
      await matchApi.createProposal({
        requesterTalentId: selectedRecommendationContext.requesterTalentId,
        providerId: selectedDetail.providerId,
        providerTalentId: selectedDetail.talentId,
        requestMessage: trimmedMessage,
      });

      setStatusMessage("교환 제안이 전송되었습니다. 상대방의 응답을 기다려 주세요.");
      setSelectedDetail(null);
      setSelectedRecommendationContext(null);
      setIsProfileModalOpen(false);
      setRequestMessage("");

      await loadAutoRecommendations();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "교환 제안 전송 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmittingProposal(false);
    }
  }

  function handleCloseDetail() {
    setIsProfileModalOpen(false);
    setSelectedDetail(null);
    setSelectedRecommendationContext(null);
  }

  function handleOpenProfileModal() {
    setErrorMessage(null);
    setIsProfileModalOpen(true);
  }

  return (
    <>
      {statusMessage ? (
        <p className="mb-6 border border-[#ccfbf1] bg-[#f0fdfa] p-4 text-sm font-black text-[#0f766e]">
          {statusMessage}
        </p>
      ) : null}

      <div className="mb-8 flex flex-col gap-3 border-b border-slate-400/55 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">
            내 재능과 연결 가능한 추천 상대
          </h2>
        </div>

        <p className="text-sm font-bold text-zinc-500 sm:text-right">
          등록한 재능을 기준으로 자동 조회된 결과입니다.
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isHydrated && isLoadingList ? (
        <div className="border border-[#ded6ff] bg-white/90 p-8 text-center text-sm font-black text-zinc-500">
          매칭 추천을 불러오는 중입니다...
        </div>
      ) : null}

      {isHydrated && !isLoadingList && !hasLoadedMyTalents && !errorMessage ? (
        <EmptyState
          title="등록한 재능이 없습니다."
          description="재능을 등록하면 내 재능의 카테고리를 기준으로 추천 상대가 자동으로 표시됩니다."
          actionLabel="재능 등록하기"
          actionHref="/talents/new"
        />
      ) : null}

      {isHydrated &&
        !isLoadingList &&
        hasLoadedMyTalents &&
        recommendationItems.length === 0 ? (
        <EmptyState
          title="현재 추천 가능한 상대 재능이 없습니다."
          description="내가 등록한 재능과 같은 카테고리에 다른 사용자의 재능이 생기면 자동으로 추천됩니다."
        />
      ) : null}

      {isHydrated && !isLoadingList && recommendationItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 xl:grid-cols-4">
          {recommendationItems.map((item) => (
            <RecommendationCard
              key={getRecommendationItemKey(item)}
              recommendation={item.recommendation}
              requesterTalentTitle={item.requesterTalentTitle}
              requesterCategoryName={item.requesterCategoryName}
              isLoadingDetail={loadingDetailKey === getRecommendationItemKey(item)}
              onOpen={() => handleOpenDetail(item)}
            />
          ))}
        </div>
      ) : null}

      {selectedDetail ? (
        <RecommendationDetailModal
          detail={selectedDetail}
          requestMessage={requestMessage}
          isSubmitting={isSubmittingProposal}
          requesterTalentTitle={selectedRecommendationContext?.requesterTalentTitle ?? null}
          onRequestMessageChange={setRequestMessage}
          onClose={handleCloseDetail}
          onOpenProfile={handleOpenProfileModal}
          onCreateProposal={handleCreateProposal}
        />
      ) : null}

      {selectedDetail && isProfileModalOpen ? (
        <UserProfileModal
          detail={selectedDetail}
          requestMessage={requestMessage}
          isSubmitting={isSubmittingProposal}
          errorMessage={errorMessage}
          onRequestMessageChange={setRequestMessage}
          onClose={() => setIsProfileModalOpen(false)}
          onCreateProposal={handleCreateProposal}
        />
      ) : null}
    </>
  );
}

function getRecommendationItemKey(item: RecommendationItem): string {
  return `${item.requesterTalentId}-${item.recommendation.talentId}`;
}

function RecommendationCard({
  recommendation,
  requesterTalentTitle,
  requesterCategoryName,
  isLoadingDetail,
  onOpen,
}: {
  recommendation: MatchRecommendationRes;
  requesterTalentTitle: string;
  requesterCategoryName: string;
  isLoadingDetail: boolean;
  onOpen: () => void;
}) {
  const visual = getCategoryVisual(recommendation.categoryName);
  const CategoryIcon = visual.Icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block cursor-pointer text-left outline-none"
    >
      <div
        className={`relative aspect-square overflow-hidden bg-gradient-to-br ${visual.tile}`}
      >
        <div
          className={`absolute -right-10 -top-10 h-36 w-36 rounded-[44px] bg-gradient-to-br ${visual.panel} opacity-90 blur-[1px] transition group-hover:scale-105`}
        />
        <div
          className={`absolute right-[20%] top-[22%] h-16 w-16 rounded-full ${visual.accent} opacity-[0.42] blur-xl`}
        />
        <div className="absolute left-8 top-[76px] z-20 flex h-10 w-16 items-center justify-center rounded-t-[18px] rounded-b-none border border-b-0 border-white/88 bg-white/76 backdrop-blur">
          <CategoryIcon className={`h-7 w-7 ${visual.badge}`} aria-hidden="true" />
        </div>
        <div className="absolute inset-x-8 top-[116px] bottom-8 z-10 rounded-b-[24px] rounded-tr-[24px] border border-t-0 border-white/88 bg-white/76 p-6 shadow-xl shadow-orange-950/10 backdrop-blur">
          <span className="block text-[42px] font-black leading-none tracking-normal text-zinc-950">
            {visual.headline}
          </span>
          <div
            className={`mt-5 h-2 w-20 rounded-full bg-gradient-to-r ${visual.panel}`}
            aria-hidden="true"
          />
        </div>
        <span className={`absolute right-5 top-5 rounded-full bg-white/88 px-3 py-1 text-xs font-black ${visual.badge} shadow-sm`}>
          {recommendation.categoryName}
        </span>
      </div>

      <div className="pt-5">
        <p className="mb-2 line-clamp-1 text-xs font-black text-[#8c5bff]">
          내 재능: {requesterCategoryName} · {requesterTalentTitle}
        </p>
        <h2 className={`line-clamp-2 min-h-14 text-[17px] font-black leading-7 text-zinc-950 transition ${visual.hover}`}>
          {recommendation.title}
        </h2>
        <p className="mt-2 line-clamp-2 min-h-12 text-sm font-semibold leading-6 text-zinc-500">
          {recommendation.content}
        </p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-black text-zinc-950">
            {formatCredit(recommendation.creditPrice)}
          </span>
          <span className="text-sm font-semibold text-zinc-400">
            {formatEstimatedDuration(recommendation.estimatedHours)}
          </span>
        </div>

        <p className="mt-2 text-sm font-semibold text-zinc-500">
          ★ {formatRating(recommendation.avgRating)} · 완료 {recommendation.completeCount}건
        </p>

        {recommendation.proposalRequestDisabledReason ? (
          <p className="mt-3 line-clamp-2 text-xs font-black text-amber-700">
            {recommendation.proposalRequestDisabledReason}
          </p>
        ) : (
          <p className="mt-3 text-xs font-black text-[#0f766e]">
            제안 가능
          </p>
        )}

        <span className="mt-4 inline-flex border-b-2 border-[#8c5bff] pb-1 text-sm font-black text-[#8c5bff] transition group-hover:text-zinc-950">
          {isLoadingDetail ? "상세 불러오는 중..." : "상세 보기"}
        </span>
      </div>
    </button>
  );
}

function RecommendationDetailModal({
  detail,
  requestMessage,
  isSubmitting,
  requesterTalentTitle,
  onRequestMessageChange,
  onClose,
  onOpenProfile,
  onCreateProposal,
}: {
  detail: MatchRecommendationDetailRes;
  requestMessage: string;
  isSubmitting: boolean;
  requesterTalentTitle: string | null;
  onRequestMessageChange: (value: string) => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onCreateProposal: () => void;
}) {
  const disabledReason = detail.proposalRequestDisabledReason;
  const isProposalDisabled = !detail.proposalRequestEnabled || isSubmitting;
  const providerName = getDisplayName(detail.nickname);
  const providerIntroduction =
    detail.introduction?.trim() || "아직 등록된 소개가 없습니다.";
  const profileImageUrl = detail.profileImageUrl?.trim() || null;
  const categoryName = detail.categoryName?.trim() || "재능";
  const title = detail.title?.trim() || "제목 없음";
  const trustScore = getOptionalNumber(detail.trustScore);
  const viewCount = getOptionalNumber(detail.viewCount);
  const creditPrice = getOptionalNumber(detail.creditPrice);
  const estimatedHours = getOptionalNumber(detail.estimatedHours);
  const avgRating = getOptionalNumber(detail.avgRating);
  const completeCount = getOptionalNumber(detail.completeCount);
  const content = detail.content?.trim() || "상세 설명이 없습니다.";
  const visual = getCategoryVisual(categoryName);
  const CategoryIcon = visual.Icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-5 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-zinc-950/25">
        <div className="grid max-h-[90vh] overflow-y-auto lg:grid-cols-[0.9fr_1.1fr]">
          <aside
            className={`relative min-h-[360px] overflow-hidden bg-gradient-to-br ${visual.tile} p-8 lg:min-h-full`}
          >
            <div
              className={`absolute -right-14 -top-14 h-52 w-52 rounded-[60px] bg-gradient-to-br ${visual.panel} opacity-90 blur-[1px]`}
            />
            <div
              className={`absolute right-16 top-24 h-24 w-24 rounded-full ${visual.accent} opacity-30 blur-2xl`}
            />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className={`rounded-full bg-white/90 px-4 py-2 text-sm font-black ${visual.badge} shadow-sm`}>
                {categoryName}
              </span>
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-black text-[#0f766e] shadow-sm">
                신뢰 {formatOptionalRating(trustScore)}
              </span>
            </div>

            <div className="relative z-10 mt-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-zinc-950/10">
                <CategoryIcon className={`h-8 w-8 ${visual.badge}`} aria-hidden="true" />
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.28em] text-zinc-500">
                Recommended Talent
              </p>
              <h2
                id="match-detail-title"
                className="mt-3 text-4xl font-black leading-tight tracking-[-0.04em] text-zinc-950"
              >
                {title}
              </h2>
              <div
                className={`mt-6 h-2 w-24 rounded-full bg-gradient-to-r ${visual.panel}`}
                aria-hidden="true"
              />
            </div>

            <div className="relative z-10 mt-10 rounded-3xl border border-white/80 bg-white/72 p-5 shadow-xl shadow-zinc-950/10 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">
                Provider
              </p>
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl text-left transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#ccfbf1]"
                aria-label={`${providerName} 프로필 보기`}
              >
                <ProviderAvatar
                  nickname={providerName}
                  profileImageUrl={profileImageUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-zinc-950">
                    {providerName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">
                    조회 {formatOptionalCount(viewCount)}회 · 완료 {formatOptionalCount(completeCount)}건
                  </p>
                </div>
              </button>
            </div>
          </aside>

          <section className="relative p-8 lg:p-10">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 h-11 rounded-full border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              닫기
            </button>

            <div className="pr-20">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8c5bff]">
                Exchange Proposal
              </p>
              <h3 className="mt-3 text-2xl font-black text-zinc-950">
                이 재능과 교환을 제안해 보세요
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
                상대 재능의 조건을 확인하고, 내가 제공할 수 있는 재능을 기준으로 제안 메시지를 보낼 수 있습니다.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                label="필요 크레딧"
                value={creditPrice === null ? "-" : formatCredit(creditPrice)}
              />
              <MetricCard
                label="작업 기간"
                value={
                  estimatedHours === null
                    ? "-"
                    : formatEstimatedDuration(estimatedHours)
                }
              />
              <MetricCard
                label="평점"
                value={avgRating === null ? "-" : `★ ${formatRating(avgRating)}`}
              />
              <MetricCard
                label="완료"
                value={
                  completeCount === null
                    ? "-"
                    : `${formatOptionalCount(completeCount)}건`
                }
              />
            </div>

            <div className="mt-8 border-y border-zinc-200 py-6">
              <p className="text-sm font-black text-zinc-950">재능 소개</p>
              <p className="mt-3 whitespace-pre-line text-base font-semibold leading-8 text-zinc-700">
                {content}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50/70 p-5">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#ccfbf1]"
                  aria-label={`${providerName} 프로필 보기`}
                >
                  <ProviderAvatar
                    nickname={providerName}
                    profileImageUrl={profileImageUrl}
                    size="md"
                  />
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-zinc-950">
                      {providerName}
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#0f766e] ring-1 ring-[#ccfbf1]">
                      신뢰 {formatOptionalRating(trustScore)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
                    {providerIntroduction}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <label className="block text-sm font-black text-zinc-950">
                제안 메시지
                <textarea
                  value={requestMessage}
                  onChange={(event) => onRequestMessageChange(event.target.value)}
                  rows={5}
                  className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-semibold leading-6 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#0f766e] focus:ring-4 focus:ring-[#ccfbf1]/70"
                  placeholder="상대에게 어떤 재능을 제공할 수 있는지, 원하는 교환 방식은 무엇인지 적어 주세요."
                />
              </label>
              {requesterTalentTitle ? (
                <div className="mt-3 rounded-2xl border border-[#ccfbf1] bg-[#f0fdfa] px-4 py-3 text-sm font-black text-[#0f766e]">
                  제안 기준 내 재능 · {requesterTalentTitle}
                </div>
              ) : null}
              {disabledReason ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
                  {disabledReason}
                </p>
              ) : null}
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-zinc-200 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-full border border-zinc-300 bg-white px-6 text-sm font-black text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isProposalDisabled}
                onClick={onCreateProposal}
                className="h-12 rounded-full bg-zinc-950 px-7 text-sm font-black text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "전송 중..." : "교환 제안하기"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/[0.03]">
      <p className="text-xs font-black text-zinc-400">{label}</p>
      <p className="mt-2 text-base font-black text-zinc-950">{value}</p>
    </div>
  );
}

function ProviderAvatar({
  nickname,
  profileImageUrl,
  size,
}: {
  nickname: string | null | undefined;
  profileImageUrl: string | null | undefined;
  size: "sm" | "md";
}) {
  const displayName = getDisplayName(nickname);
  const imageUrl = profileImageUrl?.trim();
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-12 w-12 text-sm";
  const placeholderText =
    displayName === "프로필" ? "프로필" : displayName.slice(0, 1);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`${displayName} 프로필 이미지`}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-black text-zinc-500`}
    >
      {placeholderText}
    </div>
  );
}


function getDisplayName(nickname: string | null | undefined): string {
  return nickname?.trim() || "프로필";
}

function getOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatOptionalRating(value: number | null): string {
  return value === null ? "-" : formatRating(value);
}

function formatOptionalCount(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}
