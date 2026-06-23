import type {
  CreditTransactionType,
  ExchangeStatus,
  NotificationType,
} from "@/types/domain";

export function getExchangeStatusLabel(status: ExchangeStatus): string {
  const labels: Record<ExchangeStatus, string> = {
    REQUESTED: "요청됨",
    ACCEPTED: "수락됨",
    IN_PROGRESS: "진행 중",
    SUBMITTED: "검토 중",
    COMPLETED: "완료",
    REJECTED: "거절됨",
    DISPUTED: "분쟁 중",
  };
  return labels[status];
}

export function getExchangeStatusDescription(status: ExchangeStatus): string {
  const descriptions: Record<ExchangeStatus, string> = {
    REQUESTED: "제공자가 요청을 검토하고 있어요.",
    ACCEPTED: "요청이 수락되어 에스크로 예치 후 작업을 시작할 수 있어요.",
    IN_PROGRESS: "제공자가 결과물을 준비하고 있어요.",
    SUBMITTED: "결과물이 제출되어 요청자의 확인을 기다리고 있어요.",
    COMPLETED: "거래가 완료되어 리뷰를 작성할 수 있어요.",
    REJECTED: "요청이 거절되어 크레딧이 차감되지 않아요.",
    DISPUTED: "문제 상황이 접수되어 관리자 검토를 기다리고 있어요.",
  };
  return descriptions[status];
}

export function getCreditTransactionTypeLabel(
  type: CreditTransactionType,
): string {
  const labels: Record<CreditTransactionType, string> = {
    EARN: "적립",
    SPEND: "사용",
    ESCROW_HOLD: "에스크로 예치",
    ESCROW_RELEASE: "에스크로 지급",
    REFUND: "환불",
    CHARGE: "충전",
  };
  return labels[type];
}

export function getNotificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    MATCHING: "매칭",
    EXCHANGE_REQUEST: "거래 요청",
    EXCHANGE_ACCEPTED: "요청 수락",
    EXCHANGE_COMPLETED: "거래 완료",
    REVIEW_RECEIVED: "리뷰",
    CREDIT_UPDATED: "크레딧",
    DISPUTE_UPDATED: "분쟁",
  };
  return labels[type];
}

export function canAcceptExchange(status: ExchangeStatus): boolean {
  return status === "REQUESTED";
}

export function canRejectExchange(status: ExchangeStatus): boolean {
  return status === "REQUESTED";
}

export function canSubmitExchangeResult(status: ExchangeStatus): boolean {
  return status === "IN_PROGRESS";
}

export function canCompleteExchange(status: ExchangeStatus): boolean {
  return status === "SUBMITTED";
}

export function canDisputeExchange(status: ExchangeStatus): boolean {
  return status === "SUBMITTED";
}
