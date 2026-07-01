"use client";

import { Code2, FileText, Palette, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import { UserProfileModal } from "@/components/profile/UserProfileModal";
import {
  ApiError,
  matchApi,
  profileApi,
  talentApi,
  type MatchRecommendationDetailRes,
  type MatchRecommendationRes,
} from "@/lib/api";
import {
  getStoredUserId,
  hasStoredAccessToken,
  setStoredLastTalentId,
} from "@/lib/auth";
import {
  isAuthRequiredError,
  isAuthRequiredMessage,
} from "@/lib/auth-required";
import {
  formatCredit,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";
import { getUserProfileImageUrl } from "@/utils/profileImage";

type RecommendationSource =
  "MY_TALENT" | "PROFILE_OWN_CATEGORY" | "PROFILE_WANT_CATEGORY";

interface RecommendationItem {
  requesterTalentId: number | null;
  requesterTalentTitle: string;
  requesterCategoryName: string;
  recommendation: MatchRecommendationRes;
  source: RecommendationSource;
}

interface SelectedRecommendationContext {
  requesterTalentId: number;
  requesterTalentTitle: string;
}

interface SetupAction {
  label: string;
  href: string;
}

const RECOMMENDATION_API_ERROR_MESSAGE =
  "내 재능과 매칭 추천 목록을 불러오는 중 문제가 발생했습니다.";

const categoryVisuals = {
  development: {
    Icon: Code2,
    tileBg: "bg-[#fff8e7]",
    panelBg: "bg-[#f97316]",
    lineBg: "bg-[#f97316]",
    badge: "text-[#b45309]",
    hover: "group-hover:text-[#c2410c]",
    label: "개발",
    headline: "개발",
  },
  design: {
    Icon: Palette,
    tileBg: "bg-[#f7fee7]",
    panelBg: "bg-[#5ec85a]",
    lineBg: "bg-[#22c55e]",
    badge: "text-[#3f6212]",
    hover: "group-hover:text-[#4d7c0f]",
    label: "디자인",
    headline: "디자인",
  },
  document: {
    Icon: FileText,
    tileBg: "bg-[#fff1f2]",
    panelBg: "bg-[#f05267]",
    lineBg: "bg-[#f43f5e]",
    badge: "text-[#9f1239]",
    hover: "group-hover:text-[#be123c]",
    label: "문서 정리",
    headline: "문서",
  },
  default: {
    Icon: Sparkles,
    tileBg: "bg-[#fff7ed]",
    panelBg: "bg-[#f97316]",
    lineBg: "bg-[#f97316]",
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
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [matchRecommendationItems, setMatchRecommendationItems] = useState<
    RecommendationItem[]
  >([]);
  const [selectedRecommendationContext, setSelectedRecommendationContext] =
    useState<SelectedRecommendationContext | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<MatchRecommendationDetailRes | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupActions, setSetupActions] = useState<SetupAction[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingDetailKey, setLoadingDetailKey] = useState<string | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const hasMissingSetup = setupActions.length > 0;
  const hasRecommendationItems = matchRecommendationItems.length > 0;

  const loadAutoRecommendations = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage("");
    setSetupActions([]);
    setIsLoadingList(true);

    try {
      const [myTalentsResponse, profile] = await Promise.all([
        talentApi.getMyList({ size: 50 }),
        profileApi.getMe(),
      ]);
      const activeMyTalents = Array.isArray(myTalentsResponse.content)
        ? myTalentsResponse.content
        : [];
      const activeWantCategories = (profile.wantTalentCategories ?? []).filter(
        (category) => category.active,
      );
      const nextSetupActions: SetupAction[] = [];
      if (activeMyTalents.length === 0) {
        nextSetupActions.push({
          label: "재능 등록하기",
          href: "/talents/new",
        });
      }

      if (activeWantCategories.length === 0) {
        nextSetupActions.push({
          label: "원하는 재능 카테고리 설정하기",
          href: "/profile/edit",
        });
      }

      if (nextSetupActions.length > 0) {
        setSetupActions(nextSetupActions);
        setMatchRecommendationItems([]);
        setSelectedRecommendationContext(null);
        setStatusMessage("");
        return;
      }

      const recommendationResults = await Promise.allSettled(
        activeMyTalents.map(async (myTalent) => {
          const recommendations = await matchApi.getRecommendations({
            talentId: myTalent.talentId,
          });

          return recommendations.map((recommendation) => {
            return {
              requesterTalentId: myTalent.talentId,
              requesterTalentTitle: myTalent.title,
              requesterCategoryName: myTalent.categoryName,
              recommendation,
              source: "MY_TALENT" as const,
            };
          });
        }),
      );

      const rejectedResult = recommendationResults.find(
        (result) => result.status === "rejected",
      );

      if (rejectedResult?.status === "rejected") {
        throw rejectedResult.reason;
      }

      const myTalentRecommendationItems = dedupeRecommendationItemsByProvider(
        recommendationResults.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        ),
      );

      // 프로필 카테고리 기반 검색 추천은 백엔드 매칭 추천과 섞지 않기 위해 비활성화합니다.
      // 필요하면 아래 함수를 다시 호출해 별도 화면에서만 사용하세요.
      // const profile = await profileApi.getMe();
      // const profileCategories = getProfileRecommendationCategories(profile);
      // const ownTalentIds = new Set(
      //   activeMyTalents.map((talent) => talent.talentId),
      // );
      // const seenRecommendationTalentIds = new Set(
      //   myTalentRecommendationItems.map((item) => item.recommendation.talentId),
      // );
      // const nextProfileCategoryRecommendationItems =
      //   await loadProfileCategoryRecommendationItems({
      //     categories: profileCategories,
      //     ownTalentIds,
      //     seenRecommendationTalentIds,
      //   });

      const userId = getStoredUserId();
      if (userId !== null && activeMyTalents[0]) {
        setStoredLastTalentId(userId, activeMyTalents[0].talentId);
      }

      setMatchRecommendationItems(myTalentRecommendationItems);
      setSelectedRecommendationContext(null);
      setStatusMessage("");
    } catch (error) {
      setMatchRecommendationItems([]);
      setSelectedRecommendationContext(null);
      setStatusMessage("");
      if (error instanceof ApiError && error.status === 404) {
        setErrorMessage(null);
        setSetupActions([
          {
            label: "재능 등록하기",
            href: "/talents/new",
          },
        ]);
        return;
      }

      setErrorMessage(
        isAuthRequiredError(error)
          ? "로그인 후 이용해 주세요."
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
    if (item.source !== "MY_TALENT") {
      router.push(`/talents/${item.recommendation.talentId}`);
      return;
    }

    if (item.requesterTalentId === null) {
      setErrorMessage("교환 제안에는 내가 등록한 재능이 필요합니다.");
      return;
    }

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

      setStatusMessage(
        "교환 제안이 전송되었습니다. 상대방의 응답을 기다려 주세요.",
      );
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

  const isLoginRequired = isAuthRequiredMessage(errorMessage);

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
          등록한 재능과 프로필 카테고리를 기준으로 자동 조회된 결과입니다.
        </p>
      </div>

      {isLoginRequired ? (
        <LoginRequiredState
          className="mb-5"
          description="매칭 추천과 교환 제안은 로그인 후 이용할 수 있어요."
        />
      ) : errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isHydrated && isLoadingList ? (
        <div className="border border-[#ded6ff] bg-white/90 p-8 text-center text-sm font-black text-zinc-500">
          매칭 추천을 불러오는 중입니다...
        </div>
      ) : null}

      {isHydrated &&
        !isLoadingList &&
        hasMissingSetup &&
        !errorMessage ? (
        <RecommendationSetupState
          actions={setupActions}
        />
      ) : null}

      {isHydrated &&
        !isLoadingList &&
        !hasMissingSetup &&
        !hasRecommendationItems &&
        !errorMessage ? (
        <EmptyState
          title="현재 추천 가능한 상대 재능이 없습니다."
          description="내 재능과 원하는 재능 카테고리에 맞는 다른 사용자의 재능이 생기면 자동으로 추천됩니다."
        />
      ) : null}

      {isHydrated && !isLoadingList && hasRecommendationItems ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matchRecommendationItems.map((item) => (
            <RecommendationCard
              key={getRecommendationItemKey(item)}
              recommendation={item.recommendation}
              requesterTalentTitle={item.requesterTalentTitle}
              requesterCategoryName={item.requesterCategoryName}
              source={item.source}
              isLoadingDetail={
                loadingDetailKey === getRecommendationItemKey(item)
              }
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
          requesterTalentTitle={
            selectedRecommendationContext?.requesterTalentTitle ?? null
          }
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

function RecommendationSetupState({ actions }: { actions: SetupAction[] }) {
  const hasMultipleActions = actions.length > 1;

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
      <p className="text-base font-semibold text-zinc-900">
        추천을 받기 위한 정보가 부족합니다.
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {hasMultipleActions
          ? "내 재능과 원하는 재능 카테고리를 등록하면 매칭 추천을 확인할 수 있습니다."
          : actions[0]?.href === "/talents/new"
            ? "내가 제공할 재능을 먼저 등록하면 매칭 추천을 확인할 수 있습니다."
            : "프로필에 원하는 재능 카테고리를 설정하면 매칭 추천을 확인할 수 있습니다."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/*
function getProfileRecommendationCategories(profile: {
  myTalentCategories?: { id: number; name: string; active: boolean }[];
  wantTalentCategories?: { id: number; name: string; active: boolean }[];
}) {
  const categories = [
    ...(profile.wantTalentCategories ?? []).map((category) => ({
      ...category,
      source: "PROFILE_WANT_CATEGORY" as const,
    })),
    ...(profile.myTalentCategories ?? []).map((category) => ({
      ...category,
      source: "PROFILE_OWN_CATEGORY" as const,
    })),
  ];
  const seenCategorySourceKeys = new Set<string>();

  return categories.filter((category) => {
    const key = `${category.source}-${category.id}`;

    if (!category.active || seenCategorySourceKeys.has(key)) {
      return false;
    }

    seenCategorySourceKeys.add(key);
    return true;
  });
}

async function loadProfileCategoryRecommendationItems({
  categories,
  ownTalentIds,
  seenRecommendationTalentIds,
}: {
  categories: ReturnType<typeof getProfileRecommendationCategories>;
  ownTalentIds: Set<number>;
  seenRecommendationTalentIds: Set<number>;
}): Promise<RecommendationItem[]> {
  const categoryResults = await Promise.allSettled(
    categories.map(async (category) => {
      const page = await talentApi.search({
        categoryId: category.id,
        size: 6,
        sort: "POPULAR",
      });

      return page.content
        .filter((talent) => !ownTalentIds.has(talent.talentId))
        .filter((talent) => !seenRecommendationTalentIds.has(talent.talentId))
        .slice(0, 3)
        .map((talent) => {
          seenRecommendationTalentIds.add(talent.talentId);

          return {
            requesterTalentId: null,
            requesterTalentTitle:
              category.source === "PROFILE_WANT_CATEGORY"
                ? "원하는 재능 카테고리"
                : "내가 가진 재능 카테고리",
            requesterCategoryName: category.name,
            recommendation: toProfileCategoryRecommendation(talent),
            source: category.source,
          };
        });
    }),
  );

  return categoryResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

function toProfileCategoryRecommendation(
  talent: TalentListRes,
): MatchRecommendationRes {
  return {
    talentId: talent.talentId,
    providerId: getTalentProviderId(talent),
    nickname:
      talent.authorNickname ??
      talent.nickname ??
      talent.sellerNickname ??
      talent.providerNickname ??
      talent.userNickname ??
      talent.author?.nickname ??
      null,
    providerNickname: talent.providerNickname ?? null,
    sellerNickname: talent.sellerNickname ?? null,
    authorNickname: talent.authorNickname ?? talent.author?.nickname ?? null,
    userNickname: talent.userNickname ?? null,
    categoryId: 0,
    categoryName: talent.categoryName,
    title: talent.title,
    content: "프로필에서 선택한 카테고리를 기준으로 추천된 재능입니다.",
    creditPrice: talent.creditPrice,
    estimatedHours: talent.estimatedHours,
    avgRating: talent.avgRating,
    completeCount: talent.completeCount,
    proposalRequestEnabled: false,
    proposalRequestDisabledReason: null,
  };
}

function getTalentProviderId(talent: TalentListRes): number {
  return (
    talent.authorId ??
    talent.author?.id ??
    talent.author?.userId ??
    talent.author?.authorId ??
    talent.author?.providerId ??
    talent.author?.sellerId ??
    0
  );
}
*/

function getRecommendationReason(source: RecommendationSource): string {
  switch (source) {
    case "MY_TALENT":
      return "내가 등록한 재능을 기반으로 추천";
    case "PROFILE_OWN_CATEGORY":
      return "내가 가진 재능 기반 추천";
    case "PROFILE_WANT_CATEGORY":
      return "원하는 재능 기반 추천";
  }
}

function getRecommendationActionLabel(source: RecommendationSource): string {
  return source === "MY_TALENT" ? "교환 상세 보기" : "재능 상세로 이동";
}

function dedupeRecommendationItemsByProvider(
  items: RecommendationItem[],
): RecommendationItem[] {
  const seenProviderIds = new Set<number>();

  return items.filter((item) => {
    const providerId = item.recommendation.providerId;

    if (seenProviderIds.has(providerId)) {
      return false;
    }

    seenProviderIds.add(providerId);
    return true;
  });
}

function getRecommendationItemKey(item: RecommendationItem): string {
  return `${item.source}-${item.requesterTalentId ?? item.requesterCategoryName}-${item.recommendation.providerId}`;
}

function RecommendationCard({
  recommendation,
  requesterTalentTitle,
  requesterCategoryName,
  source,
  isLoadingDetail,
  onOpen,
}: {
  recommendation: MatchRecommendationRes;
  requesterTalentTitle: string;
  requesterCategoryName: string;
  source: RecommendationSource;
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
        className={`relative aspect-square overflow-hidden ${visual.tileBg}`}
      >
        <div
          className={`absolute right-0 top-0 h-[40%] w-[40%] rounded-bl-[48px] ${visual.panelBg} transition group-hover:scale-[1.02]`}
        />
        <div className="absolute left-8 top-[76px] z-20 flex h-10 w-16 items-center justify-center rounded-t-[18px] rounded-b-none border border-b-0 border-white/88 bg-white/76 backdrop-blur">
          <CategoryIcon
            className={`h-7 w-7 ${visual.badge}`}
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-x-8 top-[116px] bottom-8 z-10 rounded-b-[24px] rounded-tr-[24px] border border-t-0 border-white/88 bg-white/76 p-6 shadow-xl shadow-orange-950/10 backdrop-blur">
          <span className="block text-[42px] font-black leading-none tracking-normal text-zinc-950">
            {visual.headline}
          </span>
          <div
            className={`mt-5 h-2 w-20 rounded-full ${visual.lineBg}`}
            aria-hidden="true"
          />
        </div>
        <span
          className={`absolute right-5 top-5 rounded-full bg-white/88 px-3 py-1 text-xs font-black ${visual.badge} shadow-sm`}
        >
          {recommendation.categoryName}
        </span>
      </div>

      <div className="pt-5">
        <p className="mb-2 line-clamp-1 text-xs font-black text-[#8c5bff]">
          {source === "MY_TALENT"
            ? `내 재능: ${requesterCategoryName} · ${requesterTalentTitle}`
            : `프로필 관심: ${requesterCategoryName}`}
        </p>
        <h2
          className={`line-clamp-2 min-h-14 text-[17px] font-black leading-7 text-zinc-950 transition ${visual.hover}`}
        >
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
          ★ {formatRating(recommendation.avgRating)} · 완료{" "}
          {recommendation.completeCount}건
        </p>

        <p
          className={`mt-3 line-clamp-2 text-xs font-black ${source === "MY_TALENT" ? "text-[#0f766e]" : "text-[#b45309]"
            }`}
        >
          {getRecommendationReason(source)}
        </p>

        <span className="mt-4 inline-flex border-b-2 border-[#8c5bff] pb-1 text-sm font-black text-[#8c5bff] transition group-hover:text-zinc-950">
          {isLoadingDetail
            ? "상세 불러오는 중..."
            : getRecommendationActionLabel(source)}
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
            className={`relative min-h-[360px] overflow-hidden ${visual.tileBg} p-8 lg:min-h-full`}
          >
            <div
              className={`absolute -right-14 -top-14 h-52 w-52 rounded-[60px] ${visual.panelBg} opacity-90 blur-[1px]`}
            />
            <div
              className={`absolute right-16 top-24 h-24 w-24 rounded-full ${visual.panelBg} opacity-20 blur-2xl`}
            />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <span
                className={`rounded-full bg-white/90 px-4 py-2 text-sm font-black ${visual.badge} shadow-sm`}
              >
                {categoryName}
              </span>
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-black text-[#0f766e] shadow-sm">
                신뢰 {formatOptionalRating(trustScore)}
              </span>
            </div>

            <div className="relative z-10 mt-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 shadow-lg shadow-zinc-950/10">
                <CategoryIcon
                  className={`h-8 w-8 ${visual.badge}`}
                  aria-hidden="true"
                />
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
                className={`mt-6 h-2 w-24 rounded-full ${visual.lineBg}`}
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
                    조회 {formatOptionalCount(viewCount)}회 · 완료{" "}
                    {formatOptionalCount(completeCount)}건
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
                상대 재능의 조건을 확인하고, 내가 제공할 수 있는 재능을 기준으로
                제안 메시지를 보낼 수 있습니다.
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
                value={
                  avgRating === null ? "-" : `★ ${formatRating(avgRating)}`
                }
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
                  onChange={(event) =>
                    onRequestMessageChange(event.target.value)
                  }
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
  const imageUrl = getUserProfileImageUrl(profileImageUrl);
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-12 w-12 text-sm";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={`${displayName} 프로필 이미지`}
      className={`${sizeClass} shrink-0 rounded-full object-cover`}
    />
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
