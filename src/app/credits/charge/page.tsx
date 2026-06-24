import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

export default function CreditChargePage() {
  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="크레딧 충전소"
        description="크레딧 충전 API가 준비되면 이 화면에서 충전할 수 있습니다."
      />
      <EmptyState
        title="크레딧 충전 API가 아직 없어 이용할 수 없습니다."
        description="현재는 실제 충전 또는 결제 연동을 제공하지 않습니다."
        actionLabel="크레딧 지갑으로"
        actionHref="/credits"
      />
    </div>
  );
}
