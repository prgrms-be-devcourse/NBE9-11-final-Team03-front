"use client";

import { useEffect, useState } from "react";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { matchApi } from "@/lib/api";
import { getStoredLastTalentId, getStoredUserId } from "@/lib/auth";

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
  const [requesterTalentIdInput, setRequesterTalentIdInput] = useState("");
  const [isSubmittingCreditRequest, setIsSubmittingCreditRequest] =
    useState(false);
  const [isSubmittingSwapRequest, setIsSubmittingSwapRequest] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const userId = getStoredUserId();
      const storedTalentId = getStoredLastTalentId(userId);

      if (storedTalentId !== null) {
        setRequesterTalentIdInput(String(storedTalentId));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

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

    const requesterTalentId = Number(requesterTalentIdInput.trim());
    if (!Number.isInteger(requesterTalentId) || requesterTalentId <= 0) {
      setMessage("교환에 사용할 내 재능 ID를 숫자로 입력해 주세요.");
      return;
    }

    setMessage(null);
    setIsSubmittingSwapRequest(true);

    try {
      await matchApi.createProposal({
        requesterTalentId,
        providerId,
        providerTalentId,
        requestMessage: "내 재능으로 교환을 제안합니다.",
      });
      setIsSuccessModalOpen(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "교환 제안 전송에 실패했습니다.",
      );
    } finally {
      setIsSubmittingSwapRequest(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={handleCreateCreditRequest}
          disabled={isSubmittingCreditRequest}
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {isSubmittingCreditRequest ? "요청 중..." : "크레딧으로 요청하기"}
        </button>
        <input
          value={requesterTalentIdInput}
          onChange={(event) =>
            setRequesterTalentIdInput(event.target.value.replace(/\D/g, ""))
          }
          inputMode="numeric"
          placeholder="내 재능 ID"
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="button"
          disabled={isSubmittingSwapRequest}
          onClick={handleCreateSwapRequest}
          className="h-11 rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
        >
          {isSubmittingSwapRequest ? "제안 중..." : "교환 제안"}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-zinc-500">
        교환 제안은 requesterTalentId가 필요합니다. 최근 확인한 내 재능 ID가
        있으면 자동으로 채워지고, 아니면 직접 입력해 주세요.
      </p>

      {message ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
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
