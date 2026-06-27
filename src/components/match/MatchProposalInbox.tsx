"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { MatchProposalCard } from "@/components/match/MatchProposalCard";
import {
  chatApi,
  matchApi,
  type MatchProposalReceivedRes,
  type MatchProposalSentRes,
} from "@/lib/api";
import { hasStoredAccessToken } from "@/lib/auth";

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
          error instanceof Error
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

  return (
    <section>
      {successMessage ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          <p>{successMessage}</p>
          {preparedChatHref !== null ? (
            <Link
              href={preparedChatHref}
              className="btn btn-secondary rounded-md border border-teal-200 bg-white px-3 py-2 text-sm font-black text-teal-700 transition hover:bg-teal-100"
            >
              채팅으로 이동
            </Link>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          제안 목록을 불러오는 중입니다...
        </div>
      ) : null}

      {!isLoading && !errorMessage && proposals.length === 0 ? (
        <EmptyState title={emptyTitle} />
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
