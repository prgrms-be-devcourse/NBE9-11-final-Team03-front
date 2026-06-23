import { StatusBadge } from "@/components/common/StatusBadge";
import type {
  MatchProposalReceivedRes,
  MatchProposalSentRes,
  MatchProposalStatus,
} from "@/lib/api";
import { formatDate } from "@/utils/format";

type ProposalCardVariant = "received" | "sent";

type ProposalStatusTone = "default" | "success" | "warning" | "danger";

interface MatchProposalCardProps {
  proposal: MatchProposalReceivedRes | MatchProposalSentRes;
  variant: ProposalCardVariant;
  isProcessing?: boolean;
  onAccept?: (proposal: MatchProposalReceivedRes) => void;
  onReject?: (proposalId: number) => void;
}

function getStatusLabel(status: MatchProposalStatus): string {
  const labels: Record<MatchProposalStatus, string> = {
    REQUESTED: "대기 중",
    ACCEPTED: "수락됨",
    REJECTED: "거절됨",
    CANCELLED: "취소됨",
  };

  return labels[status];
}

function getStatusTone(status: MatchProposalStatus): ProposalStatusTone {
  const tones: Record<MatchProposalStatus, ProposalStatusTone> = {
    REQUESTED: "warning",
    ACCEPTED: "success",
    REJECTED: "danger",
    CANCELLED: "default",
  };

  return tones[status];
}

function getInitial(name: string): string {
  return name.trim().slice(0, 1) || "?";
}

function ProfileAvatar({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`${name} 프로필 이미지`}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-black text-zinc-500">
      {getInitial(name)}
    </div>
  );
}

export function MatchProposalCard({
  proposal,
  variant,
  isProcessing = false,
  onAccept,
  onReject,
}: MatchProposalCardProps) {
  const isReceived = variant === "received";
  const profileName = isReceived
    ? (proposal as MatchProposalReceivedRes).requesterNickname
    : (proposal as MatchProposalSentRes).providerNickname;
  const profileImageUrl = isReceived
    ? (proposal as MatchProposalReceivedRes).requesterProfileImageUrl
    : (proposal as MatchProposalSentRes).providerProfileImageUrl;
  const firstTalentLabel = isReceived ? "요청자 재능" : "내 재능";
  const firstTalentTitle = isReceived
    ? (proposal as MatchProposalReceivedRes).requesterTalentTitle ??
      "크레딧 요청"
    : (proposal as MatchProposalSentRes).requesterTalentTitle ??
      "내 재능 없음";
  const secondTalentLabel = isReceived ? "내 재능" : "상대 재능";
  const secondTalentTitle = isReceived
    ? (proposal as MatchProposalReceivedRes).providerTalentTitle
    : (proposal as MatchProposalSentRes).providerTalentTitle;
  const canRespond = isReceived && proposal.status === "REQUESTED";

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar imageUrl={profileImageUrl} name={profileName} />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-zinc-950">
              {profileName}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {formatDate(proposal.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge
          label={getStatusLabel(proposal.status)}
          tone={getStatusTone(proposal.status)}
        />
      </div>

      <div className="mt-5 grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm">
        <ProposalInfo label={firstTalentLabel} value={firstTalentTitle} />
        <ProposalInfo label={secondTalentLabel} value={secondTalentTitle} />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-zinc-500">요청 메시지</p>
        <p className="mt-2 whitespace-pre-line rounded-md border border-zinc-100 p-3 text-sm leading-6 text-zinc-700">
          {proposal.requestMessage || "요청 메시지가 없습니다."}
        </p>
      </div>

      {canRespond ? (
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAccept?.(proposal as MatchProposalReceivedRes)}
            className="h-10 rounded-md border border-teal-200 bg-white px-4 text-sm font-bold text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
          >
            {isProcessing ? "수락 중..." : "수락"}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onReject?.(proposal.proposalId)}
            className="h-10 rounded-md border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            거절
          </button>
        </div>
      ) : null}

    </article>
  );
}

function ProposalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-bold text-zinc-950">{value}</p>
    </div>
  );
}
