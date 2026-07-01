"use client";

import {
  Fragment,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import {
  chatApi,
  talentApi,
  tradeApi,
  type ChatMessageRes,
  type ChatRoomListItem,
  type ChatRoomRes,
  type TalentDetailRes,
  type TradeListRes,
  type TradeRes,
} from "@/lib/api";
import {
  connectChatRoomListSocket,
  connectChatSocket,
  type ChatRoomListSocketConnection,
  type ChatSocketConnection,
} from "@/lib/api/chatSocket";
import { isAuthRequiredMessage } from "@/lib/auth-required";
import {
  extractAuthClaimsFromAccessToken,
  getAccessToken,
  getStoredUserId,
} from "@/lib/auth";
import { getUserProfileImageUrl } from "@/utils/profileImage";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const tokenUserId = extractAuthClaimsFromAccessToken(
    getAccessToken() ?? "",
  ).userId;

  return tokenUserId ?? getStoredUserId();
}

function formatMessageTime(date: string): string {
  const targetDate = getValidDate(date);

  if (targetDate === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(targetDate);
}

function formatDateDivider(date: string): string {
  const targetDate = getValidDate(date);

  if (targetDate === null) {
    return "날짜 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(targetDate);
}

function isSameDate(left: string, right: string): boolean {
  const leftDate = getValidDate(left);
  const rightDate = getValidDate(right);

  if (leftDate === null || rightDate === null) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function getValidDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function getPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue > 0
      ? numericValue
      : null;
  }

  return null;
}

function getNonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getFirstNonEmptyText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = getNonEmptyText(value);

    if (text !== null) {
      return text;
    }
  }

  return null;
}

function isYesterday(date: Date, today: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function formatChatRoomListDate(date: string): string {
  const targetDate = getValidDate(date);
  const today = new Date();

  if (targetDate === null) {
    return "-";
  }

  if (isSameDate(date, today.toISOString())) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(targetDate);
  }

  if (isYesterday(targetDate, today)) {
    return "어제";
  }

  if (targetDate.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
    }).format(targetDate);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(targetDate)
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}

function getRoomStatusLabel(status: ChatRoomRes["status"]): string {
  const labels: Record<ChatRoomRes["status"], string> = {
    MATCH: "매칭 채팅",
    TRANSACTION: "거래 채팅",
  };

  return labels[status] ?? status;
}

function getMessageSenderLabel({
  senderId,
  currentUserId,
  opponentName,
}: {
  senderId: number | null;
  currentUserId: number | null;
  opponentName: string;
}): string {
  if (senderId !== null && senderId === currentUserId) {
    return "나";
  }

  return opponentName;
}

function getFallbackTalentLabel(
  title: unknown,
  id: unknown,
  fallbackText: string,
): string {
  const talentTitle = getNonEmptyText(title);

  if (talentTitle) {
    return talentTitle;
  }

  const talentId = getPositiveInteger(id);

  return talentId === null ? fallbackText : `재능 #${talentId}`;
}

function hasExplicitTalentPair(room: ChatRoomListItem): boolean {
  return (
    getNonEmptyText(room.myTalentTitle) !== null ||
    getPositiveInteger(room.myTalentId) !== null ||
    getNonEmptyText(room.opponentTalentTitle) !== null ||
    getPositiveInteger(room.opponentTalentId) !== null
  );
}

function hasRequesterProviderTalentPair(room: ChatRoomListItem): boolean {
  return (
    getNonEmptyText(room.requesterTalentTitle) !== null ||
    getPositiveInteger(room.requesterTalentId) !== null ||
    getNonEmptyText(room.providerTalentTitle) !== null ||
    getPositiveInteger(room.providerTalentId) !== null
  );
}

type ChatRoomTalentLine = {
  label: string;
  value: string;
  talentId: number | null;
};

function getCounterpartyTalentId(
  room: ChatRoomListItem,
  currentUserId: number | null,
): number | null {
  const hasTradeGroup = getPositiveInteger(room.tradeGroupId) !== null;

  if (room.roomType === "TRANSACTION" || hasTradeGroup) {
    const runtimeRoom = room as ChatRoomRuntimeFields;
    const receivedTalentId =
      getPositiveInteger(runtimeRoom.myReceiveTalentId) ??
      getPositiveInteger(runtimeRoom.receivedTalentId);

    if (receivedTalentId !== null) {
      return receivedTalentId;
    }

    if (hasTradeGroup) {
      return null;
    }
  }

  if (hasRequesterProviderTalentPair(room) && currentUserId !== null) {
    if (getPositiveInteger(room.requesterId) === currentUserId) {
      return getPositiveInteger(room.providerTalentId);
    }

    if (getPositiveInteger(room.providerId) === currentUserId) {
      return getPositiveInteger(room.requesterTalentId);
    }
  }

  if (hasExplicitTalentPair(room)) {
    return getPositiveInteger(room.opponentTalentId);
  }

  return null;
}

function getChatRoomTalentLines(room: ChatRoomListItem): ChatRoomTalentLine[] {
  const runtimeRoom = room as ChatRoomRuntimeFields;
  const displayTalentLines = Array.isArray(runtimeRoom.displayTalentLines)
    ? runtimeRoom.displayTalentLines.filter(
      (line) => getNonEmptyText(line.value) !== null,
    )
    : [];

  if (displayTalentLines.length > 0) {
    return displayTalentLines;
  }

  const receiveTalentTitle =
    getNonEmptyText(runtimeRoom.myReceiveTalentTitle) ??
    getNonEmptyText(runtimeRoom.receivedTalentTitle);
  const receiveTalentId =
    getPositiveInteger(runtimeRoom.myReceiveTalentId) ??
    getPositiveInteger(runtimeRoom.receivedTalentId);
  const provideTalentTitle = getNonEmptyText(runtimeRoom.myProvideTalentTitle);
  const provideTalentId = getPositiveInteger(runtimeRoom.myProvideTalentId);

  const fallbackLines: ChatRoomTalentLine[] = [];

  if (receiveTalentTitle !== null || receiveTalentId !== null) {
    fallbackLines.push({
      label: "상대방 재능",
      value:
        receiveTalentTitle ??
        (receiveTalentId === null ? "재능 정보 없음" : `재능 #${receiveTalentId}`),
      talentId: receiveTalentId,
    });
  }

  if (provideTalentTitle !== null || provideTalentId !== null) {
    fallbackLines.push({
      label: "내 재능",
      value:
        provideTalentTitle ??
        (provideTalentId === null ? "재능 정보 없음" : `재능 #${provideTalentId}`),
      talentId: provideTalentId,
    });
  }

  if (fallbackLines.length > 0) {
    return fallbackLines;
  }

  if (getPositiveInteger(room.tradeGroupId) !== null) {
    return [
      {
        label: "상대방 재능",
        value: "재능 정보 없음",
        talentId: null,
      },
    ];
  }

  const opponentTalentTitle = getNonEmptyText(room.opponentTalentTitle);
  const opponentTalentId = getPositiveInteger(room.opponentTalentId);

  if (opponentTalentTitle !== null || opponentTalentId !== null) {
    return [
      {
        label: "상대방 재능",
        value:
          opponentTalentTitle ??
          (opponentTalentId === null
            ? "재능 정보 없음"
            : `재능 #${opponentTalentId}`),
        talentId: null,
      },
    ];
  }

  return [
    {
      label: "상대방 재능",
      value: getFallbackTalentLabel(
        room.talentTitle,
        room.talentId,
        "재능 정보 없음",
      ),
      talentId: null,
    },
  ];
}

type ChatMessageRuntimeFields = ChatMessageRes & {
  messageId?: number | string | null;
  sentAt?: string | null;
  createdDate?: string | null;
  message?: string | null;
  read?: boolean | null;
  isRead?: boolean | null;
};

type ChatUserRuntimeFields = {
  id?: number | null;
  userId?: number | null;
  profileImageUrl?: string | null;
  profileImage?: string | null;
  profileUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
};

type ChatRoomRuntimeFields = ChatRoomListItem & {
  displayTalentLines?: ChatRoomTalentLine[] | null;
  myReceiveTalentId?: number | null;
  myReceiveTalentTitle?: string | null;
  myProvideTalentId?: number | null;
  myProvideTalentTitle?: string | null;
  receivedTalentId?: number | null;
  receivedTalentTitle?: string | null;
  profileImageUrl?: string | null;
  opponentProfileImage?: string | null;
  opponentProfileUrl?: string | null;
  opponentImageUrl?: string | null;
  opponentAvatarUrl?: string | null;
  requesterProfileImageUrl?: string | null;
  providerProfileImageUrl?: string | null;
  buyerProfileImageUrl?: string | null;
  sellerProfileImageUrl?: string | null;
  opponent?: ChatUserRuntimeFields | null;
  opponentProfile?: ChatUserRuntimeFields | null;
  requester?: ChatUserRuntimeFields | null;
  provider?: ChatUserRuntimeFields | null;
  buyer?: ChatUserRuntimeFields | null;
  seller?: ChatUserRuntimeFields | null;
  unreadCount?: number | null;
  unreadMessageCount?: number | null;
  unreadMessagesCount?: number | null;
  notReadCount?: number | null;
  lastMessageContent?: string | null;
  lastMessageText?: string | null;
  lastMessageSenderId?: number | null;
  lastMessageSenderUserId?: number | null;
};

function getChatUserProfileImageUrl(
  user: ChatUserRuntimeFields | null | undefined,
): string | null {
  if (!user) {
    return null;
  }

  return getFirstNonEmptyText(
    user.profileImageUrl,
    user.profileImage,
    user.profileUrl,
    user.imageUrl,
    user.avatarUrl,
  );
}

function getChatUserId(
  user: ChatUserRuntimeFields | null | undefined,
): number | null {
  if (!user) {
    return null;
  }

  return getPositiveInteger(user.userId) ?? getPositiveInteger(user.id);
}

function getCounterpartyProfileImageByUserId(
  room: ChatRoomListItem,
  userId: number,
): string | null {
  const runtimeRoom = room as ChatRoomRuntimeFields;
  const candidates = [
    {
      userId:
        getPositiveInteger(runtimeRoom.requesterId) ??
        getChatUserId(runtimeRoom.requester),
      imageUrl: getFirstNonEmptyText(
        runtimeRoom.requesterProfileImageUrl,
        getChatUserProfileImageUrl(runtimeRoom.requester),
      ),
    },
    {
      userId:
        getPositiveInteger(runtimeRoom.providerId) ??
        getChatUserId(runtimeRoom.provider),
      imageUrl: getFirstNonEmptyText(
        runtimeRoom.providerProfileImageUrl,
        getChatUserProfileImageUrl(runtimeRoom.provider),
      ),
    },
    {
      userId:
        getPositiveInteger(runtimeRoom.buyerId) ??
        getChatUserId(runtimeRoom.buyer),
      imageUrl: getFirstNonEmptyText(
        runtimeRoom.buyerProfileImageUrl,
        getChatUserProfileImageUrl(runtimeRoom.buyer),
      ),
    },
    {
      userId:
        getPositiveInteger(runtimeRoom.sellerId) ??
        getChatUserId(runtimeRoom.seller),
      imageUrl: getFirstNonEmptyText(
        runtimeRoom.sellerProfileImageUrl,
        getChatUserProfileImageUrl(runtimeRoom.seller),
      ),
    },
  ];

  return (
    candidates.find(
      (candidate) => candidate.userId === userId && candidate.imageUrl !== null,
    )?.imageUrl ?? null
  );
}

function getChatRoomOpponentProfileImageUrl(
  room: ChatRoomListItem,
  currentUserId: number | null,
): string | null {
  const runtimeRoom = room as ChatRoomRuntimeFields;
  const directImageUrl = getFirstNonEmptyText(
    room.opponentProfileImageUrl,
    runtimeRoom.opponentProfileImage,
    runtimeRoom.opponentProfileUrl,
    runtimeRoom.opponentImageUrl,
    runtimeRoom.opponentAvatarUrl,
    getChatUserProfileImageUrl(runtimeRoom.opponent),
    getChatUserProfileImageUrl(runtimeRoom.opponentProfile),
    runtimeRoom.profileImageUrl,
  );

  if (directImageUrl !== null) {
    return directImageUrl;
  }

  const opponentId = getPositiveInteger(room.opponentId);
  if (opponentId !== null) {
    const imageUrl = getCounterpartyProfileImageByUserId(room, opponentId);

    if (imageUrl !== null) {
      return imageUrl;
    }
  }

  if (currentUserId === null) {
    return null;
  }

  if (getPositiveInteger(room.requesterId) === currentUserId) {
    return getFirstNonEmptyText(
      runtimeRoom.providerProfileImageUrl,
      getChatUserProfileImageUrl(runtimeRoom.provider),
    );
  }

  if (getPositiveInteger(room.providerId) === currentUserId) {
    return getFirstNonEmptyText(
      runtimeRoom.requesterProfileImageUrl,
      getChatUserProfileImageUrl(runtimeRoom.requester),
    );
  }

  if (getPositiveInteger(room.buyerId) === currentUserId) {
    return getFirstNonEmptyText(
      runtimeRoom.sellerProfileImageUrl,
      getChatUserProfileImageUrl(runtimeRoom.seller),
    );
  }

  if (getPositiveInteger(room.sellerId) === currentUserId) {
    return getFirstNonEmptyText(
      runtimeRoom.buyerProfileImageUrl,
      getChatUserProfileImageUrl(runtimeRoom.buyer),
    );
  }

  return null;
}

function withRoomOpponentProfileImage(
  room: ChatRoomListItem,
  profileImageUrl: string,
): ChatRoomListItem {
  return {
    ...room,
    opponentProfileImageUrl: profileImageUrl,
  };
}

function getRoomUnreadCount(room: ChatRoomListItem): number {
  const runtimeRoom = room as ChatRoomRuntimeFields;
  const candidates = [
    runtimeRoom.unreadCount,
    runtimeRoom.unreadMessageCount,
    runtimeRoom.unreadMessagesCount,
    runtimeRoom.notReadCount,
  ];

  const count = candidates.find(
    (candidate): candidate is number =>
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate > 0,
  );

  return count ?? 0;
}

function getRoomLastMessageText(room: ChatRoomListItem): string {
  const runtimeRoom = room as ChatRoomRuntimeFields;
  const candidates = [
    runtimeRoom.lastMessage,
    runtimeRoom.lastMessageContent,
    runtimeRoom.lastMessageText,
  ];

  return (
    candidates
      .find(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0,
      )
      ?.trim() ?? "아직 메시지가 없습니다."
  );
}

function withRoomUnreadCount(
  room: ChatRoomListItem,
  unreadCount: number,
): ChatRoomListItem {
  return {
    ...room,
    unreadCount,
  } as ChatRoomListItem;
}

function withRoomLastMessage(
  room: ChatRoomListItem,
  message: ChatMessageRes,
): ChatRoomListItem {
  const content = getMessageContent(message);
  const createdAt = getMessageCreatedAtValue(message);

  return {
    ...room,
    lastMessage: content || room.lastMessage,
    lastMessageAt: createdAt || room.lastMessageAt,
  };
}

function getMessageRoomId(message: ChatMessageRes): number | null {
  return getPositiveInteger(message.roomId);
}

function isMessageForRoom(message: ChatMessageRes, roomId: number): boolean {
  const messageRoomId = getMessageRoomId(message);

  return messageRoomId === null || messageRoomId === roomId;
}

function getMessageCreatedAtValue(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const candidates = [
    runtimeMessage.createdAt,
    runtimeMessage.sentAt,
    runtimeMessage.createdDate,
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? ""
  );
}

function getMessageTime(message: ChatMessageRes): number {
  const date = getValidDate(getMessageCreatedAtValue(message));

  return date?.getTime() ?? 0;
}

function getMessageContent(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const content =
    typeof runtimeMessage.content === "string"
      ? runtimeMessage.content
      : typeof runtimeMessage.message === "string"
        ? runtimeMessage.message
        : "";

  return content;
}

function isMessageRead(message: ChatMessageRes): boolean {
  const runtimeMessage = message as ChatMessageRuntimeFields;

  if (typeof runtimeMessage.read === "boolean") {
    return runtimeMessage.read;
  }

  if (typeof runtimeMessage.isRead === "boolean") {
    return runtimeMessage.isRead;
  }

  return true;
}

function withRoomMessageSnapshot(
  room: ChatRoomListItem,
  messages: ChatMessageRes[],
  currentUserId: number | null,
): ChatRoomListItem {
  if (messages.length === 0) {
    return room;
  }

  const normalizedMessages = normalizeMessages(messages);
  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const unreadCount = normalizedMessages.filter((message) => {
    const senderId = getPositiveInteger(message.senderId);

    return (
      currentUserId !== null &&
      senderId !== null &&
      senderId !== currentUserId &&
      !isMessageRead(message)
    );
  }).length;

  return withRoomUnreadCount(
    withRoomLastMessage(room, lastMessage),
    unreadCount,
  );
}

async function hydrateChatRoomsWithMessageSnapshots(
  rooms: ChatRoomListItem[],
  currentUserId: number | null,
): Promise<ChatRoomListItem[]> {
  const results = await Promise.allSettled(
    rooms.map(async (room) => {
      const response = await chatApi.getMessages(room.roomId);
      const messages = Array.isArray(response.content) ? response.content : [];

      return withRoomMessageSnapshot(room, messages, currentUserId);
    }),
  );

  return rooms.map((room, index) => {
    const result = results[index];

    return result.status === "fulfilled" ? result.value : room;
  });
}

type TradeListRuntimeFields = TradeListRes & {
  title?: string | null;
};

const TRADE_LIST_HYDRATION_PAGE_SIZE = 50;

function isGeneratedFallbackTitle(value: string | null): boolean {
  return (
    value !== null &&
    (value === "재능 정보 없음" || /^재능\s*#\d+$/.test(value))
  );
}

function getBestDisplayTitle(...values: unknown[]): string | null {
  const titles = values
    .map(getNonEmptyText)
    .filter((value): value is string => value !== null);
  const explicitTitle = titles.find((title) => !isGeneratedFallbackTitle(title));

  return explicitTitle ?? titles[0] ?? null;
}

function getTradeDisplayTalentTitle(trade: TradeListRes): string {
  const runtimeTrade = trade as TradeListRuntimeFields;
  const talentTitle = getNonEmptyText(runtimeTrade.talentTitle);

  if (talentTitle !== null) {
    return talentTitle;
  }

  const title = getNonEmptyText(runtimeTrade.title);

  if (title !== null) {
    return title;
  }

  const talentId = getPositiveInteger(runtimeTrade.talentId);

  return talentId === null ? "재능 정보 없음" : `재능 #${talentId}`;
}

function getTradeTalentLineValue(trade: TradeListRes): {
  talentId: number | null;
  talentTitle: string;
} {
  const talentId = getPositiveInteger(trade.talentId);

  return {
    talentId,
    talentTitle: getTradeDisplayTalentTitle(trade),
  };
}

function getChatRoomTalentTitleForTrade(
  room: ChatRoomListItem,
  trade: TradeListRes,
  currentUserId: number | null,
): string | null {
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

function getTradeTalentLineValueForRoom({
  room,
  trade,
  currentUserId,
}: {
  room: ChatRoomListItem;
  trade: TradeListRes;
  currentUserId: number | null;
}): {
  talentId: number | null;
  talentTitle: string;
} {
  const tradeTalent = getTradeTalentLineValue(trade);

  return {
    talentId: tradeTalent.talentId,
    talentTitle:
      getBestDisplayTitle(
        getChatRoomTalentTitleForTrade(room, trade, currentUserId),
        trade.talentTitle,
        (trade as TradeListRuntimeFields).title,
        tradeTalent.talentTitle,
      ) ?? tradeTalent.talentTitle,
  };
}

async function enrichChatTradeDetails(
  trades: TradeListRes[],
): Promise<TradeListRes[]> {
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
          const detail =
            tradeId === null ? null : detailsByTradeId.get(tradeId);

          return (
            getPositiveInteger(detail?.talentId) ??
            getPositiveInteger(trade.talentId)
          );
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
    const talentId =
      getPositiveInteger(detail?.talentId) ?? getPositiveInteger(trade.talentId);
    const talentDetail =
      talentId === null ? null : talentDetailsById.get(talentId);

    return {
      ...trade,
      title: getBestDisplayTitle(
        detail?.title,
        talentDetail?.title,
        (trade as TradeListRuntimeFields).title,
      ),
      tradeGroupId:
        getPositiveInteger(detail?.tradeGroupId) ?? trade.tradeGroupId,
      talentId: talentId ?? trade.talentId,
      talentTitle: getBestDisplayTitle(
        detail?.talentTitle,
        talentDetail?.title,
        trade.talentTitle,
      ),
      buyerId: getPositiveInteger(detail?.buyerId) ?? trade.buyerId,
      sellerId: getPositiveInteger(detail?.sellerId) ?? trade.sellerId,
      buyerNickname:
        getNonEmptyText(detail?.buyerNickname) ?? trade.buyerNickname,
      sellerNickname:
        getNonEmptyText(detail?.sellerNickname) ?? trade.sellerNickname,
      creditPrice:
        typeof detail?.creditPrice === "number" &&
          Number.isFinite(detail.creditPrice)
          ? detail.creditPrice
          : trade.creditPrice,
      tradeStatus: detail?.tradeStatus ?? trade.tradeStatus,
      updatedAt: getNonEmptyText(detail?.updatedAt) ?? trade.updatedAt,
    };
  });
}

function withRoomTradeTalentLines({
  room,
  receiveTrade,
  provideTrade,
  groupTrades,
  currentUserId,
}: {
  room: ChatRoomListItem;
  receiveTrade?: TradeListRes;
  provideTrade?: TradeListRes;
  groupTrades: TradeListRes[];
  currentUserId: number | null;
}): ChatRoomListItem {
  const displayTalentLines: ChatRoomTalentLine[] = [];
  const receiveTalent = receiveTrade
    ? getTradeTalentLineValueForRoom({
      room,
      trade: receiveTrade,
      currentUserId,
    })
    : null;
  const provideTalent = provideTrade
    ? getTradeTalentLineValueForRoom({
      room,
      trade: provideTrade,
      currentUserId,
    })
    : null;

  if (receiveTalent !== null) {
    displayTalentLines.push({
      label: "상대방 재능",
      value: receiveTalent.talentTitle,
      talentId: receiveTalent.talentId,
    });
  }

  if (
    provideTalent !== null &&
    provideTalent.talentTitle !== receiveTalent?.talentTitle
  ) {
    displayTalentLines.push({
      label: "내 재능",
      value: provideTalent.talentTitle,
      talentId: provideTalent.talentId,
    });
  }

  if (displayTalentLines.length === 0) {
    const uniqueTitles = Array.from(
      new Set(
        groupTrades
          .map((trade) => getTradeDisplayTalentTitle(trade))
          .map((title) => title.trim())
          .filter((title) => title.length > 0),
      ),
    );

    if (uniqueTitles.length >= 2) {
      displayTalentLines.push({
        label: "교환 재능",
        value: uniqueTitles.slice(0, 2).join(" ↔ "),
        talentId: null,
      });
    }
  }

  if (displayTalentLines.length === 0) {
    return room;
  }

  return {
    ...room,
    displayTalentLines,
    myReceiveTalentId: receiveTalent?.talentId ?? null,
    myReceiveTalentTitle: receiveTalent?.talentTitle ?? null,
    myProvideTalentId: provideTalent?.talentId ?? null,
    myProvideTalentTitle: provideTalent?.talentTitle ?? null,
    receivedTalentId: receiveTalent?.talentId ?? null,
    receivedTalentTitle: receiveTalent?.talentTitle ?? null,
  } as ChatRoomListItem;
}

function mergeUniqueTrades(trades: TradeListRes[]): TradeListRes[] {
  const tradeMap = new Map<number, TradeListRes>();
  const fallbackTrades: TradeListRes[] = [];

  trades.forEach((trade) => {
    const tradeId = getPositiveInteger(trade.tradeId);

    if (tradeId === null) {
      fallbackTrades.push(trade);
      return;
    }

    const currentTrade = tradeMap.get(tradeId);

    tradeMap.set(tradeId, {
      ...currentTrade,
      ...trade,
      talentTitle:
        getBestDisplayTitle(trade.talentTitle, currentTrade?.talentTitle) ??
        trade.talentTitle,
      title:
        getBestDisplayTitle(
          (trade as TradeListRuntimeFields).title,
          currentTrade === undefined
            ? null
            : (currentTrade as TradeListRuntimeFields).title,
        ) ?? (trade as TradeListRuntimeFields).title,
    });
  });

  return [...tradeMap.values(), ...fallbackTrades];
}

async function loadRoomTradeDetailsForChatRoomHydration(
  rooms: ChatRoomListItem[],
): Promise<Map<number, TradeListRes>> {
  const tradeIds = Array.from(
    new Set(
      rooms
        .map((room) => getPositiveInteger(room.tradeId))
        .filter((tradeId): tradeId is number => tradeId !== null),
    ),
  );

  if (tradeIds.length === 0) {
    return new Map();
  }

  const settledTradeDetails = await Promise.allSettled(
    tradeIds.map(async (tradeId) => ({
      tradeId,
      detail: await tradeApi.getDetail(tradeId),
    })),
  );
  const roomTradeDetails = settledTradeDetails
    .filter(
      (result): result is PromiseFulfilledResult<{
        tradeId: number;
        detail: TradeRes;
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value.detail);
  const enrichedTradeDetails = await enrichChatTradeDetails(roomTradeDetails);
  const detailsByTradeId = new Map<number, TradeListRes>();

  enrichedTradeDetails.forEach((trade) => {
    const tradeId = getPositiveInteger(trade.tradeId);

    if (tradeId !== null) {
      detailsByTradeId.set(tradeId, trade);
    }
  });

  return detailsByTradeId;
}

async function loadTradeListForChatRoomHydration(): Promise<TradeListRes[]> {
  const trades: TradeListRes[] = [];
  const seenTradeIds = new Set<number>();
  let cursor: number | null | undefined = null;

  for (let requestCount = 0; requestCount < 10; requestCount += 1) {
    const response = await tradeApi.getList({
      cursor,
      size: TRADE_LIST_HYDRATION_PAGE_SIZE,
    });
    const pageTrades = Array.isArray(response.content) ? response.content : [];
    const enrichedPageTrades = await enrichChatTradeDetails(pageTrades);

    enrichedPageTrades.forEach((trade) => {
      const tradeId = getPositiveInteger(trade.tradeId);

      if (tradeId !== null) {
        if (seenTradeIds.has(tradeId)) {
          return;
        }

        seenTradeIds.add(tradeId);
      }

      trades.push(trade);
    });

    if (!response.hasNext || response.nextCursor === null) {
      break;
    }

    cursor = response.nextCursor;
  }

  return trades;
}

async function hydrateChatRoomsWithTradeGroupReceiveTalents(
  rooms: ChatRoomListItem[],
  currentUserId: number | null,
): Promise<ChatRoomListItem[]> {
  if (rooms.length === 0 || currentUserId === null) {
    return rooms;
  }

  try {
    const roomTradeDetailsByTradeId =
      await loadRoomTradeDetailsForChatRoomHydration(rooms);
    let listTrades: TradeListRes[] = [];

    try {
      listTrades = await loadTradeListForChatRoomHydration();
    } catch {
      listTrades = [];
    }

    const trades = mergeUniqueTrades([
      ...roomTradeDetailsByTradeId.values(),
      ...listTrades,
    ]);
    const tradesByGroupId = new Map<number, TradeListRes[]>();
    const tradesById = new Map<number, TradeListRes>();

    trades.forEach((trade) => {
      const tradeId = getPositiveInteger(trade.tradeId);
      const tradeGroupId = getPositiveInteger(trade.tradeGroupId);

      if (tradeId !== null) {
        tradesById.set(tradeId, trade);
      }

      if (tradeGroupId === null) {
        return;
      }

      const groupTrades = tradesByGroupId.get(tradeGroupId) ?? [];
      groupTrades.push(trade);
      tradesByGroupId.set(tradeGroupId, groupTrades);
    });

    return rooms.map((room) => {
      const roomTradeId = getPositiveInteger(room.tradeId);
      const roomTrade =
        roomTradeId === null
          ? undefined
          : roomTradeDetailsByTradeId.get(roomTradeId) ??
          tradesById.get(roomTradeId);
      const tradeGroupId =
        getPositiveInteger(room.tradeGroupId) ??
        getPositiveInteger(roomTrade?.tradeGroupId);
      const groupTrades =
        tradeGroupId === null ? [] : tradesByGroupId.get(tradeGroupId) ?? [];
      const opponentId = getPositiveInteger(room.opponentId);

      const receiveTrade =
        groupTrades.find(
          (trade) => getPositiveInteger(trade.buyerId) === currentUserId,
        ) ??
        (roomTrade !== undefined &&
          getPositiveInteger(roomTrade.buyerId) === currentUserId
          ? roomTrade
          : undefined) ??
        (opponentId === null
          ? undefined
          : trades.find(
            (trade) =>
              getPositiveInteger(trade.buyerId) === currentUserId &&
              getPositiveInteger(trade.sellerId) === opponentId,
          ));
      const provideTrade =
        groupTrades.find(
          (trade) => getPositiveInteger(trade.sellerId) === currentUserId,
        ) ??
        (roomTrade !== undefined &&
          getPositiveInteger(roomTrade.sellerId) === currentUserId
          ? roomTrade
          : undefined) ??
        (opponentId === null
          ? undefined
          : trades.find(
            (trade) =>
              getPositiveInteger(trade.sellerId) === currentUserId &&
              getPositiveInteger(trade.buyerId) === opponentId,
          ));

      return withRoomTradeTalentLines({
        room: {
          ...room,
          tradeGroupId: tradeGroupId ?? room.tradeGroupId,
        },
        receiveTrade,
        provideTrade,
        groupTrades,
        currentUserId,
      });
    });
  } catch {
    return rooms;
  }
}

const talentAuthorProfileImageRequests = new Map<
  number,
  Promise<string | null>
>();

function getTalentAuthorProfileImageUrlOnce(
  talentId: number,
): Promise<string | null> {
  const pendingRequest = talentAuthorProfileImageRequests.get(talentId);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = talentApi
    .getDetail(talentId)
    .then((talent) => getNonEmptyText(talent.author.profileImageUrl))
    .catch(() => null)
    .finally(() => {
      talentAuthorProfileImageRequests.delete(talentId);
    });

  talentAuthorProfileImageRequests.set(talentId, request);
  return request;
}

async function hydrateChatRoomsWithOpponentProfileImages(
  rooms: ChatRoomListItem[],
  currentUserId: number | null,
): Promise<ChatRoomListItem[]> {
  const directHydratedRooms = rooms.map((room) => {
    const profileImageUrl = getChatRoomOpponentProfileImageUrl(
      room,
      currentUserId,
    );

    return profileImageUrl === null
      ? room
      : withRoomOpponentProfileImage(room, profileImageUrl);
  });
  const talentIds = Array.from(
    new Set(
      directHydratedRooms
        .filter(
          (room) =>
            getChatRoomOpponentProfileImageUrl(room, currentUserId) === null,
        )
        .map((room) => getCounterpartyTalentId(room, currentUserId))
        .filter((talentId): talentId is number => talentId !== null),
    ),
  );

  if (talentIds.length === 0) {
    return directHydratedRooms;
  }

  const results = await Promise.allSettled(
    talentIds.map(async (talentId) => ({
      talentId,
      profileImageUrl: await getTalentAuthorProfileImageUrlOnce(talentId),
    })),
  );
  const profileImageUrlByTalentId = new Map<number, string>();

  results.forEach((result) => {
    if (
      result.status === "fulfilled" &&
      result.value.profileImageUrl !== null
    ) {
      profileImageUrlByTalentId.set(
        result.value.talentId,
        result.value.profileImageUrl,
      );
    }
  });

  if (profileImageUrlByTalentId.size === 0) {
    return directHydratedRooms;
  }

  return directHydratedRooms.map((room) => {
    if (getChatRoomOpponentProfileImageUrl(room, currentUserId) !== null) {
      return room;
    }

    const talentId = getCounterpartyTalentId(room, currentUserId);
    const profileImageUrl =
      talentId === null ? undefined : profileImageUrlByTalentId.get(talentId);

    return profileImageUrl === undefined
      ? room
      : withRoomOpponentProfileImage(room, profileImageUrl);
  });
}

function mergeChatRooms(
  currentRooms: ChatRoomListItem[],
  nextRooms: ChatRoomListItem[],
  append: boolean,
): ChatRoomListItem[] {
  if (!append) {
    return nextRooms;
  }

  const roomMap = new Map<number, ChatRoomListItem>();

  currentRooms.forEach((room) => {
    roomMap.set(room.roomId, room);
  });

  nextRooms.forEach((room) => {
    roomMap.set(room.roomId, room);
  });

  return Array.from(roomMap.values());
}

function getMessageId(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const primaryId = runtimeMessage.messageId ?? runtimeMessage.id;

  if (typeof primaryId === "number" && Number.isFinite(primaryId)) {
    return `id-${primaryId}`;
  }

  if (typeof primaryId === "string" && primaryId.trim().length > 0) {
    return `id-${primaryId.trim()}`;
  }

  const roomId = getMessageRoomId(message) ?? "unknown-room";
  const senderId = getPositiveInteger(runtimeMessage.senderId) ?? "unknown";
  const createdAt = getMessageCreatedAtValue(message);
  const content = getMessageContent(message);

  return `fallback-${roomId}-${senderId}-${createdAt}-${content}`;
}

function getMessageNumericId(message: ChatMessageRes): number | null {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const primaryId = runtimeMessage.messageId ?? runtimeMessage.id;

  if (typeof primaryId === "number" && Number.isFinite(primaryId)) {
    return primaryId;
  }

  if (typeof primaryId === "string") {
    const numericId = Number(primaryId);

    return Number.isFinite(numericId) ? numericId : null;
  }

  return null;
}

function dedupeMessages(messages: ChatMessageRes[]): ChatMessageRes[] {
  const messageMap = new Map<string, ChatMessageRes>();

  for (const message of messages) {
    messageMap.set(getMessageId(message), message);
  }

  return Array.from(messageMap.values());
}

function sortMessagesByCreatedAtAsc(
  messages: ChatMessageRes[],
): ChatMessageRes[] {
  return [...messages].sort((left, right) => {
    const timeDiff = getMessageTime(left) - getMessageTime(right);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const leftId = getMessageNumericId(left);
    const rightId = getMessageNumericId(right);

    if (leftId !== null && rightId !== null && leftId !== rightId) {
      return leftId - rightId;
    }

    return getMessageId(left).localeCompare(getMessageId(right));
  });
}

function normalizeMessages(messages: ChatMessageRes[]): ChatMessageRes[] {
  return sortMessagesByCreatedAtAsc(dedupeMessages(messages));
}

export default function ChatsPage() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [hasCheckedUserId, setHasCheckedUserId] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoomListItem[]>([]);
  const [hasNextRooms, setHasNextRooms] = useState(false);
  const [nextRoomCursor, setNextRoomCursor] = useState<number | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoomRes | null>(null);
  const [messages, setMessages] = useState<ChatMessageRes[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMoreRooms, setIsLoadingMoreRooms] = useState(false);
  const [isEnteringRoom, setIsEnteringRoom] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnectedToSocket, setIsConnectedToSocket] = useState(false);
  const [socketConnectionVersion, setSocketConnectionVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatSocketRef = useRef<ChatSocketConnection | null>(null);
  const chatRoomListSocketRef = useRef<ChatRoomListSocketConnection | null>(
    null,
  );
  const currentUserIdRef = useRef<number | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);
  const initialRoomQueryHandledRef = useRef(false);
  const currentRoomId = currentRoom?.id ?? null;
  const subscribedRoomIdsKey = chatRooms.map((room) => room.roomId).join(",");
  const currentRoomListItem =
    currentRoomId === null
      ? undefined
      : chatRooms.find((room) => room.roomId === currentRoomId);
  const currentOpponentName =
    currentRoomListItem?.opponentNickname?.trim() || "상대방";
  const currentOpponentProfileImageUrl =
    currentRoomListItem === undefined
      ? null
      : getChatRoomOpponentProfileImageUrl(currentRoomListItem, currentUserId);
  const currentTalentLines =
    currentRoomListItem !== undefined
      ? getChatRoomTalentLines(currentRoomListItem)
      : currentRoom
        ? [
          {
            label: "상대방 재능",
            value: getFallbackTalentLabel(
              null,
              currentRoom.talentId,
              "재능 정보 없음",
            ),
            talentId: getPositiveInteger(currentRoom.talentId),
          },
        ]
        : [];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentUserId(readStoredUserId());
      setHasCheckedUserId(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    chatRoomListSocketRef.current?.disconnect();
    chatRoomListSocketRef.current = null;

    if (currentUserId === null || subscribedRoomIdsKey.length === 0) {
      return;
    }

    const roomIds = subscribedRoomIdsKey
      .split(",")
      .map((roomId) => Number(roomId))
      .filter((roomId) => Number.isInteger(roomId) && roomId > 0);

    if (roomIds.length === 0) {
      return;
    }

    const connection = connectChatRoomListSocket({
      roomIds,
      onMessage: (message) => {
        const messageRoomId = getMessageRoomId(message);
        const userId = currentUserIdRef.current;

        if (messageRoomId === null) {
          return;
        }

        setChatRooms((prevRooms) =>
          prevRooms.map((room) => {
            if (room.roomId !== messageRoomId) {
              return room;
            }

            const nextRoom = withRoomLastMessage(room, message);
            const isCurrentRoomMessage =
              selectedRoomIdRef.current === messageRoomId;
            const isMyMessage = userId !== null && message.senderId === userId;

            if (isCurrentRoomMessage || isMyMessage) {
              return withRoomUnreadCount(nextRoom, 0);
            }

            return withRoomUnreadCount(nextRoom, getRoomUnreadCount(room) + 1);
          }),
        );
      },
      onRead: (event) => {
        const readRoomId = getPositiveInteger(event.roomId);
        const readerId = getPositiveInteger(event.readerId);
        const userId = currentUserIdRef.current;

        if (readRoomId === null || readerId === null || readerId === userId) {
          return;
        }

        setChatRooms((prevRooms) =>
          prevRooms.map((room) =>
            room.roomId === readRoomId ? withRoomUnreadCount(room, 0) : room,
          ),
        );
      },
      onError: () => {
        // 목록 실시간 알림 연결 실패는 채팅 화면 사용을 막지 않는다.
      },
    });

    chatRoomListSocketRef.current = connection;

    return () => {
      connection.disconnect();
      if (chatRoomListSocketRef.current === connection) {
        chatRoomListSocketRef.current = null;
      }
    };
  }, [currentUserId, subscribedRoomIdsKey]);

  useEffect(() => {
    if (currentRoomId === null) {
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      return;
    }

    chatSocketRef.current?.disconnect();

    let connection: ChatSocketConnection | null = null;

    connection = connectChatSocket({
      roomId: currentRoomId,
      onMessage: (message) => {
        const messageRoomId = getMessageRoomId(message) ?? currentRoomId;
        const userId = currentUserIdRef.current;
        const isCurrentRoomMessage =
          selectedRoomIdRef.current === messageRoomId &&
          isMessageForRoom(message, messageRoomId);

        setChatRooms((prevRooms) =>
          prevRooms.map((room) => {
            if (room.roomId !== messageRoomId) {
              return room;
            }

            const nextRoom = withRoomLastMessage(room, message);

            if (isCurrentRoomMessage || message.senderId === userId) {
              return withRoomUnreadCount(nextRoom, 0);
            }

            return withRoomUnreadCount(nextRoom, getRoomUnreadCount(room) + 1);
          }),
        );

        if (!isCurrentRoomMessage) {
          return;
        }

        setMessages((prevMessages) => {
          const currentRoomMessages = prevMessages.filter((prevMessage) =>
            isMessageForRoom(prevMessage, currentRoomId),
          );

          return normalizeMessages([...currentRoomMessages, message]);
        });

        if (userId !== null && message.senderId !== userId) {
          chatSocketRef.current?.markAsRead();
        }
      },
      onRead: (event) => {
        const readRoomId = getPositiveInteger(event.roomId);

        if (
          selectedRoomIdRef.current !== currentRoomId ||
          (readRoomId !== null && readRoomId !== currentRoomId)
        ) {
          return;
        }

        const readMessageIds = new Set(
          Array.isArray(event.messageIds) ? event.messageIds : [],
        );

        setMessages((prevMessages) =>
          normalizeMessages(
            prevMessages
              .filter((message) => isMessageForRoom(message, currentRoomId))
              .map((message) =>
                readMessageIds.has(message.id)
                  ? {
                    ...message,
                    read: true,
                  }
                  : message,
              ),
          ),
        );
      },
      onConnect: () => {
        setIsConnectedToSocket(true);

        const userId = currentUserIdRef.current;
        if (userId !== null) {
          connection?.markAsRead();
        }
      },
      onDisconnect: () => {
        setIsConnectedToSocket(false);
      },
      onError: () => {
        setIsConnectedToSocket(false);
        setErrorMessage(
          "WebSocket 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      },
    });

    chatSocketRef.current = connection;

    return () => {
      connection?.disconnect();
      if (chatSocketRef.current === connection) {
        chatSocketRef.current = null;
      }
    };
  }, [currentRoomId, socketConnectionVersion]);

  const loadMessages = useCallback(async (roomId: number) => {
    setErrorMessage(null);
    setIsLoadingMessages(true);

    try {
      const response = await chatApi.getMessages(roomId);
      const nextMessages = Array.isArray(response.content)
        ? response.content
        : [];

      if (selectedRoomIdRef.current !== roomId) {
        return;
      }

      setMessages((prevMessages) => {
        const currentRoomMessages = prevMessages.filter((message) =>
          isMessageForRoom(message, roomId),
        );

        return normalizeMessages([...currentRoomMessages, ...nextMessages]);
      });
    } catch (error) {
      if (selectedRoomIdRef.current !== roomId) {
        return;
      }

      setMessages([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "메시지를 불러오지 못했습니다.",
      );
    } finally {
      if (selectedRoomIdRef.current === roomId) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const loadChatRooms = useCallback(
    async ({
      cursor,
      append = false,
    }: { cursor?: number | null; append?: boolean } = {}) => {
      if (!append) {
        setIsLoadingRooms(true);
      } else {
        setIsLoadingMoreRooms(true);
      }

      setErrorMessage(null);

      try {
        const response = await chatApi.getMyChatRooms({
          cursor,
          size: 20,
        });
        const responseRooms = Array.isArray(response.content)
          ? response.content
          : [];
        const messageHydratedRooms = await hydrateChatRoomsWithMessageSnapshots(
          responseRooms,
          currentUserId,
        );
        const tradeHydratedRooms =
          await hydrateChatRoomsWithTradeGroupReceiveTalents(
            messageHydratedRooms,
            currentUserId,
          );
        const profileHydratedRooms =
          await hydrateChatRoomsWithOpponentProfileImages(
            tradeHydratedRooms,
            currentUserId,
          );

        setChatRooms((prevRooms) =>
          mergeChatRooms(prevRooms, profileHydratedRooms, append),
        );
        setHasNextRooms(response.hasNext);
        setNextRoomCursor(response.nextCursor);
      } catch (error) {
        if (!append) {
          setChatRooms([]);
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "채팅방 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoadingRooms(false);
        setIsLoadingMoreRooms(false);
      }
    },
    [currentUserId],
  );

  const openExistingRoom = useCallback(
    async (roomId: number) => {
      let activeRoomId = roomId;

      setErrorMessage(null);
      setIsEnteringRoom(true);
      setIsConnectedToSocket(false);
      selectedRoomIdRef.current = roomId;
      setCurrentRoom(null);
      setMessages([]);

      try {
        const room = await chatApi.getRoom(roomId);

        if (selectedRoomIdRef.current !== roomId) {
          return;
        }

        activeRoomId = room.id;
        selectedRoomIdRef.current = room.id;
        setCurrentRoom(room);
        setChatRooms((prevRooms) =>
          prevRooms.map((prevRoom) =>
            prevRoom.roomId === room.id
              ? withRoomUnreadCount(prevRoom, 0)
              : prevRoom,
          ),
        );
        setSocketConnectionVersion((version) => version + 1);
        await loadMessages(room.id);
      } catch (error) {
        if (selectedRoomIdRef.current !== roomId) {
          return;
        }

        setCurrentRoom(null);
        setMessages([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "채팅방에 입장하지 못했습니다.",
        );
      } finally {
        if (selectedRoomIdRef.current === activeRoomId) {
          setIsEnteringRoom(false);
        }
      }
    },
    [loadMessages],
  );

  useEffect(() => {
    if (
      !hasCheckedUserId ||
      currentUserId === null ||
      initialRoomQueryHandledRef.current
    ) {
      return;
    }

    const roomIdQuery = new URLSearchParams(window.location.search).get(
      "roomId",
    );
    const roomId = roomIdQuery === null ? NaN : Number(roomIdQuery);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      initialRoomQueryHandledRef.current = true;
      return;
    }

    initialRoomQueryHandledRef.current = true;

    const timeoutId = window.setTimeout(() => {
      void openExistingRoom(roomId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, hasCheckedUserId, openExistingRoom]);

  useEffect(() => {
    if (!hasCheckedUserId) {
      return;
    }

    if (currentUserId === null) {
      const timeoutId = window.setTimeout(() => {
        setChatRooms([]);
        setHasNextRooms(false);
        setNextRoomCursor(null);
        setCurrentRoom(null);
        setMessages([]);
        selectedRoomIdRef.current = null;
        chatRoomListSocketRef.current?.disconnect();
        chatRoomListSocketRef.current = null;
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      void loadChatRooms();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, hasCheckedUserId, loadChatRooms]);

  async function handleSelectRoom(roomId: number) {
    if (currentUserId === null) {
      setErrorMessage("로그인 후 이용해 주세요.");
      return;
    }

    await openExistingRoom(roomId);
  }

  async function handleLoadMoreRooms() {
    if (!hasNextRooms || nextRoomCursor === null || isLoadingMoreRooms) {
      return;
    }

    await loadChatRooms({
      cursor: nextRoomCursor,
      append: true,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentRoom === null || currentUserId === null || isSending) {
      return;
    }

    const content = messageInput.trim();
    if (content.length === 0) {
      return;
    }

    if (chatSocketRef.current === null || !isConnectedToSocket) {
      setErrorMessage("WebSocket 연결 후 메시지를 전송할 수 있습니다.");
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      chatSocketRef.current.sendMessage({
        content,
      });
      setMessageInput("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "메시지를 전송하지 못했습니다.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-x-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14">
        <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-12">
          <h1 className="baton-page-title mt-3 !font-bold">CHATTING</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            매칭과 거래에서 이어진 대화를 한 곳에서 확인하고 실시간으로 메시지를
            주고받으세요.
          </p>
        </header>

        <div className="relative grid min-h-[680px] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-[0_28px_80px_rgba(80,60,160,0.12)] backdrop-blur lg:h-[720px] lg:min-h-0 lg:grid-cols-[340px_1fr]">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
            aria-hidden="true"
          />
          <aside className="flex min-h-0 max-h-[360px] flex-col border-b border-[#eee8ff] bg-[#fbf9ff]/70 lg:max-h-none lg:border-b-0 lg:border-r">
            <div className="border-b border-[#eee8ff] px-5 py-5">
              <p className="text-sm font-black text-zinc-950">대화 목록</p>
              <p className="mt-1 text-xs font-bold text-zinc-400">
                총 {chatRooms.length}
                {hasNextRooms ? "+" : ""}개 대화
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior-y:contain] [scrollbar-gutter:stable]">
              {isLoadingRooms ? (
                <div className="px-5 py-8 text-center text-sm font-semibold text-zinc-500">
                  채팅방 목록을 불러오는 중입니다.
                </div>
              ) : null}

              {!isLoadingRooms && chatRooms.length > 0 ? (
                <div className="divide-y divide-[#eee8ff]">
                  {chatRooms.map((room) => (
                    <ChatRoomListButton
                      key={room.roomId}
                      room={room}
                      currentUserId={currentUserId}
                      isActive={currentRoomId === room.roomId}
                      onSelect={() => handleSelectRoom(room.roomId)}
                    />
                  ))}
                  {hasNextRooms ? (
                    <div className="p-4">
                      <button
                        type="button"
                        disabled={isLoadingMoreRooms}
                        onClick={handleLoadMoreRooms}
                        className="h-10 w-full cursor-pointer rounded-lg border border-[#ded6ff] bg-white text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingMoreRooms ? "불러오는 중" : "더 보기"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isLoadingRooms && chatRooms.length === 0 ? (
                <div className="px-5 py-5">
                  <EmptyState
                    title="아직 채팅방이 없습니다."
                    description="매칭 제안이 수락되거나 거래가 시작되면 채팅방이 생성됩니다."
                  />
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-[560px] min-w-0 flex-col lg:min-h-0">
            <div className="border-b border-[#eee8ff] px-6 py-5">
              {!hasCheckedUserId ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-zinc-500">
                    사용자 정보를 확인하는 중입니다.
                  </p>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              ) : currentUserId === null ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-amber-700">
                    로그인 후 이용해 주세요.
                  </p>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              ) : currentRoom ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChatRoomAvatar
                      imageUrl={currentOpponentProfileImageUrl}
                      name={currentOpponentName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-zinc-950">
                        {currentOpponentName}
                      </p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-zinc-500">
                        {currentTalentLines.length > 0 ? (
                          currentTalentLines.map((line, index) => (
                            <Fragment
                              key={`${line.label}-${line.talentId ?? index}`}
                            >
                              {index > 0 ? (
                                <span
                                  className="text-zinc-300"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                              ) : null}
                              {line.talentId !== null ? (
                                <Link
                                  href={`/talents/${line.talentId}`}
                                  className="min-w-0 truncate transition hover:text-[#8c5bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c5bff]/30"
                                >
                                  <span className="font-black text-zinc-600">
                                    {line.label}
                                  </span>
                                  <span aria-hidden="true">: </span>
                                  <span>{line.value}</span>
                                </Link>
                              ) : (
                                <span className="min-w-0 truncate">
                                  <span className="font-black text-zinc-600">
                                    {line.label}
                                  </span>
                                  <span aria-hidden="true">: </span>
                                  <span>{line.value}</span>
                                </span>
                              )}
                            </Fragment>
                          ))
                        ) : (
                          <span>재능 정보 없음</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-4 text-xs font-black text-[#8c5bff] sm:text-sm">
                      {getRoomStatusLabel(currentRoom.status)}
                    </span>
                    <SocketStatusBadge isConnected={isConnectedToSocket} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-zinc-950">
                      채팅방을 선택해 주세요
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">
                      왼쪽 목록에서 대화를 선택하면 메시지를 확인할 수 있습니다.
                    </p>
                  </div>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              )}
            </div>

            {isAuthRequiredMessage(errorMessage) ? (
              <div className="px-6 pt-4">
                <LoginRequiredState description="채팅은 로그인 후 이용할 수 있어요." />
              </div>
            ) : errorMessage ? (
              <div className="px-6 pt-4">
                <ErrorState message={errorMessage} />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbf9ff]/60 px-4 py-5 [scrollbar-gutter:stable] sm:px-6 sm:py-6">
              <div className="mx-auto flex max-w-[720px] flex-col gap-4">
                {currentRoom === null ? (
                  isEnteringRoom ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
                      채팅방에 입장하는 중입니다.
                    </div>
                  ) : (
                    <EmptyState
                      title="채팅방을 선택해 주세요"
                      description="왼쪽 채팅방 목록에서 대화를 선택하면 메시지를 확인할 수 있어요."
                    />
                  )
                ) : isLoadingMessages ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
                    메시지를 불러오는 중입니다.
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="아직 메시지가 없어요"
                    description="첫 메시지를 보내 대화를 시작해 보세요."
                  />
                ) : (
                  messages.map((message, index) => {
                    const previousMessage = messages[index - 1];
                    const messageCreatedAt = getMessageCreatedAtValue(message);
                    const shouldShowDateDivider =
                      previousMessage === undefined ||
                      !isSameDate(
                        getMessageCreatedAtValue(previousMessage),
                        messageCreatedAt,
                      );
                    const senderId = getPositiveInteger(message.senderId);

                    return (
                      <Fragment key={getMessageId(message)}>
                        {shouldShowDateDivider ? (
                          <DateDivider date={messageCreatedAt} />
                        ) : null}
                        <MessageBubble
                          message={message}
                          isMine={
                            senderId !== null && senderId === currentUserId
                          }
                          senderLabel={getMessageSenderLabel({
                            senderId,
                            currentUserId,
                            opponentName: currentOpponentName,
                          })}
                        />
                      </Fragment>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-[#eee8ff] bg-white/95 px-4 py-4 sm:px-6">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <label htmlFor="chat-message" className="sr-only">
                  메시지 입력
                </label>
                <div className="flex h-12 flex-1 items-center gap-3 rounded-lg border border-[#ded6ff] bg-white px-4 transition focus-within:border-[#8c5bff] focus-within:ring-4 focus-within:ring-[#f4f0ff]">
                  <MessageCircle
                    className="size-5 text-[#8c5bff]"
                    aria-hidden="true"
                  />
                  <input
                    id="chat-message"
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    maxLength={1000}
                    disabled={
                      currentRoom === null ||
                      currentUserId === null ||
                      !isConnectedToSocket
                    }
                    className="field h-full flex-1 border-0 bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 disabled:bg-transparent"
                    placeholder={
                      isConnectedToSocket
                        ? "메시지를 입력해 주세요."
                        : "WebSocket 연결 후 메시지를 입력할 수 있습니다."
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    currentRoom === null ||
                    currentUserId === null ||
                    !isConnectedToSocket ||
                    messageInput.trim().length === 0 ||
                    isSending
                  }
                  className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#8c5bff] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(140,91,255,0.22)] transition hover:bg-[#7c4eff] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none sm:w-auto"
                >
                  <Send className="size-4" aria-hidden="true" />
                  {isSending ? "전송 중" : "보내기"}
                </button>
              </form>
              <p className="mt-2 text-right text-xs font-semibold text-zinc-400">
                {messageInput.length}/1000
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SocketStatusBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-black ${isConnected
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-[#ded6ff] bg-white text-zinc-500"
        }`}
    >
      {isConnected ? "WebSocket 연결됨" : "WebSocket 연결 대기"}
    </span>
  );
}

function ChatRoomListButton({
  room,
  currentUserId,
  isActive,
  onSelect,
}: {
  room: ChatRoomListItem;
  currentUserId: number | null;
  isActive: boolean;
  onSelect: () => void;
}) {
  const opponentName = room.opponentNickname?.trim() || "상대방";
  const listDate = formatChatRoomListDate(room.lastMessageAt ?? room.createdAt);
  const talentLines = getChatRoomTalentLines(room);
  const unreadCount = getRoomUnreadCount(room);
  const lastMessageText = getRoomLastMessageText(room);
  const profileImageUrl = getChatRoomOpponentProfileImageUrl(
    room,
    currentUserId,
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full cursor-pointer gap-3 px-5 py-5 text-left transition ${isActive ? "bg-[#f4f0ff]" : "bg-white/70 hover:bg-white"
        }`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1 transition ${isActive ? "bg-[#8c5bff]" : "bg-transparent group-hover:bg-[#ded6ff]"
          }`}
        aria-hidden="true"
      />
      <ChatRoomAvatar imageUrl={profileImageUrl} name={opponentName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-black text-zinc-950">
            {opponentName}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="text-xs font-semibold text-zinc-400">{listDate}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {talentLines.map((line) => (
            <span
              key={`${line.label}-${line.talentId ?? line.value}`}
              className="inline-flex min-w-0 max-w-full items-center rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-3 py-1.5 text-xs font-black text-[#8c5bff] shadow-sm shadow-violet-500/10"
              title={`${line.label}: ${line.value}`}
            >
              <span className="shrink-0">{line.label}</span>
              <span aria-hidden="true">: </span>
              <span className="min-w-0 truncate">{line.value}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-sm ${unreadCount > 0 ? "font-black text-zinc-900" : "font-semibold text-zinc-600"}`}
          >
            {lastMessageText}
          </p>
          {unreadCount > 0 ? (
            <span
              className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black leading-none text-white shadow-sm shadow-red-500/30"
              aria-label={`읽지 않은 메시지 ${unreadCount}개`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </div>
        <span className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-[#ded6ff] bg-white px-4 text-sm font-black text-[#8c5bff]">
          {getRoomStatusLabel(room.roomType)}
        </span>
      </div>
    </button>
  );
}

function ChatRoomAvatar({
  imageUrl,
  name,
  size = "sm",
}: {
  imageUrl: string | null | undefined;
  name: string;
  size?: "sm" | "md";
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const normalizedImageUrl = imageUrl?.trim() || null;
  const avatarSizeClass = size === "md" ? "h-12 w-12" : "h-11 w-11";
  const src =
    failedImageUrl === normalizedImageUrl
      ? getUserProfileImageUrl(null)
      : getUserProfileImageUrl(normalizedImageUrl);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} 프로필 이미지`}
      className={`${avatarSizeClass} shrink-0 rounded-full border border-[#ded6ff] object-cover`}
      onError={() => setFailedImageUrl(normalizedImageUrl)}
    />
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full border border-[#ded6ff] bg-white px-3 py-1 text-xs font-bold text-zinc-500">
        {formatDateDivider(date)}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  senderLabel,
}: {
  message: ChatMessageRes;
  isMine: boolean;
  senderLabel: string;
}) {
  const shouldShowUnreadCount = isMine && !message.read;
  const createdAt = getMessageCreatedAtValue(message);
  const content = getMessageContent(message) || "메시지 내용이 없습니다.";

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {!isMine ? (
        <p className="mb-1 text-sm font-semibold text-zinc-400">
          {senderLabel}
        </p>
      ) : null}
      <div
        className={`flex w-full items-end gap-2 ${isMine ? "justify-end" : "justify-start"
          }`}
      >
        {isMine ? (
          <MessageMeta
            createdAt={createdAt}
            shouldShowUnreadCount={shouldShowUnreadCount}
            isMine={isMine}
          />
        ) : null}

        <div
          className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${isMine
            ? "bg-[#8c5bff] text-white shadow-[0_12px_24px_rgba(140,91,255,0.18)]"
            : "border border-[#eee8ff] bg-white text-zinc-900"
            }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">
            {content}
          </p>
        </div>

        {!isMine ? (
          <MessageMeta
            createdAt={createdAt}
            shouldShowUnreadCount={false}
            isMine={isMine}
          />
        ) : null}
      </div>
    </div>
  );
}

function MessageMeta({
  createdAt,
  shouldShowUnreadCount,
  isMine,
}: {
  createdAt: string;
  shouldShowUnreadCount: boolean;
  isMine: boolean;
}) {
  return (
    <div
      className={`mb-1 flex shrink-0 flex-col text-[11px] font-semibold leading-4 ${isMine ? "items-end" : "items-start"
        }`}
    >
      {shouldShowUnreadCount ? (
        <span className="font-black text-amber-500">1</span>
      ) : null}
      <span className="text-zinc-400">{formatMessageTime(createdAt)}</span>
    </div>
  );
}
