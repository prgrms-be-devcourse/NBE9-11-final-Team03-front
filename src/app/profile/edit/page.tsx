"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Link2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import {
  categoryApi,
  profileApi,
  type CategoryRes,
  type MyProfileDetailRes,
} from "@/lib/api";
import {
  getAccessToken,
  getStoredUserId,
  getStoredUserRole,
  hasStoredAccessToken,
  setAuthStorage,
} from "@/lib/auth";

interface ProfileFormState {
  profileImageUrl: string;
  introduction: string;
  myTalentCategoryIds: number[];
  wantTalentCategoryIds: number[];
  portfolioLinksText: string;
}

const emptyForm: ProfileFormState = {
  profileImageUrl: "",
  introduction: "",
  myTalentCategoryIds: [],
  wantTalentCategoryIds: [],
  portfolioLinksText: "",
};

const formControlClassName =
  "w-full rounded-md border border-[#ded6ff] bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]";

function getCategoryId(category: CategoryRes): number {
  return category.categoryId;
}

function toFormState(profile: MyProfileDetailRes): ProfileFormState {
  return {
    profileImageUrl: profile.profileImageUrl ?? "",
    introduction: profile.introduction ?? "",
    myTalentCategoryIds: profile.myTalentCategories.map(
      (category) => category.id,
    ),
    wantTalentCategoryIds: profile.wantTalentCategories.map(
      (category) => category.id,
    ),
    portfolioLinksText: profile.portfolioLinkList.join("\n"),
  };
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}

function parsePortfolioLinks(value: string): string[] {
  return value
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfileDetailRes | null>(null);
  const [categories, setCategories] = useState<CategoryRes[]>([]);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadProfileEdit() {
      if (!hasStoredAccessToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const [nextProfile, nextCategories] = await Promise.all([
          profileApi.getMe(),
          categoryApi.getList(),
        ]);

        if (ignore) {
          return;
        }

        setProfile(nextProfile);
        setForm(toFormState(nextProfile));
        setCategories(
          [...nextCategories].sort(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              getCategoryId(left) - getCategoryId(right),
          ),
        );
        setErrorMessage(null);
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "프로필을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadProfileEdit();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSave() {
    const introduction = form.introduction.trim();

    if (introduction.length < 5) {
      setErrorMessage("한줄 소개는 5자 이상 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setIsSuccessModalOpen(false);
    setErrorMessage(null);

    try {
      const updatedProfile = await profileApi.update({
        profileImageUrl: form.profileImageUrl.trim() || null,
        introduction,
        myTalentCategoryIds: form.myTalentCategoryIds,
        wantTalentCategoryIds: form.wantTalentCategoryIds,
        portfolioLinkList: parsePortfolioLinks(form.portfolioLinksText),
      });

      setProfile(updatedProfile);
      setForm(toFormState(updatedProfile));

      const accessToken = getAccessToken();
      const userId = getStoredUserId();
      if (accessToken && userId !== null) {
        setAuthStorage(accessToken, userId, {
          role: getStoredUserRole(),
          nickname: updatedProfile.nickname,
          profileImageUrl: updatedProfile.profileImageUrl,
        });
      }

      setIsSuccessModalOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "프로필 저장에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-10 sm:py-14 lg:py-16">
          <div className="rounded-lg border border-[#ded6ff] bg-white p-8 text-center text-sm font-semibold text-zinc-600 shadow-sm shadow-violet-950/[0.04]">
            프로필 정보를 불러오는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  if (!hasStoredAccessToken()) {
    return (
      <main className="min-h-[calc(100dvh-64px)] bg-white">
        <div className="fixed-container py-12 sm:py-14 lg:py-16">
          <EmptyState
            title="로그인 후 이용해 주세요."
            actionLabel="로그인"
            actionHref="/login"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-white">
      <div className="fixed-container max-w-[980px] py-10 sm:py-14 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3">프로필 수정</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            프로필 이미지, 소개, 관심 카테고리, 포트폴리오 링크를 관리합니다.
          </p>
        </header>

        <div className="mt-8">
          <Link
            href="/mypage"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ded6ff] px-4 text-sm font-black text-[#8c5bff] transition hover:bg-[#f4f0ff]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            마이페이지
          </Link>
        </div>

        {errorMessage ? (
          <div className="mt-5">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        <section className="mt-5 rounded-lg border border-[#ded6ff] bg-white p-5 shadow-sm shadow-violet-950/[0.04] sm:p-6 lg:p-8">
          <div className="rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {form.profileImageUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.profileImageUrl.trim()}
                  alt="프로필 이미지 미리보기"
                  className="size-20 rounded-full object-cover ring-2 ring-[#ded6ff]"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full border border-[#ded6ff] bg-white text-2xl font-black text-[#8c5bff]">
                  {(profile?.nickname ?? "프").slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8c5bff]">
                  Profile
                </p>
                <h2 className="mt-2 truncate text-3xl font-black text-zinc-950">
                  {profile?.nickname ?? "내 프로필"}
                </h2>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ded6ff] bg-white px-3 py-1.5 text-sm font-black text-[#8c5bff]">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  신뢰 점수 {profile?.trustScore ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-7">
            <Field
              label="프로필 이미지 URL"
              description="외부 이미지 주소를 입력하면 상단 미리보기에 바로 반영됩니다."
              icon={<ImageIcon className="size-4" aria-hidden="true" />}
            >
              <input
                value={form.profileImageUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    profileImageUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/profile.png"
                className={formControlClassName}
              />
            </Field>

            <Field label="한줄 소개" description="프로필에 표시될 소개 문구입니다.">
              <textarea
                value={form.introduction}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    introduction: event.target.value,
                  }))
                }
                rows={4}
                className={`${formControlClassName} min-h-28 resize-none`}
              />
            </Field>

            <CategoryCheckboxGroup
              title="내가 가진 재능 카테고리"
              description="제공할 수 있는 재능을 선택해 주세요."
              categories={categories}
              selectedIds={form.myTalentCategoryIds}
              onToggle={(categoryId) =>
                setForm((current) => ({
                  ...current,
                  myTalentCategoryIds: toggleId(
                    current.myTalentCategoryIds,
                    categoryId,
                  ),
                }))
              }
            />

            <CategoryCheckboxGroup
              title="원하는 재능 카테고리"
              description="교환받고 싶은 재능을 선택해 주세요."
              categories={categories}
              selectedIds={form.wantTalentCategoryIds}
              onToggle={(categoryId) =>
                setForm((current) => ({
                  ...current,
                  wantTalentCategoryIds: toggleId(
                    current.wantTalentCategoryIds,
                    categoryId,
                  ),
                }))
              }
            />

            <Field
              label="포트폴리오 링크"
              description="여러 링크는 줄바꿈으로 구분해 주세요."
              icon={<Link2 className="size-4" aria-hidden="true" />}
            >
              <textarea
                value={form.portfolioLinksText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    portfolioLinksText: event.target.value,
                  }))
                }
                rows={4}
                placeholder={
                  "https://github.com/example\nhttps://notion.so/example"
                }
                className={`${formControlClassName} min-h-28 resize-none`}
              />
            </Field>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/mypage"
              className="inline-flex h-12 items-center justify-center rounded-md border border-[#ded6ff] px-6 text-sm font-black text-[#8c5bff] transition hover:bg-[#f4f0ff]"
            >
              취소
            </Link>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#8c5bff] px-7 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:bg-[#7a4df2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="size-4" aria-hidden="true" />
              {isSaving ? "저장 중..." : "프로필 저장"}
            </button>
          </div>
        </section>

        {isSuccessModalOpen ? (
          <FeedbackModal
            title="프로필 수정이 완료되었습니다"
            description="수정한 프로필은 마이페이지에서 바로 확인할 수 있어요."
            confirmLabel="마이페이지로 이동"
            onConfirm={() => router.push("/mypage")}
          />
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  description,
  icon,
  children,
}: {
  label: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-black text-zinc-950">
        {icon ? <span className="text-[#8c5bff]">{icon}</span> : null}
        {label}
      </span>
      {description ? (
        <span className="mt-1 block text-xs font-semibold leading-5 text-zinc-500">
          {description}
        </span>
      ) : null}
      <div className="mt-3">{children}</div>
    </label>
  );
}

function CategoryCheckboxGroup({
  title,
  description,
  categories,
  selectedIds,
  onToggle,
}: {
  title: string;
  description: string;
  categories: CategoryRes[];
  selectedIds: number[];
  onToggle: (categoryId: number) => void;
}) {
  return (
    <div>
      <div>
        <p className="text-sm font-black text-zinc-950">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
          {description}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const categoryId = getCategoryId(category);
          const isSelected = selectedIds.includes(categoryId);

          return (
            <label
              key={categoryId}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 text-sm font-black transition ${
                isSelected
                  ? "border-[#8c5bff] bg-[#f4f0ff] text-[#8c5bff]"
                  : "border-[#ded6ff] bg-white text-zinc-700 hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(categoryId)}
                className="size-4 accent-[#8c5bff]"
              />
              <span>{category.name}</span>
              {isSelected ? (
                <Check className="ml-auto size-4" aria-hidden="true" />
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
