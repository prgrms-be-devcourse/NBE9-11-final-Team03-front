"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { matchApi, talentApi, type TalentListRes } from "@/lib/api";
import {
  getStoredLastTalentId,
  getStoredUserId,
  setStoredLastTalentId,
} from "@/lib/auth";
import { formatCredit, formatEstimatedDuration } from "@/utils/format";

interface TalentDetailActionsProps {
  providerId: number;
  providerTalentId: number;
  isOwner: boolean;
  isLoggedIn: boolean;
}

type ProposalMessageMode = "credit" | "swap";

const REQUEST_MESSAGE_MAX_LENGTH = 1000;

function getTalentDisplayTitle(talent: TalentListRes) {
  return talent.title?.trim() || `재능 #${talent.talentId}`;
}

export function TalentDetailActions({
  providerId,
  providerTalentId,
  isOwner,
  isLoggedIn,
}: TalentDetailActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [myTalents, setMyTalents] = useState<TalentListRes[] | null>(null);
  const [selectedRequesterTalentId, setSelectedRequesterTalentId] = useState<
    number | null
  >(null);
  const [isTalentSelectOpen, setIsTalentSelectOpen] = useState(false);
  const [proposalMessageMode, setProposalMessageMode] =
    useState<ProposalMessageMode | null>(null);
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalMessageError, setProposalMessageError] = useState<
    string | null
  >(null);
  const [isSubmittingCreditRequest, setIsSubmittingCreditRequest] =
    useState(false);
  const [isSubmittingSwapRequest, setIsSubmittingSwapRequest] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

  const visibleMyTalents = useMemo(
    () => (isLoggedIn ? (myTalents ?? []) : []),
    [isLoggedIn, myTalents],
  );
  const isLoadingMyTalents = isLoggedIn && myTalents === null;

  const selectedTalent = useMemo(
    () =>
      visibleMyTalents.find(
        (talent) => talent.talentId === selectedRequesterTalentId,
      ) ?? null,
    [visibleMyTalents, selectedRequesterTalentId],
  );
  const isSubmittingProposal =
    isSubmittingCreditRequest || isSubmittingSwapRequest;

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let ignore = false;

    void talentApi
      .getMyList({
        size: 50,
        sort: "LATEST",
      })
      .then((response) => {
        if (ignore) {
          return;
        }

        const activeMyTalents = Array.isArray(response.content)
          ? response.content
          : [];
        const userId = getStoredUserId();
        const storedTalentId = getStoredLastTalentId(userId);
        const nextSelectedTalent =
          activeMyTalents.find(
            (talent) => talent.talentId === storedTalentId,
          ) ??
          activeMyTalents[0] ??
          null;

        setMyTalents(activeMyTalents);
        setSelectedRequesterTalentId(nextSelectedTalent?.talentId ?? null);
      })
      .catch((error: unknown) => {
        if (ignore) {
          return;
        }

        setMyTalents([]);
        setSelectedRequesterTalentId(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "내 재능 목록을 불러오지 못했습니다.",
        );
      });

    return () => {
      ignore = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isTalentSelectOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsTalentSelectOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTalentSelectOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTalentSelectOpen]);

  function openProposalMessageModal(mode: ProposalMessageMode) {
    setProposalMessage("");
    setProposalMessageError(null);
    setMessage(null);
    setProposalMessageMode(mode);
  }

  function closeProposalMessageModal() {
    if (isSubmittingProposal) {
      return;
    }

    setProposalMessageMode(null);
    setProposalMessage("");
    setProposalMessageError(null);
  }

  function handleProposalMessageChange(value: string) {
    setProposalMessage(value);

    if (value.length > REQUEST_MESSAGE_MAX_LENGTH) {
      setProposalMessageError("요청 메시지는 1000자 이하로 입력해 주세요.");
      return;
    }

    if (proposalMessageError) {
      setProposalMessageError(null);
    }
  }

  function handleOpenCreditRequestMessage() {
    if (!isLoggedIn) {
      setMessage("로그인 후 이용해 주세요.");
      return;
    }

    if (isOwner) {
      setMessage("내가 등록한 재능에는 요청할 수 없습니다.");
      return;
    }

    if (
      !Number.isInteger(providerId) ||
      providerId <= 0 ||
      !Number.isInteger(providerTalentId) ||
      providerTalentId <= 0
    ) {
      setMessage("요청에 필요한 재능 정보를 확인할 수 없습니다.");
      return;
    }

    openProposalMessageModal("credit");
  }

  function handleOpenSwapRequestMessage() {
    if (!isLoggedIn) {
      setMessage("로그인 후 이용해 주세요.");
      return;
    }

    if (isOwner) {
      setMessage("내가 등록한 재능에는 제안할 수 없습니다.");
      return;
    }

    if (selectedRequesterTalentId === null) {
      setMessage("교환에 사용할 내 재능을 선택해 주세요.");
      return;
    }

    if (
      !Number.isInteger(providerId) ||
      providerId <= 0 ||
      !Number.isInteger(providerTalentId) ||
      providerTalentId <= 0
    ) {
      setMessage("요청에 필요한 재능 정보를 확인할 수 없습니다.");
      return;
    }

    setIsTalentSelectOpen(false);
    openProposalMessageModal("swap");
  }

  async function handleSubmitProposalMessage() {
    if (proposalMessageMode === null || isSubmittingProposal) {
      return;
    }

    if (proposalMessageMode === "swap" && selectedRequesterTalentId === null) {
      setProposalMessageError("교환에 사용할 내 재능을 선택해 주세요.");
      return;
    }

    const requestMessage = proposalMessage.trim();

    if (requestMessage.length === 0) {
      setProposalMessageError("상대에게 전달할 요청 내용을 입력해 주세요.");
      return;
    }

    if (
      proposalMessage.length > REQUEST_MESSAGE_MAX_LENGTH ||
      requestMessage.length > REQUEST_MESSAGE_MAX_LENGTH
    ) {
      setProposalMessageError("요청 메시지는 1000자 이하로 입력해 주세요.");
      return;
    }

    setMessage(null);
    setProposalMessageError(null);

    const isCreditRequest = proposalMessageMode === "credit";
    const requesterTalentId = isCreditRequest ? null : selectedRequesterTalentId;

    if (isCreditRequest) {
      setIsSubmittingCreditRequest(true);
    } else {
      setIsSubmittingSwapRequest(true);
    }

    try {
      await matchApi.createProposal({
        requesterTalentId,
        providerId,
        providerTalentId,
        requestMessage,
      });

      if (!isCreditRequest && requesterTalentId !== null) {
        const userId = getStoredUserId();
        if (userId !== null) {
          setStoredLastTalentId(userId, requesterTalentId);
        }
      }

      setProposalMessageMode(null);
      setProposalMessage("");
      setProposalMessageError(null);
      setIsSuccessModalOpen(true);
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : isCreditRequest
            ? "요청 전송에 실패했습니다."
            : "교환 제안 전송에 실패했습니다.";

      setMessage(nextMessage);
      setProposalMessageError(nextMessage);
    } finally {
      if (isCreditRequest) {
        setIsSubmittingCreditRequest(false);
      } else {
        setIsSubmittingSwapRequest(false);
      }
    }
  }

  return (
    <>
      <div className="rounded-[24px] border border-[#e5ddff] bg-gradient-to-br from-white via-[#fbf9ff] to-[#f5f0ff] p-4 shadow-sm shadow-violet-950/[0.04] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
              Request
            </p>
            <h2 className="mt-2 text-xl font-black text-zinc-950">
              원하는 방식으로 재능을 요청하세요
            </h2>
          </div>
          <p className="text-xs font-bold leading-5 text-zinc-500 sm:text-right">
            크레딧 요청은 즉시 제안되고,
            <br className="hidden sm:block" /> 교환 제안은 내 재능 선택이
            필요합니다.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.1fr_0.75fr]">
          <button
            type="button"
            onClick={handleOpenCreditRequestMessage}
            disabled={isSubmittingCreditRequest}
            className="h-14 rounded-2xl bg-zinc-950 px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:opacity-60"
          >
            {isSubmittingCreditRequest ? "요청 중..." : "크레딧으로 요청하기"}
          </button>

          <div ref={selectRef} className="relative">
            <button
              type="button"
              onClick={() => setIsTalentSelectOpen((previous) => !previous)}
              disabled={isLoadingMyTalents || visibleMyTalents.length === 0}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[#d9ccff] bg-white px-5 text-left text-sm font-black text-zinc-950 shadow-sm shadow-violet-950/[0.04] outline-none transition hover:border-[#8c5bff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
              aria-haspopup="listbox"
              aria-expanded={isTalentSelectOpen}
            >
              <span className="min-w-0 truncate">
                {isLoadingMyTalents
                  ? "내 재능 불러오는 중"
                  : selectedTalent
                    ? getTalentDisplayTitle(selectedTalent)
                    : "선택 가능한 내 재능 없음"}
              </span>
              <span className="shrink-0 text-lg text-[#8c5bff]">⌄</span>
            </button>

            {isTalentSelectOpen ? (
              <div
                role="listbox"
                aria-label="교환에 사용할 내 재능 선택"
                className="absolute left-0 right-0 z-40 mt-3 max-h-72 overflow-y-auto rounded-2xl border border-[#d9ccff] bg-white p-2 shadow-[0_20px_48px_rgba(80,60,160,0.18)]"
              >
                {visibleMyTalents.map((talent) => {
                  const selected =
                    talent.talentId === selectedRequesterTalentId;

                  return (
                    <button
                      key={talent.talentId}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setSelectedRequesterTalentId(talent.talentId);
                        setIsTalentSelectOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        selected
                          ? "bg-[#f4f0ff] text-[#8c5bff]"
                          : "text-zinc-700 hover:bg-[#f8f5ff] hover:text-[#8c5bff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {getTalentDisplayTitle(talent)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-zinc-500">
                            {talent.categoryName} ·{" "}
                            {formatCredit(talent.creditPrice)} ·{" "}
                            {formatEstimatedDuration(talent.estimatedHours)}
                          </p>
                        </div>
                        {selected ? (
                          <span className="shrink-0 text-sm font-black text-[#8c5bff]">
                            선택됨
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={
              isSubmittingSwapRequest ||
              isLoadingMyTalents ||
              selectedRequesterTalentId === null
            }
            onClick={handleOpenSwapRequestMessage}
            className="h-14 rounded-2xl border border-[#d9ccff] bg-white px-5 text-sm font-black text-[#6f3cff] shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:border-[#8c5bff] hover:bg-[#f8f5ff] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          >
            {isSubmittingSwapRequest ? "제안 중..." : "교환 제안"}
          </button>
        </div>

        <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">
          교환 제안에는 내가 등록한 재능이 필요합니다. 최근 사용한 재능이 있으면
          자동 선택되고, 리스트에서 다른 재능으로 변경할 수 있습니다.
        </p>
      </div>

      {message ? (
        <p className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
          {message}
        </p>
      ) : null}

      {proposalMessageMode ? (
        <ProposalMessageModal
          mode={proposalMessageMode}
          message={proposalMessage}
          errorMessage={proposalMessageError}
          isSubmitting={
            proposalMessageMode === "credit"
              ? isSubmittingCreditRequest
              : isSubmittingSwapRequest
          }
          onChange={handleProposalMessageChange}
          onClose={closeProposalMessageModal}
          onSubmit={handleSubmitProposalMessage}
        />
      ) : null}

      {isSuccessModalOpen ? (
        <FeedbackModal
          title="요청이 전송되었습니다"
          description="상대방이 받은 제안에서 요청을 확인할 수 있습니다."
          onConfirm={() => setIsSuccessModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function ProposalMessageModal({
  mode,
  message,
  errorMessage,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: ProposalMessageMode;
  message: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const title =
    mode === "credit" ? "크레딧 요청 메시지" : "교환 제안 메시지";
  const submitLabel =
    mode === "credit" ? "크레딧 요청 보내기" : "교환 제안 보내기";
  const messageLength = message.length;
  const isOverLimit = messageLength > REQUEST_MESSAGE_MAX_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-message-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#ded6ff] bg-white/95 p-6 shadow-[0_28px_80px_rgba(80,60,160,0.24)] sm:p-7"
      >
        <div
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
          aria-hidden="true"
        />

        <h2
          id="proposal-message-modal-title"
          className="text-xl font-black text-zinc-950"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
          상대에게 전달할 요청 내용을 입력해 주세요.
        </p>

        <label className="mt-5 block text-sm font-black text-zinc-900">
          메시지
          <textarea
            value={message}
            onChange={(event) => onChange(event.target.value)}
            rows={7}
            className="mt-2 w-full resize-none rounded-2xl border border-[#d9ccff] bg-white px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
            placeholder="원하는 작업 내용, 일정, 참고 사항을 간단히 작성해 주세요."
          />
        </label>

        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {errorMessage ? (
            <p className="min-w-0 flex-1 text-xs font-semibold text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <span
            className={`ml-auto shrink-0 text-xs font-semibold ${
              isOverLimit ? "text-red-600" : "text-zinc-500"
            }`}
          >
            {messageLength.toLocaleString("en-US")}/
            {REQUEST_MESSAGE_MAX_LENGTH.toLocaleString("en-US")}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-12 rounded-xl border border-zinc-300 bg-white text-sm font-black text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_48%,#79e4dd_100%)] text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "전송 중..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
