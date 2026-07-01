"use client";

import { MouseEvent, useEffect } from "react";
import type { MatchRecommendationDetailRes } from "@/lib/api";
import {
  formatCredit,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";
import { getUserProfileImageUrl } from "@/utils/profileImage";

interface UserProfileModalProps {
  detail: MatchRecommendationDetailRes;
  requestMessage: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onRequestMessageChange: (value: string) => void;
  onClose: () => void;
  onCreateProposal: () => void;
}

export function UserProfileModal({
  detail,
  requestMessage,
  isSubmitting,
  errorMessage,
  onRequestMessageChange,
  onClose,
  onCreateProposal,
}: UserProfileModalProps) {
  const nickname = getDisplayText(detail.nickname, "프로필");
  const introduction = getDisplayText(detail.introduction, "소개가 아직 없습니다.");
  const profileImageUrl = detail.profileImageUrl?.trim() || null;
  const categoryName = getDisplayText(detail.categoryName, "-");
  const title = getDisplayText(detail.title, "-");
  const content = getDisplayText(detail.content, "재능 상세 설명이 없습니다.");
  const creditPrice = getOptionalNumber(detail.creditPrice);
  const estimatedHours = getOptionalNumber(detail.estimatedHours);
  const trustScore = getOptionalNumber(detail.trustScore);
  const completeCount = getOptionalNumber(detail.completeCount);
  const avgRating = getOptionalNumber(detail.avgRating);
  const disabledReason = detail.proposalRequestDisabledReason;
  const isProposalDisabled = !detail.proposalRequestEnabled || isSubmitting;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleModalClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4 sm:p-6"
    >
      <div
        onClick={handleModalClick}
        className="max-h-[90vh] w-full max-w-[900px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-5 border-b border-zinc-100 pb-5">
          <div className="flex min-w-0 items-start gap-4">
            <ProfileAvatar nickname={nickname} profileImageUrl={profileImageUrl} />
            <div className="min-w-0">
              <h2
                id="user-profile-title"
                className="truncate text-2xl font-black text-zinc-950"
              >
                {nickname}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {introduction}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-bold text-zinc-700 transition hover:border-zinc-500"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="신뢰 점수" value={formatScore(trustScore, "점")} />
          <StatCard label="완료 거래" value={formatScore(completeCount, "건")} />
          <StatCard label="평균 평점" value={formatRatingValue(avgRating)} />
        </div>

        <section className="mt-6 rounded-lg border border-zinc-200 p-5">
          <h3 className="text-base font-black text-zinc-950">제공 재능 상세</h3>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <DetailRow label="카테고리" value={categoryName} />
            <DetailRow label="재능 제목" value={title} />
            <DetailRow
              label="크레딧 가격"
              value={creditPrice === null ? "-" : formatCredit(creditPrice)}
            />
            <DetailRow
              label="예상 작업 기간"
              value={
                estimatedHours === null
                  ? "-"
                  : formatEstimatedDuration(estimatedHours)
              }
            />
          </div>
          <p className="mt-5 whitespace-pre-line text-sm leading-6 text-zinc-700">
            {content}
          </p>
        </section>

        <section className="mt-6 rounded-lg bg-zinc-50 p-5">
          <h3 className="text-base font-black text-zinc-950">추천 이유</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
            <li>같은 카테고리의 재능을 기준으로 추천되었습니다.</li>
            <li>평점과 완료 거래 수를 기준으로 우선 노출되었습니다.</li>
          </ul>
        </section>

        <section className="mt-6">
          <label className="block text-sm font-semibold text-zinc-800">
            제안 메시지
            <textarea
              value={requestMessage}
              onChange={(event) => onRequestMessageChange(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="상대에게 보낼 교환 제안 메시지를 입력해 주세요."
            />
          </label>
          {disabledReason ? (
            <p className="mt-2 text-sm font-semibold text-amber-700">
              {disabledReason}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-2 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-zinc-300 px-5 text-sm font-bold text-zinc-700 transition hover:border-zinc-500"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isProposalDisabled}
            onClick={onCreateProposal}
            className="h-11 rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {isSubmitting ? "전송 중..." : "제안 요청하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileAvatar({
  nickname,
  profileImageUrl,
}: {
  nickname: string;
  profileImageUrl: string | null;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getUserProfileImageUrl(profileImageUrl)}
      alt={`${nickname} 프로필 이미지`}
      className="h-16 w-16 shrink-0 rounded-full object-cover"
    />
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-black text-zinc-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function getDisplayText(
  value: string | null | undefined,
  fallback: string,
): string {
  return value?.trim() || fallback;
}

function getOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatScore(value: number | null, suffix: string): string {
  if (value === null) {
    return "-";
  }

  return `${value.toLocaleString("ko-KR")}${suffix}`;
}

function formatRatingValue(value: number | null): string {
  return value === null ? "-" : formatRating(value);
}
