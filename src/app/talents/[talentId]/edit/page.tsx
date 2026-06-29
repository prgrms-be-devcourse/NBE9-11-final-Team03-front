"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ErrorState } from "@/components/common/ErrorState";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { Listbox, type ListboxOption } from "@/components/common/Listbox";
import { SectionTitle } from "@/components/common/SectionTitle";
import { categoryApi, talentApi } from "@/lib/api";

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
  { value: "168", label: "1주일" },
  { value: "336", label: "2주일" },
  { value: "720", label: "1개월" },
];

export default function EditTalentPage() {
  const params = useParams<{ talentId: string }>();
  const router = useRouter();
  const talentId = Number(params.talentId);
  const [categoryOptions, setCategoryOptions] = useState<
    ListboxOption<string>[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
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
        setErrorMessage(null);
      } catch (error) {
        if (!ignore) {
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

    try {
      await talentApi.update(talentId, {
        categoryId: values.categoryId,
        title: values.title.trim(),
        content: values.content.trim(),
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
    <div className="mx-auto w-[720px] py-10">
      <SectionTitle
        title="재능 수정"
        description="등록한 재능의 카테고리, 제목, 내용, 기간, 크레딧을 수정합니다."
      />

      {errorMessage ? (
        <div className="mb-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
          재능 수정 정보를 불러오는 중입니다.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6"
        >
          <Field label="제목" error={errors.title?.message}>
            <input {...register("title")} className="form-input" />
          </Field>

          <Field label="카테고리" error={errors.categoryId?.message}>
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
          </Field>

          <Field label="제공 내용" error={errors.content?.message}>
            <textarea
              {...register("content")}
              rows={6}
              className="form-input min-h-36"
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

            <Field label="필요 크레딧" error={errors.creditPrice?.message}>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
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
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || categoryOptions.length === 0}
            className="h-11 w-full rounded-md bg-zinc-950 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSubmitting ? "저장 중..." : "재능 저장"}
          </button>
        </form>
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
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
