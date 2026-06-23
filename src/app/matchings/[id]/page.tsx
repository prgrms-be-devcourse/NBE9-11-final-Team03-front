import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

export default function MatchingDetailPage() {
  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="매칭 추천 상세 안내"
        description="매칭 추천 상세는 새 추천 화면에서 확인할 수 있습니다."
      />
      <EmptyState
        title="매칭 상세 정보를 표시할 수 없어요"
        description="/matches 경로에서 내 재능 기준으로 추천을 조회해 주세요."
        actionLabel="매칭 추천으로 이동"
        actionHref="/matches"
      />
    </div>
  );
}
