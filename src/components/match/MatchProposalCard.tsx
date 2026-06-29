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

function getStatusClass(status: MatchProposalStatus): string {
  const classes: Record<ProposalStatusTone, string> = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
  };

  return classes[getStatusTone(status)];
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
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d9ccff] bg-[#f4f0ff] text-sm font-black text-[#8c5bff]">
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
  const variantLabel = isReceived ? "받은 제안" : "보낸 제안";
  const variantDescription = isReceived
    ? "상대가 보낸 교환 요청"
    : "내가 보낸 교환 요청";

  return (
    <article className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:border-[#c8b7ff] hover:shadow-xl hover:shadow-violet-950/[0.08]">
      <div className="h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]" />
      <div className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
              {variantLabel}
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              {variantDescription}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${getStatusClass(
              proposal.status,
            )}`}
          >
            {getStatusLabel(proposal.status)}
          </span>
        </div>

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
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 text-sm md:grid-cols-2">
          <ProposalInfo label={firstTalentLabel} value={firstTalentTitle} />
          <ProposalInfo label={secondTalentLabel} value={secondTalentTitle} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-black text-zinc-500">요청 메시지</p>
          <p className="mt-2 whitespace-pre-line rounded-lg border border-[#eee8ff] bg-white/90 p-4 text-sm font-semibold leading-6 text-zinc-700">
            {proposal.requestMessage || "요청 메시지가 없습니다."}
          </p>
        </div>

        {canRespond ? (
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onAccept?.(proposal as MatchProposalReceivedRes)}
              className="h-10 cursor-pointer rounded-lg border border-transparent bg-[linear-gradient(135deg,#8c5bff_0%,#8467ff_48%,#7f75ff_100%)] px-5 text-sm font-black text-white shadow-lg shadow-violet-400/[0.18] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#8250ff_0%,#7f62ff_48%,#796fff_100%)] hover:shadow-xl hover:shadow-violet-400/[0.22] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {isProcessing ? "수락 중..." : "수락"}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onReject?.(proposal.proposalId)}
              className="h-10 cursor-pointer rounded-lg border border-rose-200 bg-white px-5 text-sm font-black text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              거절
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ProposalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/80 p-3">
      <p className="text-xs font-black text-[#8c5bff]">{label}</p>
      <p className="mt-1 break-words font-bold text-zinc-950">{value}</p>
    </div>
  );
}
