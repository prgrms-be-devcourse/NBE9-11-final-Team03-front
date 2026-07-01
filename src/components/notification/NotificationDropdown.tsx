"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchApi, type MatchProposalReceivedRes } from "@/lib/api";
import { hasStoredAccessToken, subscribeAuthChanged } from "@/lib/auth";
import { formatDate } from "@/utils/format";
import { getUserProfileImageUrl } from "@/utils/profileImage";

function getBadgeLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function getBadgeSizeClass(count: number): string {
  if (count > 99) {
    return "h-7 w-7 text-[9px]";
  }

  if (count > 9) {
    return "h-6 w-6 text-[10px]";
  }

  return "h-5 w-5 text-[10px]";
}

function getRequesterTalentTitle(proposal: MatchProposalReceivedRes): string {
  return proposal.requesterTalentTitle ?? "크레딧 요청";
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [proposals, setProposals] = useState<MatchProposalReceivedRes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationCount = proposals.length;

  const loadNotifications = useCallback(async () => {
    if (!hasStoredAccessToken()) {
      setProposals([]);
      setErrorMessage(null);
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

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    }

    const unsubscribeAuthChanged = subscribeAuthChanged(() => {
      void loadNotifications();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeAuthChanged();
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Node && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loadNotifications]);

  function handleClose(): void {
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label="알림 열기"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((value) => !value)}
        className={`relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border shadow-sm transition ${
          isOpen
            ? "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff] shadow-violet-500/10"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-[#d9ccff] hover:bg-[#f8f5ff] hover:text-[#8c5bff]"
        }`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {notificationCount > 0 ? (
          <span
            className={`absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-red-600 font-black leading-none text-white ring-2 ring-white ${getBadgeSizeClass(
              notificationCount,
            )}`}
          >
            {getBadgeLabel(notificationCount)}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-40 mt-3 w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/15 sm:w-[400px]">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
            <div>
              <p className="text-lg font-black text-zinc-950">최근 알림</p>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                처리되지 않은 매칭 제안을 확인하세요.
              </p>
            </div>
            <Link
              href="/matches?tab=received"
              onClick={handleClose}
              className="shrink-0 rounded-md border border-[#d9ccff] px-3 py-2 text-xs font-bold text-[#8c5bff] transition hover:bg-[#f4f0ff]"
            >
              전체 보기
            </Link>
          </div>

          <div className="max-h-[440px] overflow-y-auto [scrollbar-gutter:stable]">
            {isLoading ? (
              <p className="px-6 py-10 text-center text-sm font-semibold text-zinc-500">
                알림을 불러오는 중입니다...
              </p>
            ) : null}

            {!isLoading && errorMessage ? (
              <p className="px-6 py-10 text-center text-sm font-semibold text-red-600">
                {errorMessage}
              </p>
            ) : null}

            {!isLoading && !errorMessage && proposals.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm font-semibold text-zinc-500">
                새로운 매칭 제안이 없습니다.
              </p>
            ) : null}

            {!isLoading && !errorMessage && proposals.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {proposals.map((proposal) => (
                  <NotificationItem
                    key={proposal.proposalId}
                    proposal={proposal}
                    onClose={handleClose}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationItem({
  proposal,
  onClose,
}: {
  proposal: MatchProposalReceivedRes;
  onClose: () => void;
}) {
  return (
    <Link
      href="/matches?tab=received"
      onClick={onClose}
      className="flex gap-3 px-6 py-4 text-left transition hover:bg-zinc-50"
    >
      <NotificationAvatar proposal={proposal} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate font-black text-zinc-950">
            {proposal.requesterNickname}
          </p>
          <p className="shrink-0 text-xs font-semibold text-zinc-400">
            {formatDate(proposal.createdAt)}
          </p>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-zinc-600">
          {getRequesterTalentTitle(proposal)} → {proposal.providerTalentTitle}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-500">
          {proposal.requestMessage || "요청 메시지가 없습니다."}
        </p>
      </div>
    </Link>
  );
}

function NotificationAvatar({
  proposal,
}: {
  proposal: MatchProposalReceivedRes;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getUserProfileImageUrl(proposal.requesterProfileImageUrl)}
      alt={`${proposal.requesterNickname} 프로필 이미지`}
      className="h-11 w-11 shrink-0 rounded-full object-cover"
    />
  );
}
