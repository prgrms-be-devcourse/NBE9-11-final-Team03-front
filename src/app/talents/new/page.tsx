"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { Listbox, type ListboxOption } from "@/components/common/Listbox";
import { categoryApi, talentApi } from "@/lib/api";
import { setStoredLastTalentId } from "@/lib/auth";

const schema = z.object({
  title: z.string().min(5, "제목은 5자 이상 입력해 주세요."),
  categoryId: z.coerce.number().min(1, "카테고리를 선택해 주세요."),
  content: z.string().min(30, "제공 내용은 30자 이상 입력해 주세요."),
  estimatedHours: z.coerce
    .number()
    .int("예상 작업 기간을 선택해 주세요.")
    .positive("예상 작업 기간을 선택해 주세요."),
  creditPrice: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }

      if (typeof value === "number" && Number.isNaN(value)) {
        return undefined;
      }

      return Number(value);
    },
    z
      .number({
        error: "필요 크레딧을 입력해 주세요.",
      })
      .int("크레딧은 숫자만 입력해 주세요.")
      .min(0, "크레딧은 0 이상으로 입력해 주세요."),
  ),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

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

function getCategoryErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.";

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("forbidden")
  ) {
    return "로그인 후 카테고리를 조회할 수 있습니다.";
  }

  return message;
}

function getCreatedTalentId(response: { id?: number; talentId?: number }) {
  const talentId = response.talentId ?? response.id;

  return typeof talentId === "number" && Number.isInteger(talentId)
    ? talentId
    : null;
}

export default function NewTalentPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<
    ListboxOption<string>[]
  >([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      estimatedHours: 8,
    },
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

  useEffect(() => {
    let ignore = false;

    async function loadCategories() {
      setIsCategoryLoading(true);
      setCategoryError(null);

      try {
        const response = await categoryApi.getList();
        const categories = Array.isArray(response) ? response : [];
        const options = [...categories]
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.categoryId - b.categoryId,
          )
          .map((category) => ({
            value: String(category.categoryId),
            label: category.name,
          }));

        if (ignore) {
          return;
        }

        setCategoryOptions(options);

        if (options[0]) {
          setValue("categoryId", Number(options[0].value), {
            shouldValidate: true,
          });
        }
      } catch (error) {
        if (ignore) {
          return;
        }

        setCategoryOptions([]);
        setCategoryError(getCategoryErrorMessage(error));
      } finally {
        if (!ignore) {
          setIsCategoryLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      ignore = true;
    };
  }, [setValue]);

  async function onSubmit(values: FormValues) {
    setMessage("");

    const storedUserId = localStorage.getItem("baton_user_id");
    const userId = storedUserId === null ? NaN : Number(storedUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      setMessage("로그인 후 이용해 주세요.");
      return;
    }

    try {
      const response = await talentApi.create({
        categoryId: values.categoryId,
        title: values.title.trim(),
        content: values.content.trim(),
        estimatedHours: values.estimatedHours,
        creditPrice: values.creditPrice,
      });
      const createdTalentId = getCreatedTalentId(response);

      if (createdTalentId !== null) {
        setStoredLastTalentId(userId, createdTalentId);
      }

      setIsSuccessModalOpen(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "재능 등록 중 오류가 발생했습니다.",
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

      <div className="fixed-container relative pb-72 pt-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="mt-4 text-5xl font-black tracking-normal text-zinc-950">
            내 재능 등록하기
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-600">
            내가 제공할 수 있는 일을 선명하게 정리하고, 좋은 교환 상대를 만날 준비를 시작해요.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="relative mx-auto mt-12 w-[880px] overflow-visible rounded-lg border border-[#ded6ff] bg-white/90 p-8 shadow-[0_28px_80px_rgba(80,60,160,0.14)] backdrop-blur"
        >
          <div
            className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
            aria-hidden="true"
          />

          <div className="grid gap-6">
            <Field label="제목" error={errors.title?.message}>
              <input {...register("title")} className={inputClassName} />
            </Field>

            <Field label="카테고리" error={errors.categoryId?.message}>
              {isCategoryLoading ? (
                <p className="rounded-lg border border-[#d9ccff] bg-[#fbf9ff] px-4 py-3 text-sm font-bold text-zinc-600">
                  카테고리를 불러오는 중입니다...
                </p>
              ) : null}

              {!isCategoryLoading && categoryOptions.length > 0 ? (
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
              ) : null}

              {categoryError ? (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {categoryError}
                </p>
              ) : null}

              {!isCategoryLoading &&
                !categoryError &&
                categoryOptions.length === 0 ? (
                <p className="rounded-lg border border-[#d9ccff] bg-[#fbf9ff] px-4 py-3 text-sm font-bold text-zinc-600">
                  등록 가능한 카테고리가 없습니다.
                </p>
              ) : null}
            </Field>

            <Field label="제공 내용" error={errors.content?.message}>
              <textarea
                {...register("content")}
                rows={7}
                className={textareaClassName}
              />
            </Field>

            <div className="grid grid-cols-2 gap-5">
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

              <Field label="필요 크레딧">
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
                    const onlyNumbers = event.target.value.replace(/\D/g, "");

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

                <div className="mt-2 min-h-5">
                  {errors.creditPrice?.message ? (
                    <p className="text-xs font-semibold text-red-600">
                      {errors.creditPrice.message}
                    </p>
                  ) : null}
                </div>
              </Field>
            </div>

            {message ? (
              <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmitting || isCategoryLoading || categoryOptions.length === 0
              }
              className="mt-2 h-[52px] w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] text-base font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {isSubmitting ? "등록 중..." : "재능 등록하기"}
            </button>
          </div>
        </form>

        {isSuccessModalOpen ? (
          <FeedbackModal
            title="재능이 등록되었습니다"
            description="등록한 재능은 재능 둘러보기에서 확인할 수 있어요."
            confirmLabel="재능 둘러보기로 이동"
            onConfirm={() => router.push("/talents")}
          />
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[15px] font-black text-zinc-900">
      {label}
      <div className="mt-2.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>
      ) : null}
    </label>
  );
}
