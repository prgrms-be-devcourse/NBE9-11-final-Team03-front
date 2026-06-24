import { apiFetch } from "./client";
import {
  clearAuthStorage,
  clearStoredLastTalentId,
  getStoredUserId,
} from "@/lib/auth";
import type {
  CategoryRes,
  ChatMessageCreateReq,
  ChatMessageRes,
  ChatRoomCreateReq,
  ChatRoomListItem,
  ChatRoomRes,
  CreditBalanceRes,
  CreditTransactionRes,
  CursorPageRes,
  MatchProposalCreateReq,
  MatchProposalReceivedRes,
  MatchProposalRes,
  MatchProposalSentRes,
  MatchProposalStatus,
  MatchRecommendationDetailRes,
  MatchRecommendationRes,
  TalentAttachmentPresignedUrlReq,
  TalentAttachmentPresignedUrlRes,
  TalentAttachmentRes,
  TalentAttachmentSaveReq,
  TalentCreateReq,
  TalentCreateRes,
  TalentDetailRes,
  TalentListRes,
  TradeRes,
  TradeSubmissionPresignedUrlReq,
  TradeSubmissionPresignedUrlRes,
  TradeSubmissionReq,
  TradeSubmissionRes,
  UserLoginReq,
  UserLoginRes,
  UserSignupReq,
  UserSignupRes,
} from "./types";

export * from "./client";
export * from "./types";

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
}

interface MatchRecommendationParams {
  talentId: number;
}

interface MatchRecommendationDetailParams {
  providerTalentId: number;
  requesterTalentId: number;
}

function createAcceptProposalIdempotencyKey(proposalId: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `accept-proposal-${proposalId}-${Date.now()}`;
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

  async logout(): Promise<void> {
    try {
      await apiFetch<void>("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      clearAuthStorage();
    }
  },
};

export const categoryApi = {
  getList(): Promise<CategoryRes[]> {
    return apiFetch<CategoryRes[]>("/api/v1/categories");
  },
};

export const talentApi = {
  getList(params: CursorParams = {}): Promise<CursorPageRes<TalentListRes>> {
    return apiFetch<CursorPageRes<TalentListRes>>("/api/v1/talents", {
      query: params,
    });
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

  acceptProposal(
    proposalId: number,
    idempotencyKey = createAcceptProposalIdempotencyKey(proposalId),
  ): Promise<MatchProposalRes> {
    return apiFetch<MatchProposalRes>(
      `/api/v1/match-proposals/${proposalId}/accept`,
      {
        method: "PATCH",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
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

  getRoom(chatRoomId: number, userId: number): Promise<ChatRoomRes> {
    return apiFetch<ChatRoomRes>(`/api/v1/chat-rooms/${chatRoomId}`, {
      query: {
        userId,
      },
    });
  },

  getMessages(chatRoomId: number): Promise<ChatMessageRes[]> {
    return apiFetch<ChatMessageRes[]>(
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
  getDetail(tradeId: number): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}`);
  },

  cancel(tradeId: number): Promise<TradeRes> {
    return apiFetch<TradeRes>(`/api/v1/trade/${tradeId}/cancel`, {
      method: "PATCH",
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
        "Content-Type": file.type || "application/octet-stream",
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

export const creditApi = {
  getBalance(): Promise<CreditBalanceRes> {
    return apiFetch<CreditBalanceRes>("/api/v1/credit/balance");
  },

  getTransactions(
    params: CursorParams = {},
  ): Promise<CursorPageRes<CreditTransactionRes>> {
    return apiFetch<CursorPageRes<CreditTransactionRes>>(
      "/api/v1/credit/transactions",
      {
        query: params,
      },
    );
  },
};
