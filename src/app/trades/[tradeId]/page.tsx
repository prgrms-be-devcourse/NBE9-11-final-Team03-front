"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/common/ErrorState";
import { Listbox } from "@/components/common/Listbox";
import { extractAuthClaimsFromAccessToken, getAccessToken } from "@/lib/auth";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import {
  chatApi,
  profileApi,
  talentApi,
  tradeApi,
  type ChatRoomListItem,
  type MyProfileDetailRes,
  type TalentDetailRes,
  type ReportReason,
  type TradeListRes,
  type TradeRes,
  type TradeSubmissionRes,
} from "@/lib/api";
import {
  isAuthRequiredError,
  isAuthRequiredMessage,
} from "@/lib/auth-required";
import { formatCredit, formatDate } from "@/utils/format";

const MAX_SUBMISSION_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const TRADE_PARTNER_LOOKUP_PAGE_SIZE = 50;

const TRADE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "거래 진행 중",
  COMPLETED: "거래 완료",
  CANCELLED: "거래 취소",
  DISPUTED: "분쟁 중",
  UNDER_REVIEW: "구매자 검토 중",
  AWAITING_PARTNER: "상대 확정 대기",
};

const ESCROW_STATUS_LABELS: Record<string, string> = {
  HELD: "예치 중",
  RELEASED: "정산 완료",
  REFUNDED: "환불 완료",
  FROZEN: "동결",
  DISPUTED: "분쟁 중",
};

const TRADE_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "크레딧 구매",
  SWAP: "재능 교환",
};

const DISPUTE_REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "ILLEGAL_OR_CHEATING", label: "불법·사기성 거래" },
  { value: "EXTERNAL_CONTACT_OR_AD", label: "외부 연락·광고 유도" },
  { value: "INAPPROPRIATE_CONTENT", label: "부적절한 콘텐츠" },
  { value: "ETC", label: "기타" },
];

const DISPUTE_REASON_LISTBOX_OPTIONS: {
  value: ReportReason | "";
  label: string;
  disabled?: boolean;
}[] = [
    { value: "", label: "신고 항목을 선택해 주세요", disabled: true },
    ...DISPUTE_REASON_OPTIONS,
  ];

const DISPUTE_TITLE_MAX_LENGTH = 50;
const DISPUTE_CONTENT_MAX_LENGTH = 120;
const DISPUTE_REASON_MAX_LENGTH = 200;

function getDisputeReasonLabel(reason: ReportReason): string {
  return (
    DISPUTE_REASON_OPTIONS.find((option) => option.value === reason)?.label ??
    "기타"
  );
}

function buildDisputeReasonPayload({
  category,
  title,
  content,
}: {
  category: ReportReason;
  title: string;
  content: string;
}): string {
  return `[${getDisputeReasonLabel(category)}] ${title.trim()}\n${content.trim()}`;
}

const inputClassName =
  "form-input rounded-lg border-[#d9ccff] bg-white/95 px-4 py-3 text-[15px] font-semibold leading-7 shadow-sm shadow-violet-950/[0.03] transition focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]";

const sideCardClassName =
  "relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-6 shadow-sm shadow-violet-950/[0.04] backdrop-blur";

type TradeDisplayFields = TradeRes & {
  displayTradeTitle?: string | null;
  displayTalentTitle?: string | null;
  myReceiveTalentTitle?: string | null;
  myProvideTalentTitle?: string | null;
};

function readAuthenticatedUserId(): number | null {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  return extractAuthClaimsFromAccessToken(token).userId;
}

function getStatusTone(
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"],
): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "RELEASED") return "success";
  if (status === "CANCELLED" || status === "DISPUTED" || status === "FROZEN") {
    return "danger";
  }
  if (status === "UNDER_REVIEW" || status === "HELD") return "warning";
  if (status === "IN_PROGRESS") return "info";
  return "default";
}

function getStatusClass(
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"],
): string {
  const classes = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
    info: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
  };

  return classes[getStatusTone(status)];
}

function getTradeStatusLabelForViewer(
  trade: TradeRes,
  currentUserId: number | null,
): string {
  const isCurrentBuyer = currentUserId === getPositiveInteger(trade.buyerId);
  const isCurrentSeller = currentUserId === getPositiveInteger(trade.sellerId);

  if (trade.tradeStatus === "UNDER_REVIEW") {
    if (isCurrentBuyer) {
      return "상대방 제출 완료";
    }

    if (isCurrentSeller) {
      return "결과물 제출 완료";
    }
  }

  if (trade.tradeStatus === "AWAITING_PARTNER") {
    if (isCurrentBuyer) {
      return "구매 확정 완료";
    }

    if (isCurrentSeller) {
      return "상대방 구매 확정 완료";
    }
  }

  return getTradeStatusLabel(trade.tradeStatus);
}

function getPeerConfirmationNoticeTitle(
  trade: TradeRes,
  currentUserId: number | null,
): string {
  if (currentUserId === getPositiveInteger(trade.sellerId)) {
    return "상대방 구매 확정 완료";
  }

  if (currentUserId === getPositiveInteger(trade.buyerId)) {
    return "구매 확정 완료";
  }

  return "구매 확정 완료";
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: TradeRes["tradeStatus"] | TradeRes["escrowStatus"];
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${getStatusClass(
        status,
      )}`}
    >
      {label}
    </span>
  );
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9ccff] bg-white px-3 py-1.5 text-xs font-black text-[#8c5bff]">
      {label}
    </span>
  );
}

function getTradeStatusLabel(status: unknown): string {
  return typeof status === "string"
    ? TRADE_STATUS_LABELS[status] ?? status
    : "거래 상태 정보 없음";
}

function getEscrowStatusLabel(status: unknown): string {
  return typeof status === "string"
    ? ESCROW_STATUS_LABELS[status] ?? status
    : "에스크로 상태 정보 없음";
}

function getTradeTypeLabel(type: unknown): string {
  return typeof type === "string"
    ? TRADE_TYPE_LABELS[type] ?? type
    : "거래 유형 정보 없음";
}

function getRawTradeTitle(trade: TradeRes | TradeListRes): string | null {
  return getNonEmptyText("title" in trade ? trade.title : null);
}

function getPositiveInteger(value: unknown) {
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

function formatOptionalEntityId(label: string, value: unknown) {
  const id = getPositiveInteger(value);

  return id === null ? `${label} 정보 없음` : `${label} #${id}`;
}

function getParticipantDisplayName(
  role: "buyer" | "seller",
  nickname: string | null | undefined,
  userId: number | null | undefined,
): string {
  const roleLabel = role === "buyer" ? "구매자" : "판매자";
  const displayName = nickname?.trim();

  if (displayName) {
    return displayName;
  }

  return formatOptionalEntityId(roleLabel, userId);
}

function formatBuyerName(trade: TradeRes) {
  return getParticipantDisplayName("buyer", trade.buyerNickname, trade.buyerId);
}

function formatSellerName(trade: TradeRes) {
  return getParticipantDisplayName(
    "seller",
    trade.sellerNickname,
    trade.sellerId,
  );
}

function formatTalentTitle(trade: TradeRes) {
  const displayTitle = getNonEmptyText(
    (trade as TradeDisplayFields).displayTalentTitle,
  );

  if (displayTitle !== null) {
    return displayTitle;
  }

  return formatBaseTalentTitle(trade);
}

function formatBaseTalentTitle(trade: TradeRes | TradeListRes) {
  const title = getBestDisplayTitle(trade.talentTitle, getRawTradeTitle(trade));

  return title || formatOptionalEntityId("재능", trade.talentId);
}

function formatMyReceiveTalentTitle(
  trade: TradeRes,
  currentUserId: number | null,
) {
  const displayFields = trade as TradeDisplayFields;
  const receiveTitle = getBestDisplayTitle(displayFields.myReceiveTalentTitle);
  const buyerId = getPositiveInteger(trade.buyerId);
  const sellerId = getPositiveInteger(trade.sellerId);

  if (receiveTitle !== null) {
    return receiveTitle;
  }

  if (currentUserId !== null && currentUserId === buyerId) {
    return formatBaseTalentTitle(trade);
  }

  if (trade.tradeType === "PURCHASE" && currentUserId === sellerId) {
    return "구매 거래는 받을 재능이 없습니다.";
  }

  return (
    getBestDisplayTitle(displayFields.displayTalentTitle) ??
    "내가 받을 재능 정보 없음"
  );
}

function formatMyProvideTalentTitle(
  trade: TradeRes,
  currentUserId: number | null,
) {
  const displayFields = trade as TradeDisplayFields;
  const provideTitle = getBestDisplayTitle(displayFields.myProvideTalentTitle);
  const sellerId = getPositiveInteger(trade.sellerId);
  const buyerId = getPositiveInteger(trade.buyerId);

  if (provideTitle !== null) {
    return provideTitle;
  }

  if (currentUserId !== null && currentUserId === sellerId) {
    return formatBaseTalentTitle(trade);
  }

  if (trade.tradeType === "PURCHASE" && currentUserId === buyerId) {
    return "크레딧으로 결제하는 거래입니다.";
  }

  return "내가 제공할 재능 정보 없음";
}

function formatTradeTitle(trade: TradeRes) {
  const displayTitle = getNonEmptyText(
    (trade as TradeDisplayFields).displayTradeTitle,
  );

  if (displayTitle !== null) {
    return displayTitle;
  }

  const title = getRawTradeTitle(trade);

  if (title !== null) {
    return title;
  }

  return trade.tradeType === "SWAP"
    ? formatOptionalEntityId("거래", trade.tradeId)
    : formatTalentTitle(trade) || formatOptionalEntityId("거래", trade.tradeId);
}

function getNonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isGeneratedFallbackTitle(value: string | null) {
  return (
    value !== null &&
    (value === "재능 정보 없음" || /^재능\s*#\d+$/.test(value))
  );
}

function getBestDisplayTitle(...values: unknown[]) {
  const titles = values
    .map(getNonEmptyText)
    .filter((value): value is string => value !== null);
  const explicitTitle = titles.find((title) => !isGeneratedFallbackTitle(title));

  return explicitTitle ?? titles[0] ?? null;
}


function getImagePreviewContentType(value: unknown): string | null {
  const url = getNonEmptyText(value);

  if (!url) {
    return null;
  }

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerUrl.includes(".png")) {
    return "image/png";
  }

  if (lowerUrl.includes(".webp")) {
    return "image/webp";
  }

  if (lowerUrl.includes(".gif")) {
    return "image/gif";
  }

  return null;
}

function getTalentAuthorId(talent: TalentDetailRes) {
  return (
    getPositiveInteger(talent.author?.id) ??
    getPositiveInteger(talent.author?.userId) ??
    getPositiveInteger(talent.author?.authorId) ??
    getPositiveInteger(talent.author?.sellerId) ??
    getPositiveInteger(talent.userId) ??
    getPositiveInteger(talent.authorId) ??
    getPositiveInteger(talent.sellerId)
  );
}

function findMatchingChatRoom(
  trade: TradeRes | TradeListRes,
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
  trade: TradeRes | TradeListRes,
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

async function getTalentDetailForTrade(
  trade: TradeRes | TradeListRes,
  fallbackTalentDetail: TalentDetailRes | null,
) {
  const talentId = getPositiveInteger(trade.talentId);
  const fallbackTalentId =
    fallbackTalentDetail === null
      ? null
      : getPositiveInteger(fallbackTalentDetail.talentId) ??
      getPositiveInteger(fallbackTalentDetail.id);

  if (talentId === null) {
    return null;
  }

  if (fallbackTalentId === talentId) {
    return fallbackTalentDetail;
  }

  return talentApi.getDetail(talentId).then(
    (talent) => talent,
    () => null,
  );
}

async function getTalentTitleForTradeDisplay({
  trade,
  currentUserId,
  chatRooms,
  fallbackTalentDetail,
}: {
  trade: TradeRes | TradeListRes;
  currentUserId: number | null;
  chatRooms: ChatRoomListItem[];
  fallbackTalentDetail: TalentDetailRes | null;
}) {
  const matchingRoom = findMatchingChatRoom(trade, chatRooms);
  const talentDetail = await getTalentDetailForTrade(trade, fallbackTalentDetail);

  return (
    getBestDisplayTitle(
      getChatRoomTalentTitleForTrade(trade, matchingRoom, currentUserId),
      trade.talentTitle,
      talentDetail?.title,
      getRawTradeTitle(trade),
    ) ?? formatOptionalEntityId("재능", trade.talentId)
  );
}

function applyTradeDisplayFields({
  trade,
  currentUserId,
  myProfile,
  talentDetail,
  chatRooms,
}: {
  trade: TradeRes;
  currentUserId: number | null;
  myProfile: MyProfileDetailRes | null;
  talentDetail: TalentDetailRes | null;
  chatRooms: ChatRoomListItem[];
}): TradeRes {
  const enrichedTrade: TradeRes = { ...trade };
  const myNickname = getNonEmptyText(myProfile?.nickname);
  const matchingRoom = findMatchingChatRoom(enrichedTrade, chatRooms);
  const opponentNickname = getNonEmptyText(matchingRoom?.opponentNickname);

  enrichedTrade.talentTitle =
    getBestDisplayTitle(
      getChatRoomTalentTitleForTrade(
        enrichedTrade,
        matchingRoom,
        currentUserId,
      ),
      enrichedTrade.talentTitle,
      talentDetail?.title,
    ) ??
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

  const talentAuthorId = talentDetail ? getTalentAuthorId(talentDetail) : null;
  const talentAuthorNickname = getNonEmptyText(talentDetail?.author?.nickname);

  if (
    talentAuthorId !== null &&
    talentAuthorId === getPositiveInteger(enrichedTrade.sellerId) &&
    talentAuthorNickname !== null
  ) {
    enrichedTrade.sellerNickname =
      getNonEmptyText(enrichedTrade.sellerNickname) ?? talentAuthorNickname;
  }

  return enrichedTrade;
}

async function findSwapPartnerTradeForDisplay(
  currentTrade: TradeRes,
): Promise<TradeRes | TradeListRes | null> {
  const currentTradeId = getPositiveInteger(currentTrade.tradeId);
  const currentTradeGroupId = getPositiveInteger(currentTrade.tradeGroupId);
  const currentBuyerId = getPositiveInteger(currentTrade.buyerId);
  const currentSellerId = getPositiveInteger(currentTrade.sellerId);

  if (currentTrade.tradeType !== "SWAP" || currentTradeId === null) {
    return null;
  }

  const myTrades = await getMyTradeListForPartnerStatus();

  const partnerFromList = myTrades.find((candidate) => {
    const candidateTradeId = getPositiveInteger(candidate.tradeId);
    const candidateTradeGroupId = getPositiveInteger(candidate.tradeGroupId);
    const candidateBuyerId = getPositiveInteger(candidate.buyerId);
    const candidateSellerId = getPositiveInteger(candidate.sellerId);
    const isSameGroup =
      currentTradeGroupId !== null &&
      candidateTradeGroupId === currentTradeGroupId;
    const isReversePair =
      currentBuyerId !== null &&
      currentSellerId !== null &&
      candidateBuyerId === currentSellerId &&
      candidateSellerId === currentBuyerId;

    return (
      candidate.tradeType === "SWAP" &&
      candidateTradeId !== null &&
      candidateTradeId !== currentTradeId &&
      (isSameGroup || isReversePair)
    );
  });

  if (partnerFromList) {
    return tradeApi.getDetail(partnerFromList.tradeId).then(
      (trade) => trade,
      () => partnerFromList,
    );
  }

  const swapCandidates = myTrades.filter((candidate) => {
    const candidateTradeId = getPositiveInteger(candidate.tradeId);

    return (
      candidate.tradeType === "SWAP" &&
      candidateTradeId !== null &&
      candidateTradeId !== currentTradeId
    );
  });

  const detailResults = await Promise.allSettled(
    swapCandidates.map((candidate) => tradeApi.getDetail(candidate.tradeId)),
  );

  for (const result of detailResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const candidate = result.value;
    const candidateTradeGroupId = getPositiveInteger(candidate.tradeGroupId);
    const candidateBuyerId = getPositiveInteger(candidate.buyerId);
    const candidateSellerId = getPositiveInteger(candidate.sellerId);
    const isSameGroup =
      currentTradeGroupId !== null &&
      candidateTradeGroupId === currentTradeGroupId;
    const isReversePair =
      currentBuyerId !== null &&
      currentSellerId !== null &&
      candidateBuyerId === currentSellerId &&
      candidateSellerId === currentBuyerId;

    if (isSameGroup || isReversePair) {
      return candidate;
    }
  }

  return null;
}

async function applySwapDisplayFields({
  trade,
  currentUserId,
  talentDetail,
  chatRooms,
}: {
  trade: TradeRes;
  currentUserId: number | null;
  talentDetail: TalentDetailRes | null;
  chatRooms: ChatRoomListItem[];
}): Promise<TradeRes> {
  if (trade.tradeType !== "SWAP" || currentUserId === null) {
    return trade;
  }

  const partnerTrade = await findSwapPartnerTradeForDisplay(trade).catch(
    () => null,
  );
  const tradeCandidates = partnerTrade === null ? [trade] : [trade, partnerTrade];
  const receiveTrade = tradeCandidates.find(
    (candidate) => getPositiveInteger(candidate.buyerId) === currentUserId,
  );
  const provideTrade = tradeCandidates.find(
    (candidate) => getPositiveInteger(candidate.sellerId) === currentUserId,
  );
  const [receiveTalentTitle, provideTalentTitle] = await Promise.all([
    receiveTrade
      ? getTalentTitleForTradeDisplay({
        trade: receiveTrade,
        currentUserId,
        chatRooms,
        fallbackTalentDetail: talentDetail,
      }).catch(() => null)
      : Promise.resolve(null),
    provideTrade
      ? getTalentTitleForTradeDisplay({
        trade: provideTrade,
        currentUserId,
        chatRooms,
        fallbackTalentDetail: talentDetail,
      }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const displayTalentTitle =
    getBestDisplayTitle(receiveTalentTitle) ??
    (getPositiveInteger(trade.sellerId) === currentUserId
      ? "내가 받을 재능 정보 없음"
      : getBestDisplayTitle(trade.talentTitle, talentDetail?.title));
  const displayTradeTitle =
    receiveTalentTitle !== null &&
      provideTalentTitle !== null &&
      receiveTalentTitle !== provideTalentTitle
      ? `${receiveTalentTitle} ↔ ${provideTalentTitle}`
      : getBestDisplayTitle(
        receiveTalentTitle,
        provideTalentTitle,
        `교환 거래 #${trade.tradeId}`,
      );

  return {
    ...trade,
    displayTradeTitle,
    displayTalentTitle,
    myReceiveTalentTitle: receiveTalentTitle,
    myProvideTalentTitle: provideTalentTitle,
  } as TradeDisplayFields;
}

async function enrichTradeDetailDisplayFields(
  trade: TradeRes,
  currentUserId: number | null,
) {
  const talentId = getPositiveInteger(trade.talentId);

  const [profileResult, talentDetailResult, chatRoomsResult] = await Promise.all([
    profileApi.getMe().then(
      (profile) => profile,
      () => null,
    ),
    talentId === null
      ? Promise.resolve(null)
      : talentApi.getDetail(talentId).then(
        (talent) => talent,
        () => null,
      ),
    chatApi.getMyChatRooms({ size: 100 }).then(
      (response) => response.content,
      () => [],
    ),
  ]);

  const participantEnrichedTrade = applyTradeDisplayFields({
    trade,
    currentUserId,
    myProfile: profileResult,
    talentDetail: talentDetailResult,
    chatRooms: chatRoomsResult,
  });

  return applySwapDisplayFields({
    trade: participantEnrichedTrade,
    currentUserId,
    talentDetail: talentDetailResult,
    chatRooms: chatRoomsResult,
  }).catch(() => participantEnrichedTrade);
}

function getCurrentUserDisplayName(
  trade: TradeRes,
  currentUserId: number | null,
): string {
  if (currentUserId === getPositiveInteger(trade.buyerId)) {
    return getParticipantDisplayName(
      "buyer",
      trade.buyerNickname,
      trade.buyerId,
    );
  }

  if (currentUserId === getPositiveInteger(trade.sellerId)) {
    return getParticipantDisplayName(
      "seller",
      trade.sellerNickname,
      trade.sellerId,
    );
  }

  return "거래 참여자가 아닙니다.";
}

interface PartnerTradeInfo {
  tradeId: number;
  tradeStatus: TradeRes["tradeStatus"];
  buyerId: number;
  sellerId: number;
}

interface SwapPartnerTradeLookupTarget {
  tradeId: unknown;
  tradeGroupId: unknown;
  tradeStatus: unknown;
  tradeType: unknown;
}

type ConfirmDialogState =
  | {
    type: "confirmTrade";
    title: string;
    description: string;
    confirmLabel: string;
    tone: "primary";
  }
  | {
    type: "cancelTrade";
    title: string;
    description: string;
    confirmLabel: string;
    tone: "danger";
  };

function toPartnerTradeInfo(
  trade: TradeListRes | TradeRes,
): PartnerTradeInfo | null {
  const tradeId = getPositiveInteger(trade.tradeId);
  const buyerId = getPositiveInteger(trade.buyerId);
  const sellerId = getPositiveInteger(trade.sellerId);

  if (tradeId === null || buyerId === null || sellerId === null) {
    return null;
  }

  return {
    tradeId,
    tradeStatus: trade.tradeStatus,
    buyerId,
    sellerId,
  };
}

async function getMyTradeListForPartnerStatus() {
  const trades: TradeListRes[] = [];
  let cursor: number | null = null;
  let hasNext = true;
  let scannedPageCount = 0;

  while (hasNext && scannedPageCount < 5) {
    const page = await tradeApi.getList({
      cursor,
      size: TRADE_PARTNER_LOOKUP_PAGE_SIZE,
    });

    trades.push(...page.content);
    hasNext = page.hasNext;
    cursor = page.nextCursor;
    scannedPageCount += 1;

    if (cursor === null) {
      break;
    }
  }

  return trades;
}

async function findSwapPartnerTrade(
  currentTrade: SwapPartnerTradeLookupTarget,
): Promise<PartnerTradeInfo | null> {
  const currentTradeId = getPositiveInteger(currentTrade.tradeId);
  const currentTradeGroupId = getPositiveInteger(currentTrade.tradeGroupId);

  if (
    currentTrade.tradeType !== "SWAP" ||
    currentTradeId === null ||
    currentTradeGroupId === null
  ) {
    return null;
  }

  const myTrades = await getMyTradeListForPartnerStatus();

  const partnerFromList = myTrades.find((candidate) => {
    const candidateTradeId = getPositiveInteger(candidate.tradeId);
    const candidateTradeGroupId = getPositiveInteger(candidate.tradeGroupId);

    return (
      candidateTradeId !== null &&
      candidateTradeId !== currentTradeId &&
      candidateTradeGroupId === currentTradeGroupId
    );
  });

  if (partnerFromList) {
    return toPartnerTradeInfo(partnerFromList);
  }

  const swapCandidates = myTrades.filter((candidate) => {
    const candidateTradeId = getPositiveInteger(candidate.tradeId);

    return (
      candidate.tradeType === "SWAP" &&
      candidateTradeId !== null &&
      candidateTradeId !== currentTradeId
    );
  });

  const detailResults = await Promise.allSettled(
    swapCandidates.map((candidate) => tradeApi.getDetail(candidate.tradeId)),
  );

  for (const result of detailResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const partnerDetail = result.value;
    const partnerTradeGroupId = getPositiveInteger(partnerDetail.tradeGroupId);

    if (partnerTradeGroupId === currentTradeGroupId) {
      return toPartnerTradeInfo(partnerDetail);
    }
  }

  return null;
}

export default function TradeDetailPage() {
  const params = useParams<{ tradeId: string }>();
  const tradeId = Number(params.tradeId);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [trade, setTrade] = useState<TradeRes | null>(null);
  const [partnerTrade, setPartnerTrade] = useState<PartnerTradeInfo | null>(null);
  const [submission, setSubmission] = useState<TradeSubmissionRes | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [disputeCategory, setDisputeCategory] = useState<ReportReason | "">("");
  const [disputeTitle, setDisputeTitle] = useState("");
  const [disputeContent, setDisputeContent] = useState("");
  const [disputeReasonError, setDisputeReasonError] = useState("");
  const [isDisputeDialogOpen, setIsDisputeDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSubmissionLoading, setIsSubmissionLoading] = useState(false);
  const [submissionFileInputKey, setSubmissionFileInputKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadTradeDetail() {
      await Promise.resolve();

      if (!Number.isInteger(tradeId) || tradeId <= 0) {
        if (!ignore) {
          setErrorMessage("유효한 거래 ID가 아닙니다.");
          setPartnerTrade(null);
          setIsLoading(false);
        }
        return;
      }

      const userId = readAuthenticatedUserId();

      if (userId === null) {
        if (!ignore) {
          setCurrentUserId(null);
          setPartnerTrade(null);
          setErrorMessage("로그인 후 이용해 주세요.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextTrade = await tradeApi.getDetail(tradeId);
        const nextDisplayTrade = await enrichTradeDetailDisplayFields(
          nextTrade,
          userId,
        );

        if (ignore) {
          return;
        }

        setCurrentUserId(userId);
        setTrade(nextDisplayTrade);
        setSubmission(null);
        setSubmissionMessage(null);
        setErrorMessage(null);
      } catch (error) {
        if (ignore) {
          return;
        }

        setTrade(null);
        setPartnerTrade(null);
        setErrorMessage(
          isAuthRequiredError(error)
            ? "로그인 후 이용해 주세요."
            : error instanceof Error
              ? error.message
              : "거래 상세를 불러오지 못했습니다.",
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadTradeDetail();

    return () => {
      ignore = true;
    };
  }, [tradeId]);

  const partnerStatusTradeId = trade?.tradeId ?? null;
  const partnerStatusTradeGroupId = trade?.tradeGroupId ?? null;
  const partnerStatusTradeStatus = trade?.tradeStatus ?? null;
  const partnerStatusTradeType = trade?.tradeType ?? null;

  useEffect(() => {
    let ignore = false;

    async function loadPartnerTradeStatus() {
      if (currentUserId === null || partnerStatusTradeType !== "SWAP") {
        setPartnerTrade(null);
        return;
      }

      try {
        const nextPartnerTrade = await findSwapPartnerTrade({
          tradeId: partnerStatusTradeId,
          tradeGroupId: partnerStatusTradeGroupId,
          tradeStatus: partnerStatusTradeStatus,
          tradeType: partnerStatusTradeType,
        });

        if (!ignore) {
          setPartnerTrade(nextPartnerTrade);
        }
      } catch {
        if (!ignore) {
          setPartnerTrade(null);
        }
      }
    }

    void loadPartnerTradeStatus();

    return () => {
      ignore = true;
    };
  }, [
    currentUserId,
    partnerStatusTradeGroupId,
    partnerStatusTradeId,
    partnerStatusTradeStatus,
    partnerStatusTradeType,
  ]);

  async function refreshTrade(nextSuccessMessage?: string) {
    if (currentUserId === null || !Number.isInteger(tradeId) || tradeId <= 0) {
      return;
    }

    const nextTrade = await tradeApi.getDetail(tradeId);
    const nextDisplayTrade = await enrichTradeDetailDisplayFields(
      nextTrade,
      currentUserId,
    );
    setTrade(nextDisplayTrade);
    if (nextSuccessMessage) {
      setSuccessMessage(nextSuccessMessage);
    }
  }

  const loadSubmission = useCallback(
    async (showSuccessMessage = false) => {
      if (!trade || currentUserId === null) {
        return;
      }

      setSubmissionMessage(null);
      setIsSubmissionLoading(true);

      try {
        const nextSubmission = await tradeApi.getSubmission(trade.tradeId);
        setSubmission(nextSubmission);
        if (showSuccessMessage) {
          setSuccessMessage("결과물을 불러왔습니다.");
        }
      } catch (error) {
        setSubmission(null);
        setSubmissionMessage(
          error instanceof Error
            ? error.message
            : "결과물을 불러오지 못했습니다.",
        );
      } finally {
        setIsSubmissionLoading(false);
      }
    },
    [currentUserId, trade],
  );

  useEffect(() => {
    if (
      !trade ||
      currentUserId === null ||
      currentUserId !== getPositiveInteger(trade.buyerId) ||
      trade.tradeStatus !== "UNDER_REVIEW"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSubmission(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [trade, currentUserId, loadSubmission]);

  function handleConfirmTrade() {
    if (!trade || currentUserId === null || isActionLoading) {
      return;
    }

    setConfirmDialog({
      type: "confirmTrade",
      title: "구매를 확정할까요?",
      description:
        "결과물을 확인했다면 구매를 확정해 주세요. 확정 후에는 에스크로 정산 또는 상대 확정 대기 상태로 전환됩니다.",
      confirmLabel: "구매 확정",
      tone: "primary",
    });
  }

  function handleCancelTrade() {
    if (!trade || currentUserId === null || isActionLoading) {
      return;
    }

    setConfirmDialog({
      type: "cancelTrade",
      title: "거래를 취소할까요?",
      description:
        "진행 중인 거래를 취소합니다. 취소 후에는 되돌릴 수 없으니 거래 상황을 확인한 뒤 진행해 주세요.",
      confirmLabel: "거래 취소",
      tone: "danger",
    });
  }

  function closeConfirmDialog() {
    if (isActionLoading) {
      return;
    }

    setConfirmDialog(null);
  }

  async function executeConfirmDialogAction() {
    if (!trade || currentUserId === null || confirmDialog === null) {
      return;
    }

    const actionType = confirmDialog.type;

    setErrorMessage(null);
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      if (actionType === "confirmTrade") {
        await tradeApi.confirm(trade.tradeId);
        setConfirmDialog(null);
        await refreshTrade("구매가 확정되었습니다.");
        return;
      }

      await tradeApi.cancel(trade.tradeId);
      setConfirmDialog(null);
      await refreshTrade("거래가 취소되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : actionType === "confirmTrade"
            ? "구매 확정에 실패했습니다."
            : "거래 취소에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  function openDisputeDialog() {
    if (!trade || currentUserId === null) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setDisputeReasonError("");
    setIsDisputeDialogOpen(true);
  }

  function closeDisputeDialog() {
    if (isActionLoading) {
      return;
    }

    setIsDisputeDialogOpen(false);
    setDisputeReasonError("");
  }

  async function handleDisputeTrade() {
    if (!trade || currentUserId === null) {
      return;
    }

    const category = disputeCategory;
    const title = disputeTitle.trim();
    const content = disputeContent.trim();

    if (!category) {
      setDisputeReasonError("신고 항목을 선택해 주세요.");
      return;
    }

    if (title.length < 2 || title.length > DISPUTE_TITLE_MAX_LENGTH) {
      setDisputeReasonError(
        `제목은 2자 이상 ${DISPUTE_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`,
      );
      return;
    }

    if (content.length < 5 || content.length > DISPUTE_CONTENT_MAX_LENGTH) {
      setDisputeReasonError(
        `내용은 5자 이상 ${DISPUTE_CONTENT_MAX_LENGTH}자 이하로 입력해 주세요.`,
      );
      return;
    }

    const reason = buildDisputeReasonPayload({ category, title, content });

    if (reason.length > DISPUTE_REASON_MAX_LENGTH) {
      setDisputeReasonError(
        `제목과 내용을 합쳐 ${DISPUTE_REASON_MAX_LENGTH}자 이하로 입력해 주세요.`,
      );
      return;
    }

    setErrorMessage(null);
    setDisputeReasonError("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await tradeApi.dispute(trade.tradeId, { reason });
      setDisputeCategory("");
      setDisputeTitle("");
      setDisputeContent("");
      setIsDisputeDialogOpen(false);
      await refreshTrade("분쟁이 신청되었습니다. 관리자 검토가 완료될 때까지 에스크로가 동결됩니다.");
    } catch (error) {
      setDisputeReasonError(
        error instanceof Error ? error.message : "분쟁 신청에 실패했습니다.",
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleLoadSubmission() {
    setErrorMessage(null);
    setSuccessMessage("");
    await loadSubmission(true);
  }

  function handleSubmissionFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSuccessMessage("");

    if (file === null) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
      event.target.value = "";
      setSelectedFile(null);
      setErrorMessage("결과물 파일은 20MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  }

  function markSubmissionAsSubmitted(
    nextSubmission: TradeSubmissionRes,
    nextSuccessMessage: string,
  ) {
    setSubmission(nextSubmission);
    setSelectedFile(null);
    setSubmissionFileInputKey((current) => current + 1);
    setDescription("");
    setTrade((currentTrade) =>
      currentTrade === null
        ? currentTrade
        : { ...currentTrade, tradeStatus: "UNDER_REVIEW" },
    );
    setSuccessMessage(nextSuccessMessage);
  }

  function getSubmitResultErrorMessage(error: unknown) {
    if (!(error instanceof Error)) {
      return "결과물 제출 API에서 오류가 발생했습니다.";
    }

    if (error.message.includes("서버 내부 오류")) {
      return "결과물 제출 API에서 서버 오류가 발생했습니다. 이미 제출된 결과물이 있거나 거래 상태가 서버와 맞지 않을 수 있습니다. 새로고침 후에도 반복되면 백엔드 로그를 확인해 주세요.";
    }

    return `결과물 제출 API에서 오류가 발생했습니다. ${error.message}`;
  }

  async function refreshTradeAfterSubmission() {
    try {
      await refreshTrade();
    } catch {
      setSubmissionMessage(
        "결과물은 제출되었지만 최신 거래 상태를 다시 불러오지 못했습니다. 잠시 후 새로고침해 주세요.",
      );
    }
  }

  async function handleSubmitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trade || currentUserId === null) {
      return;
    }

    const urlTradeId = getPositiveInteger(tradeId);
    const detailTradeId = getPositiveInteger(trade.tradeId);

    if (urlTradeId === null) {
      setErrorMessage("유효한 거래 ID가 아닙니다.");
      return;
    }

    if (detailTradeId === null || detailTradeId !== urlTradeId) {
      setErrorMessage("거래 정보를 다시 확인해 주세요.");
      return;
    }

    if (currentUserId !== getPositiveInteger(trade.sellerId)) {
      setErrorMessage("판매자만 결과물을 제출할 수 있습니다.");
      return;
    }

    if (trade.tradeStatus !== "IN_PROGRESS") {
      setErrorMessage("진행 중인 거래에만 결과물을 제출할 수 있습니다.");
      return;
    }

    if (selectedFile === null) {
      setErrorMessage("제출할 결과물 파일을 선택해 주세요.");
      return;
    }

    if (selectedFile.size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
      setErrorMessage("결과물 파일은 20MB 이하만 업로드할 수 있습니다.");
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setErrorMessage("결과물 설명을 입력해 주세요.");
      return;
    }

    if (trimmedDescription.length > 200) {
      setErrorMessage("결과물 설명은 200자 이하로 입력해 주세요.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setSubmissionMessage(null);
    setIsActionLoading(true);

    try {
      let presigned;
      try {
        presigned = await tradeApi.createSubmissionPresignedUrl(urlTradeId, {
          fileName: selectedFile.name,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? `presigned URL 발급에 실패했습니다. ${error.message}`
            : "presigned URL 발급에 실패했습니다.",
        );
        return;
      }

      const expectedFileKeyPrefix = `trades/${urlTradeId}/`;
      if (!presigned.fileKey.startsWith(expectedFileKeyPrefix)) {
        setErrorMessage("업로드 파일 경로와 거래 정보가 일치하지 않습니다.");
        return;
      }

      try {
        await tradeApi.uploadFileToPresignedUrl(
          presigned.presignedUrl,
          selectedFile,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "파일 업로드에 실패했습니다.",
        );
        return;
      }

      let nextSubmission: TradeSubmissionRes;
      try {
        nextSubmission = await tradeApi.submitResult(urlTradeId, {
          fileKey: presigned.fileKey,
          description: trimmedDescription,
        });
      } catch (error) {
        setErrorMessage(getSubmitResultErrorMessage(error));
        return;
      }

      markSubmissionAsSubmitted(nextSubmission, "결과물이 제출되었습니다.");
      await refreshTradeAfterSubmission();
    } finally {
      setIsActionLoading(false);
    }
  }

  const tradeBuyerId = trade === null ? null : getPositiveInteger(trade.buyerId);
  const tradeSellerId =
    trade === null ? null : getPositiveInteger(trade.sellerId);
  const isBuyer =
    trade !== null && currentUserId !== null && currentUserId === tradeBuyerId;
  const isSeller =
    trade !== null && currentUserId !== null && currentUserId === tradeSellerId;
  const canSubmitResult =
    trade !== null && isSeller && trade.tradeStatus === "IN_PROGRESS";
  const canReviewResult =
    trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW";
  const shouldShowPartnerSubmittedNotice = canReviewResult;
  const canCancelTrade =
    trade !== null &&
    (isBuyer || isSeller) &&
    trade.tradeStatus === "IN_PROGRESS";
  const canDisputeTrade =
    trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW";
  const shouldShowSwapAwaitingPartnerNotice =
    trade !== null &&
    trade.tradeType === "SWAP" &&
    trade.tradeStatus === "AWAITING_PARTNER";
  const shouldShowPartnerConfirmedNotice =
    trade !== null &&
    trade.tradeType === "SWAP" &&
    isBuyer &&
    trade.tradeStatus === "UNDER_REVIEW" &&
    partnerTrade?.tradeStatus === "AWAITING_PARTNER";
  const shouldShowBuyerInProgressNotice =
    trade !== null && isBuyer && trade.tradeStatus === "IN_PROGRESS";
  const shouldShowSellerReviewNotice =
    trade !== null && isSeller && trade.tradeStatus === "UNDER_REVIEW";
  const shouldShowSubmissionSection =
    submission !== null ||
    (trade !== null && isBuyer && trade.tradeStatus === "UNDER_REVIEW");
  const terminalTradeMessage =
    trade?.tradeStatus === "COMPLETED"
      ? "거래가 완료되었습니다."
      : trade?.tradeStatus === "CANCELLED"
        ? "거래가 취소되었습니다."
        : trade?.tradeStatus === "DISPUTED"
          ? "분쟁 중인 거래입니다."
          : null;

  if (isLoading) {
    return (
      <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-[linear-gradient(135deg,#fbfdff_0%,#edf5ff_46%,#f4efff_100%)]">
        <div
          className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8c5bff]/12 blur-3xl"
          aria-hidden="true"
        />

        <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
          <div className="mx-auto w-full max-w-[880px] rounded-lg border border-[#ded6ff] bg-white/90 p-6 text-center text-sm font-black text-zinc-500 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
            거래 상세를 불러오는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-[linear-gradient(135deg,#fbfdff_0%,#edf5ff_46%,#f4efff_100%)]">
      <div
        className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8c5bff]/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[8%] top-48 h-52 w-52 rounded-full bg-[#79e4dd]/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="fixed-container relative pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pt-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3 !font-bold">
            TRADE DETAIL
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-600 sm:mt-5 sm:text-lg sm:leading-8">
            거래 상태, 에스크로, 결과물 제출과 구매 확정을 한 화면에서 확인하세요.
          </p>
        </header>

        {isAuthRequiredMessage(errorMessage) ? (
          <LoginRequiredState
            className="mx-auto mt-8 w-full max-w-[1180px]"
            description="거래 상세와 제출 기능은 로그인 후 확인할 수 있어요."
          />
        ) : errorMessage ? (
          <div className="mx-auto mt-8 w-full max-w-[1180px]">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        {successMessage ? (
          <p className="mx-auto mt-8 w-full max-w-[1180px] rounded-lg border border-[#d9ccff] bg-[#fbf9ff] p-4 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.04]">
            {successMessage}
          </p>
        ) : null}

        {trade ? (
          <div className="mx-auto mt-8 grid w-full max-w-[1180px] grid-cols-1 gap-6 lg:mt-12 lg:grid-cols-[1fr_360px]">
            <section className="relative overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-5 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
              <div
                className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
                aria-hidden="true"
              />
              <div className="flex flex-wrap gap-2">
                <StatusPill
                  label={getTradeStatusLabelForViewer(trade, currentUserId)}
                  status={trade.tradeStatus}
                />
                <StatusPill
                  label={getEscrowStatusLabel(trade.escrowStatus)}
                  status={trade.escrowStatus}
                />
                <TypePill label={getTradeTypeLabel(trade.tradeType)} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                <SummaryItem
                  title="내가 받을 재능"
                  value={formatMyReceiveTalentTitle(trade, currentUserId)}
                />
                <SummaryItem
                  title="내가 제공할 재능"
                  value={formatMyProvideTalentTitle(trade, currentUserId)}
                />
                <SummaryItem
                  title="크레딧 가격"
                  value={formatTradeCredit(trade.creditPrice)}
                />
                <SummaryItem title="구매자" value={formatBuyerName(trade)} />
                <SummaryItem title="판매자" value={formatSellerName(trade)} />
                <SummaryItem
                  title="매칭 ID"
                  value={
                    getPositiveInteger(trade.matchId) === null
                      ? "-"
                      : `#${getPositiveInteger(trade.matchId)}`
                  }
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-white/80 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                <SummaryItem
                  title="거래 상태"
                  value={getTradeStatusLabelForViewer(trade, currentUserId)}
                />
                <SummaryItem
                  title="에스크로 상태"
                  value={getEscrowStatusLabel(trade.escrowStatus)}
                />
                <SummaryItem
                  title="거래 타입"
                  value={getTradeTypeLabel(trade.tradeType)}
                />
                <SummaryItem
                  title="에스크로 만료"
                  value={
                    trade.escrowExpiresAt
                      ? getDisplayDate(trade.escrowExpiresAt)
                      : "-"
                  }
                />
                <SummaryItem title="생성일" value={getDisplayDate(trade.createdAt)} />
                <SummaryItem title="수정일" value={getDisplayDate(trade.updatedAt)} />
                <SummaryItem
                  title="현재 사용자"
                  value={getCurrentUserDisplayName(trade, currentUserId)}
                />
              </div>
            </section>

            <aside className="space-y-5">
              {terminalTradeMessage && (isBuyer || isSeller) ? (
                <TradeActionNotice
                  title="거래 상태"
                  description={`${terminalTradeMessage} 더 이상 진행할 액션이 없습니다.`}
                />
              ) : null}

              {!terminalTradeMessage && shouldShowBuyerInProgressNotice ? (
                <TradeActionNotice
                  title="작업 진행 중입니다"
                  description="판매자가 결과물을 제출하면 구매 확정 또는 분쟁 신청을 선택할 수 있습니다."
                />
              ) : null}

              {!terminalTradeMessage && shouldShowSwapAwaitingPartnerNotice ? (
                <TradeActionNotice
                  title={getPeerConfirmationNoticeTitle(trade, currentUserId)}
                  description={
                    isBuyer
                      ? "결과물 확인과 구매 확정을 완료했습니다. 상대방도 자신의 거래를 확정하면 재능 교환 거래가 완료됩니다."
                      : "상대방이 구매 확정을 완료했습니다. 내 거래 확인이 끝나면 재능 교환 거래가 완료됩니다."
                  }
                />
              ) : null}

              {!terminalTradeMessage && shouldShowPartnerConfirmedNotice ? (
                <TradeActionNotice
                  title="상대방 구매 확정 완료"
                  description="상대방이 자신의 거래에서 구매 확정을 완료했습니다. 내가 받을 결과물을 확인하고 구매 확정을 누르면 재능 교환 거래가 완료됩니다."
                />
              ) : null}

              {!terminalTradeMessage && canCancelTrade ? (
                <section className={sideCardClassName}>
                  <p className="font-black text-zinc-950">거래 취소</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    작업 진행 중인 거래만 참여자가 취소할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleCancelTrade}
                    className="mt-5 h-11 w-full cursor-pointer rounded-lg border border-rose-200 bg-white px-4 text-sm font-black text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    거래 취소
                  </button>
                </section>
              ) : null}

              {!terminalTradeMessage && shouldShowPartnerSubmittedNotice ? (
                <TradeActionNotice
                  title="상대방 제출 완료"
                  description="상대방이 결과물을 제출했습니다. 결과물을 확인한 뒤 구매 확정 또는 분쟁 신청을 선택해 주세요."
                />
              ) : null}

              {!terminalTradeMessage && canReviewResult ? (
                <section className={sideCardClassName}>
                  <p className="font-black text-zinc-950">구매자 액션</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    결과물을 확인한 뒤 구매 확정 또는 분쟁 신청을 선택할 수
                    있습니다.
                  </p>
                  <div className="mt-5 grid gap-2">
                    <button
                      type="button"
                      disabled={isActionLoading || isSubmissionLoading}
                      onClick={handleLoadSubmission}
                      className="h-11 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmissionLoading ? "조회 중" : "결과물 다시 조회"}
                    </button>
                    <button
                      type="button"
                      disabled={isActionLoading || trade.tradeStatus !== "UNDER_REVIEW"}
                      onClick={handleConfirmTrade}
                      className="h-11 cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] px-4 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                    >
                      구매 확정
                    </button>
                    <button
                      type="button"
                      disabled={isActionLoading || !canDisputeTrade}
                      onClick={openDisputeDialog}
                      className="h-11 cursor-pointer rounded-lg border border-amber-200 bg-white px-4 text-sm font-black text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      분쟁 신청
                    </button>
                  </div>
                </section>
              ) : null}

              {!terminalTradeMessage && canSubmitResult ? (
                <section className={sideCardClassName}>
                  <p className="font-black text-zinc-950">결과물 제출</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    파일을 선택하면 presigned URL로 업로드한 뒤 결과물을
                    제출합니다.
                  </p>
                  <form onSubmit={handleSubmitResult} className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold text-zinc-800">
                      결과물 파일
                      <input
                        key={submissionFileInputKey}
                        type="file"
                        onChange={handleSubmissionFileChange}
                        className="mt-2 block w-full text-sm font-semibold text-zinc-700 file:mr-4 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#8c5bff] file:px-4 file:text-sm file:font-black file:text-white"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-zinc-800">
                      설명
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={200}
                        rows={4}
                        className={`${inputClassName} mt-2 min-h-24 resize-none`}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        isActionLoading ||
                        selectedFile === null ||
                        description.trim().length === 0
                      }
                      className="h-11 w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] px-4 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                    >
                      {isActionLoading ? "업로드 중" : "결과물 제출"}
                    </button>
                  </form>
                </section>
              ) : null}

              {!terminalTradeMessage && shouldShowSellerReviewNotice ? (
                <TradeActionNotice
                  title="결과물 검토 중입니다"
                  description="결과물이 제출되었습니다. 구매자 확인을 기다리는 중입니다."
                />
              ) : null}

              {!isBuyer && !isSeller ? (
                <section className={sideCardClassName}>
                  <p className="font-black text-zinc-950">권한 안내</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    이 거래의 구매자 또는 판매자만 거래 액션을 사용할 수
                    있습니다.
                  </p>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}

        {shouldShowSubmissionSection ? (
          <section className="relative mx-auto mt-6 w-full max-w-[1180px] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/90 p-5 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:p-8">
            <div
              className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
              aria-hidden="true"
            />
            <p className="font-black text-zinc-950">결과물 정보</p>

            {isSubmissionLoading ? (
              <div className="mt-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-6 text-center text-sm font-semibold text-zinc-600">
                결과물을 불러오는 중입니다.
              </div>
            ) : submission ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                  <SummaryItem
                    title="제출 ID"
                    value={formatOptionalEntityId("제출", submission.id)}
                  />
                  <SummaryItem
                    title="에스크로 ID"
                    value={formatOptionalEntityId("에스크로", submission.escrowId)}
                  />
                  <SummaryItem
                    title="제출일"
                    value={getDisplayDate(submission.submittedAt)}
                  />
                  <SummaryItem
                    title="설명"
                    value={getNonEmptyText(submission.description) ?? "-"}
                  />
                </div>
                {getNonEmptyText(submission.fileUrl) ? (
                  <div className="mt-5 space-y-4">
                    {getImagePreviewContentType(submission.fileUrl) ? (
                      <div className="overflow-hidden rounded-lg border border-[#eee8ff] bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getNonEmptyText(submission.fileUrl) ?? undefined}
                          alt="제출된 결과물 미리보기"
                          className="max-h-[520px] w-full object-contain"
                        />
                      </div>
                    ) : null}
                    <a
                      href={getNonEmptyText(submission.fileUrl) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center rounded-lg border border-[#ded6ff] bg-white px-5 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
                    >
                      결과물 파일 열기
                    </a>
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg border border-[#eee8ff] bg-white px-4 py-3 text-sm font-semibold text-zinc-600">
                    결과물 파일 정보를 확인할 수 없습니다.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-5 text-sm font-semibold text-zinc-600">
                {submissionMessage ?? "아직 제출된 결과물이 없습니다."}
              </p>
            )}
          </section>
        ) : null}

        {confirmDialog ? (
          <ConfirmActionDialog
            title={confirmDialog.title}
            description={confirmDialog.description}
            confirmLabel={confirmDialog.confirmLabel}
            tone={confirmDialog.tone}
            isSubmitting={isActionLoading}
            onClose={closeConfirmDialog}
            onConfirm={executeConfirmDialogAction}
          />
        ) : null}

        {trade && isDisputeDialogOpen ? (
          <DisputeRequestDialog
            category={disputeCategory}
            title={disputeTitle}
            content={disputeContent}
            errorMessage={disputeReasonError}
            isSubmitting={isActionLoading}
            tradeTitle={formatTradeTitle(trade)}
            onChangeCategory={(value) => {
              setDisputeCategory(value);
              if (disputeReasonError) {
                setDisputeReasonError("");
              }
            }}
            onChangeTitle={(value) => {
              setDisputeTitle(value);
              if (disputeReasonError) {
                setDisputeReasonError("");
              }
            }}
            onChangeContent={(value) => {
              setDisputeContent(value);
              if (disputeReasonError) {
                setDisputeReasonError("");
              }
            }}
            onClose={closeDisputeDialog}
            onSubmit={handleDisputeTrade}
          />
        ) : null}
      </div>
    </main >
  );
}


function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  tone,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "primary" | "danger";
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const confirmButtonClassName =
    tone === "danger"
      ? "h-12 rounded-xl border border-rose-200 bg-white text-sm font-black text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      : "h-12 rounded-xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_48%,#79e4dd_100%)] text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-action-confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6 backdrop-blur-sm"
    >
      <section className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#ded6ff] bg-white/95 p-6 shadow-[0_28px_80px_rgba(80,60,160,0.24)] sm:p-7">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
          aria-hidden="true"
        />

        <h2
          id="trade-action-confirm-dialog-title"
          className="text-xl font-black text-zinc-950"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
          {description}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-12 rounded-xl border border-zinc-300 bg-white text-sm font-black text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className={confirmButtonClassName}
          >
            {isSubmitting ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function DisputeRequestDialog({
  category,
  title,
  content,
  errorMessage,
  isSubmitting,
  tradeTitle,
  onChangeCategory,
  onChangeTitle,
  onChangeContent,
  onClose,
  onSubmit,
}: {
  category: ReportReason | "";
  title: string;
  content: string;
  errorMessage: string;
  isSubmitting: boolean;
  tradeTitle: string;
  onChangeCategory: (category: ReportReason | "") => void;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const titleLength = title.length;
  const contentLength = content.length;
  const isTitleOverLimit = titleLength > DISPUTE_TITLE_MAX_LENGTH;
  const isContentOverLimit = contentLength > DISPUTE_CONTENT_MAX_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-request-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-[#ded6ff] bg-white/95 p-6 shadow-[0_28px_80px_rgba(80,60,160,0.24)] sm:p-7"
      >
        <div
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
          aria-hidden="true"
        />

        <h2
          id="dispute-request-dialog-title"
          className="text-xl font-black text-zinc-950"
        >
          분쟁 신청
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
          신고 항목, 제목, 내용을 입력해 주세요. 신청 후 관리자 검토가
          끝날 때까지 에스크로가 동결됩니다.
        </p>
        <p className="mt-3 rounded-2xl border border-[#eee8ff] bg-[#fbf9ff] px-4 py-3 text-sm font-bold text-zinc-700">
          대상 거래: {tradeTitle}
        </p>

        <div className="mt-5">
          <p className="mb-2 text-sm font-black text-zinc-900">신고 항목</p>
          <Listbox
            label="신고 항목"
            value={category}
            options={DISPUTE_REASON_LISTBOX_OPTIONS}
            onChange={onChangeCategory}
            placeholder="신고 항목을 선택해 주세요"
            className="mt-0"
            placement="bottom"
          />
          {!category ? (
            <p className="mt-1.5 text-xs font-semibold text-zinc-500">
              분쟁 신청 전에 항목을 선택해 주세요.
            </p>
          ) : null}
        </div>

        <label className="mt-4 block text-sm font-black text-zinc-900">
          제목
          <input
            type="text"
            value={title}
            onChange={(event) => onChangeTitle(event.target.value)}
            maxLength={DISPUTE_TITLE_MAX_LENGTH}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-2xl border border-[#d9ccff] bg-white px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            placeholder="예: 제출 결과물 파일 확인 불가"
          />
        </label>
        <div className="mt-1.5 flex justify-end">
          <span
            className={`text-xs font-semibold ${isTitleOverLimit ? "text-red-600" : "text-zinc-500"
              }`}
          >
            {titleLength.toLocaleString("en-US")}/{DISPUTE_TITLE_MAX_LENGTH}
          </span>
        </div>

        <label className="mt-4 block text-sm font-black text-zinc-900">
          내용
          <textarea
            value={content}
            onChange={(event) => onChangeContent(event.target.value)}
            rows={6}
            maxLength={DISPUTE_CONTENT_MAX_LENGTH}
            disabled={isSubmitting}
            className="mt-2 w-full resize-none rounded-2xl border border-[#d9ccff] bg-white px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            placeholder="예: 스팸 같아요. 결과물이 약속한 내용과 다르거나 파일 확인이 어렵습니다."
          />
        </label>

        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {errorMessage ? (
            <p className="min-w-0 flex-1 text-xs font-semibold text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <span
            className={`ml-auto shrink-0 text-xs font-semibold ${isContentOverLimit ? "text-red-600" : "text-zinc-500"
              }`}
          >
            {contentLength.toLocaleString("en-US")}/{DISPUTE_CONTENT_MAX_LENGTH}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-12 rounded-xl border border-zinc-300 bg-white text-sm font-black text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_48%,#79e4dd_100%)] text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "신청 중..." : "분쟁 신청"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SummaryItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-white/80 p-3">
      <p className="text-xs font-black text-[#8c5bff]">{title}</p>
      <p className="mt-1 break-words text-base font-black text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function TradeActionNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={sideCardClassName}>
      <p className="font-black text-zinc-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </section>
  );
}
