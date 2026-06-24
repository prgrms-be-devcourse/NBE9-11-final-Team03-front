"use client";

import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

export function NewReviewForm() {
  return (
    <div className="mx-auto w-[720px] py-10">
      <SectionTitle
        title="리뷰 작성"
        description="리뷰 기능이 준비되면 완료된 거래에 대한 후기를 남길 수 있습니다."
      />
      <EmptyState
        title="아직 리뷰를 작성할 수 없습니다."
        description="리뷰 작성 기능이 준비되면 완료된 거래에 대한 후기를 남길 수 있습니다."
        actionLabel="마이페이지로"
        actionHref="/mypage"
      />
    </div>
  );
}
