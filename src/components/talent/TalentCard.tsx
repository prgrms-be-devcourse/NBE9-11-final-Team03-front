import Link from "next/link";
import type { Profile, Talent, TalentCategory } from "@/types/domain";
import { formatCredit, formatRating } from "@/utils/format";
import { StatusBadge } from "@/components/common/StatusBadge";

interface TalentCardProps {
  talent: Talent;
  category: TalentCategory | null;
  provider: Profile | null;
}

export function TalentCard({ talent, category, provider }: TalentCardProps) {
  return (
    <Link
      href={`/talents/${talent.id}`}
      prefetch={false}
      className="group flex h-[396px] flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex h-8 items-center gap-2 overflow-hidden">
        <StatusBadge label={category?.name ?? "기타"} tone="info" />
        <StatusBadge
          label={`신뢰 ${provider?.trustScore.totalScore ?? 0}`}
          tone="success"
        />
      </div>
      <h3 className="mt-4 line-clamp-2 h-14 text-lg font-bold leading-7 text-zinc-950 group-hover:text-teal-700">
        {talent.title}
      </h3>
      <p className="mt-2 line-clamp-3 h-[72px] text-sm leading-6 text-zinc-600">
        {talent.description}
      </p>
      <div className="mt-4 grid h-[104px] grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div>
          <p className="text-xs text-zinc-500">제공자</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {provider?.nickname ?? "알 수 없음"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">필요 크레딧</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {formatCredit(talent.requiredCredits)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">예상 소요</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            {talent.estimatedDuration}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">평점 / 완료</p>
          <p className="mt-1 truncate font-semibold text-zinc-900">
            ★ {formatRating(talent.averageRating)} · {talent.completedCount}건
          </p>
        </div>
      </div>
      <div className="mt-4 flex h-8 gap-2 overflow-hidden border-t border-zinc-100 pt-3">
        {talent.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="inline-flex max-w-[92px] shrink-0 items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
          >
            <span className="truncate">#{tag}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}
