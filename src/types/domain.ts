// ─────────────────────────────────────────────
// 공통 Union Types
// ─────────────────────────────────────────────

/** 직무 유형 */
export type JobRole =
  | "JUNIOR_DEVELOPER"
  | "JUNIOR_DESIGNER"
  | "MARKETER"
  | "PLANNER"
  | "VIDEO_EDITOR"
  | "PORTFOLIO_PREPARER"
  | "OTHER";

/** 협업 방식 */
export type CollaborationStyle = "ONLINE" | "OFFLINE" | "BOTH";

/** 재능 제공 방식 */
export type DeliveryMethod = "ONLINE" | "OFFLINE" | "BOTH";

/** 거래 상태 */
export type ExchangeStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "REJECTED"
  | "DISPUTED";

/** 크레딧 거래 타입 */
export type CreditTransactionType =
  | "EARN"
  | "SPEND"
  | "ESCROW_HOLD"
  | "ESCROW_RELEASE"
  | "REFUND"
  | "CHARGE";

/** 에스크로 상태 */
export type EscrowStatus = "HELD" | "RELEASED" | "REFUNDED" | "DISPUTED";

/** 알림 타입 */
export type NotificationType =
  | "MATCHING"
  | "EXCHANGE_REQUEST"
  | "EXCHANGE_ACCEPTED"
  | "EXCHANGE_COMPLETED"
  | "REVIEW_RECEIVED"
  | "CREDIT_UPDATED"
  | "DISPUTE_UPDATED";

// ─────────────────────────────────────────────
// 사용자 & 프로필
// ─────────────────────────────────────────────

/** 플랫폼 회원 계정 */
export interface User {
  id: number;
  email: string;
  nickname: string;
  jobRole: JobRole;
  createdAt: string;
  updatedAt: string;
}

/** 사용자 프로필 (재능 태그, 협업 정보 포함) */
export interface Profile {
  id: number;
  userId: number;
  nickname: string;
  bio: string;
  profileImageUrl: string | null;
  portfolioUrl: string | null;
  offeredTalentTags: string[];
  wantedTalentTags: string[];
  mainCategoryId: number;
  availableTimeSlots: string[];
  collaborationStyle: CollaborationStyle;
  trustScore: TrustScore;
  createdAt: string;
  updatedAt: string;
}

/** 신뢰 점수 (평점, 완료율, 응답률 기반) */
export interface TrustScore {
  userId: number;
  averageRating: number;
  completionRate: number;
  responseRate: number;
  completedExchangeCount: number;
  totalScore: number;
}

// ─────────────────────────────────────────────
// 재능
// ─────────────────────────────────────────────

/** 재능 카테고리 */
export interface TalentCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
}

/** 재능 게시글 */
export interface Talent {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  description: string;
  estimatedDuration: string;
  requiredCredits: number;
  portfolioUrl: string | null;
  tags: string[];
  deliveryMethod: DeliveryMethod;
  averageRating: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// 크레딧
// ─────────────────────────────────────────────

/** 크레딧 지갑 */
export interface CreditWallet {
  id: number;
  userId: number;
  availableCredits: number;
  escrowCredits: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
}

/** 크레딧 거래 내역 */
export interface CreditTransaction {
  id: number;
  walletId: number;
  userId: number;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  exchangeId: number | null;
  createdAt: string;
}

// ─────────────────────────────────────────────
// 거래 & 에스크로
// ─────────────────────────────────────────────

/** 재능 교환 거래 요청 */
export interface ExchangeRequest {
  id: number;
  talentId: number;
  requesterId: number;
  providerId: number;
  status: ExchangeStatus;
  offeredCredits: number;
  message: string | null;
  escrowId: number | null;
  submittedResultUrl: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 에스크로 (거래 중 크레딧 예치) */
export interface Escrow {
  id: number;
  exchangeId: number;
  payerId: number;
  payeeId: number;
  amount: number;
  status: EscrowStatus;
  heldAt: string;
  releasedAt: string | null;
}

// ─────────────────────────────────────────────
// 리뷰
// ─────────────────────────────────────────────

/** 거래 완료 후 작성하는 양방향 리뷰 */
export interface Review {
  id: number;
  exchangeId: number;
  reviewerId: number;
  revieweeId: number;
  talentId: number;
  rating: number;
  responseSpeedRating: number;
  resultSatisfactionRating: number;
  collaborationAttitudeRating: number;
  content: string;
  wouldCollaborateAgain: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
// 매칭 & 알림 (Nice-to-have)
// ─────────────────────────────────────────────

/** 자동 매칭 추천 */
export interface MatchingRecommendation {
  id: number;
  userId: number;
  targetUserId: number;
  matchScore: number;
  reasons: string[];
  offeredTalentTags: string[];
  wantedTalentTags: string[];
  trustScore: TrustScore;
  completedExchangeCount: number;
}

/** 알림 */
export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────
// 채팅
// ─────────────────────────────────────────────

/** 거래나 매칭 이후 대화를 나누는 채팅방 */
export interface ChatRoom {
  id: number;
  participantUserIds: number[];
  relatedExchangeId: number | null;
  relatedTalentId: number | null;
  title: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

/** 채팅방에 속한 메시지 */
export interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  replyToMessageId?: number | null;
  isRead: boolean;
  isDeleted?: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}
