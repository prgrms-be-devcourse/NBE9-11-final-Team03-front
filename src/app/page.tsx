import Link from "next/link";
import { ShieldCheck, Star, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/common/StatusBadge";
import { talentApi, type TalentListRes } from "@/lib/api";
import {
  formatCredit,
  formatEstimatedDuration,
  formatRating,
} from "@/utils/format";

async function getPopularTalents(): Promise<TalentListRes[]> {
  try {
    const response = await talentApi.getList({ size: 3 });
    return response.content;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const popularTalents = await getPopularTalents();

  return (
    <div>
      <section className="bg-white">
        <div className="fixed-container grid grid-cols-[620px_1fr] gap-10 py-20">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold text-teal-700">
              주니어·초입자를 위한 재능 교환
            </p>
            <h1 className="text-5xl font-black leading-tight tracking-normal text-zinc-950">
              돈 없이, 재능으로 시작하는 협업
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              개발자는 디자인을, 디자이너는 개발을, 초입자는 실제 협업 경험을
              얻을 수 있어요.
            </p>
            <div className="mt-8 flex flex-row gap-3">
              <Link
                href="/talents"
                className="inline-flex h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700"
              >
                재능 둘러보기
              </Link>
              <Link
                href="/talents/new"
                className="inline-flex h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
              >
                내 재능 등록하기
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <div className="grid gap-3">
              {[
                "포트폴리오 UI 디자인 ↔ 랜딩 페이지 개발",
                "README 문서화 ↔ 발표 자료 디자인",
                "API 구조 리뷰 ↔ Notion 기획서 정리",
              ].map((item) => (
                <div key={item} className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="font-semibold text-zinc-950">{item}</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    크레딧 에스크로와 리뷰로 안전하게 교환해요.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="fixed-container py-14">
        <SectionTitle title="초입자가 자주 막히는 순간" />
        <div className="grid grid-cols-4 gap-4">
          {[
            "포트폴리오를 만들고 싶은데 디자인이 없음",
            "디자인은 가능한데 개발자가 없음",
            "외주를 맡기기엔 돈이 부담됨",
            "협업 경험이 부족해서 레퍼런스를 만들기 어려움",
          ].map((text) => (
            <div
              key={text}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <p className="font-semibold leading-7 text-zinc-900">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="fixed-container">
          <SectionTitle
            title="재능을 크레딧으로 바꾸고, 필요한 재능을 요청해요"
            description="등록, 적립, 요청, 에스크로, 리뷰까지 MVP에서 확인할 수 있는 흐름으로 구성했습니다."
          />
          <div className="grid grid-cols-5 gap-4">
            {[
              "재능 등록",
              "크레딧 적립",
              "원하는 재능 요청",
              "에스크로 거래",
              "리뷰와 신뢰 점수",
            ].map((text, index) => (
              <div key={text} className="rounded-lg border border-zinc-200 p-5">
                <p className="text-sm font-bold text-teal-700">
                  0{index + 1}
                </p>
                <p className="mt-3 font-bold text-zinc-950">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fixed-container py-14">
        <SectionTitle eyebrow="인기 재능" title="지금 교환하기 좋은 재능" />
        {popularTalents.length > 0 ? (
          <div className="grid grid-cols-3 gap-5">
            {popularTalents.map((talent) => (
              <PopularTalentCard key={talent.talentId} talent={talent} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="표시할 재능이 없어요"
            description="재능 목록 API에 데이터가 준비되면 이 영역에 표시됩니다."
            actionLabel="재능 둘러보기"
            actionHref="/talents"
          />
        )}
      </section>

      <section className="bg-white py-14">
        <div className="fixed-container grid grid-cols-4 gap-5">
          {[
            {
              title: "에스크로",
              icon: WalletCards,
              text: "거래 시작 시 크레딧을 안전하게 보관",
            },
            { title: "양방향 리뷰", icon: Star, text: "완료 후 서로의 협업 경험을 평가" },
            { title: "신뢰 점수", icon: ShieldCheck, text: "평점, 완료율, 응답률을 함께 확인" },
            { title: "상태 추적", icon: ShieldCheck, text: "요청부터 완료까지 흐름을 명확하게 표시" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-zinc-200 p-5">
                <Icon className="h-6 w-6 text-teal-700" aria-hidden="true" />
                <p className="mt-4 font-bold text-zinc-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="fixed-container py-14">
        <div className="rounded-lg bg-zinc-950 p-10 text-white">
          <h2 className="text-3xl font-black">
            첫 협업 경험을 재능 교환으로 만들어 보세요
          </h2>
          <div className="mt-6 flex flex-row gap-3">
            <Link
              href="/talents/new"
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-bold text-zinc-950"
            >
              지금 내 재능 등록하기
            </Link>
            <Link
              href="/talents"
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/30 px-5 text-sm font-bold text-white"
            >
              필요한 재능 찾아보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function PopularTalentCard({ talent }: { talent: TalentListRes }) {
  return (
    <Link
      href={`/talents/${talent.talentId}`}
      className="group flex h-[300px] flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <StatusBadge label={talent.categoryName} tone="info" />
      </div>
      <h3 className="mt-4 line-clamp-2 text-lg font-bold leading-7 text-zinc-950 group-hover:text-teal-700">
        {talent.title}
      </h3>
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <Metric label="필요 크레딧" value={formatCredit(talent.creditPrice)} />
        <Metric
          label="예상 작업 기간"
          value={formatEstimatedDuration(talent.estimatedHours)}
        />
        <Metric label="평점" value={`★ ${formatRating(talent.avgRating)}`} />
        <Metric label="완료" value={`${talent.completeCount}건`} />
      </div>
      <p className="mt-auto border-t border-zinc-100 pt-4 text-sm font-bold text-teal-700">
        상세 보기
      </p>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
