"use client";

import { useState } from "react";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { matchApi } from "@/lib/api";

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
  const [isSubmittingCreditRequest, setIsSubmittingCreditRequest] =
    useState(false);

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
        <button
          type="button"
          disabled
          className="h-11 rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-400 disabled:cursor-not-allowed"
          title="내 재능 선택 API가 없어 교환 제안은 아직 사용할 수 없습니다."
        >
          내 재능으로 교환 제안하기
        </button>
        <button
          type="button"
          disabled
          className="h-11 rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-400 disabled:cursor-not-allowed"
          title="관심 재능 저장 API가 아직 없습니다."
        >
          관심 재능으로 저장하기
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-zinc-500">
        내 재능 선택 API가 없어 교환 제안은 아직 사용할 수 없습니다.
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
