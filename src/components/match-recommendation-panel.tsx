"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UserProfileModal } from "@/components/profile/UserProfileModal";
import {
  ApiError,
  matchApi,
  type MatchRecommendationDetailRes,
  type MatchRecommendationRes,
} from "@/lib/api";
import {
  clearStoredLastTalentId,
  getStoredLastTalentId,
  getStoredUserId,
  hasStoredAccessToken,
  setStoredLastTalentId,
} from "@/lib/auth";
import {
  formatCredit,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

interface RequestContext {
  requesterTalentId: number;
}

const EMPTY_TALENT_ID_MESSAGE = "추천을 조회할 내 재능 ID를 먼저 입력해 주세요.";
const RECOMMENDATION_API_ERROR_MESSAGE =
  "추천 목록을 불러오는 중 문제가 발생했습니다.";
const STORED_TALENT_FORBIDDEN_MESSAGE =
  "저장된 재능 ID로 추천을 조회할 수 없습니다. 내 재능 상세 페이지에 다시 진입하거나 재능을 다시 등록해 주세요.";
const MANUAL_TALENT_FORBIDDEN_MESSAGE =
  "해당 재능으로 추천을 조회할 권한이 없습니다. 본인이 등록한 재능 ID를 입력해 주세요.";

type RecommendationLoadSource = "manual" | "stored";

export function MatchRecommendationPanel() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [requesterTalentIdInput, setRequesterTalentIdInput] = useState("");
  const [rememberedTalentId, setRememberedTalentId] = useState<number | null>(
    null,
  );
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [requestContext, setRequestContext] = useState<RequestContext | null>(
    null,
  );
  const [recommendations, setRecommendations] = useState<
    MatchRecommendationRes[]
  >([]);
  const [selectedDetail, setSelectedDetail] =
    useState<MatchRecommendationDetailRes | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingDetailTalentId, setLoadingDetailTalentId] = useState<
    number | null
  >(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const hasSearched = requestContext !== null;

  const loadRecommendations = useCallback(async (
    context: RequestContext,
    clearStatusMessage = true,
    source: RecommendationLoadSource = "manual",
  ) => {
    setErrorMessage(null);
    if (clearStatusMessage) {
      setStatusMessage("");
    }
    setIsLoadingList(true);

    try {
      const response = await matchApi.getRecommendations({
        talentId: context.requesterTalentId,
      });
      const userId = getStoredUserId();

      if (userId !== null) {
        setStoredLastTalentId(userId, context.requesterTalentId);
        setRememberedTalentId(context.requesterTalentId);
      }

      setRequesterTalentIdInput(String(context.requesterTalentId));
      setRequestContext(context);
      setIsManualInputOpen(false);

      if (source === "stored") {
        setStatusMessage("최근 등록한 재능 기준으로 추천을 조회했습니다.");
      }

      setRecommendations(Array.isArray(response) ? response : []);
    } catch (error) {
      const userId = getStoredUserId();

      if (error instanceof ApiError && error.status === 403) {
        if (userId !== null) {
          clearStoredLastTalentId(userId, context.requesterTalentId);
        }

        setRequesterTalentIdInput("");
        setRememberedTalentId(null);
        setRequestContext(null);
        setIsManualInputOpen(true);
      }

      setStatusMessage("");
      setRecommendations([]);
      setErrorMessage(
        error instanceof ApiError && error.status === 403
          ? source === "stored"
            ? STORED_TALENT_FORBIDDEN_MESSAGE
            : MANUAL_TALENT_FORBIDDEN_MESSAGE
          : RECOMMENDATION_API_ERROR_MESSAGE,
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsHydrated(true);

      const userId = getStoredUserId();

      if (!hasStoredAccessToken() || userId === null) {
        setIsManualInputOpen(true);
        return;
      }

      const storedTalentId = getStoredLastTalentId(userId);

      if (storedTalentId === null) {
        setIsManualInputOpen(true);
        return;
      }

      const nextContext = { requesterTalentId: storedTalentId };

      setRememberedTalentId(storedTalentId);
      setRequesterTalentIdInput(String(storedTalentId));
      setRequestContext(nextContext);
      void loadRecommendations(
        nextContext,
        false,
        "stored",
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRecommendations]);

  async function handleSearch() {
    const trimmedRequesterTalentId = requesterTalentIdInput.trim();
    const requesterTalentId = Number(trimmedRequesterTalentId);

    if (!hasStoredAccessToken()) {
      setErrorMessage("로그인 후 이용해 주세요.");
      setRecommendations([]);
      setRequestContext(null);
      return;
    }

    if (!trimmedRequesterTalentId) {
      setErrorMessage(EMPTY_TALENT_ID_MESSAGE);
      setRecommendations([]);
      setRequestContext(null);
      return;
    }

    if (!Number.isInteger(requesterTalentId) || requesterTalentId <= 0) {
      setErrorMessage("재능 ID는 숫자로 입력해 주세요.");
      setRecommendations([]);
      setRequestContext(null);
      return;
    }

    const nextContext = { requesterTalentId };
    setRequestContext(nextContext);
    await loadRecommendations(nextContext);
  }

  async function handleOpenDetail(recommendation: MatchRecommendationRes) {
    if (!requestContext) {
      setErrorMessage("먼저 매칭 추천을 조회해 주세요.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage("");
    setLoadingDetailTalentId(recommendation.talentId);

    try {
      const response = await matchApi.getRecommendationDetail({
        providerTalentId: recommendation.talentId,
        requesterTalentId: requestContext.requesterTalentId,
      });
      setSelectedDetail(response);
      setIsProfileModalOpen(false);
      setRequestMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "매칭 추천 상세를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingDetailTalentId(null);
    }
  }

  async function handleCreateProposal() {
    if (!requestContext || !selectedDetail) {
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
        requesterTalentId: requestContext.requesterTalentId,
        providerId: selectedDetail.providerId,
        providerTalentId: selectedDetail.talentId,
        requestMessage: trimmedMessage,
      });
      setStatusMessage("교환 제안이 전송되었습니다.");
      setIsProfileModalOpen(false);
      setRequestMessage("");

      try {
        const refreshedDetail = await matchApi.getRecommendationDetail({
          providerTalentId: selectedDetail.talentId,
          requesterTalentId: requestContext.requesterTalentId,
        });
        setSelectedDetail(refreshedDetail);
      } catch {
        setSelectedDetail(null);
      }

      await loadRecommendations(requestContext, false);
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
  }

  function handleOpenProfileModal() {
    setErrorMessage(null);
    setIsProfileModalOpen(true);
  }

  return (
    <>
      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        {!isHydrated ? (
          <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm font-semibold text-zinc-600">
            매칭 추천 정보를 확인하는 중입니다...
          </p>
        ) : rememberedTalentId && !isManualInputOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-zinc-950">
                최근 등록한 내 재능 기준으로 추천을 조회합니다.
              </p>
              <p className="mt-1 text-xs font-semibold text-teal-700">
                재능 ID: {rememberedTalentId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsManualInputOpen(true)}
              className="h-10 cursor-pointer rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition hover:border-teal-300 hover:text-teal-700"
            >
              다른 재능 ID로 조회
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <label className="block text-sm font-semibold text-zinc-800">
                내 재능 ID
                <input
                  value={requesterTalentIdInput}
                  onChange={(event) => {
                    setRequesterTalentIdInput(event.target.value);
                    setRememberedTalentId(null);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="예: 1"
                  className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <button
                type="button"
                disabled={isLoadingList}
                onClick={handleSearch}
                className="mt-7 h-11 cursor-pointer rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
              >
                {isLoadingList ? "조회 중" : "조회"}
              </button>
            </div>
            {rememberedTalentId ? (
              <p className="mt-3 rounded-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                최근 등록한 내 재능으로 추천을 조회합니다. 재능 ID:{" "}
                {rememberedTalentId}
              </p>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                저장된 재능 ID가 없습니다. 재능을 등록하거나 내 재능 상세
                페이지에 들어가면 자동으로 저장됩니다.
              </p>
            )}
          </>
        )}
        {isHydrated ? (
          <p className="mt-2 text-xs text-zinc-500">
            userId나 profileId가 아니라 재능 상세 URL의 talentId를 입력해야
            합니다.
          </p>
        ) : null}
      </section>

      {statusMessage ? (
        <p className="mb-5 rounded-md bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isHydrated && isLoadingList ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          매칭 추천을 불러오는 중입니다...
        </div>
      ) : null}

      {isHydrated &&
      !isLoadingList &&
      hasSearched &&
      recommendations.length === 0 ? (
        <EmptyState
          title="현재 같은 카테고리에 추천 가능한 상대 재능이 없습니다."
          description="다른 내 재능 ID로 조회하거나, 같은 카테고리에 등록된 상대 재능이 생긴 뒤 다시 확인해 주세요."
        />
      ) : null}

      {isHydrated && !isLoadingList && !hasSearched && !errorMessage ? (
        <EmptyState
          title="추천을 조회할 내 재능 ID를 입력해 주세요."
          description="재능 상세 페이지에서 내 재능 ID를 확인한 뒤 입력하면 같은 카테고리의 추천 상대를 볼 수 있습니다."
        />
      ) : null}

      {isHydrated && !isLoadingList && recommendations.length > 0 ? (
        <div className="grid grid-cols-3 gap-5">
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.talentId}
              recommendation={recommendation}
              isLoadingDetail={
                loadingDetailTalentId === recommendation.talentId
              }
              onOpen={() => handleOpenDetail(recommendation)}
            />
          ))}
        </div>
      ) : null}

      {selectedDetail ? (
        <RecommendationDetailModal
          detail={selectedDetail}
          requestMessage={requestMessage}
          isSubmitting={isSubmittingProposal}
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

function RecommendationCard({
  recommendation,
  isLoadingDetail,
  onOpen,
}: {
  recommendation: MatchRecommendationRes;
  isLoadingDetail: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-[356px] cursor-pointer flex-col rounded-lg border border-zinc-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100"
    >
      <div className="flex h-14 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-black text-zinc-950">
            {recommendation.title}
          </p>
          <p className="mt-1 truncate text-sm text-zinc-500">
            {recommendation.categoryName} · 완료{" "}
            {recommendation.completeCount}건
          </p>
        </div>
        <StatusBadge label={recommendation.categoryName} tone="info" />
      </div>

      <p className="mt-4 line-clamp-4 h-24 text-sm leading-6 text-zinc-700">
        {recommendation.content}
      </p>

      <div className="mt-4 grid h-[96px] grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div>
          <p className="text-xs text-zinc-500">필요 크레딧</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatCredit(recommendation.creditPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">예상 작업 기간</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatEstimatedDuration(recommendation.estimatedHours)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">평점</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            ★ {formatRating(recommendation.avgRating)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">제안 가능</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {recommendation.proposalRequestEnabled ? "가능" : "불가"}
          </p>
        </div>
      </div>

      {recommendation.proposalRequestDisabledReason ? (
        <p className="mt-3 line-clamp-2 text-xs font-semibold text-amber-700">
          {recommendation.proposalRequestDisabledReason}
        </p>
      ) : null}

      <span className="mt-auto border-t border-zinc-100 pt-4 text-sm font-bold text-teal-700">
        {isLoadingDetail ? "상세 불러오는 중..." : "상세 보기"}
      </span>
    </button>
  );
}

function RecommendationDetailModal({
  detail,
  requestMessage,
  isSubmitting,
  onRequestMessageChange,
  onClose,
  onOpenProfile,
  onCreateProposal,
}: {
  detail: MatchRecommendationDetailRes;
  requestMessage: string;
  isSubmitting: boolean;
  onRequestMessageChange: (value: string) => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onCreateProposal: () => void;
}) {
  const disabledReason = detail.proposalRequestDisabledReason;
  const isProposalDisabled = !detail.proposalRequestEnabled || isSubmitting;
  const providerName = getDisplayName(detail.nickname);
  const providerIntroduction =
    detail.introduction?.trim() || "소개가 아직 없습니다.";
  const profileImageUrl = detail.profileImageUrl?.trim() || null;
  const categoryName = detail.categoryName?.trim() || "카테고리";
  const title = detail.title?.trim() || "제목 없음";
  const trustScore = getOptionalNumber(detail.trustScore);
  const viewCount = getOptionalNumber(detail.viewCount);
  const creditPrice = getOptionalNumber(detail.creditPrice);
  const estimatedHours = getOptionalNumber(detail.estimatedHours);
  const avgRating = getOptionalNumber(detail.avgRating);
  const completeCount = getOptionalNumber(detail.completeCount);
  const content = detail.content?.trim() || "상세 설명이 없습니다.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6"
    >
      <div className="max-h-[88vh] w-[760px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={categoryName} tone="info" />
              <StatusBadge
                label={`신뢰 ${formatOptionalRating(trustScore)}`}
                tone="success"
              />
            </div>
            <h2
              id="match-detail-title"
              className="mt-4 text-2xl font-black text-zinc-950"
            >
              {title}
            </h2>
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <button
                type="button"
                onClick={onOpenProfile}
                className="inline-flex min-w-0 items-center gap-2 rounded-md pr-1 text-left transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-100"
                aria-label={`${providerName} 프로필 보기`}
              >
                <ProviderAvatar
                  nickname={providerName}
                  profileImageUrl={profileImageUrl}
                  size="sm"
                />
                <span className="truncate font-semibold text-zinc-700 underline-offset-4 hover:underline">
                  {providerName}
                </span>
              </button>
              <span>· 조회 {formatOptionalCount(viewCount)}회</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-bold text-zinc-700 transition hover:border-zinc-500"
          >
            닫기
          </button>
        </div>

        <p className="mt-6 whitespace-pre-line leading-7 text-zinc-700">
          {content}
        </p>

        <div className="mt-6 grid grid-cols-4 gap-4 rounded-lg bg-zinc-50 p-5 text-sm">
          <Metric
            label="필요 크레딧"
            value={creditPrice === null ? "-" : formatCredit(creditPrice)}
          />
          <Metric
            label="예상 작업 기간"
            value={
              estimatedHours === null
                ? "-"
                : formatEstimatedDuration(estimatedHours)
            }
          />
          <Metric
            label="평점"
            value={avgRating === null ? "-" : `★ ${formatRating(avgRating)}`}
          />
          <Metric
            label="완료"
            value={
              completeCount === null
                ? "-"
                : `${formatOptionalCount(completeCount)}건`
            }
          />
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 p-5">
          <p className="font-black text-zinc-950">제공자 프로필</p>
          <button
            type="button"
            onClick={onOpenProfile}
            className="mt-4 flex w-full items-center gap-3 rounded-md text-left transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-100"
            aria-label={`${providerName} 프로필 보기`}
          >
            <ProviderAvatar
              nickname={providerName}
              profileImageUrl={profileImageUrl}
              size="md"
            />
            <div>
              <p className="text-lg font-black text-zinc-950">
                {providerName}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                신뢰 점수 {formatOptionalRating(trustScore)}
              </p>
            </div>
          </button>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            {providerIntroduction}
          </p>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-semibold text-zinc-800">
            제안 메시지
            <textarea
              value={requestMessage}
              onChange={(event) => onRequestMessageChange(event.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="상대에게 보낼 교환 제안 메시지를 입력해 주세요."
            />
          </label>
          {disabledReason ? (
            <p className="mt-2 text-sm font-semibold text-amber-700">
              {disabledReason}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-zinc-300 px-5 text-sm font-bold text-zinc-700 transition hover:border-zinc-500"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isProposalDisabled}
            onClick={onCreateProposal}
            className="h-11 rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {isSubmitting ? "전송 중..." : "교환 제안하기"}
          </button>
        </div>
      </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
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
