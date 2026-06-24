"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import {
  creditApi,
  type CreditBalanceRes,
  type CreditTransactionRes,
} from "@/lib/api";
import { formatCredit, formatDate } from "@/utils/format";

const CREDIT_ACCOUNT_NOT_FOUND_MESSAGE =
  "크레딧 계좌가 없습니다. 기존 가입 계정일 수 있습니다. 새로 회원가입한 계정으로 다시 확인해 주세요.";
const TRANSACTION_PAGE_SIZE = 10;

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

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalanceRes | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionRes[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  async function handleLoadMore() {
    if (!hasNext || nextCursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      const transactionPage = await creditApi.getTransactions({
        cursor: nextCursor,
        size: TRANSACTION_PAGE_SIZE,
      });

      setTransactions((prevTransactions) => [
        ...prevTransactions,
        ...transactionPage.content,
      ]);
      setNextCursor(transactionPage.nextCursor);
      setHasNext(transactionPage.hasNext);
    } catch (error) {
      setErrorMessage(getCreditErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="크레딧 지갑"
        description="사용 가능 크레딧과 에스크로 예치 내역을 확인하세요."
      />
      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-4">
        <Summary
          title="사용 가능 크레딧"
          value={formatCredit(balanceValue)}
          isLoading={isBalanceLoading}
        />
        <Summary
          title="에스크로 예치 중"
          value={formatCredit(escrowBalanceValue)}
          isLoading={isBalanceLoading}
        />
        <Summary
          title="총 보유"
          value={formatCredit(balanceValue + escrowBalanceValue)}
          isLoading={isBalanceLoading}
        />
      </div>
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-black text-zinc-950">
            크레딧 사용 내역
          </h2>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            크레딧 적립, 사용, 정산 내역을 확인하세요.
          </p>
        </div>
        <div className="p-5">
          {isTransactionsLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
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
                    className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
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
  );
}

function CreditTransactionCard({
  transaction,
}: {
  transaction: CreditTransactionRes;
}) {
  const isPositive = transaction.amount > 0;
  const amountClassName = isPositive ? "text-teal-700" : "text-red-600";
  const formattedAmount = `${isPositive ? "+" : ""}${formatCredit(
    transaction.amount,
  )}`;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-zinc-950">
            {transaction.defaultReason}
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {transaction.type} · {formatDate(transaction.createdAt)}
          </p>
        </div>
        <p className={`text-lg font-black ${amountClassName}`}>
          {formattedAmount}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-zinc-50 p-3 text-sm">
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
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function Summary({
  title,
  value,
  isLoading,
}: {
  title: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-xl font-black text-zinc-950">
        {isLoading ? "불러오는 중..." : value}
      </p>
    </div>
  );
}
