"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TalentAttachmentPanel } from "@/components/talent/TalentAttachmentPanel";
import { TalentDetailActions } from "@/components/talent/TalentDetailActions";
import { talentApi, type TalentDetailRes } from "@/lib/api";
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
  const talentId = Number(params.talentId);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [talent, setTalent] = useState<TalentDetailRes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="fixed-container py-10">
      <div className="grid grid-cols-[1fr_340px] gap-8">
        <article className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={talent.categoryName} tone="info" />
            <StatusBadge
              label={talent.status === "ACTIVE" ? "거래 가능" : "마감"}
              tone={talent.status === "ACTIVE" ? "success" : "default"}
            />
          </div>
          <h1 className="mt-4 text-3xl font-black text-zinc-950">
            {talent.title}
          </h1>
          <p className="mt-4 whitespace-pre-line leading-8 text-zinc-700">
            {talent.content}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 rounded-lg bg-zinc-50 p-5">
            <Metric
              label="필요 크레딧"
              value={formatCredit(talent.creditPrice)}
            />
            <Metric
              label="예상 작업 기간"
              value={formatEstimatedDuration(talent.estimatedHours)}
            />
            <Metric
              label="평점 / 완료"
              value={`★ ${formatRating(talent.avgRating)} · ${talent.completeCount}건`}
            />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 rounded-lg border border-zinc-100 p-5 text-sm">
            <Metric label="조회수" value={`${talent.viewCount}회`} />
            <Metric label="등록일" value={formatDate(talent.createdAt)} />
            <Metric label="수정일" value={formatDate(talent.updatedAt)} />
          </div>
          <div className="mt-8">
            {/* UX guard only; the backend still performs the real permission check. */}
            {isOwner ? (
              <p className="rounded-md bg-zinc-50 p-3 text-sm font-semibold text-zinc-500">
                내가 등록한 재능입니다.
              </p>
            ) : currentUserId === null ? (
              <p className="rounded-md bg-zinc-50 p-3 text-sm font-semibold text-zinc-500">
                로그인 후 이용해 주세요.
              </p>
            ) : talentAuthorId === null ? (
              <p className="rounded-md bg-zinc-50 p-3 text-sm font-semibold text-zinc-500">
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
          </div>
        </article>

        <aside className="space-y-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="font-bold text-zinc-950">제공자 프로필</p>
            <div className="mt-4 flex items-center gap-3">
              {talent.author.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={talent.author.profileImageUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-sm font-black text-zinc-500">
                  {talent.author.nickname.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-xl font-black">
                  {talent.author.nickname}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  신뢰 점수 {formatRating(talent.author.trustScore)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              {talent.author.introduction}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p>
                완료 <b>{talent.completeCount}건</b>
              </p>
              <p>
                평점 <b>{formatRating(talent.avgRating)}</b>
              </p>
              <p>
                조회 <b>{talent.viewCount}회</b>
              </p>
              <p>
                카테고리 <b>{talent.categoryName}</b>
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-950">에스크로 안내</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              요청 시 크레딧은 즉시 지급되지 않고 에스크로에 보관됩니다. 결과물
              확인 후 제공자에게 지급되며, 문제 발생 시 분쟁 신청이 가능합니다.
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <TalentAttachmentPanel talentId={talent.id} />
      </div>

      <section className="mt-10">
        <SectionTitle
          title="리뷰"
          description="리뷰 API가 연결되면 완료된 거래 후기가 이 영역에 표시됩니다."
        />
        <EmptyState
          title="아직 표시할 리뷰가 없어요"
          description="백엔드 리뷰 연동 전까지는 상세 정보만 확인할 수 있습니다."
        />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-zinc-950">{value}</p>
    </div>
  );
}
