"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { TalentDetailActions } from "@/components/talent/TalentDetailActions";
import {
  talentApi,
  type ReportReason,
  type TalentDetailRes,
} from "@/lib/api";
import { setStoredLastTalentId } from "@/lib/auth";
import {
  formatCredit,
  formatDate,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUserId = window.localStorage.getItem("baton_user_id");
  const userId = storedUserId === null ? NaN : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getTalentAuthorId(talent: TalentDetailRes): number | null {
  const authorId =
    talent.userId ??
    talent.providerId ??
    talent.authorId ??
    talent.sellerId ??
    talent.author.userId ??
    talent.author.providerId ??
    talent.author.authorId ??
    talent.author.sellerId ??
    talent.author.id;

  return typeof authorId === "number" && Number.isInteger(authorId)
    ? authorId
    : null;
}

function getTalentId(talent: TalentDetailRes): number | null {
  const nextTalentId = talent.id ?? talent.talentId;

  return typeof nextTalentId === "number" && Number.isInteger(nextTalentId)
    ? nextTalentId
    : null;
}

export default function TalentDetailPage() {
  const params = useParams<{ talentId: string }>();
  const router = useRouter();
  const talentId = Number(params.talentId);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [talent, setTalent] = useState<TalentDetailRes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadTalentDetail() {
      const storedUserId = readStoredUserId();

      setCurrentUserId(storedUserId);

      if (!Number.isInteger(talentId) || talentId <= 0) {
        setTalent(null);
        setErrorMessage("유효한 재능 ID가 아닙니다.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextTalent = await talentApi.getDetail(talentId);

        if (ignore) {
          return;
        }

        const talentAuthorId = getTalentAuthorId(nextTalent);
        const nextTalentId = getTalentId(nextTalent);

        if (
          storedUserId !== null &&
          talentAuthorId === storedUserId &&
          nextTalentId !== null
        ) {
          setStoredLastTalentId(storedUserId, nextTalentId);
        }

        setTalent(nextTalent);
      } catch (error) {
        if (ignore) {
          return;
        }

        setTalent(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadTalentDetail();

    return () => {
      ignore = true;
    };
  }, [talentId]);

  if (isLoading) {
    return (
      <div className="fixed-container py-12">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          재능 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="fixed-container py-12">
        <ErrorState
          title="재능 정보를 불러오지 못했어요"
          message={errorMessage}
        />
        <div className="mt-5">
          <EmptyState
            title="재능 목록에서 다시 찾아볼까요?"
            actionLabel="재능 목록으로"
            actionHref="/talents"
          />
        </div>
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="fixed-container py-12">
        <EmptyState
          title="재능을 찾을 수 없어요"
          description="삭제되었거나 존재하지 않는 재능입니다."
          actionLabel="재능 목록으로"
          actionHref="/talents"
        />
      </div>
    );
  }

  const talentAuthorId = getTalentAuthorId(talent);
  const isOwner =
    currentUserId !== null &&
    talentAuthorId !== null &&
    currentUserId === talentAuthorId;
  const authorIntroduction =
    talent.author.introduction?.trim() || "아직 등록된 소개가 없습니다.";

  async function handleDeleteTalent() {
    if (!talent || !window.confirm("이 재능을 삭제하시겠습니까?")) {
      return;
    }

    setIsDeleting(true);
    setActionMessage(null);

    try {
      await talentApi.delete(talent.id);
      router.push("/talents");
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "재능 삭제에 실패했습니다.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-white">
      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <Link
          href="/talents"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ded6ff] bg-white px-4 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.04] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          재능 둘러보기
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            <article className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white shadow-sm shadow-violet-950/[0.04]">
              <div
                className="h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
                aria-hidden="true"
              />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-3 py-1.5 text-xs font-black text-[#8c5bff]">
                      {talent.categoryName}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-black ${
                        talent.status === "ACTIVE"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-zinc-200 bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {talent.status === "ACTIVE" ? "거래 가능" : "마감"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-400">
                    등록일 {formatDate(talent.createdAt)}
                  </p>
                </div>

                <h1 className="mt-6 text-3xl font-black leading-tight tracking-normal text-zinc-950 sm:text-4xl">
                  {talent.title}
                </h1>
                <p className="mt-5 whitespace-pre-line text-base font-semibold leading-8 text-zinc-600">
                  {talent.content}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="필요 크레딧"
                    value={formatCredit(talent.creditPrice)}
                  />
                  <MetricCard
                    label="작업 기간"
                    value={formatEstimatedDuration(talent.estimatedHours)}
                  />
                  <MetricCard
                    label="평점 / 완료"
                    value={`★ ${formatRating(talent.avgRating)} · ${talent.completeCount}건`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetaCard label="조회수" value={`${talent.viewCount}회`} />
                  <MetaCard label="수정일" value={formatDate(talent.updatedAt)} />
                  <MetaCard label="작성자" value={talent.author.nickname} />
                </div>
              </div>
            </article>

            <section className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04] sm:p-6">
              {/* UX guard only; the backend still performs the real permission check. */}
              {isOwner ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
                    Manage
                  </p>
                  <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black text-zinc-950">
                        내가 등록한 재능입니다
                      </h2>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
                        상세 내용을 수정하거나 더 이상 노출하지 않을 수 있습니다.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:w-64">
                      <Link
                        href={`/talents/${talent.id}/edit`}
                        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800"
                      >
                        수정
                      </Link>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleDeleteTalent}
                        className="h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {isDeleting ? "삭제 중" : "삭제"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : currentUserId === null ? (
                <p className="rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-4 text-sm font-black text-[#8c5bff]">
                  로그인 후 요청할 수 있습니다.
                </p>
              ) : talentAuthorId === null ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-500">
                  제공자 정보를 확인할 수 없어 요청할 수 없습니다.
                </p>
              ) : (
                <TalentDetailActions
                  providerId={talentAuthorId}
                  providerTalentId={talent.id}
                  isOwner={isOwner}
                  isLoggedIn={currentUserId !== null}
                />
              )}
              {actionMessage ? (
                <p className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {actionMessage}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04] sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
                    Reviews
                  </p>
                  <h2 className="mt-2 text-xl font-black text-zinc-950">
                    리뷰
                  </h2>
                </div>
                <p className="text-sm font-semibold text-zinc-400">
                  완료된 거래 후기가 표시됩니다.
                </p>
              </div>
              <EmptyState
                title="아직 표시할 리뷰가 없어요"
                description="백엔드 리뷰 연동 전까지는 상세 정보만 확인할 수 있습니다."
              />
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
                Provider
              </p>
              <h2 className="mt-2 text-lg font-black text-zinc-950">
                제공자 프로필
              </h2>
              <div className="mt-5 flex items-center gap-3">
                {talent.author.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={talent.author.profileImageUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#ded6ff] bg-[#f4f0ff] text-base font-black text-[#8c5bff]">
                    {talent.author.nickname.slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="text-xl font-black text-zinc-950">
                    {talent.author.nickname}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">
                    신뢰 점수 {formatRating(talent.author.trustScore)}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm font-semibold leading-6 text-zinc-600">
                {authorIntroduction}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniStat label="완료" value={`${talent.completeCount}건`} />
                <MiniStat label="평점" value={formatRating(talent.avgRating)} />
                <MiniStat label="조회" value={`${talent.viewCount}회`} />
                <MiniStat label="카테고리" value={talent.categoryName} />
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="font-black text-amber-950">에스크로 안내</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-amber-900">
                요청 시 크레딧은 즉시 지급되지 않고 에스크로에 보관됩니다.
                결과물 확인 후 제공자에게 지급되며, 문제 발생 시 분쟁 신청이
                가능합니다.
              </p>
            </div>

            {!isOwner && currentUserId !== null ? (
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="h-11 w-full rounded-lg border border-red-200 bg-white px-4 text-sm font-black text-red-600 transition hover:bg-red-50"
              >
                재능 신고
              </button>
            ) : null}
          </aside>
        </div>
      </div>

      {isReportModalOpen ? (
        <TalentReportModal
          talentId={talent.id}
          onClose={() => setIsReportModalOpen(false)}
          onReported={(message) => {
            setIsReportModalOpen(false);
            setActionMessage(message);
          }}
        />
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#fbf9ff] p-4">
      <p className="text-xs font-black text-[#8c5bff]">{label}</p>
      <p className="mt-2 text-base font-black text-zinc-950">{value}</p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-4">
      <p className="text-xs font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-black text-zinc-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs font-bold text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-zinc-950">{value}</p>
    </div>
  );
}

const reportReasons: { value: ReportReason; label: string }[] = [
  { value: "ILLEGAL_OR_CHEATING", label: "불법 또는 부정행위" },
  { value: "EXTERNAL_CONTACT_OR_AD", label: "외부 연락/광고 유도" },
  { value: "INAPPROPRIATE_CONTENT", label: "부적절한 콘텐츠" },
  { value: "ETC", label: "기타" },
];

function TalentReportModal({
  talentId,
  onClose,
  onReported,
}: {
  talentId: number;
  onClose: () => void;
  onReported: (message: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("INAPPROPRIATE_CONTENT");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await talentApi.report(talentId, {
        reason,
        description: description.trim() || null,
      });
      onReported("신고가 접수되었습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "신고 접수에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="talent-report-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-6"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[480px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7"
      >
        <h2 id="talent-report-title" className="text-xl font-black text-zinc-950">
          재능 신고
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          신고 사유와 상세 설명을 남기면 관리자가 확인합니다.
        </p>

        <label className="mt-5 block text-sm font-semibold text-zinc-800">
          신고 사유
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            className="form-input mt-2"
          >
            {reportReasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-semibold text-zinc-800">
          상세 설명
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={5}
            className="form-input mt-2 min-h-32 resize-none"
          />
        </label>

        {errorMessage ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-11 rounded-md border border-zinc-300 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-md bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? "접수 중..." : "신고 접수"}
          </button>
        </div>
      </form>
    </div>
  );
}
