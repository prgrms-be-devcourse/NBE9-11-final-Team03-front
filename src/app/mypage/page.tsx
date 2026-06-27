"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import {
  authApi,
  creditApi,
  profileApi,
  tradeApi,
  type CreditBalanceRes,
  type MyProfileDetailRes,
  type TradeListRes,
  type TradeStatus,
} from "@/lib/api";
import { hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate } from "@/utils/format";

const TRADE_STATUS_LABELS: Record<TradeStatus, string> = {
  IN_PROGRESS: "진행 중",
  UNDER_REVIEW: "검토 중",
  AWAITING_PARTNER: "상대 확정 대기",
  COMPLETED: "완료",
  CANCELLED: "취소",
  DISPUTED: "분쟁",
};

export default function MyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfileDetailRes | null>(null);
  const [balance, setBalance] = useState<CreditBalanceRes | null>(null);
  const [trades, setTrades] = useState<TradeListRes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadMyPage() {
      if (!hasStoredAccessToken()) {
        setIsLoading(false);
        return;
      }

      const [profileResult, balanceResult, tradesResult] =
        await Promise.allSettled([
          profileApi.getMe(),
          creditApi.getBalance(),
          tradeApi.getList({ size: 5 }),
        ]);

      if (ignore) {
        return;
      }

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      }

      if (balanceResult.status === "fulfilled") {
        setBalance(balanceResult.value);
      }

      if (tradesResult.status === "fulfilled") {
        setTrades(tradesResult.value.content);
      }

      const rejected = [profileResult, balanceResult, tradesResult].find(
        (result) => result.status === "rejected",
      );

      setErrorMessage(
        rejected?.status === "rejected" && rejected.reason instanceof Error
          ? rejected.reason.message
          : null,
      );
      setIsLoading(false);
    }

    void loadMyPage();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleWithdraw() {
    setIsWithdrawing(true);
    setErrorMessage(null);

    try {
      await authApi.deleteMe();
      router.push("/login");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "회원 탈퇴에 실패했습니다.",
      );
      setIsWithdrawModalOpen(false);
    } finally {
      setIsWithdrawing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="fixed-container py-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          마이페이지 정보를 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (!hasStoredAccessToken()) {
    return (
      <div className="fixed-container py-12">
        <EmptyState
          title="로그인 후 이용해 주세요."
          actionLabel="로그인"
          actionHref="/login"
        />
      </div>
    );
  }

  const balanceValue = balance?.balance ?? 0;
  const escrowBalanceValue = balance?.escrowBalance ?? 0;

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="마이페이지"
        description="프로필, 크레딧, 최근 거래 상태를 한 곳에서 확인합니다."
      />

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profileImageUrl}
                alt="내 프로필 이미지"
                className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-200"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-lg font-black text-zinc-500">
                {(profile?.nickname ?? "나").slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-zinc-950">
                {profile?.nickname ?? "내 프로필"}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                {profile?.introduction ?? "프로필 소개를 등록해 주세요."}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                신뢰 점수 {profile?.trustScore ?? "-"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/profile/edit"
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
            >
              프로필 수정
            </Link>
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(true)}
              className="h-10 rounded-md border border-red-200 px-4 text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <Summary title="사용 가능 크레딧" value={formatCredit(balanceValue)} />
        <Summary
          title="에스크로 예치 중"
          value={formatCredit(escrowBalanceValue)}
        />
        <Summary
          title="총 보유"
          value={formatCredit(balanceValue + escrowBalanceValue)}
        />
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-zinc-950">최근 거래</h2>
            <p className="mt-1 text-sm text-zinc-500">
              진행 중인 거래와 검토 상태를 확인하세요.
            </p>
          </div>
          <Link
            href="/trades"
            className="text-sm font-black text-teal-700 transition hover:text-teal-900"
          >
            전체 보기
          </Link>
        </div>
        <div className="p-5">
          {trades.length === 0 ? (
            <EmptyState title="아직 거래가 없습니다." />
          ) : (
            <div className="grid gap-3">
              {trades.map((trade) => (
                <Link
                  key={trade.tradeId}
                  href={`/trades/${trade.tradeId}`}
                  className="grid grid-cols-[1fr_120px_140px] items-center gap-4 rounded-lg border border-zinc-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <div>
                    <p className="font-black text-zinc-950">
                      거래 #{trade.tradeId} · 재능 #{trade.talentId}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDate(trade.updatedAt)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-zinc-700">
                    {TRADE_STATUS_LABELS[trade.tradeStatus]}
                  </p>
                  <p className="text-right text-sm font-black text-zinc-950">
                    {formatCredit(trade.creditPrice)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {isWithdrawModalOpen ? (
        <WithdrawConfirmModal
          isSubmitting={isWithdrawing}
          onCancel={() => setIsWithdrawModalOpen(false)}
          onConfirm={handleWithdraw}
        />
      ) : null}
    </div>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-xl font-black text-zinc-950">{value}</p>
    </div>
  );
}

function WithdrawConfirmModal({
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6"
    >
      <div className="w-[420px] rounded-xl border border-zinc-200 bg-white p-7 shadow-2xl">
        <h2 id="withdraw-title" className="text-xl font-black text-zinc-950">
          회원 탈퇴
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          탈퇴하면 현재 계정으로 Baton 서비스를 이용할 수 없습니다. 진행 중인
          거래가 있다면 먼저 상태를 확인해 주세요.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="h-11 rounded-md border border-zinc-300 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="h-11 rounded-md bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? "탈퇴 중..." : "탈퇴하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
