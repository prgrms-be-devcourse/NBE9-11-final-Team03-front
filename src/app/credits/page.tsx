"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import {
  creditApi,
  type CreditBalanceRes,
  type CreditTransactionRes,
  type CreditTransactionSearchParams,
  type CreditTransactionType,
} from "@/lib/api";
import { isAuthRequiredMessage } from "@/lib/auth-required";
import { formatCredit, formatDate } from "@/utils/format";

const CREDIT_ACCOUNT_NOT_FOUND_MESSAGE =
  "크레딧 계좌가 없습니다. 기존 가입 계정일 수 있습니다. 새로 회원가입한 계정으로 다시 확인해 주세요.";
const TRANSACTION_PAGE_SIZE = 10;

type TransactionTypeFilter = "" | CreditTransactionType;

const transactionTypeLabels: Record<CreditTransactionType, string> = {
  WELCOME: "가입 보너스",
  PURCHASE_DEBIT: "크레딧 사용",
  ESCROW_HOLD: "에스크로 예치",
  ESCROW_RELEASE: "에스크로 정산",
  REFUND: "환불",
  CHARGE: "충전",
  REFERRAL_REWARD: "추천 보상",
  ADJUSTMENT: "관리자 조정",
};

const transactionTypeOptions: Array<{
  value: TransactionTypeFilter;
  label: string;
}> = [
  { value: "", label: "전체 유형" },
  ...Object.entries(transactionTypeLabels).map(([value, label]) => ({
    value: value as CreditTransactionType,
    label,
  })),
];

function hasStoredAccessToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem("baton_access_token"));
}

function getCreditErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "크레딧 잔액을 불러오지 못했습니다.";
  }

  if (
    error.message.includes("크레딧 계좌를 찾을 수 없습니다") ||
    error.message.includes("CREDIT_ACCOUNT_NOT_FOUND")
  ) {
    return CREDIT_ACCOUNT_NOT_FOUND_MESSAGE;
  }

  return error.message;
}

function toStartOfDay(date: string): string | undefined {
  return date ? `${date}T00:00:00` : undefined;
}

function toEndOfDay(date: string): string | undefined {
  return date ? `${date}T23:59:59` : undefined;
}

function buildTransactionParams({
  cursor,
  type,
  fromDate,
  toDate,
}: {
  cursor?: number | null;
  type: TransactionTypeFilter;
  fromDate: string;
  toDate: string;
}): CreditTransactionSearchParams {
  return {
    cursor,
    size: TRANSACTION_PAGE_SIZE,
    type: type || undefined,
    from: toStartOfDay(fromDate),
    to: toEndOfDay(toDate),
  };
}

function isInvalidDateRange(fromDate: string, toDate: string): boolean {
  return Boolean(fromDate && toDate && fromDate > toDate);
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalanceRes | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionRes[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterErrorMessage, setFilterErrorMessage] = useState<string | null>(
    null,
  );
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedTypeFilter, setAppliedTypeFilter] =
    useState<TransactionTypeFilter>("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const activeFilterDescription = useMemo(() => {
    const descriptions: string[] = [];

    if (appliedTypeFilter) {
      descriptions.push(transactionTypeLabels[appliedTypeFilter]);
    }

    if (appliedFromDate || appliedToDate) {
      descriptions.push(
        `${appliedFromDate || "처음"} ~ ${appliedToDate || "오늘"}`,
      );
    }

    return descriptions.join(" · ");
  }, [appliedFromDate, appliedToDate, appliedTypeFilter]);

  const loadTransactions = useCallback(
    async ({
      cursor = null,
      append = false,
      type = appliedTypeFilter,
      from = appliedFromDate,
      to = appliedToDate,
    }: {
      cursor?: number | null;
      append?: boolean;
      type?: TransactionTypeFilter;
      from?: string;
      to?: string;
    } = {}) => {
      const transactionPage = await creditApi.getTransactions(
        buildTransactionParams({
          cursor,
          type,
          fromDate: from,
          toDate: to,
        }),
      );

      setTransactions((prevTransactions) =>
        append
          ? [...prevTransactions, ...transactionPage.content]
          : transactionPage.content,
      );
      setNextCursor(transactionPage.nextCursor);
      setHasNext(transactionPage.hasNext);
    },
    [appliedFromDate, appliedToDate, appliedTypeFilter],
  );

  useEffect(() => {
    let ignore = false;

    async function loadCreditPage() {
      if (!hasStoredAccessToken()) {
        setErrorMessage("로그인 후 이용해 주세요.");
        setBalance(null);
        setTransactions([]);
        setIsBalanceLoading(false);
        setIsTransactionsLoading(false);
        return;
      }

      try {
        const [nextBalance, transactionPage] = await Promise.all([
          creditApi.getBalance(),
          creditApi.getTransactions({
            size: TRANSACTION_PAGE_SIZE,
          }),
        ]);

        if (ignore) {
          return;
        }

        setBalance(nextBalance);
        setTransactions(transactionPage.content);
        setNextCursor(transactionPage.nextCursor);
        setHasNext(transactionPage.hasNext);
        setErrorMessage(null);
      } catch (error) {
        if (ignore) {
          return;
        }

        setBalance(null);
        setTransactions([]);
        setErrorMessage(getCreditErrorMessage(error));
      } finally {
        if (!ignore) {
          setIsBalanceLoading(false);
          setIsTransactionsLoading(false);
        }
      }
    }

    void loadCreditPage();

    return () => {
      ignore = true;
    };
  }, []);

  const balanceValue = balance?.balance ?? 0;
  const escrowBalanceValue = balance?.escrowBalance ?? 0;
  const isLoginRequired = isAuthRequiredMessage(errorMessage);
  const isFilterDisabled = isTransactionsLoading || isLoadingMore;

  async function handleApplyFilters() {
    if (isInvalidDateRange(fromDate, toDate)) {
      setFilterErrorMessage("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    setFilterErrorMessage(null);
    setErrorMessage(null);
    setIsTransactionsLoading(true);
    setAppliedTypeFilter(typeFilter);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    try {
      await loadTransactions({
        type: typeFilter,
        from: fromDate,
        to: toDate,
      });
    } catch (error) {
      setTransactions([]);
      setNextCursor(null);
      setHasNext(false);
      setErrorMessage(getCreditErrorMessage(error));
    } finally {
      setIsTransactionsLoading(false);
    }
  }

  async function handleResetFilters() {
    setTypeFilter("");
    setFromDate("");
    setToDate("");
    setAppliedTypeFilter("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setFilterErrorMessage(null);
    setErrorMessage(null);
    setIsTransactionsLoading(true);

    try {
      await loadTransactions({
        type: "",
        from: "",
        to: "",
      });
    } catch (error) {
      setTransactions([]);
      setNextCursor(null);
      setHasNext(false);
      setErrorMessage(getCreditErrorMessage(error));
    } finally {
      setIsTransactionsLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!hasNext || nextCursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      await loadTransactions({
        cursor: nextCursor,
        append: true,
      });
    } catch (error) {
      setErrorMessage(getCreditErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3 !font-bold">
            CREDIT WALLET
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            사용 가능한 크레딧과 거래 중 예치된 금액을 한눈에 확인하세요.
            <br />
            적립, 사용, 정산 흐름을 Baton 거래 기준으로 정리해 보여드립니다.
          </p>
        </header>

        {isLoginRequired ? (
          <LoginRequiredState
            className="mx-auto mt-8 max-w-4xl"
            description="크레딧 잔액과 사용 내역은 로그인 후 확인할 수 있어요."
          />
        ) : errorMessage ? (
          <div className="mx-auto mt-8 max-w-4xl">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          <Summary
            title="사용 가능 크레딧"
            description="바로 사용할 수 있는 잔액"
            value={formatCredit(balanceValue)}
            isLoading={isBalanceLoading}
            icon={<Wallet className="size-6" aria-hidden="true" />}
            tone="primary"
          />
          <Summary
            title="에스크로 예치 중"
            description="진행 중인 거래에 묶인 금액"
            value={formatCredit(escrowBalanceValue)}
            isLoading={isBalanceLoading}
            icon={<ShieldCheck className="size-6" aria-hidden="true" />}
            tone="hold"
          />
          <Summary
            title="총 보유"
            description="사용 가능 금액과 예치금을 합산"
            value={formatCredit(balanceValue + escrowBalanceValue)}
            isLoading={isBalanceLoading}
            icon={<Coins className="size-6" aria-hidden="true" />}
            tone="total"
          />
        </div>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-400/55 pb-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#8c5bff]">
                Ledger
              </p>
              <h2 className="mt-3 text-3xl font-black text-zinc-950">
                크레딧 사용 내역
              </h2>
              <p className="mt-2 text-sm font-semibold text-zinc-500">
                적립, 사용, 예치, 정산 내역을 최신순으로 확인하세요.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ded6ff] bg-white px-4 py-2 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.04]">
              <History className="size-4" aria-hidden="true" />
              총 {transactions.length}{hasNext ? "+" : ""}건
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#ded6ff] bg-white/95 p-4 shadow-sm shadow-violet-950/[0.04] sm:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <label className="block">
                <span className="text-xs font-black text-[#8c5bff]">
                  거래 유형
                </span>
                <select
                  value={typeFilter}
                  disabled={isFilterDisabled}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as TransactionTypeFilter)
                  }
                  className="mt-2 h-11 w-full rounded-lg border border-[#ded6ff] bg-white px-3 text-sm font-black text-zinc-800 outline-none transition focus:border-[#8c5bff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                >
                  {transactionTypeOptions.map((option) => (
                    <option key={option.value || "ALL"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black text-[#8c5bff]">
                  시작일
                </span>
                <input
                  type="date"
                  value={fromDate}
                  disabled={isFilterDisabled}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#ded6ff] bg-white px-3 text-sm font-black text-zinc-800 outline-none transition focus:border-[#8c5bff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black text-[#8c5bff]">
                  종료일
                </span>
                <input
                  type="date"
                  value={toDate}
                  disabled={isFilterDisabled}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#ded6ff] bg-white px-3 text-sm font-black text-zinc-800 outline-none transition focus:border-[#8c5bff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isFilterDisabled}
                  onClick={handleApplyFilters}
                  className="h-11 flex-1 cursor-pointer rounded-lg bg-[#8c5bff] px-4 text-sm font-black text-white shadow-sm shadow-violet-950/[0.08] transition hover:bg-[#7847f5] disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
                >
                  필터 적용
                </button>
                <button
                  type="button"
                  disabled={isFilterDisabled}
                  onClick={handleResetFilters}
                  className="h-11 flex-1 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-4 text-sm font-black text-zinc-700 shadow-sm shadow-violet-950/[0.04] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
                >
                  초기화
                </button>
              </div>
            </div>

            {filterErrorMessage ? (
              <p className="mt-3 text-sm font-bold text-rose-600">
                {filterErrorMessage}
              </p>
            ) : activeFilterDescription ? (
              <p className="mt-3 text-sm font-semibold text-zinc-500">
                적용 중인 필터: {activeFilterDescription}
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            {isTransactionsLoading ? (
              <div className="rounded-lg border border-[#ded6ff] bg-white/95 p-8 text-center text-sm font-semibold text-zinc-600 shadow-sm shadow-violet-950/[0.04]">
                크레딧 사용 내역을 불러오는 중입니다.
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState title="크레딧 사용 내역이 없습니다." />
            ) : (
              <>
                <div className="grid gap-3">
                  {transactions.map((transaction) => (
                    <CreditTransactionCard
                      key={transaction.transactionId}
                      transaction={transaction}
                    />
                  ))}
                </div>
                {hasNext ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      disabled={isLoadingMore}
                      onClick={handleLoadMore}
                      className="h-11 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-5 text-sm font-black text-zinc-700 shadow-sm shadow-violet-950/[0.04] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingMore ? "불러오는 중" : "더 보기"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CreditTransactionCard({
  transaction,
}: {
  transaction: CreditTransactionRes;
}) {
  const isPositive = transaction.amount > 0;
  const amountClassName = isPositive ? "text-emerald-700" : "text-rose-600";
  const amountBadgeClassName = isPositive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-600";
  const topLineClassName = isPositive
    ? "bg-[linear-gradient(90deg,#8c5bff_0%,#34d399_100%)]"
    : "bg-[linear-gradient(90deg,#8c5bff_0%,#fb7185_100%)]";
  const formattedAmount = `${isPositive ? "+" : ""}${formatCredit(
    transaction.amount,
  )}`;

  return (
    <article className="relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 p-5 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/[0.08]">
      <div className={`absolute inset-x-0 top-0 h-1 ${topLineClassName}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${amountBadgeClassName}`}
          >
            {isPositive ? (
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            )}
            {transactionTypeLabels[transaction.type] ?? transaction.type}
          </span>
          <p className="mt-3 text-base font-black text-zinc-950">
            {transaction.defaultReason || "상세 사유 없음"}
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {formatDate(transaction.createdAt)}
          </p>
        </div>
        <p className={`shrink-0 text-2xl font-black ${amountClassName}`}>
          {formattedAmount}
        </p>
      </div>
      <div className="mt-5 grid gap-3 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 text-sm md:grid-cols-3">
        <TransactionInfo
          label="거래 후 잔액"
          value={formatCredit(transaction.balanceAfter)}
        />
        <TransactionInfo
          label="관련 거래 ID"
          value={
            transaction.relatedTradeId === null
              ? "-"
              : `#${transaction.relatedTradeId}`
          }
        />
        <TransactionInfo
          label="상세 사유"
          value={transaction.detailReason ?? "-"}
        />
      </div>
    </article>
  );
}

function TransactionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black text-[#8c5bff]">{label}</p>
      <p className="mt-1 break-words font-black text-zinc-950">{value}</p>
    </div>
  );
}

function Summary({
  title,
  description,
  value,
  isLoading,
  icon,
  tone,
}: {
  title: string;
  description: string;
  value: string;
  isLoading: boolean;
  icon: ReactNode;
  tone: "primary" | "hold" | "total";
}) {
  const toneClassNames = {
    primary: {
      line: "bg-[#8c5bff]",
      icon: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
    },
    hold: {
      line: "bg-[#7aa7ff]",
      icon: "border-blue-200 bg-blue-50 text-blue-600",
    },
    total: {
      line: "bg-[#161622]",
      icon: "border-zinc-200 bg-zinc-950 text-white",
    },
  }[tone];

  return (
    <article className="relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 p-6 shadow-sm shadow-violet-950/[0.04]">
      <div className={`absolute inset-x-0 top-0 h-1 ${toneClassNames.line}`} />
      <div
        className={`flex size-12 items-center justify-center rounded-lg border ${toneClassNames.icon}`}
      >
        {icon}
      </div>
      <p className="mt-5 text-sm font-black text-zinc-600">{title}</p>
      <p className="mt-1 text-xs font-semibold text-zinc-400">
        {description}
      </p>
      <p className="mt-4 text-3xl font-black tracking-normal text-zinc-950">
        {isLoading ? "불러오는 중..." : value}
      </p>
    </article>
  );
}
