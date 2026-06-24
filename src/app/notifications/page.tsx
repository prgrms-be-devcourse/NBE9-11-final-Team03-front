"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { matchApi, type MatchProposalReceivedRes } from "@/lib/api";
import { hasStoredAccessToken } from "@/lib/auth";
import { formatDate } from "@/utils/format";

function getRequesterTalentTitle(proposal: MatchProposalReceivedRes): string {
  return proposal.requesterTalentTitle ?? "크레딧 요청";
}

export default function NotificationsPage() {
  const [proposals, setProposals] = useState<MatchProposalReceivedRes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!hasStoredAccessToken()) {
      setProposals([]);
      setErrorMessage("로그인 후 이용해 주세요.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await matchApi.getReceivedProposals("REQUESTED");
      setProposals(Array.isArray(response) ? response : []);
    } catch {
      setProposals([]);
      setErrorMessage("알림을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadNotifications]);

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="알림"
        description="처리되지 않은 매칭 제안을 확인하세요."
      />

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          알림을 불러오는 중입니다...
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <ErrorState message={errorMessage} />
      ) : null}

      {!isLoading && !errorMessage && proposals.length === 0 ? (
        <EmptyState
          title="새로운 알림이 없습니다."
          description="새로운 매칭 제안이 오면 이곳에 표시됩니다."
        />
      ) : null}

      {!isLoading && !errorMessage && proposals.length > 0 ? (
        <div className="grid gap-5">
          {proposals.map((proposal) => (
            <NotificationCard key={proposal.proposalId} proposal={proposal} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({
  proposal,
}: {
  proposal: MatchProposalReceivedRes;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-zinc-950">
            {proposal.requesterNickname}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-500">
            {formatDate(proposal.createdAt)}
          </p>
        </div>
        <Link
          href="/matches?tab=received"
          className="shrink-0 rounded-md bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
        >
          제안함으로 이동
        </Link>
      </div>

      <div className="mt-5 grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm">
        <NotificationInfo
          label="요청자 재능"
          value={getRequesterTalentTitle(proposal)}
        />
        <NotificationInfo label="내 재능" value={proposal.providerTalentTitle} />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-zinc-500">요청 메시지</p>
        <p className="mt-2 whitespace-pre-line rounded-md border border-zinc-100 p-3 text-sm leading-6 text-zinc-700">
          {proposal.requestMessage || "요청 메시지가 없습니다."}
        </p>
      </div>
    </article>
  );
}

function NotificationInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-bold text-zinc-950">{value}</p>
    </div>
  );
}
