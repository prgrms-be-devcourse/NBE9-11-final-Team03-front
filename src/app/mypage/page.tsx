"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { creditApi, type CreditBalanceRes } from "@/lib/api";
import { formatCredit } from "@/utils/format";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUserId = window.localStorage.getItem("baton_user_id");
  const userId = storedUserId === null ? NaN : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export default function MyPage() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [balance, setBalance] = useState<CreditBalanceRes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadMyPage() {
      const userId = readStoredUserId();

      if (ignore) {
        return;
      }

      setCurrentUserId(userId);

      if (userId === null) {
        setIsLoading(false);
        return;
      }

      try {
        const nextBalance = await creditApi.getBalance();

        if (!ignore) {
          setBalance(nextBalance);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!ignore) {
          setBalance(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "크레딧 잔액을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadMyPage();

    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="fixed-container py-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          마이페이지 정보를 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (currentUserId === null) {
    return (
      <div className="fixed-container py-12">
        <EmptyState
          title="로그인 후 이용해 주세요."
          actionLabel="로그인"
          actionHref="/login"
        />
      </div>
    );
  }

  const balanceValue = balance?.balance ?? 0;
  const escrowBalanceValue = balance?.escrowBalance ?? 0;

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="마이페이지"
        description="현재는 크레딧 잔액을 확인할 수 있습니다."
      />

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black text-zinc-950">
          로그인된 계정
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          회원 정보 조회 기능이 준비되면 닉네임과 소개를 표시할 수 있습니다.
        </p>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <Summary title="사용 가능 크레딧" value={formatCredit(balanceValue)} />
        <Summary
          title="에스크로 예치 중"
          value={formatCredit(escrowBalanceValue)}
        />
        <Summary
          title="총 보유"
          value={formatCredit(balanceValue + escrowBalanceValue)}
        />
      </section>

      <section className="mt-10 grid grid-cols-3 gap-5">
        <EmptyState
          title="내 재능 목록을 아직 표시할 수 없습니다."
        />
        <EmptyState
          title="최근 거래를 표시할 수 없어요"
          description="거래 ID를 알고 있다면 거래 상세 URL로 접근해 주세요."
        />
        <EmptyState
          title="리뷰를 아직 표시할 수 없습니다."
        />
      </section>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-xl font-black text-zinc-950">{value}</p>
    </div>
  );
}
