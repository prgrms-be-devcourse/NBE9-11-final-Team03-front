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

export type UserStatus =
  | "ACTIVE"
  | "DORMANT"
  | "SUSPENDED"
  | "WITHDRAWN"
  | "BANNED";

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

export interface UserCheckNicknameReq {
  nickname: string;
}

export interface UserCheckNicknameRes {
  usableNickname: boolean;
}

export interface EmailSendReq {
  email: string;
}

export interface EmailVerificationReq {
  email: string;
  verificationCode: string;
}

export interface ProfileCategoryRes {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface ProfileUpdateReq {
  profileImageUrl?: string | null;
  introduction?: string | null;
  myTalentCategoryIds?: number[] | null;
  wantTalentCategoryIds?: number[] | null;
  portfolioLinkList?: string[] | null;
}

export interface MyProfileDetailRes {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
  introduction: string;
  trustScore: number;
  portfolioLinkList: string[];
  myTalentCategories: ProfileCategoryRes[];
  wantTalentCategories: ProfileCategoryRes[];
  visible: boolean;
}

export interface ProfileUpdateRes extends MyProfileDetailRes {
  createdAt: string;
  updatedAt: string;
}

export type TalentStatus = "ACTIVE" | "CLOSED";

export type TalentSortType = "LATEST" | "RATING" | "POPULAR";

export type ReportReason =
  | "ILLEGAL_OR_CHEATING"
  | "EXTERNAL_CONTACT_OR_AD"
  | "INAPPROPRIATE_CONTENT"
  | "ETC";

export type ReportStatus = "PENDING" | "RESOLVED";

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
  authorId?: number | null;
  categoryName: string;
  title: string;
  nickname?: string | null;
  authorNickname?: string | null;
  sellerNickname?: string | null;
  providerNickname?: string | null;
  userNickname?: string | null;
  author?: AuthorInfo | null;
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

export interface TalentUpdateRes {
  talentId: number;
  categoryId: number;
  title: string;
  content: string;
  estimatedHours: number;
  creditPrice: number;
  status: TalentStatus;
}

export interface TalentReportReq {
  reason: ReportReason;
  description?: string | null;
}

export interface TalentReportRes {
  reportId: number;
  talentId: number;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
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
  nickname?: string | null;
  providerNickname?: string | null;
  sellerNickname?: string | null;
  authorNickname?: string | null;
  userNickname?: string | null;
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
}

export interface ChatRoomRes {
  id: number;
  talentId: number;
  buyerId: number;
  sellerId: number;
  tradeId: number | null;
  tradeGroupId: number | null;
  status: ChatRoomType;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatRoomListItem {
  roomId: number;
  tradeId: number | null;
  tradeGroupId: number | null;
  talentId: number;
  talentTitle: string | null;
  myTalentId?: number | null;
  myTalentTitle?: string | null;
  opponentTalentId?: number | null;
  opponentTalentTitle?: string | null;
  requesterId?: number | null;
  requesterTalentId?: number | null;
  requesterTalentTitle?: string | null;
  providerId?: number | null;
  providerTalentId?: number | null;
  providerTalentTitle?: string | null;
  buyerId: number;
  sellerId: number;
  opponentId: number;
  opponentNickname: string;
  opponentProfileImageUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  roomType: ChatRoomStatus;
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
  | "AWAITING_PARTNER"
  | "COMPLETED"
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
  title?: string | null;
  matchId: number | null;
  tradeGroupId?: number | null;
  talentId: number;
  talentTitle?: string | null;
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

export interface TradeListRes {
  tradeId: number;
  title?: string | null;
  tradeGroupId?: number | null;
  talentId: number;
  talentTitle?: string | null;
  buyerId: number;
  sellerId: number;
  buyerNickname?: string | null;
  sellerNickname?: string | null;
  creditPrice: number;
  tradeType: TradeType;
  tradeStatus: TradeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TradeDisputeReq {
  reason: string;
}

export interface TradeSubmissionReq {
  fileKey: string;
  description: string;
}

export interface TradeSubmissionPresignedUrlReq {
  fileName: string;
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

export type CreditTransactionType =
  | "WELCOME"
  | "PURCHASE_DEBIT"
  | "ESCROW_HOLD"
  | "ESCROW_RELEASE"
  | "REFUND"
  | "CHARGE"
  | "REFERRAL_REWARD"
  | "ADJUSTMENT";

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

export interface CreditTransactionSearchParams {
  cursor?: number | null;
  size?: number;
  type?: CreditTransactionType;
  from?: string;
  to?: string;
}

export interface AdminPageRes<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface AdminDashboardSummaryRes {
  totalUsers: number;
  usersByStatus: Record<string, number>;
  totalTalents: number;
  talentsByStatus: Record<string, number>;
  totalTrades: number;
  tradesByStatus: Record<string, number>;
  totalReports: number;
  reportsByStatus: Record<string, number>;
  totalEscrows: number;
  escrowsByStatus: Record<string, number>;
}

export interface AdminUserSearchParams {
  status?: UserStatus;
  role?: UserRole;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface AdminUserStatusUpdateReq {
  status: Exclude<UserStatus, "WITHDRAWN">;
  reason: string;
}

export interface AdminUserRes {
  userId: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  introduction: string;
  trustScore: number;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTalentSearchParams {
  status?: TalentStatus;
  categoryId?: number;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface AdminTalentStatusUpdateReq {
  status: TalentStatus;
  reason: string;
}

export interface AdminTalentRes {
  talentId: number;
  authorId: number;
  categoryId: number;
  categoryName: string;
  title: string;
  estimatedHours: number;
  creditPrice: number;
  status: TalentStatus;
  viewCount: number;
  completeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportSearchParams {
  status?: ReportStatus;
  reason?: ReportReason;
  page?: number;
  size?: number;
}

export interface AdminReportResolveReq {
  memo: string;
}

export interface AdminTalentReportRes {
  reportId: number;
  talentId: number;
  reporterId: number;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTradeSearchParams {
  status?: TradeStatus;
  buyerId?: number;
  sellerId?: number;
  tradeType?: TradeType;
  page?: number;
  size?: number;
}

export interface AdminTradeRes {
  tradeId: number;
  matchId: number | null;
  tradeGroupId: number | null;
  talentId: number;
  buyerId: number;
  sellerId: number;
  creditPrice: number;
  tradeType: TradeType;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
}

export type AdminActionTargetType = "USER" | "TALENT" | "REPORT";

export type AdminActionType =
  | "USER_STATUS_CHANGED"
  | "TALENT_STATUS_CHANGED"
  | "REPORT_RESOLVED";

export interface AdminActionLogSearchParams {
  adminId?: number;
  targetType?: AdminActionTargetType;
  targetId?: number;
  actionType?: AdminActionType;
  page?: number;
  size?: number;
}

export interface AdminActionLogRes {
  logId: number;
  adminId: number;
  targetType: AdminActionTargetType;
  targetId: number;
  actionType: AdminActionType;
  reason: string | null;
  createdAt: string;
}

export type DisputeVerdict = "BUYER_WIN" | "SELLER_WIN";

export interface AdminDisputeRes {
  tradeId: number;
  matchId: number | null;
  tradeGroupId: number | null;
  talentId: number;
  buyerId: number;
  sellerId: number;
  creditPrice: number;
  tradeType: TradeType;
  tradeStatus: TradeStatus;
  escrowStatus: TradeEscrowStatus;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
}
