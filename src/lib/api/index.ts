import { apiFetch } from "./client";
import {
  clearAuthStorage,
  clearStoredLastTalentId,
  getStoredUserId,
} from "@/lib/auth";
import type {
  AdminActionLogRes,
  AdminActionLogSearchParams,
  AdminDisputeRes,
  AdminDashboardSummaryRes,
  AdminPageRes,
  AdminReportResolveReq,
  AdminReportSearchParams,
  AdminTalentReportRes,
  AdminTalentRes,
  AdminTalentSearchParams,
  AdminTalentStatusUpdateReq,
  AdminTradeRes,
  AdminTradeSearchParams,
  AdminUserRes,
  AdminUserSearchParams,
  AdminUserStatusUpdateReq,
  CategoryRes,
  ChatMessageCreateReq,
  ChatMessageRes,
  ChatRoomCreateReq,
  ChatRoomListItem,
  ChatRoomRes,
  CreditBalanceRes,
  CreditTransactionRes,
  CreditTransactionSearchParams,
  CursorPageRes,
  EmailSendReq,
  EmailVerificationReq,
  MatchProposalCreateReq,
  MatchProposalReceivedRes,
  MatchProposalRes,
  MatchProposalSentRes,
  MatchProposalStatus,
  MatchRecommendationDetailRes,
  MatchRecommendationRes,
  MyProfileDetailRes,
  ProfileUpdateReq,
  ProfileUpdateRes,
  TalentAttachmentPresignedUrlReq,
  TalentAttachmentPresignedUrlRes,
  TalentAttachmentRes,
  TalentAttachmentSaveReq,
  TalentCreateReq,
  TalentCreateRes,
  TalentDetailRes,
  TalentListRes,
  TalentReportReq,
  TalentReportRes,
  TalentSortType,
  TalentUpdateRes,
  TradeDisputeReq,
  TradeListRes,
  TradeRes,
  TradeSubmissionPresignedUrlReq,
  TradeSubmissionPresignedUrlRes,
  TradeSubmissionReq,
  TradeSubmissionRes,
  TradeStatus,
  UserCheckNicknameReq,
  UserCheckNicknameRes,
  UserLoginReq,
  UserLoginRes,
  UserSignupReq,
  UserSignupRes,
} from "./types";

export * from "./client";
export * from "./types";


function getUploadContentType(file: File): string {
  const explicitType = file.type?.trim();

  if (explicitType) {
    return explicitType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

interface CursorParams {
  cursor?: number | null;
  size?: number;
}

interface TalentSearchParams extends CursorParams {
  categoryId?: number;
  minCredit?: number;
  maxCredit?: number;
  minRating?: number;
  completedOnly?: boolean;
  sort?: TalentSortType;
}

interface TalentListParams extends CursorParams {
  sort?: TalentSortType;
}

interface TradeListParams extends CursorParams {
  status?: TradeStatus;
}

interface MatchRecommendationParams {
  talentId: number;
}

interface MatchRecommendationDetailParams {
  providerTalentId: number;
  requesterTalentId: number;
}

export const authApi = {
  login(payload: UserLoginReq): Promise<UserLoginRes> {
    return apiFetch<UserLoginRes>("/api/v1/auth/login", {
      method: "POST",
      body: payload,
    });
  },

  signup(payload: UserSignupReq): Promise<UserSignupRes> {
    return apiFetch<UserSignupRes>("/api/v1/auth/signup", {
      method: "POST",
      body: payload,
    });
  },

  reissue(): Promise<UserLoginRes> {
    return apiFetch<UserLoginRes>("/api/v1/auth/reissue", {
      method: "POST",
    });
  },

  sendEmail(payload: EmailSendReq): Promise<void> {
    return apiFetch<void>("/api/v1/auth/email-send", {
      method: "POST",
      body: payload,
    });
  },

  verifyEmail(payload: EmailVerificationReq): Promise<void> {
    return apiFetch<void>("/api/v1/auth/email-verification", {
      method: "POST",
      body: payload,
    });
  },

  checkNickname(
    payload: UserCheckNicknameReq,
  ): Promise<UserCheckNicknameRes> {
    return apiFetch<UserCheckNicknameRes>("/api/v1/auth/check-nickname", {
      method: "POST",
      body: payload,
    });
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<void>("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      clearAuthStorage();
    }
  },

  async deleteMe(): Promise<void> {
    await apiFetch<void>("/api/v1/users/me", {
      method: "DELETE",
    });
    clearAuthStorage();
  },
};

export const profileApi = {
  getMe(): Promise<MyProfileDetailRes> {
    return apiFetch<MyProfileDetailRes>("/api/v1/profiles/me");
  },

  update(payload: ProfileUpdateReq): Promise<ProfileUpdateRes> {
    return apiFetch<ProfileUpdateRes>("/api/v1/profiles", {
      method: "PATCH",
      body: payload,
    });
  },
};

export const categoryApi = {
  getList(): Promise<CategoryRes[]> {
    return apiFetch<CategoryRes[]>("/api/v1/categories");
  },
};

export const talentApi = {
  getList(params: TalentListParams = {}): Promise<CursorPageRes<TalentListRes>> {
    return apiFetch<CursorPageRes<TalentListRes>>("/api/v1/talents", {
      query: params,
    });
  },

  async getMyList(
    params: TalentListParams = {},
  ): Promise<CursorPageRes<TalentListRes>> {
    const content = await apiFetch<TalentListRes[]>("/api/v1/talents/me");
    const pageSize = params.size;

    return {
      content:
        typeof pageSize === "number" && pageSize > 0
          ? content.slice(0, pageSize)
          : content,
      hasNext: false,
      nextCursor: null,
    };
  },

  search(params: TalentSearchParams = {}): Promise<CursorPageRes<TalentListRes>> {
    return apiFetch<CursorPageRes<TalentListRes>>("/api/v1/talents/search", {
      query: params,
    });
  },

  getDetail(talentId: number): Promise<TalentDetailRes> {
    return apiFetch<TalentDetailRes>(`/api/v1/talents/${talentId}`);
  },

  create(payload: TalentCreateReq): Promise<TalentCreateRes> {
    return apiFetch<TalentCreateRes>("/api/v1/talents", {
      method: "POST",
      body: payload,
    });
  },

  update(talentId: number, payload: TalentCreateReq): Promise<TalentUpdateRes> {
    return apiFetch<TalentUpdateRes>(`/api/v1/talents/${talentId}`, {
      method: "PUT",
      body: payload,
    });
  },

  report(
    talentId: number,
    payload: TalentReportReq,
  ): Promise<TalentReportRes> {
    return apiFetch<TalentReportRes>(`/api/v1/talents/${talentId}/reports`, {
      method: "POST",
      body: payload,
    });
  },

  async delete(talentId: number): Promise<void> {
    await apiFetch<void>(`/api/v1/talents/${talentId}`, {
      method: "DELETE",
    });

    const userId = getStoredUserId();

    if (userId !== null) {
      clearStoredLastTalentId(userId, talentId);
    }
  },

  createAttachmentPresignedUrl(
    talentId: number,
    payload: TalentAttachmentPresignedUrlReq,
  ): Promise<TalentAttachmentPresignedUrlRes> {
    return apiFetch<TalentAttachmentPresignedUrlRes>(
      `/api/v1/talents/${talentId}/attachments/presigned-url`,
      {
        method: "POST",
        body: payload,
      },
    );
  },

  async uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error("파일 업로드에 실패했습니다.");
    }
  },

  saveAttachment(
    talentId: number,
    payload: TalentAttachmentSaveReq,
  ): Promise<TalentAttachmentRes> {
    return apiFetch<TalentAttachmentRes>(
      `/api/v1/talents/${talentId}/attachments`,
      {
        method: "POST",
        body: payload,
      },
    );
  },

  getAttachments(talentId: number): Promise<TalentAttachmentRes[]> {
    return apiFetch<TalentAttachmentRes[]>(
      `/api/v1/talents/${talentId}/attachments`,
    );
  },

  deleteAttachment(
    talentId: number,
    attachmentId: number,
  ): Promise<void> {
    return apiFetch<void>(
      `/api/v1/talents/${talentId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
      },
    );
  },
};

export const matchApi = {
  getRecommendations(
    params: MatchRecommendationParams,
  ): Promise<MatchRecommendationRes[]> {
    return apiFetch<MatchRecommendationRes[]>(
      "/api/v1/match-recommendations",
      {
        query: {
          talentId: params.talentId,
        },
      },
    );
  },

  getRecommendationDetail({
    providerTalentId,
    requesterTalentId,
  }: MatchRecommendationDetailParams): Promise<MatchRecommendationDetailRes> {
    return apiFetch<MatchRecommendationDetailRes>(
      `/api/v1/match-recommendations/${providerTalentId}`,
      {
        query: {
          requesterTalentId,
        },
      },
    );
  },

  createProposal(payload: MatchProposalCreateReq): Promise<MatchProposalRes> {
    return apiFetch<MatchProposalRes>("/api/v1/match-proposals", {
      method: "POST",
      body: payload,
    });
  },

  getReceivedProposals(
    status?: MatchProposalStatus,
  ): Promise<MatchProposalReceivedRes[]> {
    return apiFetch<MatchProposalReceivedRes[]>(
      "/api/v1/match-proposals/received",
      {
        query: status ? { status } : undefined,
      },
    );
  },

  getSentProposals(
    status?: MatchProposalStatus,
  ): Promise<MatchProposalSentRes[]> {
    return apiFetch<MatchProposalSentRes[]>(
      "/api/v1/match-proposals/sent",
      {
        query: status ? { status } : undefined,
      },
    );
  },

  acceptProposal(proposalId: number): Promise<MatchProposalRes> {
    return apiFetch<MatchProposalRes>(
      `/api/v1/match-proposals/${proposalId}/accept`,
      {
        method: "PATCH",
      },
    );
  },

  rejectProposal(proposalId: number): Promise<MatchProposalRes> {
    return apiFetch<MatchProposalRes>(
      `/api/v1/match-proposals/${proposalId}/reject`,
      {
        method: "PATCH",
      },
    );
  },
};

export const chatApi = {
  getMyChatRooms(
    params: CursorParams = {},
  ): Promise<CursorPageRes<ChatRoomListItem>> {
    return apiFetch<CursorPageRes<ChatRoomListItem>>("/api/v1/chat-rooms", {
      query: params,
    });
  },

  createRoom(payload: ChatRoomCreateReq): Promise<ChatRoomRes> {
    return apiFetch<ChatRoomRes>("/api/v1/chat-rooms", {
      method: "POST",
      body: payload,
    });
  },

  getRoom(chatRoomId: number): Promise<ChatRoomRes> {
    return apiFetch<ChatRoomRes>(`/api/v1/chat-rooms/${chatRoomId}`);
  },

  getMessages(chatRoomId: number): Promise<CursorPageRes<ChatMessageRes>> {
    return apiFetch<CursorPageRes<ChatMessageRes>>(
      `/api/v1/chat-rooms/${chatRoomId}/messages`,
    );
  },

  sendMessage(
    chatRoomId: number,
    payload: ChatMessageCreateReq,
  ): Promise<ChatMessageRes> {
    return apiFetch<ChatMessageRes>(
      `/api/v1/chat-rooms/${chatRoomId}/messages`,
      {
        method: "POST",
        body: payload,
      },
    );
  },
};

export const tradeApi = {
  getList(params: TradeListParams = {}): Promise<CursorPageRes<TradeListRes>> {
    return apiFetch<CursorPageRes<TradeListRes>>("/api/v1/trade", {
      query: params,
    });
  },

  getDetail(tradeId: number): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}`);
  },

  cancel(tradeId: number): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}/cancel`, {
      method: "PATCH",
    });
  },

  dispute(tradeId: number, payload: TradeDisputeReq): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}/dispute`, {
      method: "PATCH",
      body: payload,
    });
  },

  confirm(tradeId: number): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}/confirm`, {
      method: "PATCH",
    });
  },

  getSubmission(tradeId: number): Promise<TradeSubmissionRes> {
    return apiFetch<TradeSubmissionRes>(
      `/api/v1/trade/${tradeId}/submission`,
    );
  },

  createSubmissionPresignedUrl(
    tradeId: number,
    payload: TradeSubmissionPresignedUrlReq,
  ): Promise<TradeSubmissionPresignedUrlRes> {
    return apiFetch<TradeSubmissionPresignedUrlRes>(
      `/api/v1/trade/${tradeId}/submission/presigned-url`,
      {
        method: "POST",
        body: payload,
      },
    );
  },

  async uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": getUploadContentType(file),
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error("파일 업로드에 실패했습니다.");
    }
  },

  submitResult(
    tradeId: number,
    payload: TradeSubmissionReq,
  ): Promise<TradeSubmissionRes> {
    return apiFetch<TradeSubmissionRes>(
      `/api/v1/trade/${tradeId}/submission`,
      {
        method: "POST",
        body: payload,
      },
    );
  },
};

export const adminApi = {
  getDashboardSummary(): Promise<AdminDashboardSummaryRes> {
    return apiFetch<AdminDashboardSummaryRes>("/api/v1/admin/dashboard");
  },

  getUsers(
    params: AdminUserSearchParams = {},
  ): Promise<AdminPageRes<AdminUserRes>> {
    return apiFetch<AdminPageRes<AdminUserRes>>("/api/v1/admin/users", {
      query: params,
    });
  },

  getUser(userId: number): Promise<AdminUserRes> {
    return apiFetch<AdminUserRes>(`/api/v1/admin/users/${userId}`);
  },

  updateUserStatus(
    userId: number,
    payload: AdminUserStatusUpdateReq,
  ): Promise<AdminUserRes> {
    return apiFetch<AdminUserRes>(`/api/v1/admin/users/${userId}/status`, {
      method: "PATCH",
      body: payload,
    });
  },

  getTalents(
    params: AdminTalentSearchParams = {},
  ): Promise<AdminPageRes<AdminTalentRes>> {
    return apiFetch<AdminPageRes<AdminTalentRes>>("/api/v1/admin/talents", {
      query: params,
    });
  },

  getTalent(talentId: number): Promise<AdminTalentRes> {
    return apiFetch<AdminTalentRes>(`/api/v1/admin/talents/${talentId}`);
  },

  updateTalentStatus(
    talentId: number,
    payload: AdminTalentStatusUpdateReq,
  ): Promise<AdminTalentRes> {
    return apiFetch<AdminTalentRes>(`/api/v1/admin/talents/${talentId}/status`, {
      method: "PATCH",
      body: payload,
    });
  },

  getReports(
    params: AdminReportSearchParams = {},
  ): Promise<AdminPageRes<AdminTalentReportRes>> {
    return apiFetch<AdminPageRes<AdminTalentReportRes>>("/api/v1/admin/reports", {
      query: params,
    });
  },

  getReport(reportId: number): Promise<AdminTalentReportRes> {
    return apiFetch<AdminTalentReportRes>(`/api/v1/admin/reports/${reportId}`);
  },

  resolveReport(
    reportId: number,
    payload: AdminReportResolveReq,
  ): Promise<AdminTalentReportRes> {
    return apiFetch<AdminTalentReportRes>(
      `/api/v1/admin/reports/${reportId}/resolve`,
      {
        method: "PATCH",
        body: payload,
      },
    );
  },

  getTrades(
    params: AdminTradeSearchParams = {},
  ): Promise<AdminPageRes<AdminTradeRes>> {
    return apiFetch<AdminPageRes<AdminTradeRes>>("/api/v1/admin/trades", {
      query: params,
    });
  },

  getActionLogs(
    params: AdminActionLogSearchParams = {},
  ): Promise<AdminPageRes<AdminActionLogRes>> {
    return apiFetch<AdminPageRes<AdminActionLogRes>>(
      "/api/v1/admin/action-logs",
      {
        query: params,
      },
    );
  },

  getDisputes(): Promise<AdminDisputeRes[]> {
    return apiFetch<AdminDisputeRes[]>("/api/v1/admin/trade/disputes");
  },

  resolveDispute(
    tradeId: number,
    verdict: "BUYER_WIN" | "SELLER_WIN",
  ): Promise<TradeRes> {
    return apiFetch<TradeRes>(
      `/api/v1/admin/trade/${tradeId}/dispute/resolve`,
      {
        method: "PATCH",
        body: { verdict },
      },
    );
  },
};

export const creditApi = {
  getBalance(): Promise<CreditBalanceRes> {
    return apiFetch<CreditBalanceRes>("/api/v1/credit/balance");
  },

  getTransactions(
    params: CreditTransactionSearchParams = {},
  ): Promise<CursorPageRes<CreditTransactionRes>> {
    return apiFetch<CursorPageRes<CreditTransactionRes>>(
      "/api/v1/credit/transactions",
      {
        query: params,
      },
    );
  },
};
