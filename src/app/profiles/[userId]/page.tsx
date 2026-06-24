import { EmptyState } from "@/components/common/EmptyState";
import { SectionTitle } from "@/components/common/SectionTitle";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title={`사용자 #${userId} 프로필`}
        description="공개 프로필 API가 준비되면 이 영역에 사용자 정보가 표시됩니다."
      />
      <EmptyState
        title="공개 프로필 API가 아직 없어 표시할 수 없습니다."
        actionLabel="채팅으로 돌아가기"
        actionHref="/chats"
      />
    </div>
  );
}
