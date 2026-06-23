"use client";

import { Listbox, type ListboxOption } from "@/components/common/Listbox";
import type { CategoryRes } from "@/lib/api";

export interface TalentFilterValue {
  categoryId?: number;
  minCredits?: number;
  maxCredits?: number;
  minRating?: number;
}

interface TalentFilterProps {
  categories: CategoryRes[];
  value: TalentFilterValue;
  onChange: (value: TalentFilterValue) => void;
}

type CreditRangeValue = "all" | "under_50" | "50_100" | "100_150" | "over_150";

const creditRangeOptions: {
  value: CreditRangeValue;
  label: string;
  minCredits?: number;
  maxCredits?: number;
}[] = [
  { value: "all", label: "전체" },
  { value: "under_50", label: "50 크레딧 이하", maxCredits: 50 },
  { value: "50_100", label: "50~100 크레딧", minCredits: 50, maxCredits: 100 },
  { value: "100_150", label: "100~150 크레딧", minCredits: 100, maxCredits: 150 },
  { value: "over_150", label: "150 크레딧 이상", minCredits: 150 },
];

function parseOptionalNumber(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getCreditRangeValue(value: TalentFilterValue): CreditRangeValue {
  const matched = creditRangeOptions.find(
    (option) =>
      option.minCredits === value.minCredits &&
      option.maxCredits === value.maxCredits,
  );
  return matched?.value ?? "all";
}

export function TalentFilter({ categories, value, onChange }: TalentFilterProps) {
  const categoryOptions: ListboxOption<string>[] = [
    { value: "", label: "전체" },
    ...categories.map((category) => ({
      value: String(category.categoryId),
      label: category.name,
    })),
  ];
  const creditOptions: ListboxOption<CreditRangeValue>[] = creditRangeOptions.map(
    (option) => ({ value: option.value, label: option.label }),
  );
  const ratingOptions: ListboxOption<string>[] = [
    { value: "", label: "전체" },
    { value: "4", label: "4.0 이상" },
    { value: "4.5", label: "4.5 이상" },
    { value: "4.8", label: "4.8 이상" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="text-sm font-semibold text-zinc-700">
        카테고리
        <Listbox
          label="카테고리"
          value={value.categoryId === undefined ? "" : String(value.categoryId)}
          options={categoryOptions}
          onChange={(selected) =>
            onChange({ ...value, categoryId: parseOptionalNumber(selected) })
          }
        />
      </label>
      <label className="text-sm font-semibold text-zinc-700">
        크레딧 범위
        <Listbox
          label="크레딧 범위"
          value={getCreditRangeValue(value)}
          options={creditOptions}
          onChange={(selectedValue) => {
            const selected =
              creditRangeOptions.find(
                (option) => option.value === selectedValue,
              ) ?? creditRangeOptions[0];
            onChange({
              ...value,
              minCredits: selected.minCredits,
              maxCredits: selected.maxCredits,
            });
          }}
        />
      </label>
      <label className="text-sm font-semibold text-zinc-700">
        최소 평점
        <Listbox
          label="최소 평점"
          value={value.minRating === undefined ? "" : String(value.minRating)}
          options={ratingOptions}
          onChange={(selected) =>
            onChange({ ...value, minRating: parseOptionalNumber(selected) })
          }
        />
      </label>
    </div>
  );
}
