"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  adminApi,
  type AdminActionLogRes,
  type AdminActionTargetType,
  type AdminActionType,
  type AdminDisputeRes,
  type AdminTalentReportRes,
  type AdminTalentRes,
  type AdminUserRes,
  type ReportReason,
  type ReportStatus,
  type TalentStatus,
  type UserRole,
  type UserStatus,
} from "@/lib/api";
import { getStoredUserRole, hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate } from "@/utils/format";

type AdminTab = "users" | "talents" | "reports" | "disputes" | "logs";
type AdminUpdatableUserStatus = Exclude<UserStatus, "WITHDRAWN">;

const tabs: { value: AdminTab; label: string }[] = [
  { value: "users", label: "사용자" },
  { value: "talents", label: "재능" },
  { value: "reports", label: "신고" },
  { value: "disputes", label: "분쟁" },
  { value: "logs", label: "조치 로그" },
];

const userStatusOptions: AdminUpdatableUserStatus[] = [
  "ACTIVE",
  "DORMANT",
  "SUSPENDED",
  "BANNED",
];
const userFilterStatusOptions: UserStatus[] = [...userStatusOptions, "WITHDRAWN"];
const userRoleOptions: UserRole[] = ["USER", "ADMIN"];
const talentStatusOptions: TalentStatus[] = ["ACTIVE", "CLOSED"];
const reportStatusOptions: ReportStatus[] = ["PENDING", "RESOLVED"];
const reportReasonOptions: ReportReason[] = [
  "ILLEGAL_OR_CHEATING",
  "EXTERNAL_CONTACT_OR_AD",
  "INAPPROPRIATE_CONTENT",
  "ETC",
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
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
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
        description="사용자, 재능, 신고, 분쟁, 조치 로그를 관리합니다."
      />

      <div className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`h-10 flex-1 rounded-md px-4 text-sm font-bold transition ${
              activeTab === tab.value
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" ? <AdminUsersTab /> : null}
      {activeTab === "talents" ? <AdminTalentsTab /> : null}
      {activeTab === "reports" ? <AdminReportsTab /> : null}
      {activeTab === "disputes" ? <AdminDisputesTab /> : null}
      {activeTab === "logs" ? <AdminActionLogsTab /> : null}
    </div>
  );
}

function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserRes[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserRes | null>(null);
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [keyword, setKeyword] = useState("");
  const [nextStatus, setNextStatus] =
    useState<AdminUpdatableUserStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getUsers({
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        keyword: keyword.trim() || undefined,
        page: 0,
        size: 20,
      });
      setUsers(response.content);
    } catch (error) {
      setUsers([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사용자 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [keyword, roleFilter, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  async function handleSelectUser(userId: number) {
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      const user = await adminApi.getUser(userId);
      setSelectedUser(user);
      setNextStatus(user.status === "WITHDRAWN" ? "ACTIVE" : user.status);
      setReason("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사용자 상세를 불러오지 못했습니다.",
      );
    }
  }

  async function handleUpdateStatus() {
    if (!selectedUser) return;
    if (!reason.trim()) {
      setErrorMessage("상태 변경 사유를 입력해 주세요.");
      return;
    }

    try {
      const updated = await adminApi.updateUserStatus(selectedUser.userId, {
        status: nextStatus,
        reason: reason.trim(),
      });
      setSelectedUser(updated);
      setSuccessMessage("사용자 상태가 변경되었습니다.");
      setReason("");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사용자 상태 변경에 실패했습니다.",
      );
    }
  }

  return (
    <AdminPanel>
      <FilterRow>
        <SelectFilter
          label="상태"
          value={statusFilter}
          values={userFilterStatusOptions}
          onChange={(value) => setStatusFilter(value as UserStatus | "")}
        />
        <SelectFilter
          label="권한"
          value={roleFilter}
          values={userRoleOptions}
          onChange={(value) => setRoleFilter(value as UserRole | "")}
        />
        <TextFilter
          label="검색"
          value={keyword}
          placeholder="이메일 또는 닉네임"
          onChange={setKeyword}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="grid gap-3">
          {users.map((user) => (
            <button
              key={user.userId}
              type="button"
              onClick={() => handleSelectUser(user.userId)}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <p className="font-black text-zinc-950">
                {user.nickname} · {user.email}
              </p>
              <div className="mt-2 flex gap-2">
                <StatusBadge label={user.status} tone="info" />
                <StatusBadge label={user.role} tone="default" />
              </div>
            </button>
          ))}
          {!isLoading && users.length === 0 ? (
            <EmptyState title="조건에 맞는 사용자가 없습니다." />
          ) : null}
        </div>

        <DetailPanel title="사용자 상세">
          {selectedUser ? (
            <>
              <DetailLine label="사용자 ID" value={`#${selectedUser.userId}`} />
              <DetailLine label="이메일" value={selectedUser.email} />
              <DetailLine label="닉네임" value={selectedUser.nickname} />
              <DetailLine label="상태" value={selectedUser.status} />
              <DetailLine label="권한" value={selectedUser.role} />
              <DetailLine
                label="가입일"
                value={formatDate(selectedUser.createdAt)}
              />
              <div className="mt-5 border-t border-zinc-100 pt-5">
                <SelectFilter
                  label="변경 상태"
                  value={nextStatus}
                  values={userStatusOptions}
                  onChange={(value) =>
                    setNextStatus(value as AdminUpdatableUserStatus)
                  }
                  includeAll={false}
                />
                <ReasonInput value={reason} onChange={setReason} />
                <ActionButton onClick={handleUpdateStatus}>
                  상태 변경
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">사용자를 선택해 주세요.</p>
          )}
        </DetailPanel>
      </div>
    </AdminPanel>
  );
}

function AdminTalentsTab() {
  const [talents, setTalents] = useState<AdminTalentRes[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<AdminTalentRes | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<TalentStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [nextStatus, setNextStatus] = useState<TalentStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadTalents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getTalents({
        status: statusFilter || undefined,
        categoryId: categoryId.trim() ? Number(categoryId) : undefined,
        keyword: keyword.trim() || undefined,
        page: 0,
        size: 20,
      });
      setTalents(response.content);
    } catch (error) {
      setTalents([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "재능 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, keyword, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTalents();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTalents]);

  async function handleSelectTalent(talentId: number) {
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      const talent = await adminApi.getTalent(talentId);
      setSelectedTalent(talent);
      setNextStatus(talent.status);
      setReason("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "재능 상세를 불러오지 못했습니다.",
      );
    }
  }

  async function handleUpdateStatus() {
    if (!selectedTalent) return;
    if (!reason.trim()) {
      setErrorMessage("상태 변경 사유를 입력해 주세요.");
      return;
    }

    try {
      const updated = await adminApi.updateTalentStatus(
        selectedTalent.talentId,
        {
          status: nextStatus,
          reason: reason.trim(),
        },
      );
      setSelectedTalent(updated);
      setSuccessMessage("재능 상태가 변경되었습니다.");
      setReason("");
      await loadTalents();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "재능 상태 변경에 실패했습니다.",
      );
    }
  }

  return (
    <AdminPanel>
      <FilterRow>
        <SelectFilter
          label="상태"
          value={statusFilter}
          values={talentStatusOptions}
          onChange={(value) => setStatusFilter(value as TalentStatus | "")}
        />
        <TextFilter
          label="카테고리 ID"
          value={categoryId}
          inputMode="numeric"
          onChange={(value) => setCategoryId(value.replace(/\D/g, ""))}
        />
        <TextFilter
          label="검색"
          value={keyword}
          placeholder="제목 또는 내용"
          onChange={setKeyword}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="grid gap-3">
          {talents.map((talent) => (
            <button
              key={talent.talentId}
              type="button"
              onClick={() => handleSelectTalent(talent.talentId)}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <p className="font-black text-zinc-950">{talent.title}</p>
              <p className="mt-1 text-sm text-zinc-500">
                재능 #{talent.talentId} · 작성자 #{talent.authorId} ·{" "}
                {talent.categoryName}
              </p>
              <div className="mt-2 flex gap-2">
                <StatusBadge label={talent.status} tone="info" />
                <StatusBadge
                  label={formatCredit(talent.creditPrice)}
                  tone="default"
                />
              </div>
            </button>
          ))}
          {!isLoading && talents.length === 0 ? (
            <EmptyState title="조건에 맞는 재능이 없습니다." />
          ) : null}
        </div>

        <DetailPanel title="재능 상세">
          {selectedTalent ? (
            <>
              <DetailLine
                label="재능 ID"
                value={`#${selectedTalent.talentId}`}
              />
              <DetailLine label="제목" value={selectedTalent.title} />
              <DetailLine label="상태" value={selectedTalent.status} />
              <DetailLine
                label="크레딧"
                value={formatCredit(selectedTalent.creditPrice)}
              />
              <DetailLine
                label="완료"
                value={`${selectedTalent.completeCount}건`}
              />
              <div className="mt-5 border-t border-zinc-100 pt-5">
                <SelectFilter
                  label="변경 상태"
                  value={nextStatus}
                  values={talentStatusOptions}
                  onChange={(value) => setNextStatus(value as TalentStatus)}
                  includeAll={false}
                />
                <ReasonInput value={reason} onChange={setReason} />
                <ActionButton onClick={handleUpdateStatus}>
                  상태 변경
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">재능을 선택해 주세요.</p>
          )}
        </DetailPanel>
      </div>
    </AdminPanel>
  );
}

function AdminReportsTab() {
  const [reports, setReports] = useState<AdminTalentReportRes[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<AdminTalentReportRes | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "">("");
  const [reasonFilter, setReasonFilter] = useState<ReportReason | "">("");
  const [memo, setMemo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getReports({
        status: statusFilter || undefined,
        reason: reasonFilter || undefined,
        page: 0,
        size: 20,
      });
      setReports(response.content);
    } catch (error) {
      setReports([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "신고 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [reasonFilter, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReports]);

  async function handleSelectReport(reportId: number) {
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      const report = await adminApi.getReport(reportId);
      setSelectedReport(report);
      setMemo("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "신고 상세를 불러오지 못했습니다.",
      );
    }
  }

  async function handleResolveReport() {
    if (!selectedReport) return;

    try {
      const updated = await adminApi.resolveReport(selectedReport.reportId, {
        memo: memo.trim(),
      });
      setSelectedReport(updated);
      setSuccessMessage("신고가 처리되었습니다.");
      setMemo("");
      await loadReports();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "신고 처리에 실패했습니다.",
      );
    }
  }

  return (
    <AdminPanel>
      <FilterRow>
        <SelectFilter
          label="상태"
          value={statusFilter}
          values={reportStatusOptions}
          onChange={(value) => setStatusFilter(value as ReportStatus | "")}
        />
        <SelectFilter
          label="사유"
          value={reasonFilter}
          values={reportReasonOptions}
          onChange={(value) => setReasonFilter(value as ReportReason | "")}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="grid gap-3">
          {reports.map((report) => (
            <button
              key={report.reportId}
              type="button"
              onClick={() => handleSelectReport(report.reportId)}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <p className="font-black text-zinc-950">
                신고 #{report.reportId} · 재능 #{report.talentId}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                {report.description ?? "상세 설명 없음"}
              </p>
              <div className="mt-2 flex gap-2">
                <StatusBadge label={report.status} tone="warning" />
                <StatusBadge label={report.reason} tone="default" />
              </div>
            </button>
          ))}
          {!isLoading && reports.length === 0 ? (
            <EmptyState title="조건에 맞는 신고가 없습니다." />
          ) : null}
        </div>

        <DetailPanel title="신고 상세">
          {selectedReport ? (
            <>
              <DetailLine
                label="신고 ID"
                value={`#${selectedReport.reportId}`}
              />
              <DetailLine
                label="대상 재능"
                value={`#${selectedReport.talentId}`}
              />
              <DetailLine
                label="신고자"
                value={`#${selectedReport.reporterId}`}
              />
              <DetailLine label="사유" value={selectedReport.reason} />
              <DetailLine label="상태" value={selectedReport.status} />
              <DetailLine
                label="상세"
                value={selectedReport.description ?? "-"}
              />
              <div className="mt-5 border-t border-zinc-100 pt-5">
                <label className="block text-sm font-semibold text-zinc-800">
                  처리 메모
                  <textarea
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    rows={4}
                    className="form-input mt-2 min-h-24 resize-none"
                  />
                </label>
                <ActionButton
                  disabled={selectedReport.status !== "PENDING"}
                  onClick={handleResolveReport}
                >
                  처리 완료
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">신고를 선택해 주세요.</p>
          )}
        </DetailPanel>
      </div>
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

  async function handleResolve(tradeId: number, verdict: "BUYER_WIN" | "SELLER_WIN") {
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
  return <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">{children}</section>;
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

function ReasonInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm font-semibold text-zinc-800">
      사유
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="form-input mt-2 min-h-20 resize-none"
      />
    </label>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-4 h-10 w-full rounded-md bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
    >
      {children}
    </button>
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

function DetailPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="font-black text-zinc-950">{title}</p>
      <div className="mt-4">{children}</div>
    </aside>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-zinc-100 py-2">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-zinc-950">
        {value}
      </p>
    </div>
  );
}
