export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

export interface CursorPageRes<T> {
  content: T[];
  hasNext: boolean;
  nextCursor: number | null;
}

export interface CategoryRes {
  categoryId: number;
  name: string;
  sortOrder: number;
}

export type UserStatus = "ACTIVE" | "DORMANT" | "SUSPENDED" | "WITHDRAWN";

export type UserRole = "USER" | "ADMIN";

export interface UserLoginReq {
  email: string;
  password: string;
}

export interface UserLoginRes {
  accessToken: string;
  // 현재 백엔드 로그인 응답에는 아래 필드들이 없으며, userId는 JWT sub에서 추출한다.
  userId?: number;
  id?: number;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export interface UserSignupReq {
  email: string;
  password: string;
  nickname: string;
  profileImageUrl?: string | null;
  introduction: string;
}

export interface UserSignupRes {
  id: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  introduction: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
}

export type TalentStatus = "ACTIVE" | "CLOSED";

export interface AuthorInfo {
  id?: number;
  userId?: number;
  authorId?: number;
  providerId?: number;
  sellerId?: number;
  nickname: string;
  profileImageUrl: string | null;
  introduction: string;
  trustScore: number;
}

export interface TalentListRes {
  talentId: number;
  categoryName: string;
  title: string;
  creditPrice: number;
  estimatedHours: number;
  avgRating: number;
  completeCount: number;
  viewCount: number;
  createdAt: string;
}

export interface TalentDetailRes {
  id: number;
  talentId?: number;
  userId?: number;
  authorId?: number;
  providerId?: number;
  sellerId?: number;
  categoryId: number;
  categoryName: string;
  title: string;
  content: string;
  estimatedHours: number;
  creditPrice: number;
  status: TalentStatus;
  viewCount: number;
  completeCount: number;
  avgRating: number;
  createdAt: string;
  updatedAt: string;
  author: AuthorInfo;
}

export interface TalentCreateReq {
  categoryId: number;
  title: string;
  content: string;
  estimatedHours: number;
  creditPrice: number;
}

export interface TalentCreateRes {
  talentId?: number;
  id?: number;
}

export interface TalentAttachmentPresignedUrlReq {
  fileName: string;
  contentType: string;
}

export interface TalentAttachmentPresignedUrlRes {
  uploadUrl: string;
  key: string;
}

export interface TalentAttachmentSaveReq {
  url: string;
  description: string | null;
}

export interface TalentAttachmentRes {
  attachmentId: number;
  talentId: number;
  url: string;
  description: string | null;
  createdAt: string;
}

export interface MatchRecommendationRes {
  talentId: number;
  providerId: number;
  categoryId: number;
  categoryName: string;
  title: string;
  content: string;
  creditPrice: number;
  estimatedHours: number;
  avgRating: number;
  completeCount: number;
  proposalRequestEnabled: boolean;
  proposalRequestDisabledReason: string | null;
}

export interface MatchRecommendationDetailRes {
  talentId: number;
  providerId: number;
  categoryId: number;
  categoryName: string;
  title: string;
  content: string;
  creditPrice: number;
  estimatedHours: number;
  avgRating: number;
  completeCount: number;
  viewCount: number;
  nickname: string;
  introduction: string;
  profileImageUrl: string | null;
  trustScore: number;
  proposalRequestEnabled: boolean;
  proposalRequestDisabledReason: string | null;
}

export type MatchProposalStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";

export interface MatchProposalCreateReq {
  requesterTalentId: number | null;
  providerId: number;
  providerTalentId: number;
  requestMessage: string;
}

export interface MatchProposalRes {
  id: number;
  providerTalentId: number;
  requesterTalentId: number | null;
  requesterId: number;
  providerId: number;
  status: MatchProposalStatus;
  requestMessage: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchProposalReceivedRes {
  proposalId: number;
  status: MatchProposalStatus;
  requestMessage: string;
  requesterId: number;
  requesterNickname: string;
  requesterProfileImageUrl: string | null;
  requesterTalentId: number | null;
  requesterTalentTitle: string | null;
  providerId: number;
  providerTalentId: number;
  providerTalentTitle: string;
  createdAt: string;
}

export interface MatchProposalSentRes {
  proposalId: number;
  status: MatchProposalStatus;
  requestMessage: string;
  requesterId: number;
  requesterTalentId: number | null;
  requesterTalentTitle: string | null;
  providerId: number;
  providerNickname: string;
  providerProfileImageUrl: string | null;
  providerTalentId: number;
  providerTalentTitle: string;
  createdAt: string;
}

export type ChatRoomType = "MATCH" | "TRANSACTION";
export type ChatRoomStatus = ChatRoomType;

export type ChatMessageType = "TEXT" | "IMAGE" | "SYSTEM";

export interface ChatRoomCreateReq {
  talentId: number;
  buyerId: number;
}

export interface ChatRoomRes {
  id: number;
  talentId: number;
  buyerId: number;
  sellerId: number;
  tradeId: number | null;
  status: ChatRoomType;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatRoomListItem {
  roomId: number;
  tradeId: number | null;
  talentId: number;
  talentTitle: string | null;
  buyerId: number;
  sellerId: number;
  opponentId: number;
  opponentNickname: string;
  opponentProfileImageUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status: ChatRoomStatus;
  createdAt: string;
}

export interface ChatMessageCreateReq {
  content: string;
}

export interface ChatMessageRes {
  id: number;
  roomId: number;
  senderId: number;
  messageType: ChatMessageType;
  content: string;
  read: boolean;
  createdAt: string;
}

export type TradeType = "SWAP" | "PURCHASE";

export type TradeStatus =
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "CANCELED"
  | "CANCELLED"
  | "DISPUTED";

export type TradeEscrowStatus =
  | "HELD"
  | "RELEASED"
  | "REFUNDED"
  | "FROZEN"
  | "DISPUTED";

export interface TradeRes {
  tradeId: number;
  matchId: number | null;
  talentId: number;
  buyerId: number;
  sellerId: number;
  buyerNickname?: string | null;
  sellerNickname?: string | null;
  buyerProfileImageUrl?: string | null;
  sellerProfileImageUrl?: string | null;
  creditPrice: number;
  tradeType: TradeType;
  tradeStatus: TradeStatus;
  escrowStatus: TradeEscrowStatus;
  escrowExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeSubmissionReq {
  fileKey: string;
  description: string;
}

export interface TradeSubmissionPresignedUrlReq {
  fileName: string;
  contentType: string;
}

export interface TradeSubmissionPresignedUrlRes {
  presignedUrl: string;
  fileKey: string;
}

export interface TradeSubmissionRes {
  id: number;
  escrowId: number;
  fileUrl: string;
  description: string | null;
  submittedAt: string;
}

export interface CreditBalanceRes {
  userId: number;
  balance: number;
  escrowBalance: number;
}

export type CreditTransactionType = string;

export interface CreditTransactionRes {
  transactionId: number;
  relatedTradeId: number | null;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  defaultReason: string;
  detailReason: string | null;
  createdAt: string;
}
