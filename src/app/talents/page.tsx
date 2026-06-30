"use client";

import {
  Check,
  Code2,
  FileText,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  categoryApi,
  talentApi,
  type CategoryRes,
  type TalentDetailRes,
  type TalentListRes,
  type TalentSortType,
} from "@/lib/api";
import {
  formatCredit,
  formatDate,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

const PAGE_SIZE = 20;

const sortOptions: { value: TalentSortType; label: string }[] = [
  { value: "POPULAR", label: "인기 재능" },
  { value: "LATEST", label: "신규 재능" },
  { value: "RATING", label: "평점 높은 순" },
];

const shelfFilters = [
  { value: "ALL", label: "전체" },
  { value: "NEW", label: "NEW" },
  { value: "BEST", label: "BEST" },
] as const;

const categoryVisuals = {
  development: {
    Icon: Code2,
    tileBg: "bg-[#fff8e7]",
    panelBg: "bg-[#f97316]",
    lineBg: "bg-[#f97316]",
    badge: "text-[#b45309]",
    hover: "group-hover:text-[#c2410c]",
    price: "text-[#ea580c]",
    bestChip: "bg-[#ea580c] text-white",
    newChip: "bg-[#ffedd5] text-[#c2410c]",
    label: "개발",
    headline: "개발",
  },
  design: {
    Icon: Palette,
    tileBg: "bg-[#f7fee7]",
    panelBg: "bg-[#5ec85a]",
    lineBg: "bg-[#22c55e]",
    badge: "text-[#3f6212]",
    hover: "group-hover:text-[#4d7c0f]",
    price: "text-[#4d7c0f]",
    bestChip: "bg-[#4d7c0f] text-white",
    newChip: "bg-[#ecfccb] text-[#3f6212]",
    label: "디자인",
    headline: "디자인",
  },
  document: {
    Icon: FileText,
    tileBg: "bg-[#fff1f2]",
    panelBg: "bg-[#f05267]",
    lineBg: "bg-[#f43f5e]",
    badge: "text-[#9f1239]",
    hover: "group-hover:text-[#be123c]",
    price: "text-[#be123c]",
    bestChip: "bg-[#be123c] text-white",
    newChip: "bg-[#ffe4e6] text-[#9f1239]",
    label: "문서 정리",
    headline: "문서",
  },
  default: {
    Icon: Sparkles,
    tileBg: "bg-[#fff7ed]",
    panelBg: "bg-[#f97316]",
    lineBg: "bg-[#f97316]",
    badge: "text-[#9a3412]",
    hover: "group-hover:text-[#b45309]",
    price: "text-[#b45309]",
    bestChip: "bg-[#b45309] text-white",
    newChip: "bg-[#ffedd5] text-[#9a3412]",
    label: "재능",
    headline: "재능",
  },
};

type ShelfFilter = (typeof shelfFilters)[number]["value"];

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

function isNewTalent(createdAt: string): boolean {
  const createdTime = new Date(createdAt).getTime();

  if (Number.isNaN(createdTime)) {
    return false;
  }

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - createdTime <= sevenDays;
}

function getCategoryVisual(categoryName: string) {
  const normalized = categoryName.replace(/\s/g, "").toLowerCase();

  if (normalized.includes("개발") || normalized.includes("dev")) {
    return categoryVisuals.development;
  }

  if (normalized.includes("디자인") || normalized.includes("design")) {
    return categoryVisuals.design;
  }

  if (
    normalized.includes("문서") ||
    normalized.includes("정리") ||
    normalized.includes("글")
  ) {
    return categoryVisuals.document;
  }

  return categoryVisuals.default;
}

function getTalentAuthorNickname(talent: TalentListRes): string | null {
  const nickname =
    talent.author?.nickname ??
    talent.nickname ??
    talent.authorNickname ??
    talent.sellerNickname ??
    talent.providerNickname ??
    talent.userNickname;

  return nickname?.trim() || null;
}

function getTalentDetailAuthorNickname(talent: TalentDetailRes): string | null {
  return talent.author?.nickname?.trim() || null;
}

function TalentSortMenu({
  value,
  onChange,
}: {
  value: TalentSortType;
  onChange: (value: TalentSortType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel =
    sortOptions.find((option) => option.value === value)?.label ??
    "인기 재능";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[#d9ccff] bg-white px-4 text-sm font-black text-zinc-950 shadow-sm shadow-violet-950/[0.04] outline-none transition hover:border-[#c8b7ff] hover:bg-[#f8f5ff] hover:text-[#8c5bff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="재능 정렬"
      >
        <span>{selectedLabel}</span>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="재능 정렬 옵션"
          className="absolute right-0 z-50 mt-3 w-44 overflow-hidden rounded-2xl border border-[#d9ccff] bg-white p-2 shadow-[0_18px_42px_rgba(80,60,160,0.16)]"
        >
          {sortOptions.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black outline-none transition ${selected
                  ? "bg-[#f4f0ff] text-[#8c5bff]"
                  : "text-zinc-700 hover:bg-[#f4f0ff] hover:text-[#8c5bff] focus:bg-[#f4f0ff] focus:text-[#8c5bff]"
                  }`}
              >
                {selected ? (
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function TalentsPage() {
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [shelfFilter, setShelfFilter] = useState<ShelfFilter>("ALL");
  const [sortBy, setSortBy] = useState<TalentSortType>("POPULAR");
  const [categories, setCategories] = useState<CategoryRes[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [categoryErrorMessage, setCategoryErrorMessage] = useState<
    string | null
  >(null);
  const [talents, setTalents] = useState<TalentListRes[]>([]);
  const [authorNamesByTalentId, setAuthorNamesByTalentId] = useState<
    Record<number, string | null>
  >({});
  const requestedAuthorIdsRef = useRef<Set<number>>(new Set());
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
      setIsInitialLoading(true);
      setErrorMessage(null);

      try {
        const response = await talentApi.search({
          categoryId,
          completedOnly: shelfFilter === "BEST" ? true : undefined,
          sort: sortBy,
          size: PAGE_SIZE,
        });

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
  }, [categoryId, shelfFilter, sortBy]);

  useEffect(() => {
    const targets = talents.filter((talent) => {
      if (getTalentAuthorNickname(talent)) {
        return false;
      }

      if (requestedAuthorIdsRef.current.has(talent.talentId)) {
        return false;
      }

      return true;
    });

    if (targets.length === 0) {
      return;
    }

    targets.forEach((talent) => {
      requestedAuthorIdsRef.current.add(talent.talentId);
    });

    let ignore = false;

    async function loadTalentAuthors() {
      const settledAuthors = await Promise.allSettled(
        targets.map((talent) => talentApi.getDetail(talent.talentId)),
      );

      if (ignore) {
        return;
      }

      setAuthorNamesByTalentId((previous) => {
        const next = { ...previous };

        settledAuthors.forEach((result, index) => {
          const talentId = targets[index].talentId;
          next[talentId] =
            result.status === "fulfilled"
              ? getTalentDetailAuthorNickname(result.value)
              : null;
        });

        return next;
      });
    }

    void loadTalentAuthors();

    return () => {
      ignore = true;
    };
  }, [talents]);

  async function handleLoadMore() {
    setErrorMessage(null);
    setIsMoreLoading(true);

    try {
      const response = await talentApi.search({
        categoryId,
        completedOnly: shelfFilter === "BEST" ? true : undefined,
        sort: sortBy,
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

  function handleShelfFilterChange(nextFilter: ShelfFilter): void {
    setShelfFilter(nextFilter);

    if (nextFilter === "NEW") {
      setSortBy("LATEST");
      return;
    }

    if (nextFilter === "BEST") {
      setSortBy("POPULAR");
    }
  }

  const filteredTalents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return talents.filter((talent) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        talent.title.toLowerCase().includes(normalizedKeyword) ||
        talent.categoryName.toLowerCase().includes(normalizedKeyword);

      return matchesKeyword;
    });
  }, [keyword, talents]);

  const isEmpty =
    !isInitialLoading && !errorMessage && filteredTalents.length === 0;
  const countLabel = isInitialLoading
    ? "재능을 불러오는 중"
    : `총 ${filteredTalents.length}${hasNext ? "+" : ""}개 재능`;

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="text-center">
          <h1 className="baton-page-title mt-3">
            TALENT MATCHING
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            내 재능과 어울리는 교환 상대를 찾아보세요.
            <br />
            상세 정보를 확인하고 바로 교환을 제안할 수 있어요.
          </p>
        </header>

        <nav
          aria-label="재능 카테고리"
          className="mt-12 flex items-center gap-7 overflow-x-auto border-b border-slate-400/55 pb-5 text-sm font-black text-zinc-950 [scrollbar-width:none] sm:mt-16 sm:gap-10 sm:text-[15px] lg:mt-20"
        >
          <button
            type="button"
            onClick={() => setCategoryId(undefined)}
            className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 pb-5 transition ${categoryId === undefined
              ? "border-[#8c5bff] text-[#8c5bff]"
              : "border-transparent hover:text-[#8c5bff]"
              }`}
          >
            ALL
          </button>
          {categories.map((category) => (
            <button
              key={category.categoryId}
              type="button"
              onClick={() => setCategoryId(category.categoryId)}
              className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 pb-5 transition ${categoryId === category.categoryId
                ? "border-[#8c5bff] text-[#8c5bff]"
                : "border-transparent hover:text-[#8c5bff]"
                }`}
            >
              {category.name}
            </button>
          ))}
          {isCategoryLoading ? (
            <span className="shrink-0 whitespace-nowrap text-zinc-400">
              카테고리 불러오는 중
            </span>
          ) : null}
        </nav>

        {categoryErrorMessage ? (
          <div className="mt-5">
            <ErrorState
              title="카테고리를 불러오지 못했어요"
              message={categoryErrorMessage}
            />
          </div>
        ) : null}

        <section className="mt-7 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] sm:w-auto sm:gap-3">
            {shelfFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleShelfFilterChange(filter.value)}
                className={`h-12 min-w-[76px] cursor-pointer rounded-xl border px-5 text-sm font-black transition sm:h-[58px] sm:min-w-[86px] sm:px-7 sm:text-base ${shelfFilter === filter.value
                  ? "border-[#8c5bff] bg-[#8c5bff] text-white"
                  : "border-[#ded6ff] bg-white/90 text-zinc-500 hover:border-[#d9ccff] hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <label className="relative block w-full sm:w-[260px]">
              <span className="sr-only">재능 검색</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="제목 또는 카테고리 검색"
                className="h-11 w-full rounded-xl border border-[#ded6ff] bg-white/90 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#8c5bff] focus:ring-2 focus:ring-[#f4f0ff]"
              />
            </label>
          </div>
        </section>

        <section className="mt-14 flex flex-wrap items-center justify-between gap-4 sm:mt-20 lg:mt-24">
          <p className="text-base font-semibold text-zinc-500">
            {countLabel}
          </p>
          <TalentSortMenu
            value={sortBy}
            onChange={(nextSort) => {
              setSortBy(nextSort);
              setShelfFilter("ALL");
            }}
          />
        </section>

        {isInitialLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-square bg-zinc-100" />
                <div className="mt-5 h-5 w-4/5 bg-zinc-100" />
                <div className="mt-3 h-4 w-3/5 bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-8">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        {isEmpty ? (
          <div className="mt-8">
            <EmptyState
              title="조건에 맞는 재능이 없어요"
              description="검색어를 줄이거나 다른 카테고리를 선택해 보세요."
            />
          </div>
        ) : null}

        {!isInitialLoading && !errorMessage && filteredTalents.length > 0 ? (
          <>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTalents.map((talent) => (
                <TalentProductCard
                  key={talent.talentId}
                  talent={talent}
                  authorNickname={
                    getTalentAuthorNickname(talent) ??
                    authorNamesByTalentId[talent.talentId] ??
                    null
                  }
                />
              ))}
            </div>
            {hasNext ? (
              <div className="mt-14 flex justify-center">
                <button
                  type="button"
                  disabled={isMoreLoading}
                  onClick={handleLoadMore}
                  className="h-12 min-w-36 cursor-pointer border border-zinc-300 bg-white px-7 text-sm font-black text-zinc-800 transition hover:border-[#8c5bff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMoreLoading ? "불러오는 중..." : "더 보기"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function TalentProductCard({
  talent,
  authorNickname,
}: {
  talent: TalentListRes;
  authorNickname: string | null;
}) {
  const visual = getCategoryVisual(talent.categoryName);
  const CategoryIcon = visual.Icon;
  const newTalent = isNewTalent(talent.createdAt);
  const bestTalent = talent.completeCount > 0 || talent.avgRating >= 4.5;
  const displayAuthorNickname = authorNickname ?? "등록자 정보 없음";

  return (
    <Link
      href={`/talents/${talent.talentId}`}
      className="group block text-left"
    >
      <div className={`relative aspect-square overflow-hidden ${visual.tileBg}`}>
        <div
          className={`absolute right-0 top-0 h-[40%] w-[40%] rounded-bl-[48px] ${visual.panelBg} transition group-hover:scale-[1.02]`}
        />
        <div className="absolute left-8 top-[76px] z-20 flex h-10 w-16 items-center justify-center rounded-t-[18px] rounded-b-none border border-b-0 border-white/88 bg-white/76 backdrop-blur">
          <CategoryIcon className={`h-7 w-7 ${visual.badge}`} aria-hidden="true" />
        </div>
        <div className="absolute inset-x-8 top-[116px] bottom-8 z-10 rounded-b-[24px] rounded-tr-[24px] border border-t-0 border-white/88 bg-white/76 p-6 shadow-xl shadow-orange-950/10 backdrop-blur">
          <span className="block text-[42px] font-black leading-none tracking-normal text-zinc-950">
            {visual.headline}
          </span>
          <div
            className={`mt-5 h-2 w-20 rounded-full ${visual.lineBg}`}
            aria-hidden="true"
          />
        </div>
        <span className={`absolute right-5 top-5 rounded-full bg-white/88 px-3 py-1 text-xs font-black ${visual.badge} shadow-sm`}>
          {talent.categoryName}
        </span>
      </div>

      <div className="pt-5">
        <h2 className={`line-clamp-2 min-h-14 text-[17px] font-black leading-7 text-zinc-950 transition ${visual.hover}`}>
          {talent.title}
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-black text-zinc-950">
            {formatCredit(talent.creditPrice)}
          </span>
          <span className="text-sm font-semibold text-zinc-400">
            {formatEstimatedDuration(talent.estimatedHours)}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-zinc-500">
          ★ {formatRating(talent.avgRating)} · 완료 {talent.completeCount}건 ·
          조회 {talent.viewCount}
        </p>
        <p className="mt-2 text-sm font-semibold text-zinc-500">
          등록자{" "}
          <span className="font-black text-zinc-700">
            {displayAuthorNickname}
          </span>
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`h-2 w-8 rounded-full ${visual.lineBg}`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-zinc-400">
            {formatDate(talent.createdAt)}
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          {bestTalent ? (
            <span className={`rounded-full px-3 py-1 text-xs font-black ${visual.bestChip}`}>
              BEST
            </span>
          ) : null}
          {newTalent ? (
            <span className={`rounded-full px-3 py-1 text-xs font-black ${visual.newChip}`}>
              NEW
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
