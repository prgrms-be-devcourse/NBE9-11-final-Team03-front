"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  TalentFilter,
  type TalentFilterValue,
} from "@/components/talent/TalentFilter";
import { TalentSearchBar } from "@/components/talent/TalentSearchBar";
import { TalentSortSelect } from "@/components/talent/TalentSortSelect";
import {
  categoryApi,
  talentApi,
  type CategoryRes,
  type TalentListRes,
} from "@/lib/api";
import {
  formatCredit,
  formatDate,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

type TalentSortOption =
  | "latest"
  | "rating"
  | "credits_asc"
  | "completed"
  | "trust";

const PAGE_SIZE = 20;

function getCategoryErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.";

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("forbidden")
  ) {
    return "로그인 후 카테고리를 조회할 수 있습니다.";
  }

  return message;
}

export default function TalentsPage() {
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<TalentFilterValue>({});
  const [sortBy, setSortBy] = useState<TalentSortOption>("latest");
  const [categories, setCategories] = useState<CategoryRes[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [categoryErrorMessage, setCategoryErrorMessage] = useState<
    string | null
  >(null);
  const [talents, setTalents] = useState<TalentListRes[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadCategories() {
      try {
        const response = await categoryApi.getList();
        const categoryList = Array.isArray(response) ? response : [];

        if (ignore) {
          return;
        }

        setCategories(
          [...categoryList].sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.categoryId - b.categoryId,
          ),
        );
        setCategoryErrorMessage(null);
      } catch (error) {
        if (ignore) {
          return;
        }

        setCategories([]);
        setCategoryErrorMessage(getCategoryErrorMessage(error));
      } finally {
        if (!ignore) {
          setIsCategoryLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitialTalents() {
      try {
        const response = await talentApi.getList({ size: PAGE_SIZE });

        if (ignore) {
          return;
        }

        setTalents(response.content);
        setHasNext(response.hasNext);
        setNextCursor(response.nextCursor);
      } catch (error) {
        if (ignore) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "재능 목록을 불러오지 못했습니다.",
        );
        setTalents([]);
        setHasNext(false);
        setNextCursor(null);
      } finally {
        if (!ignore) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadInitialTalents();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleLoadMore() {
    setErrorMessage(null);
    setIsMoreLoading(true);

    try {
      const response = await talentApi.getList({
        cursor: nextCursor,
        size: PAGE_SIZE,
      });
      setTalents((previous) => [...previous, ...response.content]);
      setHasNext(response.hasNext);
      setNextCursor(response.nextCursor);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "재능 목록을 추가로 불러오지 못했습니다.",
      );
    } finally {
      setIsMoreLoading(false);
    }
  }

  const filteredTalents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const selectedCategory =
      filter.categoryId === undefined
        ? undefined
        : categories.find(
            (category) => category.categoryId === filter.categoryId,
          );

    const filtered = talents.filter((talent) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        talent.title.toLowerCase().includes(normalizedKeyword) ||
        talent.categoryName.toLowerCase().includes(normalizedKeyword);
      const matchesCategory =
        filter.categoryId === undefined ||
        (selectedCategory !== undefined &&
          talent.categoryName === selectedCategory.name);
      const matchesMinCredit =
        filter.minCredits === undefined ||
        talent.creditPrice >= filter.minCredits;
      const matchesMaxCredit =
        filter.maxCredits === undefined ||
        talent.creditPrice <= filter.maxCredits;
      const matchesRating =
        filter.minRating === undefined || talent.avgRating >= filter.minRating;

      return (
        matchesKeyword &&
        matchesCategory &&
        matchesMinCredit &&
        matchesMaxCredit &&
        matchesRating
      );
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.avgRating - a.avgRating;
        case "credits_asc":
          return a.creditPrice - b.creditPrice;
        case "completed":
        case "trust":
          return b.completeCount - a.completeCount;
        case "latest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
  }, [categories, filter, keyword, sortBy, talents]);

  const isEmpty =
    !isInitialLoading && !errorMessage && filteredTalents.length === 0;

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="재능 둘러보기"
        description="필요한 재능을 검색하고 크레딧, 평점, 카테고리 기준으로 교환 상대를 찾아보세요."
      />
      <div className="mb-6 grid grid-cols-[1fr_140px] gap-3">
        <TalentSearchBar value={keyword} onChange={setKeyword} />
        <TalentSortSelect value={sortBy} onChange={setSortBy} />
      </div>
      <div className="mb-6">
        <TalentFilter
          categories={categories}
          value={filter}
          onChange={setFilter}
        />
        {isCategoryLoading ? (
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            카테고리를 불러오는 중입니다...
          </p>
        ) : null}
        {categoryErrorMessage ? (
          <div className="mt-3">
            <ErrorState
              title="카테고리를 불러오지 못했어요"
              message={categoryErrorMessage}
            />
          </div>
        ) : null}
      </div>

      {isInitialLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          재능 목록을 불러오는 중입니다...
        </div>
      ) : null}

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      {isEmpty ? (
        <EmptyState
          title="조건에 맞는 재능이 없어요"
          description="검색어를 줄이거나 필터를 초기화해 보세요."
        />
      ) : null}

      {!isInitialLoading && !errorMessage && filteredTalents.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-5">
            {filteredTalents.map((talent) => (
              <TalentListCard key={talent.talentId} talent={talent} />
            ))}
          </div>
          {hasNext ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={isMoreLoading}
                onClick={handleLoadMore}
                className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
              >
                {isMoreLoading ? "불러오는 중..." : "더 보기"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TalentListCard({ talent }: { talent: TalentListRes }) {
  return (
    <Link
      href={`/talents/${talent.talentId}`}
      className="group flex h-[328px] flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex h-8 items-center gap-2 overflow-hidden">
        <StatusBadge label={talent.categoryName} tone="info" />
        <StatusBadge label={`조회 ${talent.viewCount}`} tone="default" />
      </div>
      <h3 className="mt-4 line-clamp-2 h-14 text-lg font-bold leading-7 text-zinc-950 group-hover:text-teal-700">
        {talent.title}
      </h3>
      <p className="mt-2 line-clamp-2 h-12 text-sm leading-6 text-zinc-600">
        {talent.categoryName} 카테고리의 재능입니다. 자세한 제공 내용은 상세
        페이지에서 확인해 주세요.
      </p>
      <div className="mt-4 grid h-[104px] grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div>
          <p className="text-xs text-zinc-500">필요 크레딧</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatCredit(talent.creditPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">예상 작업 기간</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatEstimatedDuration(talent.estimatedHours)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">평점 / 완료</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            ★ {formatRating(talent.avgRating)} · {talent.completeCount}건
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">등록일</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatDate(talent.createdAt)}
          </p>
        </div>
      </div>
      <span className="mt-auto border-t border-zinc-100 pt-4 text-sm font-bold text-teal-700">
        상세 보기
      </span>
    </Link>
  );
}
