"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import {
  adminApi,
  type AdminActionLogRes,
  type AdminActionTargetType,
  type AdminActionType,
  type AdminDisputeRes,
} from "@/lib/api";
import { getStoredUserRole, hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate } from "@/utils/format";

type AdminTab = "users" | "talents" | "reports" | "disputes" | "logs";

const tabs: { value: AdminTab; label: string; isReady: boolean }[] = [
  { value: "users", label: "사용자", isReady: false },
  { value: "talents", label: "재능", isReady: false },
  { value: "reports", label: "신고", isReady: false },
  { value: "disputes", label: "분쟁", isReady: true },
  { value: "logs", label: "조치 로그", isReady: true },
];

const actionTargetOptions: AdminActionTargetType[] = [
  "USER",
  "TALENT",
  "REPORT",
];
const actionTypeOptions: AdminActionType[] = [
  "USER_STATUS_CHANGED",
  "TALENT_STATUS_CHANGED",
  "REPORT_RESOLVED",
];

export default function AdminPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("disputes");
  const isLoggedIn = hasStoredAccessToken();
  const isAdmin = getStoredUserRole() === "ADMIN";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isHydrated) {
    return (
      <div className="fixed-container py-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          관리자 권한을 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
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

  if (!isAdmin) {
    return (
      <div className="fixed-container py-12">
        <EmptyState
          title="관리자 권한이 필요합니다."
          description="ADMIN 역할이 있는 계정으로 로그인해 주세요."
          actionLabel="마이페이지로"
          actionHref="/mypage"
        />
      </div>
    );
  }

  return (
    <div className="fixed-container py-10">
      <SectionTitle
        title="관리자"
        description="현재 백엔드에서 제공되는 분쟁 처리와 조치 로그를 관리합니다."
      />

      <div className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition ${
              activeTab === tab.value
                ? "bg-zinc-950 text-white"
                : tab.isReady
                  ? "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
          >
            <span>{tab.label}</span>
            {!tab.isReady ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  activeTab === tab.value
                    ? "bg-white/15 text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                준비중
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "users" ? (
        <AdminComingSoonTab
          title="사용자 관리는 준비 중입니다."
          description="현재 백엔드에 사용자 관리자 API가 없어 목록 조회와 상태 변경을 비활성화했습니다."
        />
      ) : null}
      {activeTab === "talents" ? (
        <AdminComingSoonTab
          title="재능 관리는 준비 중입니다."
          description="현재 백엔드에 재능 관리자 API가 없어 목록 조회와 상태 변경을 비활성화했습니다."
        />
      ) : null}
      {activeTab === "reports" ? (
        <AdminComingSoonTab
          title="신고 관리는 준비 중입니다."
          description="현재 백엔드에 신고 관리자 API가 없어 신고 조회와 처리 기능을 비활성화했습니다."
        />
      ) : null}
      {activeTab === "disputes" ? <AdminDisputesTab /> : null}
      {activeTab === "logs" ? <AdminActionLogsTab /> : null}
    </div>
  );
}

function AdminComingSoonTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AdminPanel>
      <EmptyState title={title} description={description} />
    </AdminPanel>
  );
}

function AdminDisputesTab() {
  const [disputes, setDisputes] = useState<AdminDisputeRes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingTradeId, setProcessingTradeId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getDisputes();
      setDisputes(Array.isArray(response) ? response : []);
    } catch (error) {
      setDisputes([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "분쟁 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDisputes();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDisputes]);

  async function handleResolve(
    tradeId: number,
    verdict: "BUYER_WIN" | "SELLER_WIN",
  ) {
    setProcessingTradeId(tradeId);
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      await adminApi.resolveDispute(tradeId, verdict);
      setSuccessMessage("분쟁 판정이 완료되었습니다.");
      await loadDisputes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "분쟁 처리에 실패했습니다.",
      );
    } finally {
      setProcessingTradeId(null);
    }
  }

  return (
    <AdminPanel>
      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />
      <div className="grid gap-3">
        {disputes.map((dispute) => (
          <article
            key={dispute.tradeId}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-black text-zinc-950">
                  거래 #{dispute.tradeId} · 재능 #{dispute.talentId}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  구매자 #{dispute.buyerId} · 판매자 #{dispute.sellerId} ·{" "}
                  {formatCredit(dispute.creditPrice)}
                </p>
                <p className="mt-3 rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                  {dispute.disputeReason ?? "분쟁 사유가 없습니다."}
                </p>
              </div>
              <div className="grid w-36 gap-2">
                <button
                  type="button"
                  disabled={processingTradeId === dispute.tradeId}
                  onClick={() => handleResolve(dispute.tradeId, "BUYER_WIN")}
                  className="h-10 rounded-md border border-teal-200 text-sm font-bold text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
                >
                  BUYER_WIN
                </button>
                <button
                  type="button"
                  disabled={processingTradeId === dispute.tradeId}
                  onClick={() => handleResolve(dispute.tradeId, "SELLER_WIN")}
                  className="h-10 rounded-md border border-amber-200 text-sm font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                >
                  SELLER_WIN
                </button>
              </div>
            </div>
          </article>
        ))}
        {!isLoading && disputes.length === 0 ? (
          <EmptyState title="분쟁 중인 거래가 없습니다." />
        ) : null}
      </div>
    </AdminPanel>
  );
}

function AdminActionLogsTab() {
  const [logs, setLogs] = useState<AdminActionLogRes[]>([]);
  const [adminId, setAdminId] = useState("");
  const [targetType, setTargetType] = useState<AdminActionTargetType | "">("");
  const [targetId, setTargetId] = useState("");
  const [actionType, setActionType] = useState<AdminActionType | "">("");
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getActionLogs({
        adminId: adminId.trim() ? Number(adminId) : undefined,
        targetType: targetType || undefined,
        targetId: targetId.trim() ? Number(targetId) : undefined,
        actionType: actionType || undefined,
        page,
        size: 20,
      });
      setLogs(response.content);
      setHasNext(response.hasNext);
    } catch (error) {
      setLogs([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "조치 로그를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [actionType, adminId, page, targetId, targetType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLogs();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLogs]);

  return (
    <AdminPanel>
      <FilterRow>
        <TextFilter
          label="adminId"
          value={adminId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setAdminId(value.replace(/\D/g, ""));
          }}
        />
        <SelectFilter
          label="targetType"
          value={targetType}
          values={actionTargetOptions}
          onChange={(value) => {
            setPage(0);
            setTargetType(value as AdminActionTargetType | "");
          }}
        />
        <TextFilter
          label="targetId"
          value={targetId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setTargetId(value.replace(/\D/g, ""));
          }}
        />
        <SelectFilter
          label="actionType"
          value={actionType}
          values={actionTypeOptions}
          onChange={(value) => {
            setPage(0);
            setActionType(value as AdminActionType | "");
          }}
        />
      </FilterRow>

      <AdminMessages isLoading={isLoading} errorMessage={errorMessage} />

      <div className="grid gap-3">
        {logs.map((log) => (
          <article
            key={log.logId}
            className="grid grid-cols-[120px_1fr_160px] gap-4 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <p className="font-black text-zinc-950">#{log.logId}</p>
            <div>
              <p className="font-bold text-zinc-800">
                {log.actionType} · {log.targetType} #{log.targetId}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                관리자 #{log.adminId} · {log.reason ?? "사유 없음"}
              </p>
            </div>
            <p className="text-right text-sm font-semibold text-zinc-500">
              {formatDate(log.createdAt)}
            </p>
          </article>
        ))}
        {!isLoading && logs.length === 0 ? (
          <EmptyState title="조건에 맞는 조치 로그가 없습니다." />
        ) : null}
      </div>

      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 disabled:opacity-60"
        >
          이전
        </button>
        <span className="inline-flex h-10 items-center px-3 text-sm font-bold text-zinc-600">
          page {page + 1}
        </span>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => setPage((current) => current + 1)}
          className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 disabled:opacity-60"
        >
          다음
        </button>
      </div>
    </AdminPanel>
  );
}

function AdminPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
      {children}
    </section>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 grid grid-cols-4 gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      {children}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  values,
  onChange,
  includeAll = true,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="form-input mt-2"
      >
        {includeAll ? <option value="">전체</option> : null}
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="form-input mt-2"
      />
    </label>
  );
}

function AdminMessages({
  isLoading,
  errorMessage,
  successMessage,
}: {
  isLoading: boolean;
  errorMessage?: string | null;
  successMessage?: string;
}) {
  return (
    <>
      {isLoading ? (
        <div className="mb-5 rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm font-semibold text-zinc-600">
          목록을 불러오는 중입니다.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}
      {successMessage ? (
        <p className="mb-5 rounded-md bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          {successMessage}
        </p>
      ) : null}
    </>
  );
}
