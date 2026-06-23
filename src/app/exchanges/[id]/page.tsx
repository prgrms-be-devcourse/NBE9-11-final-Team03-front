import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

interface ExchangePageProps {
  params: Promise<{ id: string }>;
}

export default async function ExchangePage({ params }: ExchangePageProps) {
  const { id } = await params;

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="거래 안내"
        description="거래 상세는 새 거래 화면에서 확인할 수 있습니다."
      />
      <EmptyState
        title="거래 정보를 표시할 수 없어요"
        description="/trades/{tradeId} 경로에서 거래 상세를 확인해 주세요."
      />
      <div className="mt-5 flex gap-3">
        <Link
          href={`/trades/${id}`}
          className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-700"
        >
          거래 상세로 이동
        </Link>
        <Link
          href="/mypage"
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
        >
          마이페이지로
        </Link>
      </div>
    </div>
  );
}
