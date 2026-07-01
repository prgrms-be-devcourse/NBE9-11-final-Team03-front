"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import {
  chatApi,
  profileApi,
  talentApi,
  tradeApi,
  type ChatRoomListItem,
  type MyProfileDetailRes,
  type TalentDetailRes,
  type TradeListRes,
  type TradeRes,
  type TradeStatus,
} from "@/lib/api";
import {
  extractAuthClaimsFromAccessToken,
  getAccessToken,
  hasStoredAccessToken,
} from "@/lib/auth";
import {
  isAuthRequiredError,
  isAuthRequiredMessage,
} from "@/lib/auth-required";
import { formatCredit, formatDate } from "@/utils/format";

const PAGE_SIZE = 20;

type TradeListItem = TradeListRes & {
  tradeGroupId?: number | null;
  talentTitle?: string | null;
  title?: string | null;
};

interface TradeGroupView {
  groupKey: string;
  tradeGroupId: number | null;
  tradeType: TradeListItem["tradeType"];
  trades: TradeListItem[];
  updatedAt: string;
}


function getAuthenticatedUserId(): number | null {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  return extractAuthClaimsFromAccessToken(token).userId;
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

function getStatusPillClass(status: TradeStatus): string {
  const tone = getStatusTone(status);

  const classes = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
    info: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
  };

  return classes[tone];
}

function TradeStatusPill({ status }: { status: TradeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${getStatusPillClass(
        status,
      )}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function TradeContextPill({
  label,
  tone = "info",
}: {
  label: string;
  tone?: "info" | "success" | "warning";
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${className}`}
    >
      {label}
    </span>
  );
}

function TradeTypePill({
  tradeType,
}: {
  tradeType: TradeListItem["tradeType"];
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9ccff] bg-white px-3 py-1.5 text-xs font-black text-[#8c5bff]">
      {tradeType === "SWAP" ? "재능 교환" : "크레딧 구매"}
    </span>
  );
}

function getTimeValue(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function buildTradeCardsForView(trades: TradeListItem[]): TradeGroupView[] {
  const map = new Map<string, TradeGroupView>();

  for (const [index, trade] of trades.entries()) {
    const tradeId = getPositiveInteger(trade.tradeId);
    const tradeGroupId = getPositiveInteger(trade.tradeGroupId);
    const groupKey =
      tradeGroupId !== null
        ? `GROUP-${tradeGroupId}`
        : tradeId !== null
          ? `TRADE-${tradeId}`
          : `TRADE-UNKNOWN-${index}`;

    const current = map.get(groupKey);

    if (!current) {
      map.set(groupKey, {
        groupKey,
        tradeGroupId,
        tradeType: trade.tradeType,
        trades: [trade],
        updatedAt: trade.updatedAt,
      });
      continue;
    }

    current.trades.push(trade);

    if (getTimeValue(trade.updatedAt) > getTimeValue(current.updatedAt)) {
      current.updatedAt = trade.updatedAt;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => getTimeValue(b.updatedAt) - getTimeValue(a.updatedAt),
  );
}

function getRepresentativeStatus(group: TradeGroupView): TradeStatus {
  const priority: TradeStatus[] = [
    "DISPUTED",
    "UNDER_REVIEW",
    "IN_PROGRESS",
    "AWAITING_PARTNER",
    "COMPLETED",
    "CANCELLED",
  ];

  return (
    priority.find((status) =>
      group.trades.some((trade) => trade.tradeStatus === status),
    ) ?? group.trades[0].tradeStatus
  );
}

function filterTradeGroupsByStatus(
  groups: TradeGroupView[],
  selectedStatus: TradeStatus | "",
) {
  if (!selectedStatus) {
    return groups;
  }

  return groups.filter(
    (group) => getRepresentativeStatus(group) === selectedStatus,
  );
}

function getRepresentativeTrade(
  group: TradeGroupView,
  currentUserId: number | null,
) {
  if (currentUserId !== null) {
    const buyerTrade = group.trades.find(
      (trade) => getPositiveInteger(trade.buyerId) === currentUserId,
    );

    if (buyerTrade) {
      return buyerTrade;
    }
  }

  return group.trades[0];
}

async function enrichTradeDetails(
  trades: TradeListItem[],
): Promise<TradeListItem[]> {
  const targetTradeIds = Array.from(
    new Set(
      trades
        .map((trade) => getPositiveInteger(trade.tradeId))
        .filter((tradeId): tradeId is number => tradeId !== null),
    ),
  );

  if (targetTradeIds.length === 0) {
    return trades;
  }

  const settledTradeDetails = await Promise.allSettled(
    targetTradeIds.map(async (tradeId) => ({
      tradeId,
      detail: await tradeApi.getDetail(tradeId),
    })),
  );

  const detailsByTradeId = new Map<number, TradeRes>();

  settledTradeDetails.forEach((result) => {
    if (result.status !== "fulfilled") {
      return;
    }

    const tradeId = getPositiveInteger(result.value.tradeId);

    if (tradeId !== null) {
      detailsByTradeId.set(tradeId, result.value.detail);
    }
  });

  const targetTalentIds = Array.from(
    new Set(
      trades
        .map((trade) => {
          const tradeId = getPositiveInteger(trade.tradeId);
          const detail = tradeId === null ? null : detailsByTradeId.get(tradeId);

          return getPositiveInteger(detail?.talentId) ?? getPositiveInteger(trade.talentId);
        })
        .filter((talentId): talentId is number => talentId !== null),
    ),
  );

  const settledTalentDetails = await Promise.allSettled(
    targetTalentIds.map(async (talentId) => ({
      talentId,
      detail: await talentApi.getDetail(talentId),
    })),
  );

  const talentDetailsById = new Map<number, TalentDetailRes>();

  settledTalentDetails.forEach((result) => {
    if (result.status !== "fulfilled") {
      return;
    }

    const talentId = getPositiveInteger(result.value.talentId);

    if (talentId !== null) {
      talentDetailsById.set(talentId, result.value.detail);
    }
  });

  if (detailsByTradeId.size === 0 && talentDetailsById.size === 0) {
    return trades;
  }

  return trades.map((trade) => {
    const tradeId = getPositiveInteger(trade.tradeId);
    const detail = tradeId === null ? null : detailsByTradeId.get(tradeId);
    const talentId = getPositiveInteger(detail?.talentId) ?? getPositiveInteger(trade.talentId);
    const talentDetail = talentId === null ? null : talentDetailsById.get(talentId);

    return {
      ...trade,
      title: getBestDisplayTitle(detail?.title, talentDetail?.title, trade.title),
      tradeGroupId: getPositiveInteger(detail?.tradeGroupId) ?? trade.tradeGroupId,
      talentId: talentId ?? trade.talentId,
      talentTitle: getBestDisplayTitle(
        detail?.talentTitle,
        talentDetail?.title,
        trade.talentTitle,
      ),
      buyerId: getPositiveInteger(detail?.buyerId) ?? trade.buyerId,
      sellerId: getPositiveInteger(detail?.sellerId) ?? trade.sellerId,
      buyerNickname: getNonEmptyText(detail?.buyerNickname) ?? trade.buyerNickname,
      sellerNickname: getNonEmptyText(detail?.sellerNickname) ?? trade.sellerNickname,
      creditPrice:
        typeof detail?.creditPrice === "number" && Number.isFinite(detail.creditPrice)
          ? detail.creditPrice
          : trade.creditPrice,
      tradeStatus: detail?.tradeStatus ?? trade.tradeStatus,
      updatedAt: getNonEmptyText(detail?.updatedAt) ?? trade.updatedAt,
    };
  });
}

function formatGroupCredit(group: TradeGroupView) {
  if (group.tradeGroupId === null || group.trades.length < 2) {
    return formatTradeCredit(group.trades[0].creditPrice);
  }

  const firstCreditPrice = group.trades[0].creditPrice;
  const isSameCreditPrice = group.trades.every(
    (trade) => trade.creditPrice === firstCreditPrice,
  );

  if (isSameCreditPrice) {
    return `각 ${formatTradeCredit(firstCreditPrice)}`;
  }

  return group.trades
    .map((trade) => formatTradeCredit(trade.creditPrice))
    .join(" / ");
}

function getPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function getDisplayDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : formatDate(value);
}

function formatTradeCredit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatCredit(value)
    : "크레딧 정보 없음";
}

function formatBuyerName(trade: TradeListItem) {
  const nickname = trade.buyerNickname?.trim();
  if (nickname) {
    return nickname;
  }

  const buyerId = getPositiveInteger(trade.buyerId);

  return buyerId === null ? "구매자 정보 없음" : `구매자 #${buyerId}`;
}

function formatSellerName(trade: TradeListItem) {
  const nickname = trade.sellerNickname?.trim();
  if (nickname) {
    return nickname;
  }

  const sellerId = getPositiveInteger(trade.sellerId);

  return sellerId === null ? "판매자 정보 없음" : `판매자 #${sellerId}`;
}

function formatTalentTitle(trade: TradeListItem) {
  const title = trade.talentTitle?.trim();
  if (title) {
    return title;
  }

  const talentId = getPositiveInteger(trade.talentId);

  return talentId === null ? "재능 정보 없음" : `재능 #${talentId}`;
}

function formatTradeTitle(trade: TradeListItem) {
  const title = trade.title?.trim();
  if (title) {
    return title;
  }

  const talentTitle = trade.talentTitle?.trim();
  if (talentTitle) {
    return talentTitle;
  }

  const tradeId = getPositiveInteger(trade.tradeId);

  return tradeId === null ? "거래 정보 없음" : `거래 #${tradeId}`;
}

function getNonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isGeneratedFallbackTitle(value: string | null) {
  return value !== null && /^재능\s*#\d+$/.test(value);
}

function getBestDisplayTitle(...values: unknown[]) {
  const titles = values.map(getNonEmptyText).filter((value): value is string => value !== null);
  const explicitTitle = titles.find((title) => !isGeneratedFallbackTitle(title));

  return explicitTitle ?? titles[0] ?? null;
}

function findMatchingChatRoom(
  trade: TradeListItem,
  chatRooms: ChatRoomListItem[],
) {
  const tradeId = getPositiveInteger(trade.tradeId);
  const tradeGroupId = getPositiveInteger(trade.tradeGroupId);
  const talentId = getPositiveInteger(trade.talentId);
  const buyerId = getPositiveInteger(trade.buyerId);
  const sellerId = getPositiveInteger(trade.sellerId);

  return (
    chatRooms.find((room) => {
      const roomTradeId = getPositiveInteger(room.tradeId);
      return tradeId !== null && roomTradeId === tradeId;
    }) ??
    chatRooms.find((room) => {
      const roomTradeGroupId = getPositiveInteger(room.tradeGroupId);
      return tradeGroupId !== null && roomTradeGroupId === tradeGroupId;
    }) ??
    chatRooms.find((room) => {
      const roomTalentId = getPositiveInteger(room.talentId);
      const roomBuyerId = getPositiveInteger(room.buyerId);
      const roomSellerId = getPositiveInteger(room.sellerId);

      return (
        talentId !== null &&
        buyerId !== null &&
        sellerId !== null &&
        roomTalentId === talentId &&
        roomBuyerId === buyerId &&
        roomSellerId === sellerId
      );
    }) ??
    null
  );
}

function getChatRoomTalentTitleForTrade(
  trade: TradeListItem,
  room: ChatRoomListItem | null,
  currentUserId: number | null,
) {
  if (!room) {
    return null;
  }

  const sellerId = getPositiveInteger(trade.sellerId);
  const talentId = getPositiveInteger(trade.talentId);
  const requesterId = getPositiveInteger(room.requesterId);
  const providerId = getPositiveInteger(room.providerId);
  const opponentId = getPositiveInteger(room.opponentId);

  if (sellerId !== null) {
    if (requesterId !== null && sellerId === requesterId) {
      return getNonEmptyText(room.requesterTalentTitle);
    }

    if (providerId !== null && sellerId === providerId) {
      return getNonEmptyText(room.providerTalentTitle);
    }

    if (currentUserId !== null && sellerId === currentUserId) {
      return getNonEmptyText(room.myTalentTitle);
    }

    if (opponentId !== null && sellerId === opponentId) {
      return getNonEmptyText(room.opponentTalentTitle);
    }
  }

  if (talentId !== null) {
    if (talentId === getPositiveInteger(room.myTalentId)) {
      return getNonEmptyText(room.myTalentTitle);
    }

    if (talentId === getPositiveInteger(room.opponentTalentId)) {
      return getNonEmptyText(room.opponentTalentTitle);
    }

    if (talentId === getPositiveInteger(room.requesterTalentId)) {
      return getNonEmptyText(room.requesterTalentTitle);
    }

    if (talentId === getPositiveInteger(room.providerTalentId)) {
      return getNonEmptyText(room.providerTalentTitle);
    }
  }

  return getNonEmptyText(room.talentTitle);
}

function applyTradeDisplayFields({
  trade,
  currentUserId,
  myProfile,
  chatRooms,
}: {
  trade: TradeListItem;
  currentUserId: number | null;
  myProfile: MyProfileDetailRes | null;
  chatRooms: ChatRoomListItem[];
}): TradeListItem {
  const enrichedTrade: TradeListItem = { ...trade };
  const myNickname = getNonEmptyText(myProfile?.nickname);
  const matchingRoom = findMatchingChatRoom(enrichedTrade, chatRooms);
  const opponentNickname = getNonEmptyText(matchingRoom?.opponentNickname);

  const chatRoomTalentTitle = getChatRoomTalentTitleForTrade(
    enrichedTrade,
    matchingRoom,
    currentUserId,
  );
  const fallbackTalentTitle = getNonEmptyText(enrichedTrade.talentTitle);

  enrichedTrade.talentTitle =
    enrichedTrade.tradeType === "SWAP"
      ? getBestDisplayTitle(chatRoomTalentTitle, fallbackTalentTitle) ??
      enrichedTrade.talentTitle
      : getBestDisplayTitle(fallbackTalentTitle, chatRoomTalentTitle) ??
      enrichedTrade.talentTitle;

  if (currentUserId !== null && myNickname !== null) {
    if (currentUserId === getPositiveInteger(enrichedTrade.buyerId)) {
      enrichedTrade.buyerNickname =
        getNonEmptyText(enrichedTrade.buyerNickname) ?? myNickname;
    }

    if (currentUserId === getPositiveInteger(enrichedTrade.sellerId)) {
      enrichedTrade.sellerNickname =
        getNonEmptyText(enrichedTrade.sellerNickname) ?? myNickname;
    }
  }

  if (currentUserId !== null && opponentNickname !== null) {
    if (currentUserId === getPositiveInteger(enrichedTrade.buyerId)) {
      enrichedTrade.sellerNickname =
        getNonEmptyText(enrichedTrade.sellerNickname) ?? opponentNickname;
    }

    if (currentUserId === getPositiveInteger(enrichedTrade.sellerId)) {
      enrichedTrade.buyerNickname =
        getNonEmptyText(enrichedTrade.buyerNickname) ?? opponentNickname;
    }
  }

  return enrichedTrade;
}

async function enrichTradeListDisplayFields(
  trades: TradeListItem[],
  currentUserId: number | null,
) {
  if (trades.length === 0) {
    return trades;
  }

  const [profileResult, chatRoomsResult] = await Promise.all([
    profileApi.getMe().then(
      (profile) => profile,
      () => null,
    ),
    chatApi.getMyChatRooms({ size: 100 }).then(
      (response) => response.content,
      () => [],
    ),
  ]);

  return trades.map((trade) =>
    applyTradeDisplayFields({
      trade,
      currentUserId,
      myProfile: profileResult,
      chatRooms: chatRoomsResult,
    }),
  );
}

function getTradeHref(trade: TradeListItem) {
  const tradeId = getPositiveInteger(trade.tradeId);

  return tradeId === null ? "/trades" : `/trades/${tradeId}`;
}

function isSwapGroupForView(group: TradeGroupView) {
  return group.tradeGroupId !== null && group.trades.length > 1;
}

function getReceiveTrade(
  group: TradeGroupView,
  currentUserId: number | null,
) {
  if (currentUserId === null) {
    return null;
  }

  return (
    group.trades.find(
      (trade) => getPositiveInteger(trade.buyerId) === currentUserId,
    ) ?? null
  );
}

function getProvideTrade(
  group: TradeGroupView,
  currentUserId: number | null,
) {
  if (currentUserId === null) {
    return null;
  }

  return (
    group.trades.find(
      (trade) => getPositiveInteger(trade.sellerId) === currentUserId,
    ) ?? null
  );
}

function getSwapContextPills(
  group: TradeGroupView,
  currentUserId: number | null,
): { key: string; label: string; tone?: "info" | "success" | "warning" }[] {
  const receiveTrade = getReceiveTrade(group, currentUserId);
  const provideTrade = getProvideTrade(group, currentUserId);
  const pills: { key: string; label: string; tone?: "info" | "success" | "warning" }[] = [];

  if (receiveTrade?.tradeStatus === "UNDER_REVIEW") {
    pills.push({
      key: `partner-submitted-${receiveTrade.tradeId}`,
      label: "상대방 제출 완료",
      tone: "info",
    });
  }

  if (provideTrade?.tradeStatus === "AWAITING_PARTNER") {
    pills.push({
      key: `partner-confirmed-${provideTrade.tradeId}`,
      label: "상대방 구매 확정 완료",
      tone: "success",
    });
  }

  if (receiveTrade?.tradeStatus === "AWAITING_PARTNER") {
    pills.push({
      key: `my-confirmed-${receiveTrade.tradeId}`,
      label: "구매 확정 완료",
      tone: "warning",
    });
  }

  return pills;
}

function getTradeStatusLabelForViewer(
  trade: TradeListItem,
  currentUserId: number | null,
): string {
  const isBuyer = currentUserId === getPositiveInteger(trade.buyerId);
  const isSeller = currentUserId === getPositiveInteger(trade.sellerId);

  if (trade.tradeStatus === "UNDER_REVIEW") {
    if (isBuyer) return "상대방 제출 완료";
    if (isSeller) return "결과물 제출 완료";
  }

  if (trade.tradeStatus === "AWAITING_PARTNER") {
    if (isBuyer) return "구매 확정 완료";
    if (isSeller) return "상대방 구매 확정 완료";
  }

  return statusLabels[trade.tradeStatus];
}

function getSwapGroupTitle(
  group: TradeGroupView,
  currentUserId: number | null,
) {
  const receiveTrade = getReceiveTrade(group, currentUserId);
  const provideTrade = getProvideTrade(group, currentUserId);

  if (receiveTrade && provideTrade) {
    return `${formatTalentTitle(receiveTrade)} ↔ ${formatTalentTitle(
      provideTrade,
    )}`;
  }

  const titles = Array.from(
    new Set(group.trades.map((trade) => formatTalentTitle(trade))),
  ).filter((title) => title !== "재능 정보 없음");

  if (titles.length >= 2) {
    return `${titles[0]} ↔ ${titles[1]}`;
  }

  return titles[0] ?? "재능 교환";
}

function getParticipantLabels(group: TradeGroupView) {
  const labelsById = new Map<number, string>();
  const labelsWithoutId = new Set<string>();

  function addParticipant(idValue: unknown, nicknameValue: unknown) {
    const userId = getPositiveInteger(idValue);
    const nickname = getNonEmptyText(nicknameValue);

    if (userId === null) {
      if (nickname) {
        labelsWithoutId.add(nickname);
      }

      return;
    }

    const fallback = `사용자 #${userId}`;
    const currentLabel = labelsById.get(userId);

    if (!currentLabel || currentLabel === fallback) {
      labelsById.set(userId, nickname ?? fallback);
    }
  }

  group.trades.forEach((trade) => {
    addParticipant(trade.buyerId, trade.buyerNickname);
    addParticipant(trade.sellerId, trade.sellerNickname);
  });

  const labels = [...labelsById.values(), ...labelsWithoutId];

  return labels.length > 0 ? labels.join(" ↔ ") : "참여자 정보 없음";
}

function getSwapLegSummaries(
  group: TradeGroupView,
  currentUserId: number | null,
) {
  const receiveTrade = getReceiveTrade(group, currentUserId);
  const provideTrade = getProvideTrade(group, currentUserId);

  if (receiveTrade || provideTrade) {
    return [
      receiveTrade
        ? {
          key: `receive-${receiveTrade.tradeId}`,
          title: "내가 받을 재능",
          description: "상대가 제공하는 재능",
          trade: receiveTrade,
        }
        : {
          key: "receive-missing",
          title: "내가 받을 재능",
          description: "상대 재능 정보를 확인할 수 없습니다.",
          trade: null,
        },
      provideTrade
        ? {
          key: `provide-${provideTrade.tradeId}`,
          title: "내가 제공할 재능",
          description: "내가 제공하는 재능",
          trade: provideTrade,
        }
        : {
          key: "provide-missing",
          title: "내가 제공할 재능",
          description: "내 재능 정보를 확인할 수 없습니다.",
          trade: null,
        },
    ];
  }

  return group.trades.slice(0, 2).map((trade, index) => ({
    key: `swap-${trade.tradeId ?? index}`,
    title: index === 0 ? "교환 재능 A" : "교환 재능 B",
    description: "교환 그룹의 재능",
    trade,
  }));
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

      const nextCurrentUserId = getAuthenticatedUserId();
      setCurrentUserId(nextCurrentUserId);

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const response = await tradeApi.getList({
          cursor,
          size: PAGE_SIZE,
        });
        const tradesWithDetails = await enrichTradeDetails(
          response.content,
        );

        const enrichedTrades = await enrichTradeListDisplayFields(
          tradesWithDetails,
          nextCurrentUserId,
        );

        setTrades((current) =>
          append ? [...current, ...enrichedTrades] : enrichedTrades,
        );
        setHasNext(response.hasNext);
        setNextCursor(response.nextCursor);
      } catch (error) {
        if (!append) {
          setTrades([]);
        }

        setErrorMessage(
          isAuthRequiredError(error)
            ? "로그인 후 이용해 주세요."
            : error instanceof Error
              ? error.message
              : "거래 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
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

  const tradeGroups = buildTradeCardsForView(trades);
  const visibleTradeGroups = filterTradeGroupsByStatus(
    tradeGroups,
    selectedStatus,
  );

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="text-center">
          <h1 className="baton-page-title mt-3 !font-bold">
            MY TRADE
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            진행 중인 교환, 검토 중인 결과물, 완료된 협업 기록을 한곳에서 확인하세요.
          </p>
        </header>

        <div className="mt-10 mb-8 flex gap-2 overflow-x-auto rounded-lg border border-[#ded6ff] bg-white/90 p-2 shadow-sm shadow-violet-950/[0.03] [scrollbar-width:none] sm:mt-14 sm:mb-10 sm:flex-wrap sm:overflow-visible">
          {statusOptions.map((option) => {
            const isActive = selectedStatus === option.value;

            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => setSelectedStatus(option.value)}
                className={`h-11 shrink-0 cursor-pointer rounded-md px-5 text-sm font-black transition ${isActive
                  ? "bg-[#8c5bff] text-white shadow-lg shadow-violet-400/20"
                  : "text-zinc-600 hover:bg-[#f4f0ff] hover:text-[#8c5bff]"
                  }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {isAuthRequiredMessage(errorMessage) ? (
          <LoginRequiredState
            className="mb-5"
            description="거래 내역은 로그인 후 확인할 수 있어요."
          />
        ) : errorMessage ? (
          <div className="mb-5">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
            거래 목록을 불러오는 중입니다.
          </div>
        ) : null}

        {!isLoading && !errorMessage && visibleTradeGroups.length === 0 ? (
          <EmptyState title="조건에 맞는 거래가 없습니다." />
        ) : null}

        {!isLoading && !errorMessage && (visibleTradeGroups.length > 0 || hasNext) ? (
          <>
            {visibleTradeGroups.length > 0 ? (
              <div className="grid gap-4">
                {visibleTradeGroups.map((group) => (
                  <TradeGroupCard
                    key={group.groupKey}
                    group={group}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : null}

            {hasNext ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  className="h-11 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-6 text-sm font-black text-zinc-800 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore ? "불러오는 중..." : "더 보기"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function TradeGroupCard({
  group,
  currentUserId,
}: {
  group: TradeGroupView;
  currentUserId: number | null;
}) {
  if (!isSwapGroupForView(group)) {
    return (
      <TradeListCard
        trade={getRepresentativeTrade(group, currentUserId)}
        currentUserId={currentUserId}
      />
    );
  }

  const groupStatus = getRepresentativeStatus(group);
  const legSummaries = getSwapLegSummaries(group, currentUserId);
  const groupTitle = getSwapGroupTitle(group, currentUserId);
  const groupLabel =
    group.tradeGroupId === null ? "교환 그룹" : `그룹 ${group.tradeGroupId}`;
  const participantLabel = getParticipantLabels(group);
  const contextPills = getSwapContextPills(group, currentUserId);

  return (
    <section className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-sm shadow-violet-950/[0.04]">
      <div className="h-[3px] bg-[linear-gradient(90deg,rgba(140,91,255,0.68)_0%,rgba(120,169,255,0.48)_54%,rgba(121,228,221,0.58)_100%)]" />
      <div className="p-6">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
              교환 거래
            </p>
            <p className="mt-2 truncate text-xl font-black text-zinc-950">
              {groupTitle}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {groupLabel} · {participantLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {getDisplayDate(group.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <TradeStatusPill status={groupStatus} />
            {contextPills.map((pill) => (
              <TradeContextPill
                key={pill.key}
                label={pill.label}
                tone={pill.tone}
              />
            ))}
            <TradeTypePill tradeType="SWAP" />
            <span className="inline-flex items-center rounded-full bg-[#f4f0ff] px-3 py-1.5 text-xs font-black text-[#8c5bff]">
              {formatGroupCredit(group)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 md:grid-cols-2">
          {legSummaries.map((summary) => (
            <TradeLegSummary
              key={summary.key}
              title={summary.title}
              description={summary.description}
              trade={summary.trade}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TradeLegSummary({
  title,
  description,
  trade,
  currentUserId,
}: {
  title: string;
  description: string;
  trade: TradeListItem | null;
  currentUserId: number | null;
}) {
  const content = (
    <>
      <p className="text-xs font-black text-[#8c5bff]">{title}</p>

      <p className="mt-2 text-base font-black text-zinc-950">
        {trade ? formatTalentTitle(trade) : "재능 정보 없음"}
      </p>

      <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>

      {trade ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <TradeContextPill
              label={getTradeStatusLabelForViewer(trade, currentUserId)}
              tone={
                trade.tradeStatus === "AWAITING_PARTNER"
                  ? "success"
                  : trade.tradeStatus === "UNDER_REVIEW"
                    ? "info"
                    : "warning"
              }
            />
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-700">
            거래 #{trade.tradeId} - {formatTradeCredit(trade.creditPrice)}
          </p>
          <TradeDirectionPills trade={trade} />
        </>
      ) : null}
    </>
  );

  if (trade) {
    return (
      <Link
        href={getTradeHref(trade)}
        className="block rounded-md border border-transparent bg-white/85 p-4 transition hover:border-[#d9ccff] hover:bg-white hover:shadow-sm hover:shadow-violet-950/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8c5bff]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-md bg-white/85 p-4">
      {content}
    </div>
  );
}

function TradeDirectionPills({ trade }: { trade: TradeListItem }) {
  const providerLabel = formatSellerName(trade);
  const receiverLabel = formatBuyerName(trade);

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-zinc-500"
      aria-label={`${providerLabel}에서 ${receiverLabel}로 제공`}
    >
      <span className="max-w-full truncate rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">
        {providerLabel}
      </span>
      <span className="text-sm text-[#8c5bff]" aria-hidden="true">
        →
      </span>
      <span className="max-w-full truncate rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">
        {receiverLabel}
      </span>
    </div>
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
    <a
      href={getTradeHref(trade)}
      className="block overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:border-[#c8b7ff] hover:shadow-xl hover:shadow-violet-950/[0.08]"
    >
      <div className="h-[3px] bg-[linear-gradient(90deg,rgba(140,91,255,0.68)_0%,rgba(120,169,255,0.48)_54%,rgba(121,228,221,0.58)_100%)]" />
      <div className="grid gap-5 p-6 md:grid-cols-[1fr_150px_170px] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TradeStatusPill status={trade.tradeStatus} />
            {(trade.tradeStatus === "UNDER_REVIEW" || trade.tradeStatus === "AWAITING_PARTNER") ? (
              <TradeContextPill
                label={getTradeStatusLabelForViewer(trade, currentUserId)}
                tone={trade.tradeStatus === "AWAITING_PARTNER" ? "success" : "info"}
              />
            ) : null}
            <TradeTypePill tradeType={trade.tradeType} />
          </div>

          <p className="mt-4 truncate text-xl font-black text-zinc-950">
            {formatTalentTitle(trade)}
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-500">
            {myRoleLabel} · {formatTradeTitle(trade)}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-500">
            {formatSellerName(trade)} → {formatBuyerName(trade)}
          </p>
        </div>

        <div className="rounded-lg border border-[#eee8ff] bg-[#fbf9ff] px-4 py-3 text-center text-sm font-bold text-zinc-600">
          {getDisplayDate(trade.updatedAt)}
        </div>

        <p className="text-xl font-black text-zinc-950 md:text-right">
          {formatTradeCredit(trade.creditPrice)}
        </p>
      </div>
    </a>
  );
}
