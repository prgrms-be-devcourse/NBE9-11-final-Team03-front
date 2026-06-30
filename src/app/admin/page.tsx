"use client";

import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Gavel,
  History,
  LayoutDashboard,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Listbox } from "@/components/common/Listbox";
import {
  adminApi,
  categoryApi,
  type AdminActionLogRes,
  type AdminActionTargetType,
  type AdminActionType,
  type AdminDashboardSummaryRes,
  type AdminDisputeRes,
  type AdminPageRes,
  type AdminTalentReportRes,
  type AdminTalentRes,
  type AdminTradeRes,
  type AdminUserRes,
  type CategoryRes,
  type DisputeVerdict,
  type ReportReason,
  type ReportStatus,
  type TalentStatus,
  type TradeStatus,
  type TradeType,
  type UserRole,
  type UserStatus,
} from "@/lib/api";
import { getStoredUserRole, hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate, formatEstimatedDuration } from "@/utils/format";

type AdminTab =
  | "overview"
  | "users"
  | "talents"
  | "reports"
  | "trades"
  | "disputes"
  | "logs";

type AdminMutableUserStatus = Exclude<UserStatus, "WITHDRAWN">;
type BreakdownTone =
  | "lime"
  | "gray"
  | "orange"
  | "red"
  | "yellow"
  | "sky"
  | "violet";

const PAGE_SIZE = 12;

const tabs: {
  value: AdminTab;
  label: string;
  description: string;
  Icon: typeof LayoutDashboard;
}[] = [
    {
      value: "overview",
      label: "요약",
      description: "서비스 운영 지표",
      Icon: LayoutDashboard,
    },
    {
      value: "users",
      label: "사용자",
      description: "계정 조회와 상태 변경",
      Icon: Users,
    },
    {
      value: "talents",
      label: "재능",
      description: "게시글 조회와 노출 관리",
      Icon: FileText,
    },
    {
      value: "reports",
      label: "신고",
      description: "신고 조회와 처리",
      Icon: AlertTriangle,
    },
    {
      value: "trades",
      label: "거래",
      description: "거래 상태와 참여자 조회",
      Icon: ClipboardList,
    },
    {
      value: "disputes",
      label: "분쟁",
      description: "분쟁 거래 판정",
      Icon: Gavel,
    },
    {
      value: "logs",
      label: "로그",
      description: "관리자 조치 이력",
      Icon: History,
    },
  ];

const userStatusOptions: UserStatus[] = [
  "ACTIVE",
  "DORMANT",
  "SUSPENDED",
  "WITHDRAWN",
  "BANNED",
];
const mutableUserStatusOptions: AdminMutableUserStatus[] = [
  "ACTIVE",
  "DORMANT",
  "SUSPENDED",
  "BANNED",
];
const userRoleOptions: UserRole[] = ["USER", "ADMIN"];
const talentStatusOptions: TalentStatus[] = ["ACTIVE", "CLOSED"];
const reportStatusOptions: ReportStatus[] = ["PENDING", "RESOLVED"];
const reportReasonOptions: ReportReason[] = [
  "ILLEGAL_OR_CHEATING",
  "EXTERNAL_CONTACT_OR_AD",
  "INAPPROPRIATE_CONTENT",
  "ETC",
];
const tradeStatusOptions: TradeStatus[] = [
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "AWAITING_PARTNER",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];
const tradeTypeOptions: TradeType[] = ["PURCHASE", "SWAP"];
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

const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "활성",
  DORMANT: "휴면",
  SUSPENDED: "정지",
  WITHDRAWN: "탈퇴",
  BANNED: "차단",
};

const userRoleLabels: Record<UserRole, string> = {
  USER: "사용자",
  ADMIN: "관리자",
};

const talentStatusLabels: Record<TalentStatus, string> = {
  ACTIVE: "노출",
  CLOSED: "숨김",
};

const reportStatusLabels: Record<ReportStatus, string> = {
  PENDING: "대기",
  RESOLVED: "완료",
};

const reportReasonLabels: Record<ReportReason, string> = {
  ILLEGAL_OR_CHEATING: "불법/부정행위",
  EXTERNAL_CONTACT_OR_AD: "외부 연락/광고",
  INAPPROPRIATE_CONTENT: "부적절한 콘텐츠",
  ETC: "기타",
};

const tradeStatusLabels: Record<TradeStatus, string> = {
  IN_PROGRESS: "진행 중",
  UNDER_REVIEW: "검토 중",
  AWAITING_PARTNER: "상태 대기",
  COMPLETED: "완료",
  CANCELLED: "취소",
  DISPUTED: "분쟁",
};

const tradeTypeLabels: Record<TradeType, string> = {
  PURCHASE: "구매",
  SWAP: "교환",
};

const targetTypeLabels: Record<AdminActionTargetType, string> = {
  USER: "사용자",
  TALENT: "재능",
  REPORT: "신고",
};

const actionTypeLabels: Record<AdminActionType, string> = {
  USER_STATUS_CHANGED: "사용자 상태 변경",
  TALENT_STATUS_CHANGED: "재능 상태 변경",
  REPORT_RESOLVED: "신고 처리",
};

const userStatusBreakdownOrder: UserStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DORMANT",
  "WITHDRAWN",
];
const talentStatusBreakdownOrder: TalentStatus[] = ["ACTIVE", "CLOSED"];
const tradeStatusBreakdownOrder: TradeStatus[] = [
  "IN_PROGRESS",
  "CANCELLED",
  "COMPLETED",
  "AWAITING_PARTNER",
  "UNDER_REVIEW",
  "DISPUTED",
];
const reportStatusBreakdownOrder: ReportStatus[] = ["PENDING", "RESOLVED"];

const userStatusBreakdownTones: Record<UserStatus, BreakdownTone> = {
  ACTIVE: "lime",
  WITHDRAWN: "gray",
  SUSPENDED: "orange",
  BANNED: "red",
  DORMANT: "yellow",
};
const talentStatusBreakdownTones: Record<TalentStatus, BreakdownTone> = {
  ACTIVE: "lime",
  CLOSED: "orange",
};
const tradeStatusBreakdownTones: Record<TradeStatus, BreakdownTone> = {
  IN_PROGRESS: "orange",
  CANCELLED: "yellow",
  COMPLETED: "lime",
  DISPUTED: "red",
  AWAITING_PARTNER: "sky",
  UNDER_REVIEW: "violet",
};
const reportStatusBreakdownTones: Record<ReportStatus, BreakdownTone> = {
  RESOLVED: "lime",
  PENDING: "orange",
};

const breakdownToneClassNames: Record<
  BreakdownTone,
  { card: string; dot: string; bar: string; accent: string }
> = {
  lime: {
    card: "border-lime-200/80 bg-gradient-to-br from-lime-50 via-white to-white",
    dot: "bg-lime-500",
    bar: "from-lime-500 to-emerald-400",
    accent: "text-lime-700",
  },
  gray: {
    card: "border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-white",
    dot: "bg-zinc-400",
    bar: "from-zinc-400 to-zinc-300",
    accent: "text-zinc-600",
  },
  orange: {
    card: "border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-white",
    dot: "bg-orange-500",
    bar: "from-orange-500 to-amber-400",
    accent: "text-orange-700",
  },
  red: {
    card: "border-red-200/80 bg-gradient-to-br from-red-50 via-white to-white",
    dot: "bg-red-500",
    bar: "from-red-500 to-rose-400",
    accent: "text-red-700",
  },
  yellow: {
    card: "border-yellow-200/80 bg-gradient-to-br from-yellow-50 via-white to-white",
    dot: "bg-yellow-500",
    bar: "from-yellow-500 to-amber-300",
    accent: "text-yellow-700",
  },
  sky: {
    card: "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-white",
    dot: "bg-sky-500",
    bar: "from-sky-500 to-cyan-400",
    accent: "text-sky-700",
  },
  violet: {
    card: "border-[#d9ccff]/80 bg-gradient-to-br from-[#f4f0ff] via-white to-white",
    dot: "bg-[#8c5bff]",
    bar: "from-[#8c5bff] to-[#6fd6e8]",
    accent: "text-[#6f3cff]",
  },
};

export default function AdminPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsHydrated(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isHydrated) {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-12">
          <StatusPanel>관리자 권한을 확인하는 중입니다.</StatusPanel>
        </div>
      </main>
    );
  }

  if (!hasStoredAccessToken()) {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-12">
          <EmptyState
            title="로그인 후 이용해 주세요."
            actionLabel="로그인"
            actionHref="/login"
          />
        </div>
      </main>
    );
  }

  if (getStoredUserRole() !== "ADMIN") {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-12">
          <EmptyState
            title="관리자 권한이 필요합니다."
            description="ADMIN 역할이 있는 계정으로 로그인해 주세요."
            actionLabel="마이페이지로"
            actionHref="/mypage"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-white">
      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="border-b border-[#ded6ff] pb-8 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="baton-page-title mt-3 !font-bold">
              관리자
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
              사용자, 재능, 신고, 거래와 분쟁을 백엔드 관리자 API로 직접 관리합니다.
            </p>
          </div>
        </header>

        <nav
          aria-label="관리자 메뉴"
          className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.value;
            const Icon = tab.Icon;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`grid min-h-[138px] cursor-pointer grid-rows-[58px_1fr] overflow-hidden rounded-lg border p-0 text-center transition hover:-translate-y-0.5 ${selected
                  ? "border-[#8c5bff] bg-[#8c5bff] text-white shadow-lg shadow-violet-400/20"
                  : "border-[#ded6ff] bg-white text-zinc-700 shadow-sm shadow-violet-950/[0.03] hover:border-[#d9ccff] hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
                }`}
              >
                <span
                  className={`flex h-full items-center justify-center gap-3 border-b px-5 text-lg font-black leading-none ${selected ? "border-white/20" : "border-[#f0ebff]"
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </span>
                <span
                  className={`flex h-full items-center justify-center whitespace-nowrap px-5 py-4 text-sm font-bold leading-none ${selected ? "text-white/85" : "text-zinc-500"
                  }`}
                >
                  {tab.description}
                </span>
              </button>
            );
          })}
        </nav>

        <section className="mt-8">
          {activeTab === "overview" ? <AdminOverviewTab /> : null}
          {activeTab === "users" ? <AdminUsersTab /> : null}
          {activeTab === "talents" ? <AdminTalentsTab /> : null}
          {activeTab === "reports" ? <AdminReportsTab /> : null}
          {activeTab === "trades" ? <AdminTradesTab /> : null}
          {activeTab === "disputes" ? <AdminDisputesTab /> : null}
          {activeTab === "logs" ? <AdminActionLogsTab /> : null}
        </section>
      </div>
    </main>
  );
}

function AdminOverviewTab() {
  const [summary, setSummary] = useState<AdminDashboardSummaryRes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setSummary(await adminApi.getDashboardSummary());
    } catch (error) {
      setSummary(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "관리자 요약 정보를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSummary();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSummary]);

  return (
    <AdminPanel
      title="운영 요약"
      description="백엔드 관리자 대시보드 API에서 집계한 현재 서비스 상태입니다."
      action={<RefreshButton onClick={loadSummary} disabled={isLoading} />}
    >
      <AdminMessages isLoading={isLoading} errorMessage={errorMessage} />

      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="사용자" value={summary.totalUsers} />
            <SummaryCard label="재능" value={summary.totalTalents} />
            <SummaryCard label="거래" value={summary.totalTrades} />
            <SummaryCard label="신고" value={summary.totalReports} />
            <SummaryCard label="에스크로" value={summary.totalEscrows} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBreakdown
              title="사용자 상태"
              items={summary.usersByStatus}
              order={userStatusBreakdownOrder}
              getLabel={(key) => userStatusLabels[key as UserStatus] ?? key}
              getTone={(key) =>
                userStatusBreakdownTones[key as UserStatus] ?? "gray"
              }
            />
            <StatusBreakdown
              title="재능 상태"
              items={summary.talentsByStatus}
              order={talentStatusBreakdownOrder}
              getLabel={(key) => talentStatusLabels[key as TalentStatus] ?? key}
              getTone={(key) =>
                talentStatusBreakdownTones[key as TalentStatus] ?? "gray"
              }
            />
            <StatusBreakdown
              title="거래 상태"
              items={summary.tradesByStatus}
              order={tradeStatusBreakdownOrder}
              getLabel={(key) => tradeStatusLabels[key as TradeStatus] ?? key}
              getTone={(key) =>
                tradeStatusBreakdownTones[key as TradeStatus] ?? "gray"
              }
            />
            <StatusBreakdown
              title="신고 상태"
              items={summary.reportsByStatus}
              order={reportStatusBreakdownOrder}
              getLabel={(key) => reportStatusLabels[key as ReportStatus] ?? key}
              getTone={(key) =>
                reportStatusBreakdownTones[key as ReportStatus] ?? "gray"
              }
            />
          </div>
        </>
      ) : null}
    </AdminPanel>
  );
}

function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserRes[]>([]);
  const [status, setStatus] = useState<UserStatus | "">("");
  const [role, setRole] = useState<UserRole | "">("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getUsers({
        status: status || undefined,
        role: role || undefined,
        keyword: keyword.trim() || undefined,
        page,
        size: PAGE_SIZE,
      });
      setUsers(response.content);
      setPageInfo(toPageInfo(response));
    } catch (error) {
      setUsers([]);
      setPageInfo(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사용자 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [keyword, page, role, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  async function handleUpdateStatus(
    user: AdminUserRes,
    nextStatus: AdminMutableUserStatus,
  ) {
    if (user.status === nextStatus) {
      return;
    }

    const reason = window.prompt(
      `${user.nickname} 사용자를 ${userStatusLabels[nextStatus]} 상태로 변경하는 사유를 입력해 주세요.`,
      "",
    );

    if (reason === null) {
      return;
    }

    setProcessingUserId(user.userId);
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      await adminApi.updateUserStatus(user.userId, {
        status: nextStatus,
        reason: reason.trim(),
      });
      setSuccessMessage("사용자 상태가 변경되었습니다.");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "사용자 상태 변경에 실패했습니다.",
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  return (
    <AdminPanel
      title="사용자 관리"
      description="이메일, 닉네임, 상태, 권한으로 사용자를 조회하고 계정 상태를 조정합니다."
      action={<RefreshButton onClick={loadUsers} disabled={isLoading} />}
    >
      <FilterRow>
        <SelectFilter
          label="상태"
          value={status}
          values={userStatusOptions}
          getLabel={(value) => userStatusLabels[value as UserStatus]}
          onChange={(value) => {
            setPage(0);
            setStatus(value as UserStatus | "");
          }}
        />
        <SelectFilter
          label="권한"
          value={role}
          values={userRoleOptions}
          getLabel={(value) => userRoleLabels[value as UserRole]}
          onChange={(value) => {
            setPage(0);
            setRole(value as UserRole | "");
          }}
        />
        <TextFilter
          label="검색어"
          value={keyword}
          placeholder="이메일 또는 닉네임"
          onChange={(value) => {
            setPage(0);
            setKeyword(value);
          }}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid gap-3">
        {users.map((user) => (
          <article
            key={user.userId}
            className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:py-6 sm:pl-12 sm:pr-8 2xl:pl-14 2xl:pr-10"
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(300px,0.72fr)_minmax(340px,0.72fr)] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xl font-black text-zinc-950">
                    {user.nickname}
                  </p>
                  <StatusChip tone={user.status === "ACTIVE" ? "success" : "warning"}>
                    {userStatusLabels[user.status]}
                  </StatusChip>
                  <StatusChip tone={user.role === "ADMIN" ? "violet" : "default"}>
                    {userRoleLabels[user.role]}
                  </StatusChip>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-zinc-500">
                  #{user.userId} · {user.email}
                </p>
                <p className="mt-2 truncate text-sm font-semibold leading-6 text-zinc-600">
                  닉네임 {user.nickname}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 text-sm">
                <SmallMetric label="신뢰" value={formatNumber(user.trustScore)} />
                <SmallMetric label="가입" value={formatDate(user.createdAt)} />
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[360px] xl:translate-x-20 xl:justify-self-end xl:grid-cols-4 2xl:w-[350px]">
                {mutableUserStatusOptions.map((nextStatus) => (
                  <ActionButton
                    key={nextStatus}
                    size="compact"
                    disabled={
                      processingUserId === user.userId ||
                      user.status === nextStatus
                    }
                    onClick={() => handleUpdateStatus(user, nextStatus)}
                  >
                    {userStatusLabels[nextStatus]}
                  </ActionButton>
                ))}
              </div>
            </div>
          </article>
        ))}
        {!isLoading && users.length === 0 ? (
          <EmptyState title="조건에 맞는 사용자가 없습니다." />
        ) : null}
      </div>

      <PageControls pageInfo={pageInfo} page={page} setPage={setPage} />
    </AdminPanel>
  );
}

function AdminTalentsTab() {
  const [talents, setTalents] = useState<AdminTalentRes[]>([]);
  const [categories, setCategories] = useState<CategoryRes[]>([]);
  const [status, setStatus] = useState<TalentStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingTalentId, setProcessingTalentId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const categoryValues = useMemo(
    () => categories.map((category) => String(category.categoryId)),
    [categories],
  );
  const categoryLabelById = useMemo(
    () =>
      new Map(
        categories.map((category) => [String(category.categoryId), category.name]),
      ),
    [categories],
  );

  const loadTalents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getTalents({
        status: status || undefined,
        categoryId: parsePositiveNumber(categoryId),
        keyword: keyword.trim() || undefined,
        page,
        size: PAGE_SIZE,
      });
      setTalents(response.content);
      setPageInfo(toPageInfo(response));
    } catch (error) {
      setTalents([]);
      setPageInfo(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "재능 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, keyword, page, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTalents();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTalents]);

  useEffect(() => {
    let ignore = false;

    async function loadCategories(): Promise<void> {
      try {
        const response = await categoryApi.getList();
        const nextCategories = [...(Array.isArray(response) ? response : [])].sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.categoryId - right.categoryId,
        );

        if (!ignore) {
          setCategories(nextCategories);
        }
      } catch {
        if (!ignore) {
          setCategories([]);
        }
      }
    }

    void loadCategories();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleUpdateStatus(
    talent: AdminTalentRes,
    nextStatus: TalentStatus,
  ) {
    if (talent.status === nextStatus) {
      return;
    }

    const reason = window.prompt(
      `"${talent.title}" 재능을 ${talentStatusLabels[nextStatus]} 상태로 변경하는 사유를 입력해 주세요.`,
      "",
    );

    if (reason === null) {
      return;
    }

    setProcessingTalentId(talent.talentId);
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      await adminApi.updateTalentStatus(talent.talentId, {
        status: nextStatus,
        reason: reason.trim(),
      });
      setSuccessMessage("재능 상태가 변경되었습니다.");
      await loadTalents();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "재능 상태 변경에 실패했습니다.",
      );
    } finally {
      setProcessingTalentId(null);
    }
  }

  return (
    <AdminPanel
      title="재능 관리"
      description="등록된 재능 게시글을 조회하고 노출 상태를 조정합니다."
      action={<RefreshButton onClick={loadTalents} disabled={isLoading} />}
    >
      <FilterRow>
        <SelectFilter
          label="상태"
          value={status}
          values={talentStatusOptions}
          getLabel={(value) => talentStatusLabels[value as TalentStatus]}
          onChange={(value) => {
            setPage(0);
            setStatus(value as TalentStatus | "");
          }}
        />
        <SelectFilter
          label="카테고리"
          value={categoryId}
          values={categoryValues}
          getLabel={(value) => categoryLabelById.get(value) ?? value}
          onChange={(value) => {
            setPage(0);
            setCategoryId(value);
          }}
        />
        <TextFilter
          label="검색어"
          value={keyword}
          placeholder="제목 또는 내용"
          onChange={(value) => {
            setPage(0);
            setKeyword(value);
          }}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid gap-3">
        {talents.map((talent) => (
          <article
            key={talent.talentId}
            className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:py-6 sm:pl-12 sm:pr-8 2xl:pl-14 2xl:pr-10"
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,1fr)_476px_176px] xl:items-center">
              <div className="relative min-w-0 text-left xl:pl-12">
                <div className="relative flex min-w-0 items-center">
                  <span className="absolute left-0 top-1/2 hidden -translate-x-12 -translate-y-1/2 xl:block">
                    <StatusChip tone={talent.status === "ACTIVE" ? "success" : "danger"}>
                      {talentStatusLabels[talent.status]}
                    </StatusChip>
                  </span>
                  <p className="min-w-0 truncate whitespace-nowrap text-xl font-black leading-tight text-zinc-950">
                    {talent.title}
                  </p>
                </div>
                <div className="mt-2 xl:hidden">
                  <StatusChip tone={talent.status === "ACTIVE" ? "success" : "danger"}>
                    {talentStatusLabels[talent.status]}
                  </StatusChip>
                </div>
                <p className="mt-2 min-w-0 truncate whitespace-nowrap text-sm font-semibold leading-6 text-zinc-500">
                  재능 #{talent.talentId} · 작성자 #{talent.authorId} · {talent.categoryName}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-4 xl:w-[476px] xl:justify-self-center">
                <SmallMetric label="크레딧" value={formatCredit(talent.creditPrice)} />
                <SmallMetric
                  label="기간"
                  value={formatEstimatedDuration(talent.estimatedHours)}
                />
                <SmallMetric label="조회" value={`${talent.viewCount}회`} />
                <SmallMetric label="완료" value={`${talent.completeCount}건`} />
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 xl:w-[176px] xl:justify-self-end">
                {talentStatusOptions.map((nextStatus) => (
                  <ActionButton
                    key={nextStatus}
                    size="compact"
                    disabled={
                      processingTalentId === talent.talentId ||
                      talent.status === nextStatus
                    }
                    onClick={() => handleUpdateStatus(talent, nextStatus)}
                  >
                    {talentStatusLabels[nextStatus]}
                  </ActionButton>
                ))}
              </div>
            </div>
          </article>
        ))}
        {!isLoading && talents.length === 0 ? (
          <EmptyState title="조건에 맞는 재능이 없습니다." />
        ) : null}
      </div>

      <PageControls pageInfo={pageInfo} page={page} setPage={setPage} />
    </AdminPanel>
  );
}

function AdminReportsTab() {
  const [reports, setReports] = useState<AdminTalentReportRes[]>([]);
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [reason, setReason] = useState<ReportReason | "">("");
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingReportId, setProcessingReportId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getReports({
        status: status || undefined,
        reason: reason || undefined,
        page,
        size: PAGE_SIZE,
      });
      setReports(response.content);
      setPageInfo(toPageInfo(response));
    } catch (error) {
      setReports([]);
      setPageInfo(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "신고 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, reason, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReports]);

  async function handleResolve(report: AdminTalentReportRes) {
    const memo = window.prompt("신고 처리 메모를 입력해 주세요.", "");

    if (memo === null) {
      return;
    }

    setProcessingReportId(report.reportId);
    setErrorMessage(null);
    setSuccessMessage("");

    try {
      await adminApi.resolveReport(report.reportId, { memo: memo.trim() });
      setSuccessMessage("신고가 처리되었습니다.");
      await loadReports();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "신고 처리에 실패했습니다.",
      );
    } finally {
      setProcessingReportId(null);
    }
  }

  return (
    <AdminPanel
      title="신고 관리"
      description="재능 신고 내역을 조회하고 처리 완료 상태로 변경합니다."
      action={<RefreshButton onClick={loadReports} disabled={isLoading} />}
    >
      <FilterRow>
        <SelectFilter
          label="상태"
          value={status}
          values={reportStatusOptions}
          getLabel={(value) => reportStatusLabels[value as ReportStatus]}
          onChange={(value) => {
            setPage(0);
            setStatus(value as ReportStatus | "");
          }}
        />
        <SelectFilter
          label="사유"
          value={reason}
          values={reportReasonOptions}
          getLabel={(value) => reportReasonLabels[value as ReportReason]}
          onChange={(value) => {
            setPage(0);
            setReason(value as ReportReason | "");
          }}
        />
      </FilterRow>

      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid gap-3">
        {reports.map((report) => (
          <article
            key={report.reportId}
            className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:px-7"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(170px,0.28fr)] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-black text-zinc-950">
                    신고 #{report.reportId}
                  </p>
                  <StatusChip tone={report.status === "PENDING" ? "warning" : "success"}>
                    {reportStatusLabels[report.status]}
                  </StatusChip>
                  <StatusChip tone="danger">
                    {reportReasonLabels[report.reason]}
                  </StatusChip>
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  재능 #{report.talentId} · 신고자 #{report.reporterId} · {formatDate(report.createdAt)}
                </p>
                <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm font-semibold leading-6 text-zinc-700">
                  {report.description || "상세 설명이 없습니다."}
                </p>
              </div>

              <ActionButton
                disabled={
                  report.status === "RESOLVED" ||
                  processingReportId === report.reportId
                }
                onClick={() => handleResolve(report)}
              >
                처리 완료
              </ActionButton>
            </div>
          </article>
        ))}
        {!isLoading && reports.length === 0 ? (
          <EmptyState title="조건에 맞는 신고가 없습니다." />
        ) : null}
      </div>

      <PageControls pageInfo={pageInfo} page={page} setPage={setPage} />
    </AdminPanel>
  );
}

function AdminTradesTab() {
  const [trades, setTrades] = useState<AdminTradeRes[]>([]);
  const [status, setStatus] = useState<TradeStatus | "">("");
  const [tradeType, setTradeType] = useState<TradeType | "">("");
  const [buyerId, setBuyerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrades = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getTrades({
        status: status || undefined,
        tradeType: tradeType || undefined,
        buyerId: parsePositiveNumber(buyerId),
        sellerId: parsePositiveNumber(sellerId),
        page,
        size: PAGE_SIZE,
      });
      setTrades(response.content);
      setPageInfo(toPageInfo(response));
    } catch (error) {
      setTrades([]);
      setPageInfo(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "거래 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [buyerId, page, sellerId, status, tradeType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTrades();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTrades]);

  return (
    <AdminPanel
      title="거래 관리"
      description="거래 유형, 상태, 구매자/판매자 기준으로 거래를 조회합니다."
      action={<RefreshButton onClick={loadTrades} disabled={isLoading} />}
    >
      <FilterRow>
        <SelectFilter
          label="상태"
          value={status}
          values={tradeStatusOptions}
          getLabel={(value) => tradeStatusLabels[value as TradeStatus]}
          onChange={(value) => {
            setPage(0);
            setStatus(value as TradeStatus | "");
          }}
        />
        <SelectFilter
          label="유형"
          value={tradeType}
          values={tradeTypeOptions}
          getLabel={(value) => tradeTypeLabels[value as TradeType]}
          onChange={(value) => {
            setPage(0);
            setTradeType(value as TradeType | "");
          }}
        />
        <TextFilter
          label="구매자 ID"
          value={buyerId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setBuyerId(onlyDigits(value));
          }}
        />
        <TextFilter
          label="판매자 ID"
          value={sellerId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setSellerId(onlyDigits(value));
          }}
        />
      </FilterRow>

      <AdminMessages isLoading={isLoading} errorMessage={errorMessage} />

      <div className="grid gap-3">
        {trades.map((trade) => (
          <article
            key={trade.tradeId}
            className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:px-7"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-black text-zinc-950">
                    거래 #{trade.tradeId}
                  </p>
                  <StatusChip tone={trade.status === "DISPUTED" ? "danger" : "violet"}>
                    {tradeStatusLabels[trade.status]}
                  </StatusChip>
                  <StatusChip tone="default">
                    {tradeTypeLabels[trade.tradeType]}
                  </StatusChip>
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  재능 #{trade.talentId} · {formatCredit(trade.creditPrice)}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <SmallMetric label="구매자" value={`#${trade.buyerId}`} />
                <SmallMetric label="판매자" value={`#${trade.sellerId}`} />
                <SmallMetric label="그룹" value={trade.tradeGroupId ? `#${trade.tradeGroupId}` : "-"} />
                <SmallMetric label="생성" value={formatDate(trade.createdAt)} />
              </div>
            </div>
          </article>
        ))}
        {!isLoading && trades.length === 0 ? (
          <EmptyState title="조건에 맞는 거래가 없습니다." />
        ) : null}
      </div>

      <PageControls pageInfo={pageInfo} page={page} setPage={setPage} />
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

  async function handleResolve(tradeId: number, verdict: DisputeVerdict) {
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
    <AdminPanel
      title="분쟁 관리"
      description="분쟁 상태의 거래를 조회하고 구매자/판매자 승소 판정을 내립니다."
      action={<RefreshButton onClick={loadDisputes} disabled={isLoading} />}
    >
      <AdminMessages
        isLoading={isLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <div className="grid gap-3">
        {disputes.map((dispute) => (
          <article
            key={dispute.tradeId}
            className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:px-7"
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,0.9fr)_minmax(180px,0.48fr)] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-black text-zinc-950">
                    거래 #{dispute.tradeId}
                  </p>
                  <StatusChip tone="danger">
                    {tradeStatusLabels[dispute.tradeStatus]}
                  </StatusChip>
                  <StatusChip tone="warning">
                    {dispute.escrowStatus}
                  </StatusChip>
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  재능 #{dispute.talentId} · {formatCredit(dispute.creditPrice)}
                </p>
                <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm font-semibold leading-6 text-zinc-700">
                  {dispute.disputeReason ?? "분쟁 사유가 없습니다."}
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 text-sm">
                <SmallMetric label="구매자" value={`#${dispute.buyerId}`} />
                <SmallMetric label="판매자" value={`#${dispute.sellerId}`} />
                <SmallMetric label="유형" value={tradeTypeLabels[dispute.tradeType]} />
                <SmallMetric label="생성" value={formatDate(dispute.createdAt)} />
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2">
                <ActionButton
                  disabled={processingTradeId === dispute.tradeId}
                  onClick={() => handleResolve(dispute.tradeId, "BUYER_WIN")}
                >
                  구매자 승소
                </ActionButton>
                <ActionButton
                  disabled={processingTradeId === dispute.tradeId}
                  onClick={() => handleResolve(dispute.tradeId, "SELLER_WIN")}
                >
                  판매자 승소
                </ActionButton>
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
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await adminApi.getActionLogs({
        adminId: parsePositiveNumber(adminId),
        targetType: targetType || undefined,
        targetId: parsePositiveNumber(targetId),
        actionType: actionType || undefined,
        page,
        size: PAGE_SIZE,
      });
      setLogs(response.content);
      setPageInfo(toPageInfo(response));
    } catch (error) {
      setLogs([]);
      setPageInfo(null);
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
    <AdminPanel
      title="조치 로그"
      description="사용자, 재능, 신고에 대한 관리자 조치 이력을 추적합니다."
      action={<RefreshButton onClick={loadLogs} disabled={isLoading} />}
    >
      <FilterRow>
        <TextFilter
          label="관리자 ID"
          value={adminId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setAdminId(onlyDigits(value));
          }}
        />
        <SelectFilter
          label="대상"
          value={targetType}
          values={actionTargetOptions}
          getLabel={(value) => targetTypeLabels[value as AdminActionTargetType]}
          onChange={(value) => {
            setPage(0);
            setTargetType(value as AdminActionTargetType | "");
          }}
        />
        <TextFilter
          label="대상 ID"
          value={targetId}
          inputMode="numeric"
          onChange={(value) => {
            setPage(0);
            setTargetId(onlyDigits(value));
          }}
        />
        <SelectFilter
          label="조치"
          value={actionType}
          values={actionTypeOptions}
          getLabel={(value) => actionTypeLabels[value as AdminActionType]}
          onChange={(value) => {
            setPage(0);
            setActionType(value as AdminActionType | "");
          }}
        />
      </FilterRow>

      <AdminMessages isLoading={isLoading} errorMessage={errorMessage} />

      <div className="grid gap-3">
        {logs.map((log) => {
          const targetLabel = `${targetTypeLabels[log.targetType]} #${log.targetId}`;
          const actionLabel = actionTypeLabels[log.actionType];

          return (
            <article
              key={log.logId}
              className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.03] sm:px-7"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#d9ccff] bg-[#f4f0ff] text-base font-black text-[#8c5bff]">
                  #{log.logId}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone="violet">{actionLabel}</StatusChip>
                    <StatusChip tone="default">{targetLabel}</StatusChip>
                  </div>

                  <h3 className="mt-3 text-xl font-black leading-7 text-zinc-950">
                    {getActionLogSummary(log)}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
                    관리자 #{log.adminId} · {actionLabel} ·{" "}
                    {formatDate(log.createdAt)}
                  </p>

                  {log.reason ? (
                    <p className="mt-3 rounded-lg bg-[#fbf9ff] px-4 py-3 text-sm font-semibold leading-6 text-zinc-600">
                      {log.reason}
                    </p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <SmallMetric label="관리자 ID" value={`#${log.adminId}`} />
                    <SmallMetric label="대상" value={targetTypeLabels[log.targetType]} />
                    <SmallMetric label="대상 ID" value={`#${log.targetId}`} />
                    <SmallMetric label="조치" value={actionLabel} />
                    <SmallMetric label="날짜" value={formatDate(log.createdAt)} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!isLoading && logs.length === 0 ? (
          <EmptyState title="조건에 맞는 조치 로그가 없습니다." />
        ) : null}
      </div>

      <PageControls pageInfo={pageInfo} page={page} setPage={setPage} />
    </AdminPanel>
  );
}

function getActionLogSummary(log: AdminActionLogRes): string {
  const targetLabel = `${targetTypeLabels[log.targetType]} #${log.targetId}`;

  switch (log.actionType) {
    case "USER_STATUS_CHANGED":
    case "TALENT_STATUS_CHANGED":
      return `${targetLabel} 상태를 변경했습니다.`;
    case "REPORT_RESOLVED":
      return `${targetLabel} 처리를 완료했습니다.`;
    default:
      return `${targetLabel} 관리자 조치를 기록했습니다.`;
  }
}

function AdminPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 border-b border-[#f0ebff] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-950 sm:text-3xl">{title}</h2>
          <p className="mt-3 text-base font-semibold leading-7 text-zinc-500 sm:text-lg sm:leading-8">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  values,
  getLabel,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  getLabel: (value: string) => string;
  onChange: (value: string) => void;
}) {
  const options = [
    { value: "", label: "전체" },
    ...values.map((item) => ({
      value: item,
      label: getLabel(item),
    })),
  ];

  return (
    <div className="block text-sm font-black text-zinc-800">
      <p>{label}</p>
      <Listbox
        label={label}
        value={value}
        options={options}
        onChange={onChange}
      />
    </div>
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
    <label className="block text-sm font-black text-zinc-800">
      {label}
      <div className="relative mt-2">
        {!inputMode ? (
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
        ) : null}
        <input
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-lg border border-[#d9ccff] bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff] ${inputMode ? "" : "pl-9"
            }`}
        />
      </div>
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
        <StatusPanel>목록을 불러오는 중입니다.</StatusPanel>
      ) : null}
      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}
      {successMessage ? (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
          {successMessage}
        </p>
      ) : null}
    </>
  );
}

function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-6 text-center text-sm font-black text-[#8c5bff]">
      {children}
    </div>
  );
}

function RefreshButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d9ccff] bg-white px-4 text-sm font-black text-[#8c5bff] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      새로고침
    </button>
  );
}

function ActionButton({
  disabled,
  onClick,
  size = "default",
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  size?: "default" | "compact";
  children: ReactNode;
}) {
  const sizeClassName =
    size === "compact" ? "h-9 px-2 text-xs" : "h-12 px-3 text-sm";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border border-[#d9ccff] bg-white font-black text-[#6f3cff] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-300 ${sizeClassName}`}
    >
      {children}
    </button>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "default" | "success" | "warning" | "danger" | "violet";
  children: ReactNode;
}) {
  const toneClassName = {
    default: "border-zinc-200 bg-zinc-100 text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    violet: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
  }[tone];

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-black ${toneClassName}`}
    >
      {children}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-5 text-center">
      <p className="text-base font-black text-[#8c5bff] sm:text-lg">{label}</p>
      <p className="mt-3 text-3xl font-black text-zinc-950 sm:text-4xl">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function StatusBreakdown({
  title,
  items,
  order,
  getLabel,
  getTone,
}: {
  title: string;
  items: Record<string, number>;
  order: readonly string[];
  getLabel: (key: string) => string;
  getTone: (key: string) => BreakdownTone;
}) {
  const orderedEntries = order.map((key) => [key, items[key] ?? 0] as const);
  const extraEntries = Object.entries(items).filter(
    ([key]) => !order.includes(key),
  );
  const entries = [...orderedEntries, ...extraEntries];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="rounded-[28px] border border-[#ded6ff] bg-white/95 p-5 shadow-[0_18px_48px_rgba(80,60,160,0.08)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-[-0.035em] text-zinc-950 sm:text-2xl">
            {title}
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-4 py-2 text-sm font-black text-[#6f3cff] shadow-sm shadow-violet-950/[0.04]">
          총 {formatNumber(total)}
        </span>
      </div>

      <div className="mt-5 grid gap-2.5">
        {entries.length > 0 ? (
          entries.map(([key, value]) => {
            const percent = total > 0 ? Math.round((value / total) * 100) : 0;
            const tone = breakdownToneClassNames[getTone(key)];
            const barWidth = value > 0 ? Math.max(percent, 4) : 0;

            return (
              <article
                key={key}
                className={`rounded-[18px] border px-4 py-3.5 shadow-sm shadow-zinc-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(80,60,160,0.08)] sm:px-5 sm:py-4 ${tone.card}`}
              >
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot} shadow-sm`}
                      aria-hidden="true"
                    />
                    <p className="truncate text-base font-extrabold tracking-[-0.02em] text-zinc-900 sm:text-lg">
                      {getLabel(key)}
                    </p>
                  </div>

                  <div className="grid shrink-0 grid-cols-[auto_2.875rem_auto_3rem] items-baseline gap-x-1 text-sm font-bold leading-6 text-zinc-500 sm:text-base">
                    <span className="whitespace-nowrap text-right">
                      전체 {formatNumber(total)}건 중
                    </span>
                    <span className="whitespace-nowrap text-right font-extrabold tabular-nums text-zinc-800">
                      {formatNumber(value)}건
                    </span>
                    <span className="text-center text-zinc-300"></span>
                    <span
                      className={`whitespace-nowrap text-right font-extrabold tabular-nums ${tone.accent}`}
                    >
                      {percent}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80 shadow-inner">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-[22px] border border-dashed border-[#d9ccff] bg-[#fbf9ff] px-4 py-10 text-center text-sm font-black text-zinc-400">
            데이터 없음
          </p>
        )}
      </div>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[66px] min-w-0 flex-col justify-center overflow-hidden rounded-lg bg-zinc-50 px-3 py-2.5 text-center">
      <p className="w-full truncate text-xs font-bold text-zinc-400">{label}</p>
      <p
        title={value}
        className="mt-1 w-full min-w-0 truncate whitespace-nowrap text-sm font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[15px]"
      >
        {value}
      </p>
    </div>
  );
}

interface PageInfo {
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

function toPageInfo<T>(response: AdminPageRes<T>): PageInfo {
  return {
    totalElements: response.totalElements,
    totalPages: response.totalPages,
    hasNext: response.hasNext,
  };
}

function PageControls({
  pageInfo,
  page,
  setPage,
}: {
  pageInfo: PageInfo | null;
  page: number;
  setPage: (updater: (current: number) => number) => void;
}) {
  if (!pageInfo) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-[#f0ebff] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-zinc-500">
        총 {formatNumber(pageInfo.totalElements)}건 · {page + 1} /{" "}
        {Math.max(1, pageInfo.totalPages)} 페이지
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="h-10 rounded-lg border border-[#d9ccff] bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>
        <button
          type="button"
          disabled={!pageInfo.hasNext}
          onClick={() => setPage((current) => current + 1)}
          className="h-10 rounded-lg border border-[#d9ccff] bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}

function parsePositiveNumber(value: string): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}
