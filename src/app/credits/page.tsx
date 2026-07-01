"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
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
  talentApi,
  tradeApi,
  type CreditBalanceRes,
  type CreditTransactionRes,
  type CreditTransactionSearchParams,
  type CreditTransactionType,
  type TalentDetailRes,
  type TradeRes,
} from "@/lib/api";
import { isAuthRequiredMessage } from "@/lib/auth-required";
import { formatCredit, formatDate } from "@/utils/format";

interface ListboxOption<TValue extends string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

interface ListboxProps<TValue extends string> {
  label: string;
  value: TValue;
  options: ListboxOption<TValue>[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  className?: string;
  placement?: "auto" | "top" | "bottom";
}

function Listbox<TValue extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "선택해 주세요",
  className = "mt-2",
  placement = "auto",
}: ListboxProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldOpenUpward, setShouldOpenUpward] = useState(false);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!listboxRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePlacement = () => {
      if (placement === "top") {
        setShouldOpenUpward(true);
        return;
      }

      if (placement === "bottom") {
        setShouldOpenUpward(false);
        return;
      }

      const container = listboxRef.current;

      if (container === null) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const estimatedDropdownHeight = Math.min(options.length * 44 + 12, 288);
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      setShouldOpenUpward(
        spaceBelow < estimatedDropdownHeight || spaceBelow < spaceAbove,
      );
    };

    updatePlacement();

    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, options.length, placement]);

  return (
    <div ref={listboxRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-lg border border-[#d9ccff] bg-white px-4 text-left text-sm font-black text-zinc-900 shadow-sm shadow-violet-950/[0.03] outline-none transition hover:border-[#c8b7ff] hover:bg-[#fbf9ff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
      >
        <span
          className={
            selected ? "font-black text-zinc-900" : "font-black text-zinc-400"
          }
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition ${isOpen ? "rotate-180" : ""
            }`}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div
          role="listbox"
          className={`absolute z-[1200] max-h-72 w-full overflow-y-auto rounded-lg border border-[#d9ccff] bg-white p-1.5 shadow-[0_18px_42px_rgba(80,60,160,0.16)] ${shouldOpenUpward ? "bottom-full mb-2" : "top-full mt-2"
            }`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex h-11 w-full items-center justify-between rounded-md px-3 text-left text-base transition ${isSelected
                    ? "bg-[#f4f0ff] font-bold text-[#8c5bff]"
                    : "font-bold text-zinc-700 hover:bg-[#f8f5ff] hover:text-[#8c5bff]"
                  } disabled:cursor-not-allowed disabled:text-zinc-300`}
              >
                <span className="font-bold">{option.label}</span>
                {isSelected ? (
                  <Check
                    className="h-4 w-4 text-[#8c5bff]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const CREDIT_ACCOUNT_NOT_FOUND_MESSAGE =
  "크레딧 계좌가 없습니다. 기존 가입 계정일 수 있습니다. 새로 회원가입한 계정으로 다시 확인해 주세요.";
const TRANSACTION_PAGE_SIZE = 10;

type TransactionTypeFilter = "" | CreditTransactionType;
type PeriodFilter = "ALL" | "TODAY" | "7D" | "30D" | "CUSTOM";

type CreditTransactionView = CreditTransactionRes & {
  tradeDetail?: TradeRes | null;
  talentDetail?: TalentDetailRes | null;
};

interface CreditTransactionGroupView {
  groupKey: string;
  tradeGroupId: number | null;
  relatedTradeId: number | null;
  transactions: CreditTransactionView[];
  latestCreatedAt: string;
}

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

const transactionTypeOptions: ListboxOption<TransactionTypeFilter>[] = [
  { value: "", label: "전체 유형" },
  ...Object.entries(transactionTypeLabels).map(([value, label]) => ({
    value: value as CreditTransactionType,
    label,
  })),
];

const periodOptions: ListboxOption<PeriodFilter>[] = [
  { value: "ALL", label: "전체 기간" },
  { value: "TODAY", label: "오늘" },
  { value: "7D", label: "최근 7일" },
  { value: "30D", label: "최근 30일" },
  { value: "CUSTOM", label: "직접 선택" },
];

function hasStoredAccessToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem("baton_access_token"));
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPeriodDateRange(period: PeriodFilter): {
  fromDate: string;
  toDate: string;
} {
  if (period === "ALL" || period === "CUSTOM") {
    return { fromDate: "", toDate: "" };
  }

  const today = new Date();
  const toDate = formatDateInput(today);
  const startDate = new Date(today);

  if (period === "7D") {
    startDate.setDate(today.getDate() - 6);
  }

  if (period === "30D") {
    startDate.setDate(today.getDate() - 29);
  }

  return {
    fromDate: formatDateInput(startDate),
    toDate,
  };
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

function getTransactionDateValue(createdAt: string): string {
  return createdAt.slice(0, 10);
}

function isTransactionInDateRange(
  transaction: CreditTransactionRes,
  fromDate: string,
  toDate: string,
): boolean {
  const transactionDate = getTransactionDateValue(transaction.createdAt);

  if (fromDate && transactionDate < fromDate) {
    return false;
  }

  if (toDate && transactionDate > toDate) {
    return false;
  }

  return true;
}

function getTradeDisplayTitle(transaction: CreditTransactionView): string {
  const detailTitle = transaction.talentDetail?.title?.trim();

  if (detailTitle) {
    return detailTitle;
  }

  const talentTitle = transaction.tradeDetail?.talentTitle?.trim();

  if (talentTitle) {
    return talentTitle;
  }

  const title = transaction.tradeDetail?.title?.trim();

  if (title) {
    return title;
  }

  if (transaction.relatedTradeId !== null) {
    return `거래 #${transaction.relatedTradeId}`;
  }

  return "관련 거래 없음";
}

function getGroupDisplayTitle(group: CreditTransactionGroupView): string {
  const titles = Array.from(
    new Set(group.transactions.map(getTradeDisplayTitle).filter(Boolean)),
  );

  if (titles.length === 0) {
    return "관련 거래 없음";
  }

  if (titles.length === 1) {
    return titles[0];
  }

  return titles.slice(0, 2).join(" ↔ ");
}

function buildCreditTransactionGroups(
  transactions: CreditTransactionView[],
): CreditTransactionGroupView[] {
  const groups = new Map<string, CreditTransactionGroupView>();

  transactions.forEach((transaction) => {
    const tradeGroupId = transaction.tradeDetail?.tradeGroupId ?? null;
    const relatedTradeId = transaction.relatedTradeId;
    const groupKey =
      tradeGroupId !== null
        ? `GROUP-${tradeGroupId}`
        : relatedTradeId !== null
          ? `TRADE-${relatedTradeId}`
          : `TX-${transaction.transactionId}`;
    const current = groups.get(groupKey);

    if (!current) {
      groups.set(groupKey, {
        groupKey,
        tradeGroupId,
        relatedTradeId,
        transactions: [transaction],
        latestCreatedAt: transaction.createdAt,
      });
      return;
    }

    current.transactions.push(transaction);

    if (
      new Date(transaction.createdAt).getTime() >
      new Date(current.latestCreatedAt).getTime()
    ) {
      current.latestCreatedAt = transaction.createdAt;
    }
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      transactions: [...group.transactions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() -
        new Date(a.latestCreatedAt).getTime(),
    );
}

function formatSignedCredit(amount: number): string {
  return `${amount > 0 ? "+" : ""}${formatCredit(amount)}`;
}

function getAmountClassName(amount: number): string {
  if (amount > 0) {
    return "text-emerald-700";
  }

  if (amount < 0) {
    return "text-rose-600";
  }

  return "text-zinc-700";
}

function getGroupSummaryAmountLabel(group: CreditTransactionGroupView): string {
  if (group.transactions.length === 1) {
    return formatSignedCredit(group.transactions[0].amount);
  }

  const tradePrices = Array.from(
    new Map(
      group.transactions
        .map((transaction) => {
          const tradeId = transaction.relatedTradeId;
          const creditPrice = transaction.tradeDetail?.creditPrice;

          if (
            typeof tradeId !== "number" ||
            typeof creditPrice !== "number" ||
            !Number.isFinite(creditPrice)
          ) {
            return null;
          }

          return [tradeId, creditPrice] as const;
        })
        .filter((entry): entry is readonly [number, number] => entry !== null),
    ).values(),
  );
  const uniqueTradePrices = Array.from(new Set(tradePrices)).sort(
    (a, b) => b - a,
  );

  if (uniqueTradePrices.length === 1) {
    return `거래 금액 ${formatCredit(uniqueTradePrices[0])}`;
  }

  if (uniqueTradePrices.length > 1) {
    return `거래 금액 ${uniqueTradePrices.map(formatCredit).join(" / ")}`;
  }

  const representativeAmounts = Array.from(
    new Set(
      group.transactions
        .map((transaction) => Math.abs(transaction.amount))
        .filter((amount) => amount > 0),
    ),
  );

  if (representativeAmounts.length === 1) {
    return `관련 금액 ${formatCredit(representativeAmounts[0])}`;
  }

  return `크레딧 로그 ${group.transactions.length}건`;
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalanceRes | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionRes[]>([]);
  const [tradeDetailsById, setTradeDetailsById] = useState<
    Record<number, TradeRes | null>
  >({});
  const [talentDetailsById, setTalentDetailsById] = useState<
    Record<number, TalentDetailRes | null>
  >({});
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterErrorMessage, setFilterErrorMessage] = useState<string | null>(
    null,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const transactionRequestIdRef = useRef(0);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const activeFilterDescription = useMemo(() => {
    const descriptions: string[] = [];

    if (typeFilter) {
      descriptions.push(transactionTypeLabels[typeFilter]);
    }

    if (periodFilter !== "ALL") {
      const periodLabel =
        periodOptions.find((option) => option.value === periodFilter)?.label ??
        "선택 기간";
      descriptions.push(periodLabel);
    }

    if (fromDate || toDate) {
      descriptions.push(`${fromDate || "처음"} ~ ${toDate || "오늘"}`);
    }

    return descriptions.join(" · ");
  }, [fromDate, periodFilter, toDate, typeFilter]);

  const fetchTransactionPage = useCallback(
    async ({
      cursor = null,
      type,
      from,
      to,
    }: {
      cursor?: number | null;
      type: TransactionTypeFilter;
      from: string;
      to: string;
    }) => {
      const transactionPage = await creditApi.getTransactions(
        buildTransactionParams({
          cursor,
          type,
          fromDate: from,
          toDate: to,
        }),
      );

      const nextContent = transactionPage.content.filter((transaction) =>
        isTransactionInDateRange(transaction, from, to),
      );

      return {
        content: nextContent,
        nextCursor: transactionPage.nextCursor,
        hasNext: transactionPage.hasNext,
      };
    },
    [],
  );

  const reloadTransactions = useCallback(
    async ({
      type,
      from,
      to,
    }: {
      type: TransactionTypeFilter;
      from: string;
      to: string;
    }) => {
      const requestId = transactionRequestIdRef.current + 1;
      transactionRequestIdRef.current = requestId;

      setIsTransactionsLoading(true);
      setIsLoadingMore(false);
      setTransactions([]);
      setNextCursor(null);
      setHasNext(false);
      setErrorMessage(null);

      try {
        const transactionPage = await fetchTransactionPage({
          type,
          from,
          to,
        });

        if (requestId !== transactionRequestIdRef.current) {
          return;
        }

        setTransactions(transactionPage.content);
        setNextCursor(transactionPage.nextCursor);
        setHasNext(transactionPage.hasNext);
      } catch (error) {
        if (requestId !== transactionRequestIdRef.current) {
          return;
        }

        setTransactions([]);
        setNextCursor(null);
        setHasNext(false);
        setErrorMessage(getCreditErrorMessage(error));
      } finally {
        if (requestId === transactionRequestIdRef.current) {
          setIsTransactionsLoading(false);
        }
      }
    },
    [fetchTransactionPage],
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

      const requestId = transactionRequestIdRef.current + 1;
      transactionRequestIdRef.current = requestId;

      try {
        const [nextBalance, transactionPage] = await Promise.all([
          creditApi.getBalance(),
          fetchTransactionPage({
            type: "",
            from: "",
            to: "",
          }),
        ]);

        if (ignore || requestId !== transactionRequestIdRef.current) {
          return;
        }

        setBalance(nextBalance);
        setTransactions(transactionPage.content);
        setNextCursor(transactionPage.nextCursor);
        setHasNext(transactionPage.hasNext);
        setErrorMessage(null);
      } catch (error) {
        if (ignore || requestId !== transactionRequestIdRef.current) {
          return;
        }

        setBalance(null);
        setTransactions([]);
        setErrorMessage(getCreditErrorMessage(error));
      } finally {
        if (!ignore && requestId === transactionRequestIdRef.current) {
          setIsBalanceLoading(false);
          setIsTransactionsLoading(false);
        }
      }
    }

    void loadCreditPage();

    return () => {
      ignore = true;
    };
  }, [fetchTransactionPage]);

  useEffect(() => {
    const tradeIds = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.relatedTradeId)
          .filter((tradeId): tradeId is number => typeof tradeId === "number"),
      ),
    ).filter((tradeId) => !(tradeId in tradeDetailsById));

    if (tradeIds.length === 0) {
      return;
    }

    let ignore = false;

    async function loadTradeDetails() {
      const results = await Promise.allSettled(
        tradeIds.map(async (tradeId) => ({
          tradeId,
          detail: await tradeApi.getDetail(tradeId),
        })),
      );

      if (ignore) {
        return;
      }

      setTradeDetailsById((current) => {
        const next = { ...current };

        results.forEach((result, index) => {
          const tradeId = tradeIds[index];

          if (result.status === "fulfilled") {
            next[tradeId] = result.value.detail;
          } else {
            next[tradeId] = null;
          }
        });

        return next;
      });
    }

    void loadTradeDetails();

    return () => {
      ignore = true;
    };
  }, [transactions, tradeDetailsById]);

  useEffect(() => {
    const talentIds = Array.from(
      new Set(
        transactions
          .map((transaction) =>
            transaction.relatedTradeId === null
              ? null
              : (tradeDetailsById[transaction.relatedTradeId]?.talentId ??
                null),
          )
          .filter(
            (talentId): talentId is number => typeof talentId === "number",
          ),
      ),
    ).filter((talentId) => !(talentId in talentDetailsById));

    if (talentIds.length === 0) {
      return;
    }

    let ignore = false;

    async function loadTalentDetails() {
      const results = await Promise.allSettled(
        talentIds.map(async (talentId) => ({
          talentId,
          detail: await talentApi.getDetail(talentId),
        })),
      );

      if (ignore) {
        return;
      }

      setTalentDetailsById((current) => {
        const next = { ...current };

        results.forEach((result, index) => {
          const talentId = talentIds[index];

          if (result.status === "fulfilled") {
            next[result.value.talentId] = result.value.detail;
          } else {
            next[talentId] = null;
          }
        });

        return next;
      });
    }

    void loadTalentDetails();

    return () => {
      ignore = true;
    };
  }, [transactions, talentDetailsById, tradeDetailsById]);

  const transactionViews = useMemo(() => {
    return transactions.map((transaction) => {
      const tradeDetail =
        transaction.relatedTradeId === null
          ? null
          : (tradeDetailsById[transaction.relatedTradeId] ?? null);

      return {
        ...transaction,
        tradeDetail,
        talentDetail:
          tradeDetail === null
            ? null
            : (talentDetailsById[tradeDetail.talentId] ?? null),
      };
    });
  }, [transactions, talentDetailsById, tradeDetailsById]);

  const transactionGroups = useMemo(() => {
    return buildCreditTransactionGroups(transactionViews);
  }, [transactionViews]);

  const balanceValue = balance?.balance ?? 0;
  const escrowBalanceValue = balance?.escrowBalance ?? 0;
  const isLoginRequired = isAuthRequiredMessage(errorMessage);
  const isFilterDisabled = isTransactionsLoading || isLoadingMore;

  function applyFilterChange({
    type,
    period,
    from,
    to,
  }: {
    type: TransactionTypeFilter;
    period: PeriodFilter;
    from: string;
    to: string;
  }) {
    setTypeFilter(type);
    setPeriodFilter(period);
    setFromDate(from);
    setToDate(to);

    if (isInvalidDateRange(from, to)) {
      setFilterErrorMessage("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    setFilterErrorMessage(null);

    void reloadTransactions({
      type,
      from,
      to,
    });
  }

  function handleTypeChange(nextType: TransactionTypeFilter) {
    applyFilterChange({
      type: nextType,
      period: periodFilter,
      from: fromDate,
      to: toDate,
    });
  }

  function handlePeriodChange(nextPeriod: PeriodFilter) {
    const nextRange =
      nextPeriod === "CUSTOM"
        ? { fromDate, toDate }
        : getPeriodDateRange(nextPeriod);

    applyFilterChange({
      type: typeFilter,
      period: nextPeriod,
      from: nextRange.fromDate,
      to: nextRange.toDate,
    });
  }

  function handleCustomDateChange(field: "from" | "to", value: string) {
    const nextFromDate = field === "from" ? value : fromDate;
    const nextToDate = field === "to" ? value : toDate;

    applyFilterChange({
      type: typeFilter,
      period: "CUSTOM",
      from: nextFromDate,
      to: nextToDate,
    });
  }

  function handleResetFilters() {
    setTypeFilter("");
    setPeriodFilter("ALL");
    setFromDate("");
    setToDate("");
    setFilterErrorMessage(null);

    void reloadTransactions({
      type: "",
      from: "",
      to: "",
    });
  }

  const loadNextPage = useCallback(async () => {
    if (
      !hasNext ||
      nextCursor === null ||
      isTransactionsLoading ||
      isLoadingMore
    ) {
      return;
    }

    const requestId = transactionRequestIdRef.current;

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      const transactionPage = await fetchTransactionPage({
        cursor: nextCursor,
        type: typeFilter,
        from: fromDate,
        to: toDate,
      });

      if (requestId !== transactionRequestIdRef.current) {
        return;
      }

      setTransactions((prevTransactions) => [
        ...prevTransactions,
        ...transactionPage.content,
      ]);
      setNextCursor(transactionPage.nextCursor);
      setHasNext(transactionPage.hasNext);
    } catch (error) {
      if (requestId === transactionRequestIdRef.current) {
        setErrorMessage(getCreditErrorMessage(error));
      }
    } finally {
      if (requestId === transactionRequestIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [
    fetchTransactionPage,
    fromDate,
    hasNext,
    isLoadingMore,
    isTransactionsLoading,
    nextCursor,
    toDate,
    typeFilter,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasNext || isTransactionsLoading || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry.isIntersecting) {
          return;
        }

        void loadNextPage();
      },
      {
        root: null,
        rootMargin: "240px",
        threshold: 0,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasNext, isLoadingMore, isTransactionsLoading, loadNextPage]);

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3 !font-bold">CREDIT WALLET</h1>
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
            description="사용 가능 금액과 예치금을 함께 표시"
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
              <History className="size-4" aria-hidden="true" />총{" "}
              {transactions.length}
              {hasNext ? "+" : ""}건 · {transactionGroups.length}
              {hasNext ? "+" : ""}개 거래
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#ded6ff] bg-white/95 p-4 shadow-sm shadow-violet-950/[0.04] sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-end">
              <div>
                <span className="text-xs font-black text-[#8c5bff]">
                  거래 유형
                </span>
                <Listbox
                  label="거래 유형"
                  value={typeFilter}
                  options={transactionTypeOptions}
                  onChange={(nextType) => {
                    if (!isFilterDisabled) {
                      handleTypeChange(nextType);
                    }
                  }}
                  className="mt-2"
                  placement="top"
                />
              </div>

              <div>
                <span className="text-xs font-black text-[#8c5bff]">
                  조회 기간
                </span>
                <Listbox
                  label="조회 기간"
                  value={periodFilter}
                  options={periodOptions}
                  onChange={(nextPeriod) => {
                    if (!isFilterDisabled) {
                      handlePeriodChange(nextPeriod);
                    }
                  }}
                  className="mt-2"
                  placement="top"
                />
              </div>

              <div className="flex gap-2">
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

            {periodFilter === "CUSTOM" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black text-[#8c5bff]">
                    시작일
                  </span>
                  <input
                    type="date"
                    value={fromDate}
                    disabled={isFilterDisabled}
                    onChange={(event) =>
                      handleCustomDateChange("from", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-[#d9ccff] bg-white px-4 text-sm font-bold text-zinc-900 shadow-sm shadow-violet-950/[0.03] outline-none transition hover:border-[#c8b7ff] hover:bg-[#fbf9ff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
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
                    onChange={(event) =>
                      handleCustomDateChange("to", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-[#d9ccff] bg-white px-4 text-sm font-bold text-zinc-900 shadow-sm shadow-violet-950/[0.03] outline-none transition hover:border-[#c8b7ff] hover:bg-[#fbf9ff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                </label>
              </div>
            ) : null}

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
                  {transactionGroups.map((group) => (
                    <CreditTransactionGroupCard
                      key={group.groupKey}
                      group={group}
                    />
                  ))}
                </div>
                <div ref={loadMoreRef} className="h-10" aria-hidden="true" />
                {isLoadingMore ? (
                  <p className="py-4 text-center text-sm font-semibold text-zinc-400">
                    다음 내역을 불러오는 중입니다.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CreditTransactionGroupCard({
  group,
}: {
  group: CreditTransactionGroupView;
}) {
  const isGroupedSwap =
    group.tradeGroupId !== null && group.transactions.length > 1;
  const representativeTransaction = group.transactions[0];
  const isSingleTransaction = group.transactions.length === 1;
  const displayAmount = isSingleTransaction
    ? representativeTransaction.amount
    : 0;
  const isPositive = displayAmount > 0;
  const isNegative = displayAmount < 0;
  const amountClassName = isSingleTransaction
    ? getAmountClassName(displayAmount)
    : "text-zinc-950";
  const amountBadgeClassName = isGroupedSwap
    ? "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]"
    : isPositive
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : isNegative
        ? "border-rose-200 bg-rose-50 text-rose-600"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  const topLineClassName = isPositive
    ? "bg-[linear-gradient(90deg,#8c5bff_0%,#34d399_100%)]"
    : isNegative
      ? "bg-[linear-gradient(90deg,#8c5bff_0%,#fb7185_100%)]"
      : "bg-[#8c5bff]";
  const formattedAmount = getGroupSummaryAmountLabel(group);
  const badgeLabel = isGroupedSwap
    ? "재능 교환"
    : (transactionTypeLabels[representativeTransaction.type] ??
      representativeTransaction.type);
  const groupSubText =
    group.tradeGroupId !== null
      ? `교환 그룹 #${group.tradeGroupId}`
      : group.relatedTradeId !== null
        ? `거래 #${group.relatedTradeId}`
        : null;

  return (
    <article className="relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 p-5 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/[0.08]">
      <div className={`absolute inset-x-0 top-0 h-1 ${topLineClassName}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${amountBadgeClassName}`}
          >
            {isGroupedSwap ? (
              <Coins className="size-3.5" aria-hidden="true" />
            ) : isPositive ? (
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
            ) : isNegative ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : (
              <Coins className="size-3.5" aria-hidden="true" />
            )}
            {badgeLabel}
          </span>
          <p className="mt-3 text-base font-black text-zinc-950">
            {getGroupDisplayTitle(group)}
          </p>
          {groupSubText ? (
            <p className="mt-1 text-xs font-semibold text-zinc-500">
              {groupSubText}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-2xl font-black ${amountClassName}`}>
            {formattedAmount}
          </p>
          {group.transactions.length > 1 ? (
            <p className="mt-1 text-xs font-semibold text-zinc-400">
              {group.transactions.length}개 크레딧 로그
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-[#eee8ff] bg-[#fbf9ff]">
        {group.transactions.map((transaction, index) => (
          <CreditTransactionRow
            key={transaction.transactionId}
            transaction={transaction}
            isFirst={index === 0}
          />
        ))}
      </div>
    </article>
  );
}

function CreditTransactionRow({
  transaction,
  isFirst,
}: {
  transaction: CreditTransactionView;
  isFirst: boolean;
}) {
  const amountClassName = getAmountClassName(transaction.amount);

  return (
    <div
      className={`grid gap-4 p-4 text-sm lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)_auto] lg:items-start ${isFirst ? "" : "border-t border-[#eee8ff]"
        }`}
    >
      <div className="min-w-0">
        <span className="inline-flex rounded-full border border-[#d9ccff] bg-white px-2.5 py-1 text-xs font-black text-[#8c5bff]">
          {transactionTypeLabels[transaction.type] ?? transaction.type}
        </span>
        <p className="mt-2 break-words font-black text-zinc-950">
          {transaction.defaultReason || "사유 없음"}
        </p>
        <p className="mt-1 text-xs font-semibold text-zinc-400">
          트랜잭션 #{transaction.transactionId}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TransactionInfo
          label="상세 사유"
          value={transaction.detailReason ?? "-"}
        />
        <TransactionInfo
          label="발생일"
          value={formatDate(transaction.createdAt)}
        />
        <div>
          <TransactionInfo
            label="관련 거래"
            value={getTradeDisplayTitle(transaction)}
          />
          <p className="mt-1 text-xs font-semibold text-zinc-400">
            {transaction.relatedTradeId !== null
              ? `거래 #${transaction.relatedTradeId}`
              : "거래 ID 없음"}
          </p>
        </div>
        <TransactionInfo
          label="거래 후 잔액"
          value={formatCredit(transaction.balanceAfter)}
        />
      </div>

      <p
        className={`whitespace-nowrap text-right text-lg font-black ${amountClassName}`}
      >
        {formatSignedCredit(transaction.amount)}
      </p>
    </div>
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
      <p className="mt-1 text-xs font-semibold text-zinc-400">{description}</p>
      <p className="mt-4 text-3xl font-black tracking-normal text-zinc-950">
        {isLoading ? "불러오는 중..." : value}
      </p>
    </article>
  );
}
