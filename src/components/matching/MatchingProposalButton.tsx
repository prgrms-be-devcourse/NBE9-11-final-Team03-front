"use client";

import { useState } from "react";
import { FeedbackModal } from "@/components/common/FeedbackModal";

export function MatchingProposalButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="h-11 rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700"
      >
        교환 제안하기
      </button>
      {isModalOpen ? (
        <FeedbackModal
          title="교환 제안이 전송되었습니다"
          description="상대가 제안을 확인하면 알림으로 알려드릴게요."
          onConfirm={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  );
}
