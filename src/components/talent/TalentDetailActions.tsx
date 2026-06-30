"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  async function handleCreateCreditRequest() {
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

    setMessage(null);
    setIsSubmittingCreditRequest(true);

    try {
      await matchApi.createProposal({
        requesterTalentId: null,
        providerId,
        providerTalentId,
        requestMessage: "크레딧으로 요청합니다.",
      });
      setIsSuccessModalOpen(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "요청 전송에 실패했습니다.",
      );
    } finally {
      setIsSubmittingCreditRequest(false);
    }
  }

  async function handleCreateSwapRequest() {
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

    setMessage(null);
    setIsSubmittingSwapRequest(true);

    try {
      await matchApi.createProposal({
        requesterTalentId: selectedRequesterTalentId,
        providerId,
        providerTalentId,
        requestMessage: "내 재능으로 교환을 제안합니다.",
      });

      const userId = getStoredUserId();
      if (userId !== null) {
        setStoredLastTalentId(userId, selectedRequesterTalentId);
      }

      setIsSuccessModalOpen(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "교환 제안 전송에 실패했습니다.",
      );
    } finally {
      setIsSubmittingSwapRequest(false);
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
            onClick={handleCreateCreditRequest}
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
                    ? selectedTalent.title
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
                            {talent.title}
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
            onClick={handleCreateSwapRequest}
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
