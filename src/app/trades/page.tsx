"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/common/StatusBadge";
import { tradeApi, type TradeListRes, type TradeStatus } from "@/lib/api";
import { getStoredUserId, hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate } from "@/utils/format";

const PAGE_SIZE = 20;

type TradeListItem = TradeListRes & {
  tradeGroupId?: number | null;
  talentTitle?: string | null;
};

interface TradeGroupView {
  groupKey: string;
  tradeType: TradeListItem["tradeType"];
  trades: TradeListItem[];
  updatedAt: string;
}

const statusOptions: { value: TradeStatus | ""; label: string }[] = [
  { value: "", label: "전체" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "UNDER_REVIEW", label: "검토 중" },
  { value: "AWAITING_PARTNER", label: "상대 확정 대기" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
  { value: "DISPUTED", label: "분쟁" },
];

const statusLabels: Record<TradeStatus, string> = {
  IN_PROGRESS: "진행 중",
  UNDER_REVIEW: "검토 중",
  AWAITING_PARTNER: "상대 확정 대기",
  COMPLETED: "완료",
  CANCELLED: "취소",
  DISPUTED: "분쟁",
};

function getStatusTone(
  status: TradeStatus,
): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "DISPUTED") return "danger";
  if (status === "UNDER_REVIEW" || status === "AWAITING_PARTNER") {
    return "warning";
  }
  if (status === "IN_PROGRESS") return "info";
  return "default";
}

function groupTradesForView(trades: TradeListItem[]): TradeGroupView[] {
  const map = new Map<string, TradeGroupView>();

  for (const trade of trades) {
    const groupKey =
      trade.tradeType === "SWAP" && trade.tradeGroupId != null
        ? `swap-${trade.tradeGroupId}`
        : `trade-${trade.tradeId}`;

    const current = map.get(groupKey);

    if (!current) {
      map.set(groupKey, {
        groupKey,
        tradeType: trade.tradeType,
        trades: [trade],
        updatedAt: trade.updatedAt,
      });
      continue;
    }

    current.trades.push(trade);

    if (
      new Date(trade.updatedAt).getTime() >
      new Date(current.updatedAt).getTime()
    ) {
      current.updatedAt = trade.updatedAt;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getRepresentativeStatus(group: TradeGroupView): TradeStatus {
  const priority: TradeStatus[] = [
    "DISPUTED",
    "UNDER_REVIEW",
    "AWAITING_PARTNER",
    "IN_PROGRESS",
    "CANCELLED",
    "COMPLETED",
  ];

  return (
    priority.find((status) =>
      group.trades.some((trade) => trade.tradeStatus === status),
    ) ?? group.trades[0].tradeStatus
  );
}

function formatGroupCredit(group: TradeGroupView) {
  if (group.tradeType !== "SWAP" || group.trades.length < 2) {
    return formatCredit(group.trades[0].creditPrice);
  }

  const firstCreditPrice = group.trades[0].creditPrice;
  const isSameCreditPrice = group.trades.every(
    (trade) => trade.creditPrice === firstCreditPrice,
  );

  if (isSameCreditPrice) {
    return `각 ${formatCredit(firstCreditPrice)}`;
  }

  return group.trades
    .map((trade) => formatCredit(trade.creditPrice))
    .join(" / ");
}

function getTradeTitle(trade: TradeListItem) {
  return trade.talentTitle?.trim() || `거래 #${trade.tradeId}`;
}

export default function TradesPage() {
  const [selectedStatus, setSelectedStatus] = useState<TradeStatus | "">("");
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrades = useCallback(
    async ({
      cursor,
      append = false,
    }: { cursor?: number | null; append?: boolean } = {}) => {
      if (!hasStoredAccessToken()) {
        setTrades([]);
        setCurrentUserId(null);
        setHasNext(false);
        setNextCursor(null);
        setErrorMessage("로그인 후 이용해 주세요.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(getStoredUserId());

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const response = await tradeApi.getList({
          status: selectedStatus || undefined,
          cursor,
          size: PAGE_SIZE,
        });

        setTrades((current) =>
          append
            ? [...current, ...response.content]
            : response.content,
        );
        setHasNext(response.hasNext);
        setNextCursor(response.nextCursor);
      } catch (error) {
        if (!append) {
          setTrades([]);
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "거래 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedStatus],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTrades();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTrades]);

  async function handleLoadMore() {
    if (!hasNext || nextCursor === null || isLoadingMore) {
      return;
    }

    await loadTrades({ cursor: nextCursor, append: true });
  }

  const tradeGroups = groupTradesForView(trades);

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="내 거래"
        description="진행 중, 검토 중, 분쟁 중인 거래를 상태별로 확인합니다."
      />

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-white p-2">
        {statusOptions.map((option) => {
          const isActive = selectedStatus === option.value;

          return (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => setSelectedStatus(option.value)}
              className={`h-10 rounded-md px-4 text-sm font-bold transition ${isActive
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          거래 목록을 불러오는 중입니다.
        </div>
      ) : null}

      {!isLoading && !errorMessage && trades.length === 0 ? (
        <EmptyState title="조건에 맞는 거래가 없습니다." />
      ) : null}

      {!isLoading && trades.length > 0 ? (
        <>
          <div className="grid gap-4">
            {tradeGroups.map((group) => (
              <TradeGroupCard
                key={group.groupKey}
                group={group}
                currentUserId={currentUserId}
              />
            ))}
          </div>

          {hasNext ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={handleLoadMore}
                className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
              >
                {isLoadingMore ? "불러오는 중..." : "더 보기"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TradeGroupCard({
  group,
  currentUserId,
}: {
  group: TradeGroupView;
  currentUserId: number | null;
}) {
  if (group.tradeType !== "SWAP" || group.trades.length === 1) {
    return (
      <TradeListCard trade={group.trades[0]} currentUserId={currentUserId} />
    );
  }

  const groupStatus = getRepresentativeStatus(group);

  const receiveTrade = group.trades.find(
    (trade) => currentUserId !== null && trade.buyerId === currentUserId,
  );

  const provideTrade = group.trades.find(
    (trade) => currentUserId !== null && trade.sellerId === currentUserId,
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={statusLabels[groupStatus]}
              tone={getStatusTone(groupStatus)}
            />
            <StatusBadge label="재능 교환" tone="info" />
          </div>

          <p className="mt-3 text-lg font-black text-zinc-950">
            교환 거래 #
            {group.trades[0].tradeGroupId ?? group.trades[0].tradeId}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            {formatDate(group.updatedAt)}
          </p>
        </div>

        <p className="text-lg font-black text-zinc-950 md:text-right">
          {formatGroupCredit(group)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {receiveTrade ? (
          <TradeLegLink
            title="내가 받을 재능"
            description="결과물 확인, 구매 확정, 분쟁 신청을 진행합니다."
            trade={receiveTrade}
          />
        ) : null}

        {provideTrade ? (
          <TradeLegLink
            title="내가 제공할 재능"
            description="결과물을 제출하는 거래입니다."
            trade={provideTrade}
          />
        ) : null}

        {!receiveTrade && !provideTrade ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-600 md:col-span-2">
            현재 로그인 사용자와 연결된 거래 역할을 확인하지 못했습니다.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TradeLegLink({
  title,
  description,
  trade,
}: {
  title: string;
  description: string;
  trade: TradeListItem;
}) {
  return (
    <Link
      href={`/trades/${trade.tradeId}`}
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:border-teal-300 hover:bg-teal-50"
    >
      <p className="text-sm font-black text-zinc-950">{title}</p>

      <p className="mt-2 text-base font-black text-zinc-950">
        {getTradeTitle(trade)}
      </p>

      <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>

      <p className="mt-3 text-sm font-bold text-zinc-700">
        {formatCredit(trade.creditPrice)}
      </p>
    </Link>
  );
}

function TradeListCard({
  trade,
  currentUserId,
}: {
  trade: TradeListItem;
  currentUserId: number | null;
}) {
  const isBuyer = currentUserId === trade.buyerId;
  const isSeller = currentUserId === trade.sellerId;

  const myRoleLabel = isBuyer
    ? "내가 구매자"
    : isSeller
      ? "내가 판매자"
      : "참여자 확인 필요";

  return (
    <Link
      href={`/trades/${trade.tradeId}`}
      className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 md:grid-cols-[1fr_140px_160px] md:items-center md:gap-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={statusLabels[trade.tradeStatus]}
            tone={getStatusTone(trade.tradeStatus)}
          />
          <StatusBadge
            label={trade.tradeType === "SWAP" ? "재능 교환" : "크레딧 구매"}
            tone="info"
          />
        </div>

        <p className="mt-3 text-lg font-black text-zinc-950">
          {getTradeTitle(trade)}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          {myRoleLabel} ·{" "}
          {trade.tradeType === "SWAP" ? "재능 교환" : "크레딧 구매"}
        </p>
      </div>

      <p className="text-sm font-bold text-zinc-700">
        {formatDate(trade.updatedAt)}
      </p>

      <p className="text-lg font-black text-zinc-950 md:text-right">
        {formatCredit(trade.creditPrice)}
      </p>
    </Link>
  );
}