import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

export default function MatchingsPage() {
  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="매칭 추천 안내"
        description="매칭 추천은 새 추천 화면에서 확인할 수 있습니다."
      />
      <EmptyState
        title="이 경로에서는 매칭 추천을 표시할 수 없어요"
        description="/matches 경로에서 추천 조회와 제안함을 이용해 주세요."
        actionLabel="매칭 추천으로 이동"
        actionHref="/matches"
      />
    </div>
  );
}
