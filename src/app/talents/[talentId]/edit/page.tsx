"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { Listbox, type ListboxOption } from "@/components/common/Listbox";
import { TalentAttachmentPanel } from "@/components/talent/TalentAttachmentPanel";
import { categoryApi, talentApi, type TalentDetailRes } from "@/lib/api";
import { getStoredUserId } from "@/lib/auth";

function numberInput(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed === "" ? undefined : Number(trimmed);
  }

  return value;
}

function creditPriceInput(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed === "" ? undefined : trimmed;
  }

  return value;
}

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(100, "제목은 100자 이하로 입력해 주세요."),
  categoryId: z.preprocess(
    numberInput,
    z
      .number({ error: "카테고리를 선택해 주세요." })
      .int("카테고리를 선택해 주세요.")
      .min(1, "카테고리를 선택해 주세요."),
  ),
  content: z
    .string()
    .trim()
    .min(1, "제공 내용을 입력해 주세요.")
    .max(10000, "제공 내용은 10000자 이하로 입력해 주세요."),
  estimatedHours: z.preprocess(
    numberInput,
    z
      .number({ error: "예상 작업 기간을 선택해 주세요." })
      .int("예상 작업 기간은 1 이상이어야 합니다.")
      .min(1, "예상 작업 기간은 1 이상이어야 합니다."),
  ),
  creditPrice: z.preprocess(
    creditPriceInput,
    z
      .string({ error: "필요 크레딧을 입력해 주세요." })
      .regex(/^-?\d+$/, "크레딧은 숫자만 입력해 주세요.")
      .transform(Number)
      .pipe(
        z
          .number()
          .int("크레딧은 숫자만 입력해 주세요.")
          .min(0, "크레딧은 0 이상으로 입력해 주세요."),
      ),
  ),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const TITLE_MAX_LENGTH = 100;
const CONTENT_MAX_LENGTH = 10000;

const estimatedDurationOptions: ListboxOption<string>[] = [
  { value: "8", label: "당일" },
  { value: "24", label: "1일" },
  { value: "48", label: "2일" },
  { value: "72", label: "3일" },
  { value: "168", label: "1주" },
  { value: "336", label: "2주" },
  { value: "720", label: "1개월" },
];

const inputClassName =
  "form-input h-12 rounded-lg border-[#d9ccff] bg-white/95 px-4 text-[15px] font-semibold shadow-sm shadow-violet-950/[0.03] transition focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]";

const textareaClassName =
  "form-input min-h-44 resize-none rounded-lg border-[#d9ccff] bg-white/95 px-4 py-3 text-[15px] font-semibold leading-7 shadow-sm shadow-violet-950/[0.03] transition focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]";

function getTextLength(value: unknown) {
  return typeof value === "string" ? value.length : 0;
}

function getTalentAuthorId(talent: TalentDetailRes): number | null {
  const authorId =
    talent.userId ??
    talent.providerId ??
    talent.authorId ??
    talent.sellerId ??
    talent.author.userId ??
    talent.author.providerId ??
    talent.author.authorId ??
    talent.author.sellerId ??
    talent.author.id;

  return typeof authorId === "number" && Number.isInteger(authorId)
    ? authorId
    : null;
}

export default function EditTalentPage() {
  const params = useParams<{ talentId: string }>();
  const router = useRouter();
  const talentId = Number(params.talentId);
  const [categoryOptions, setCategoryOptions] = useState<
    ListboxOption<string>[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const selectedEstimatedHours = useWatch({
    control,
    name: "estimatedHours",
  });
  const selectedCreditPrice = useWatch({
    control,
    name: "creditPrice",
  });
  const currentTitle = useWatch({ control, name: "title" });
  const currentContent = useWatch({ control, name: "content" });
  const titleLength = getTextLength(currentTitle);
  const contentLength = getTextLength(currentContent);

  useEffect(() => {
    let ignore = false;

    async function loadEditForm() {
      if (!Number.isInteger(talentId) || talentId <= 0) {
        setErrorMessage("유효한 재능 ID가 아닙니다.");
        setIsLoading(false);
        return;
      }

      try {
        const [categories, talent] = await Promise.all([
          categoryApi.getList(),
          talentApi.getDetail(talentId),
        ]);

        if (ignore) {
          return;
        }

        setCategoryOptions(
          [...categories]
            .sort(
              (left, right) =>
                left.sortOrder - right.sortOrder ||
                left.categoryId - right.categoryId,
            )
            .map((category) => ({
              value: String(category.categoryId),
              label: category.name,
            })),
        );
        reset({
          title: talent.title,
          categoryId: talent.categoryId,
          content: talent.content,
          estimatedHours: talent.estimatedHours,
          creditPrice: talent.creditPrice,
        });
        const currentUserId = getStoredUserId();
        const talentAuthorId = getTalentAuthorId(talent);

        setIsOwner(
          currentUserId !== null &&
            talentAuthorId !== null &&
            currentUserId === talentAuthorId,
        );
        setErrorMessage(null);
      } catch (error) {
        if (!ignore) {
          setIsOwner(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "재능 수정 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadEditForm();

    return () => {
      ignore = true;
    };
  }, [reset, talentId]);

  async function onSubmit(values: FormValues) {
    setErrorMessage(null);
    const title = values.title.trim();
    const content = values.content.trim();

    if (title.length > TITLE_MAX_LENGTH) {
      setError("title", {
        type: "maxLength",
        message: "제목은 100자 이하로 입력해 주세요.",
      });
      return;
    }

    if (content.length > CONTENT_MAX_LENGTH) {
      setError("content", {
        type: "maxLength",
        message: "제공 내용은 10000자 이하로 입력해 주세요.",
      });
      return;
    }

    try {
      await talentApi.update(talentId, {
        categoryId: values.categoryId,
        title,
        content,
        estimatedHours: values.estimatedHours,
        creditPrice: values.creditPrice,
      });
      setIsSuccessModalOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "재능 수정에 실패했습니다.",
      );
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-visible bg-[linear-gradient(135deg,#fbfdff_0%,#edf5ff_46%,#f4efff_100%)]">
      <div
        className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8c5bff]/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[8%] top-48 h-52 w-52 rounded-full bg-[#79e4dd]/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="fixed-container relative pb-28 pt-10 sm:pb-40 sm:pt-14 lg:pb-72 lg:pt-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="baton-page-title mt-3 !font-bold">EDIT POST</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            등록한 재능의 카테고리, 제목, 내용, 기간, 크레딧을 수정합니다.
          </p>
        </header>

        {errorMessage ? (
          <div className="relative mx-auto mt-8 w-full max-w-[880px] rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-[0_28px_80px_rgba(80,60,160,0.10)] sm:mt-12">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="relative mx-auto mt-8 w-full max-w-[880px] rounded-lg border border-[#ded6ff] bg-white/90 p-8 text-center text-sm font-black text-zinc-500 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:mt-12">
            재능 수정 정보를 불러오는 중입니다...
          </div>
        ) : errorMessage ? null : !isOwner ? (
          <div className="relative mx-auto mt-8 w-full max-w-[880px] rounded-lg border border-[#ded6ff] bg-white/90 p-8 text-center shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:mt-12">
            <p className="text-xl font-black text-zinc-950">
              작성자만 수정할 수 있습니다
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-zinc-500">
              재능 내용과 포트폴리오 첨부 관리는 이 글을 등록한 사용자에게만
              제공됩니다.
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="relative mx-auto mt-8 w-full max-w-[880px] overflow-visible rounded-lg border border-[#ded6ff] bg-white/90 p-5 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur sm:mt-12 sm:p-8"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
                aria-hidden="true"
              />

              <div className="grid gap-6">
                <Field
                  label="제목"
                  error={errors.title?.message}
                  counter={
                    <CharacterCount
                      count={titleLength}
                      limit={TITLE_MAX_LENGTH}
                    />
                  }
                >
                  <input
                    {...register("title")}
                    maxLength={TITLE_MAX_LENGTH}
                    className={inputClassName}
                  />
                </Field>

                <Field label="카테고리" error={errors.categoryId?.message}>
                  {categoryOptions.length > 0 ? (
                    <Listbox
                      label="카테고리"
                      value={
                        selectedCategoryId === undefined
                          ? ""
                          : String(selectedCategoryId)
                      }
                      options={categoryOptions}
                      onChange={(selected) =>
                        setValue(
                          "categoryId",
                          selected === "" ? undefined : Number(selected),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      className=""
                    />
                  ) : (
                    <p className="rounded-lg border border-[#d9ccff] bg-[#fbf9ff] px-4 py-3 text-sm font-bold text-zinc-600">
                      등록 가능한 카테고리가 없습니다.
                    </p>
                  )}
                </Field>

                <Field
                  label="제공 내용"
                  error={errors.content?.message}
                  counter={
                    <CharacterCount
                      count={contentLength}
                      limit={CONTENT_MAX_LENGTH}
                    />
                  }
                >
                  <textarea
                    {...register("content")}
                    maxLength={CONTENT_MAX_LENGTH}
                    rows={7}
                    className={textareaClassName}
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="예상 작업 기간"
                    error={errors.estimatedHours?.message}
                  >
                    <Listbox
                      label="예상 작업 기간"
                      value={
                        selectedEstimatedHours === undefined
                          ? ""
                          : String(selectedEstimatedHours)
                      }
                      options={estimatedDurationOptions}
                      onChange={(selected) =>
                        setValue(
                          "estimatedHours",
                          selected === "" ? undefined : Number(selected),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      className=""
                    />
                  </Field>

                  <Field label="필요 크레딧" error={errors.creditPrice?.message}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClassName}
                      placeholder="숫자만 입력해 주세요. 예: 150"
                      value={
                        selectedCreditPrice === undefined
                          ? ""
                          : String(selectedCreditPrice)
                      }
                      onChange={(event) => {
                        const onlyNumbers = event.target.value.replace(
                          /\D/g,
                          "",
                        );

                        setValue(
                          "creditPrice",
                          onlyNumbers === "" ? undefined : Number(onlyNumbers),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                      }}
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || categoryOptions.length === 0}
                  className="mt-2 h-[52px] w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] text-base font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                >
                  {isSubmitting ? "저장 중..." : "재능 저장하기"}
                </button>
              </div>
            </form>

            <div className="mx-auto mt-8 w-full max-w-[880px]">
              <TalentAttachmentPanel talentId={talentId} isOwner />
            </div>
          </>
        )}

        {isSuccessModalOpen ? (
          <FeedbackModal
            title="재능이 수정되었습니다"
            description="수정된 내용은 재능 상세 화면에서 확인할 수 있습니다."
            confirmLabel="상세로 이동"
            onConfirm={() => router.push(`/talents/${talentId}`)}
          />
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  counter,
  children,
}: {
  label: string;
  error?: string;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[15px] font-black text-zinc-900">
      {label}
      <div className="mt-2.5">{children}</div>
      {error || counter ? (
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {error ? (
            <p className="min-w-0 flex-1 text-xs font-semibold text-red-600">
              {error}
            </p>
          ) : null}
          {counter ? <div className="ml-auto shrink-0">{counter}</div> : null}
        </div>
      ) : null}
    </label>
  );
}

function CharacterCount({ count, limit }: { count: number; limit: number }) {
  const isOverLimit = count > limit;

  return (
    <span
      className={`text-xs font-semibold ${isOverLimit ? "text-red-600" : "text-zinc-500"
        }`}
    >
      {count.toLocaleString("en-US")}/{limit.toLocaleString("en-US")}
    </span>
  );
}
