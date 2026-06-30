"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import { MatchProposalCard } from "@/components/match/MatchProposalCard";
import {
  chatApi,
  matchApi,
  type MatchProposalReceivedRes,
  type MatchProposalSentRes,
} from "@/lib/api";
import { hasStoredAccessToken } from "@/lib/auth";
import {
  isAuthRequiredError,
  isAuthRequiredMessage,
} from "@/lib/auth-required";

interface MatchProposalInboxProps {
  type: "received" | "sent";
}

export function MatchProposalInbox({ type }: MatchProposalInboxProps) {
  const [receivedProposals, setReceivedProposals] = useState<
    MatchProposalReceivedRes[]
  >([]);
  const [sentProposals, setSentProposals] = useState<MatchProposalSentRes[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [preparedChatHref, setPreparedChatHref] = useState<string | null>(null);
  const [processingProposalId, setProcessingProposalId] = useState<
    number | null
  >(null);

  const loadProposals = useCallback(
    async (clearSuccessMessage = true) => {
      if (!hasStoredAccessToken()) {
        setReceivedProposals([]);
        setSentProposals([]);
        setErrorMessage("로그인 후 이용해 주세요.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      if (clearSuccessMessage) {
        setSuccessMessage("");
        setPreparedChatHref(null);
      }

      try {
        if (type === "received") {
          const response = await matchApi.getReceivedProposals();
          setReceivedProposals(Array.isArray(response) ? response : []);
          setSentProposals([]);
        } else {
          const response = await matchApi.getSentProposals();
          setSentProposals(Array.isArray(response) ? response : []);
          setReceivedProposals([]);
        }
      } catch (error) {
        setReceivedProposals([]);
        setSentProposals([]);
        setErrorMessage(
          isAuthRequiredError(error)
            ? "로그인 후 이용해 주세요."
            : error instanceof Error
            ? error.message
            : "제안 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProposals();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadProposals]);

  async function handleAccept(proposal: MatchProposalReceivedRes) {
    const proposalId = proposal.proposalId;

    setErrorMessage(null);
    setSuccessMessage("");
    setPreparedChatHref(null);
    setProcessingProposalId(proposalId);

    try {
      await matchApi.acceptProposal(proposalId);

      try {
        const chatRooms = await chatApi.getMyChatRooms({ size: 20 });
        const transactionRoom = chatRooms.content.find(
          (room) =>
            room.talentId === proposal.providerTalentId &&
            room.roomType === "TRANSACTION",
        );

        setPreparedChatHref(
          transactionRoom ? `/chats?roomId=${transactionRoom.roomId}` : "/chats",
        );
        setSuccessMessage("제안을 수락했습니다. 생성된 거래 채팅을 확인해 주세요.");
      } catch {
        setPreparedChatHref("/chats");
        setSuccessMessage(
          "제안은 수락되었습니다. 채팅 메뉴에서 생성된 거래 채팅을 확인해 주세요.",
        );
      }

      await loadProposals(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "제안 수락에 실패했습니다.",
      );
    } finally {
      setProcessingProposalId(null);
    }
  }

  async function handleReject(proposalId: number) {
    setErrorMessage(null);
    setSuccessMessage("");
    setPreparedChatHref(null);
    setProcessingProposalId(proposalId);

    try {
      await matchApi.rejectProposal(proposalId);
      setSuccessMessage("제안을 거절했습니다.");
      await loadProposals(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "제안 거절에 실패했습니다.",
      );
    } finally {
      setProcessingProposalId(null);
    }
  }

  const proposals =
    type === "received" ? receivedProposals : sentProposals;
  const emptyTitle =
    type === "received" ? "받은 제안이 없습니다." : "보낸 제안이 없습니다.";
  const emptyDescription =
    type === "received"
      ? "새로운 교환 요청이 도착하면 이곳에서 바로 확인할 수 있어요."
      : "추천 조회에서 보낸 교환 요청의 진행 상태가 이곳에 표시됩니다.";
  const isLoginRequired = isAuthRequiredMessage(errorMessage);

  return (
    <section>
      {successMessage ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d9ccff] bg-[#fbf9ff] p-4 text-sm font-bold text-zinc-700 shadow-sm shadow-violet-950/[0.04]">
          <p className="text-[#6f45e9]">{successMessage}</p>
          {preparedChatHref !== null ? (
            <Link
              href={preparedChatHref}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_48%,#79e4dd_100%)] px-4 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25"
            >
              채팅으로 이동
            </Link>
          ) : null}
        </div>
      ) : null}

      {isLoginRequired ? (
        <LoginRequiredState
          className="mb-5"
          description="받은 제안과 보낸 제안은 로그인 후 확인할 수 있어요."
        />
      ) : errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[#ded6ff] bg-white/95 p-8 text-center text-sm font-black text-zinc-500 shadow-sm shadow-violet-950/[0.04]">
          제안 목록을 불러오는 중입니다...
        </div>
      ) : null}

      {!isLoading && !errorMessage && proposals.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : null}

      {!isLoading && proposals.length > 0 ? (
        <div className="grid gap-5">
          {type === "received"
            ? receivedProposals.map((proposal) => (
                <MatchProposalCard
                  key={proposal.proposalId}
                  proposal={proposal}
                  variant="received"
                  isProcessing={processingProposalId === proposal.proposalId}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))
            : sentProposals.map((proposal) => (
                <MatchProposalCard
                  key={proposal.proposalId}
                  proposal={proposal}
                  variant="sent"
                  isProcessing={processingProposalId === proposal.proposalId}
                />
              ))}
        </div>
      ) : null}
    </section>
  );
}
