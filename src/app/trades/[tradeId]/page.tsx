"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/common/ErrorState";
import {
  tradeApi,
  type TradeRes,
  type TradeSubmissionRes,
} from "@/lib/api";
import { formatCredit, formatDate } from "@/utils/format";

const MAX_SUBMISSION_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const TRADE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "거래 진행 중",
  COMPLETED: "거래 완료",
  CANCELLED: "거래 취소",
  DISPUTED: "분쟁 중",
  UNDER_REVIEW: "구매자 검토 중",
  AWAITING_PARTNER: "상대 확정 대기",
};

const ESCROW_STATUS_LABELS: Record<string, string> = {
  HELD: "예치 중",
  RELEASED: "정산 완료",
  REFUNDED: "환불 완료",
  FROZEN: "동결",
  DISPUTED: "분쟁 중",
};

const TRADE_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "크레딧 구매",
  SWAP: "재능 교환",
};

const inputClassName =
  "form-input rounded-lg border-[#d9ccff] bg-white/95 px-4 py-3 text-[15px] font-semibold leading-7 shadow-sm shadow-violet-950/[0.03] transition focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]";

const sideCardClassName =
  "relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-6 shadow-sm shadow-violet-950/[0.04] backdrop-blur";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUserId = window.localStorage.getItem("baton_user_id");
  const userId = storedUserId === null ? NaN : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getStatusTone(
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"],
): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "RELEASED") return "success";
  if (status === "CANCELLED" || status === "DISPUTED" || status === "FROZEN") {
    return "danger";
  }
  if (status === "UNDER_REVIEW" || status === "HELD") return "warning";
  if (status === "IN_PROGRESS") return "info";
  return "default";
}

function getStatusClass(
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"],
): string {
  const classes = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
    info: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
  };

  return classes[getStatusTone(status)];
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"];
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${getStatusClass(
        status,
      )}`}
    >
      {label}
    </span>
  );
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9ccff] bg-white px-3 py-1.5 text-xs font-black text-[#8c5bff]">
      {label}
    </span>
  );
}

function getTradeStatusLabel(status: string): string {
  return TRADE_STATUS_LABELS[status] ?? status;
}

function getEscrowStatusLabel(status: string): string {
  return ESCROW_STATUS_LABELS[status] ?? status;
}

function getTradeTypeLabel(type: string): string {
  return TRADE_TYPE_LABELS[type] ?? type;
}

function getParticipantDisplayName(
  role: "buyer" | "seller",
  nickname: string | null | undefined,
  userId: number,
): string {
  const roleLabel = role === "buyer" ? "구매자" : "판매자";
  return nickname?.trim() || `${roleLabel} #${userId}`;
}

function getCurrentUserDisplayName(
  trade: TradeRes,
  currentUserId: number | null,
): string {
  if (currentUserId === trade.buyerId) {
    return getParticipantDisplayName(
      "buyer",
      trade.buyerNickname,
      trade.buyerId,
    );
  }

  if (currentUserId === trade.sellerId) {
    return getParticipantDisplayName(
      "seller",
      trade.sellerNickname,
      trade.sellerId,
    );
  }

  return "거래 참여자가 아닙니다.";
}

export default function TradeDetailPage() {
  const params = useParams<{ tradeId: string }>();
  const tradeId = Number(params.tradeId);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [trade, setTrade] = useState<TradeRes | null>(null);
  const [submission, setSubmission] = useState<TradeSubmissionRes | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSubmissionLoading, setIsSubmissionLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadTradeDetail() {
      await Promise.resolve();

      if (!Number.isInteger(tradeId) || tradeId <= 0) {
        if (!ignore) {
          setErrorMessage("유효한 거래 ID가 아닙니다.");
          setIsLoading(false);
        }
        return;
      }

      const userId = readStoredUserId();

      if (userId === null) {
        if (!ignore) {
          setCurrentUserId(null);
          setErrorMessage("로그인 후 이용해 주세요.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextTrade = await tradeApi.getDetail(tradeId);

        if (ignore) {
          return;
        }

        setCurrentUserId(userId);
        setTrade(nextTrade);
        setSubmission(null);
        setSubmissionMessage(null);
        setErrorMessage(null);
      } catch (error) {
        if (ignore) {
          return;
        }

        setTrade(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "거래 상세를 불러오지 못했습니다.",
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadTradeDetail();

    return () => {
      ignore = true;
    };
  }, [tradeId]);

  async function refreshTrade(nextSuccessMessage?: string) {
    if (currentUserId === null || !Number.isInteger(tradeId)) {
      return;
    }

    const nextTrade = await tradeApi.getDetail(tradeId);
    setTrade(nextTrade);
    if (nextSuccessMessage) {
      setSuccessMessage(nextSuccessMessage);
    }
  }

  const loadSubmission = useCallback(
    async (showSuccessMessage = false) => {
      if (!trade || currentUserId === null) {
        return;
      }

      setSubmissionMessage(null);
      setIsSubmissionLoading(true);

      try {
        const nextSubmission = await tradeApi.getSubmission(trade.tradeId);
        setSubmission(nextSubmission);
        if (showSuccessMessage) {
          setSuccessMessage("결과물을 불러왔습니다.");
        }
      } catch (error) {
        setSubmission(null);
        setSubmissionMessage(
          error instanceof Error
            ? error.message
            : "결과물을 불러오지 못했습니다.",
        );
      } finally {
        setIsSubmissionLoading(false);
      }
    },
    [currentUserId, trade],
  );

  useEffect(() => {
    if (
      !trade ||
      currentUserId === null ||
      currentUserId !== trade.buyerId ||
      trade.tradeStatus !== "UNDER_REVIEW"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSubmission(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [trade, currentUserId, loadSubmission]);

  async function handleConfirmTrade() {
    if (!trade || currentUserId === null) {
      return;
    }

    if (!window.confirm("결과물을 확인했고 구매를 확정하시겠습니까?")) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await tradeApi.confirm(trade.tradeId);
      await refreshTrade("구매가 확정되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "구매 확정에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleCancelTrade() {
    if (!trade || currentUserId === null) {
      return;
    }

    if (!window.confirm("진행 중인 거래를 취소하시겠습니까?")) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await tradeApi.cancel(trade.tradeId);
      await refreshTrade("거래가 취소되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "거래 취소에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleDisputeTrade() {
    if (!trade || currentUserId === null) {
      return;
    }

    const reason = disputeReason.trim();
    if (reason.length < 5 || reason.length > 200) {
      setErrorMessage("분쟁 사유는 5자 이상 200자 이하로 입력해 주세요.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await tradeApi.dispute(trade.tradeId, { reason });
      setDisputeReason("");
      await refreshTrade("분쟁이 신청되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "분쟁 신청에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleLoadSubmission() {
    setErrorMessage(null);
    setSuccessMessage("");
    await loadSubmission(true);
  }

  function handleSubmissionFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSuccessMessage("");

    if (file === null) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
      event.target.value = "";
      setSelectedFile(null);
      setErrorMessage("결과물 파일은 20MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  }

  async function handleSubmitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trade || currentUserId === null) {
      return;
    }

    if (selectedFile === null) {
      setErrorMessage("제출할 결과물 파일을 선택해 주세요.");
      return;
    }

    if (selectedFile.size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
      setErrorMessage("결과물 파일은 20MB 이하만 업로드할 수 있습니다.");
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setErrorMessage("결과물 설명을 입력해 주세요.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setSubmissionMessage(null);
    setIsActionLoading(true);

    try {
      const presigned = await tradeApi.createSubmissionPresignedUrl(
        trade.tradeId,
        {
          fileName: selectedFile.name,
        },
      );

      await tradeApi.uploadFileToPresignedUrl(
        presigned.presignedUrl,
        selectedFile,
      );

      const nextSubmission = await tradeApi.submitResult(
        trade.tradeId,
        {
          fileKey: presigned.fileKey,
          description: trimmedDescription,
        },
      );
      setSubmission(nextSubmission);
      setSelectedFile(null);
      setDescription("");
      await refreshTrade("결과물이 제출되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "결과물 제출에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  const isBuyer = trade !== null && currentUserId === trade.buyerId;
  const isSeller = trade !== null && currentUserId === trade.sellerId;
  const canSubmitResult =
    trade !== null && isSeller && trade.tradeStatus === "IN_PROGRESS";
  const canReviewResult =
    trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW";
  const canCancelTrade =
    trade !== null &&
    (isBuyer || isSeller) &&
    trade.tradeStatus === "IN_PROGRESS";
  const canDisputeTrade =
    trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW";
  const shouldShowSwapAwaitingPartnerNotice =
    trade !== null &&
    trade.tradeType === "SWAP" &&
    trade.tradeStatus === "AWAITING_PARTNER";
  const shouldShowBuyerInProgressNotice =
    trade !== null && isBuyer && trade.tradeStatus === "IN_PROGRESS";
  const shouldShowSellerReviewNotice =
    trade !== null && isSeller && trade.tradeStatus === "UNDER_REVIEW";
  const shouldShowSubmissionSection =
    submission !== null ||
    (trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW");
  const terminalTradeMessage =
    trade?.tradeStatus === "COMPLETED"
      ? "거래가 완료되었습니다."
      : trade?.tradeStatus === "CANCELLED"
        ? "거래가 취소되었습니다."
        : trade?.tradeStatus === "DISPUTED"
          ? "분쟁 중인 거래입니다."
          : null;

  if (isLoading) {
    return (
      <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-[linear-gradient(135deg,#fbfdff_0%,#edf5ff_46%,#f4efff_100%)]">
        <div
          className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8c5bff]/12 blur-3xl"
          aria-hidden="true"
        />

        <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
          <div className="mx-auto w-full max-w-[880px] rounded-lg border border-[#ded6ff] bg-white/90 p-6 text-center text-sm font-black text-zinc-500 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
            거래 상세를 불러오는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-[linear-gradient(135deg,#fbfdff_0%,#edf5ff_46%,#f4efff_100%)]">
      <div
        className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8c5bff]/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[8%] top-48 h-52 w-52 rounded-full bg-[#79e4dd]/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="fixed-container relative pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pt-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-[#8c5bff]">
            Trade Desk
          </p>
          <h1 className="baton-page-title mt-4">
            TRADE DETAIL
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-600 sm:mt-5 sm:text-lg sm:leading-8">
            거래 상태, 에스크로, 결과물 제출과 구매 확정을 한 화면에서 확인하세요.
          </p>
        </header>

      {errorMessage ? (
        <div className="mx-auto mt-8 w-full max-w-[1180px]">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {successMessage ? (
        <p className="mx-auto mt-8 w-full max-w-[1180px] rounded-lg border border-[#d9ccff] bg-[#fbf9ff] p-4 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.04]">
          {successMessage}
        </p>
      ) : null}

      {trade ? (
        <div className="mx-auto mt-8 grid w-full max-w-[1180px] grid-cols-1 gap-6 lg:mt-12 lg:grid-cols-[1fr_360px]">
          <section className="relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-5 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
            <div
              className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
              aria-hidden="true"
            />
            <div className="flex flex-wrap gap-2">
              <StatusPill
                label={getTradeStatusLabel(trade.tradeStatus)}
                status={trade.tradeStatus}
              />
              <StatusPill
                label={getEscrowStatusLabel(trade.escrowStatus)}
                status={trade.escrowStatus}
              />
              <TypePill label={getTradeTypeLabel(trade.tradeType)} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              <SummaryItem title="거래 ID" value={`#${trade.tradeId}`} />
              <SummaryItem title="재능 ID" value={`#${trade.talentId}`} />
              <SummaryItem
                title="크레딧 가격"
                value={formatCredit(trade.creditPrice)}
              />
              <SummaryItem
                title="구매자"
                value={getParticipantDisplayName(
                  "buyer",
                  trade.buyerNickname,
                  trade.buyerId,
                )}
              />
              <SummaryItem
                title="판매자"
                value={getParticipantDisplayName(
                  "seller",
                  trade.sellerNickname,
                  trade.sellerId,
                )}
              />
              <SummaryItem
                title="매칭 ID"
                value={trade.matchId === null ? "-" : `#${trade.matchId}`}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-white/80 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              <SummaryItem
                title="거래 상태"
                value={getTradeStatusLabel(trade.tradeStatus)}
              />
              <SummaryItem
                title="에스크로 상태"
                value={getEscrowStatusLabel(trade.escrowStatus)}
              />
              <SummaryItem
                title="거래 타입"
                value={getTradeTypeLabel(trade.tradeType)}
              />
              <SummaryItem
                title="에스크로 만료"
                value={
                  trade.escrowExpiresAt
                    ? formatDate(trade.escrowExpiresAt)
                    : "-"
                }
              />
              <SummaryItem title="생성일" value={formatDate(trade.createdAt)} />
              <SummaryItem title="수정일" value={formatDate(trade.updatedAt)} />
              <SummaryItem
                title="현재 사용자"
                value={getCurrentUserDisplayName(trade, currentUserId)}
              />
            </div>
          </section>

          <aside className="space-y-5">
            {terminalTradeMessage && (isBuyer || isSeller) ? (
              <TradeActionNotice
                title="거래 상태"
                description={`${terminalTradeMessage} 더 이상 진행할 액션이 없습니다.`}
              />
            ) : null}

            {!terminalTradeMessage && shouldShowBuyerInProgressNotice ? (
              <TradeActionNotice
                title="작업 진행 중입니다"
                description="판매자가 결과물을 제출하면 확인할 수 있습니다."
              />
            ) : null}

            {!terminalTradeMessage && shouldShowSwapAwaitingPartnerNotice ? (
              <TradeActionNotice
                title="상대 확정을 기다리고 있습니다"
                description="재능 교환 거래의 한쪽 확정이 완료되었습니다. 상대방이 결과물을 확인하고 확정하면 교환 거래가 완료됩니다."
              />
            ) : null}

            {!terminalTradeMessage && canCancelTrade ? (
              <section className={sideCardClassName}>
                <p className="font-black text-zinc-950">거래 취소</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  작업 진행 중인 거래만 참여자가 취소할 수 있습니다.
                </p>
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={handleCancelTrade}
                  className="mt-5 h-11 w-full cursor-pointer rounded-lg border border-rose-200 bg-white px-4 text-sm font-black text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  거래 취소
                </button>
              </section>
            ) : null}

            {!terminalTradeMessage && canReviewResult ? (
              <section className={sideCardClassName}>
                <p className="font-black text-zinc-950">구매자 액션</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  결과물을 확인한 뒤 구매를 확정할 수 있습니다.
                </p>
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    disabled={isActionLoading || isSubmissionLoading}
                    onClick={handleLoadSubmission}
                    className="h-11 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmissionLoading ? "조회 중" : "결과물 다시 조회"}
                  </button>
                  <button
                    type="button"
                    disabled={isActionLoading || trade.tradeStatus !== "UNDER_REVIEW"}
                    onClick={handleConfirmTrade}
                    className="h-11 cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] px-4 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                  >
                    구매 확정
                  </button>
                </div>
              </section>
            ) : null}

            {!terminalTradeMessage && canDisputeTrade ? (
              <section className={sideCardClassName}>
                <p className="font-black text-zinc-950">분쟁 신청</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  결과물이 약속과 다를 경우 5자 이상 200자 이하로 사유를
                  입력해 주세요.
                </p>
                <textarea
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  maxLength={200}
                  rows={4}
                  className={`${inputClassName} mt-4 min-h-24 resize-none`}
                />
                <button
                  type="button"
                  disabled={
                    isActionLoading ||
                    disputeReason.trim().length < 5 ||
                    disputeReason.trim().length > 200
                  }
                  onClick={handleDisputeTrade}
                  className="mt-3 h-11 w-full cursor-pointer rounded-lg border border-amber-200 bg-white px-4 text-sm font-black text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  분쟁 신청
                </button>
              </section>
            ) : null}

            {!terminalTradeMessage && canSubmitResult ? (
              <section className={sideCardClassName}>
                <p className="font-black text-zinc-950">결과물 제출</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  파일을 선택하면 presigned URL로 업로드한 뒤 결과물을
                  제출합니다.
                </p>
                <form onSubmit={handleSubmitResult} className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold text-zinc-800">
                    결과물 파일
                    <input
                      type="file"
                      onChange={handleSubmissionFileChange}
                      className="mt-2 block w-full text-sm font-semibold text-zinc-700 file:mr-4 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#8c5bff] file:px-4 file:text-sm file:font-black file:text-white"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-zinc-800">
                    설명
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={200}
                      rows={4}
                      className={`${inputClassName} mt-2 min-h-24 resize-none`}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      isActionLoading ||
                      selectedFile === null ||
                      description.trim().length === 0
                    }
                    className="h-11 w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] px-4 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                  >
                    {isActionLoading ? "업로드 중" : "결과물 제출"}
                  </button>
                </form>
              </section>
            ) : null}

            {!terminalTradeMessage && shouldShowSellerReviewNotice ? (
              <TradeActionNotice
                title="결과물 검토 중입니다"
                description="결과물이 제출되었습니다. 구매자 확인을 기다리는 중입니다."
              />
            ) : null}

            {!isBuyer && !isSeller ? (
              <section className={sideCardClassName}>
                <p className="font-black text-zinc-950">권한 안내</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  이 거래의 구매자 또는 판매자만 거래 액션을 사용할 수
                  있습니다.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}

      {shouldShowSubmissionSection ? (
        <section className="relative mx-auto mt-6 w-full max-w-[1180px] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-5 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
          <div
            className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
            aria-hidden="true"
          />
          <p className="font-black text-zinc-950">결과물 정보</p>

          {isSubmissionLoading ? (
            <div className="mt-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-6 text-center text-sm font-semibold text-zinc-600">
              결과물을 불러오는 중입니다.
            </div>
          ) : submission ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                <SummaryItem title="제출 ID" value={`#${submission.id}`} />
                <SummaryItem
                  title="에스크로 ID"
                  value={`#${submission.escrowId}`}
                />
                <SummaryItem
                  title="제출일"
                  value={formatDate(submission.submittedAt)}
                />
                <SummaryItem
                  title="설명"
                  value={submission.description ?? "-"}
                />
              </div>
              <a
                href={submission.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-11 items-center rounded-lg border border-[#ded6ff] bg-white px-5 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
              >
                결과물 파일 열기
              </a>
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-5 text-sm font-semibold text-zinc-600">
              {submissionMessage ?? "아직 제출된 결과물이 없습니다."}
            </p>
          )}
        </section>
      ) : null}
      </div>
    </main>
  );
}

function SummaryItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-white/80 p-3">
      <p className="text-xs font-black text-[#8c5bff]">{title}</p>
      <p className="mt-1 break-words text-base font-black text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function TradeActionNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={sideCardClassName}>
      <p className="font-black text-zinc-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </section>
  );
}
