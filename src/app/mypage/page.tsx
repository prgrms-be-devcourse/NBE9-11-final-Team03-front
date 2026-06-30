"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  Coins,
  Pencil,
  ReceiptText,
  ShieldCheck,
  UserX,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import { ErrorState } from "@/components/common/ErrorState";
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

const TRADE_STATUS_TONES: Record<TradeStatus, string> = {
  IN_PROGRESS: "border-orange-200 bg-orange-50 text-orange-700",
  UNDER_REVIEW: "border-violet-200 bg-violet-50 text-[#8c5bff]",
  AWAITING_PARTNER: "border-sky-200 bg-sky-50 text-sky-700",
  COMPLETED: "border-lime-200 bg-lime-50 text-lime-700",
  CANCELLED: "border-yellow-200 bg-yellow-50 text-yellow-700",
  DISPUTED: "border-red-200 bg-red-50 text-red-700",
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
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-10 sm:py-14 lg:py-16">
          <div className="rounded-lg border border-[#ded6ff] bg-white p-8 text-center text-sm font-semibold text-zinc-600 shadow-sm shadow-violet-950/[0.04]">
            마이페이지 정보를 확인하는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  if (!hasStoredAccessToken()) {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-12 sm:py-16 lg:py-24">
          <LoginRequiredState
            className="w-full bg-[#fbf9ff] !py-12 shadow-sm shadow-violet-950/[0.04] sm:!py-16"
            description="마이페이지는 로그인 후 이용할 수 있어요. 로그인하면 프로필, 크레딧, 최근 거래 상태를 바로 확인할 수 있습니다."
          />
        </div>
      </main>
    );
  }

  const balanceValue = balance?.balance ?? 0;
  const escrowBalanceValue = balance?.escrowBalance ?? 0;

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-white">
      <div className="fixed-container py-10 sm:py-14 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3 !font-bold">
            MY PAGE
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            프로필, 크레딧, 최근 거래 상태를 한 곳에서 확인합니다.
          </p>
        </header>

        {errorMessage ? (
          <div className="mx-auto mt-8 max-w-4xl">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        <section className="mt-10 rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04] sm:p-6 lg:mt-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              {profile?.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profileImageUrl}
                  alt="내 프로필 이미지"
                  className="size-20 rounded-full object-cover ring-2 ring-[#ded6ff]"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full border border-[#ded6ff] bg-[#f4f0ff] text-2xl font-black text-[#8c5bff]">
                  {(profile?.nickname ?? "나").slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8c5bff]">
                  Profile
                </p>
                <h2 className="mt-2 truncate text-3xl font-black text-zinc-950">
                  {profile?.nickname ?? "내 프로필"}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {profile?.introduction ?? "프로필 소개를 등록해 주세요."}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ded6ff] bg-white px-3 py-1.5 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.04]">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  신뢰 점수 {profile?.trustScore ?? "-"}
                </div>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[300px]">
              <Link
                href="/profile/edit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#ded6ff] px-4 text-sm font-black text-[#8c5bff] transition hover:bg-[#f4f0ff]"
              >
                <Pencil className="size-4" aria-hidden="true" />
                프로필 수정
              </Link>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-black text-red-600 transition hover:bg-red-50"
              >
                <UserX className="size-4" aria-hidden="true" />
                회원 탈퇴
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Summary
            title="사용 가능 크레딧"
            description="바로 요청에 사용할 수 있는 잔액"
            value={formatCredit(balanceValue)}
            icon={<Wallet className="size-5" aria-hidden="true" />}
          />
          <Summary
            title="에스크로 예치 중"
            description="거래 완료 전 안전하게 보관 중"
            value={formatCredit(escrowBalanceValue)}
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          />
          <Summary
            title="총 보유"
            description="사용 가능 금액과 예치금을 합산"
            value={formatCredit(balanceValue + escrowBalanceValue)}
            icon={<Coins className="size-5" aria-hidden="true" />}
          />
        </section>

        <section className="mt-8 rounded-lg border border-[#ded6ff] bg-white shadow-sm shadow-violet-950/[0.04]">
          <div className="flex flex-col gap-4 border-b border-[#eee9ff] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8c5bff]">
                Trade
              </p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">
                최근 거래
              </h2>
              <p className="mt-2 text-sm font-semibold text-zinc-500">
                진행 중인 거래와 검토 상태를 확인하세요.
              </p>
            </div>
            <Link
              href="/trades"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ded6ff] px-4 text-sm font-black text-[#8c5bff] transition hover:bg-[#f4f0ff]"
            >
              <span>전체 보기</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-5 sm:p-6">
            {trades.length === 0 ? (
              <EmptyState title="아직 거래가 없습니다." />
            ) : (
              <div className="grid gap-3">
                {trades.map((trade) => (
                  <Link
                    key={trade.tradeId}
                    href={`/trades/${trade.tradeId}`}
                    className="grid cursor-pointer gap-4 rounded-lg border border-[#ded6ff] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#8c5bff] hover:shadow-lg hover:shadow-violet-950/[0.06] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ReceiptText
                          className="size-5 text-[#8c5bff]"
                          aria-hidden="true"
                        />
                        <p className="truncate text-lg font-black text-zinc-950">
                          거래 #{trade.tradeId} · 재능 #{trade.talentId}
                        </p>
                        <span
                          className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-black ${TRADE_STATUS_TONES[trade.tradeStatus]}`}
                        >
                          {TRADE_STATUS_LABELS[trade.tradeStatus]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        {formatDate(trade.updatedAt)}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:w-[280px]">
                      <MiniMetric
                        label="상태"
                        value={TRADE_STATUS_LABELS[trade.tradeStatus]}
                      />
                      <MiniMetric
                        label="크레딧"
                        value={formatCredit(trade.creditPrice)}
                      />
                    </div>
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
    </main>
  );
}

function Summary({
  title,
  description,
  value,
  icon,
}: {
  title: string;
  description: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-5 shadow-sm shadow-violet-950/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#8c5bff]">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
            {description}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-[#8c5bff] ring-1 ring-[#ded6ff]">
          {icon}
        </div>
      </div>
      <p className="mt-5 text-2xl font-black text-zinc-950">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-black text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-zinc-950">{value}</p>
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
      <div className="w-full max-w-[420px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7">
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
