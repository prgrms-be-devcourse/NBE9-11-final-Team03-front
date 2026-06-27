"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SectionTitle } from "@/components/common/SectionTitle";
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

function getCategoryId(category: CategoryRes): number {
  return category.categoryId;
}

function toFormState(profile: MyProfileDetailRes): ProfileFormState {
  return {
    profileImageUrl: profile.profileImageUrl ?? "",
    introduction: profile.introduction ?? "",
    myTalentCategoryIds: profile.myTalentCategories.map((category) => category.id),
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
  const [profile, setProfile] = useState<MyProfileDetailRes | null>(null);
  const [categories, setCategories] = useState<CategoryRes[]>([]);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

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
    setErrorMessage(null);
    setSuccessMessage("");

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
      setSuccessMessage("프로필이 저장되었습니다.");

      const accessToken = getAccessToken();
      const userId = getStoredUserId();
      if (accessToken && userId !== null) {
        setAuthStorage(accessToken, userId, {
          role: getStoredUserRole(),
          nickname: updatedProfile.nickname,
          profileImageUrl: updatedProfile.profileImageUrl,
        });
      }
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
      <div className="fixed-container py-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          프로필 정보를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (!hasStoredAccessToken()) {
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

  return (
    <div className="mx-auto w-[760px] py-10">
      <SectionTitle
        title="프로필 수정"
        description="프로필 이미지, 소개, 관심 카테고리, 포트폴리오 링크를 관리합니다."
      />

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

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-center gap-4">
          {form.profileImageUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.profileImageUrl.trim()}
              alt="프로필 이미지 미리보기"
              className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-lg font-black text-zinc-500">
              {(profile?.nickname ?? "프").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="text-lg font-black text-zinc-950">
              {profile?.nickname ?? "내 프로필"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              신뢰 점수 {profile?.trustScore ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          <Field label="프로필 이미지 URL">
            <input
              value={form.profileImageUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  profileImageUrl: event.target.value,
                }))
              }
              placeholder="https://example.com/profile.png"
              className="form-input"
            />
          </Field>

          <Field label="한줄 소개">
            <textarea
              value={form.introduction}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  introduction: event.target.value,
                }))
              }
              rows={4}
              className="form-input min-h-28 resize-none"
            />
          </Field>

          <CategoryCheckboxGroup
            title="내가 가진 재능 카테고리"
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

          <Field label="포트폴리오 링크">
            <textarea
              value={form.portfolioLinksText}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  portfolioLinksText: event.target.value,
                }))
              }
              rows={4}
              placeholder={"https://github.com/example\nhttps://notion.so/example"}
              className="form-input min-h-28 resize-none"
            />
            <p className="mt-2 text-xs text-zinc-500">
              여러 링크는 줄바꿈으로 구분해 주세요.
            </p>
          </Field>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="mt-6 h-11 w-full rounded-md bg-zinc-950 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {isSaving ? "저장 중..." : "프로필 저장"}
        </button>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function CategoryCheckboxGroup({
  title,
  categories,
  selectedIds,
  onToggle,
}: {
  title: string;
  categories: CategoryRes[];
  selectedIds: number[];
  onToggle: (categoryId: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {categories.map((category) => {
          const categoryId = getCategoryId(category);
          const isSelected = selectedIds.includes(categoryId);

          return (
            <label
              key={categoryId}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                isSelected
                  ? "border-teal-300 bg-teal-50 text-teal-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(categoryId)}
                className="h-4 w-4 accent-teal-700"
              />
              {category.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
