import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

export default function ProfileEditPage() {
  return (
    <div className="mx-auto w-[720px] py-10">
      <SectionTitle
        title="프로필 수정"
        description="회원 정보 수정 기능이 준비되면 이 화면에서 정보를 변경할 수 있습니다."
      />
      <EmptyState
        title="회원 정보 수정 기능이 아직 준비되지 않았습니다."
        description="프로필 등록, 태그 저장, 포트폴리오 저장 기능은 아직 제공하지 않습니다."
        actionLabel="마이페이지로"
        actionHref="/mypage"
      />
    </div>
  );
}
