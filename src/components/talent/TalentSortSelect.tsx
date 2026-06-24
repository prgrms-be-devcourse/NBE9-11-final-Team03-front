"use client";

import { Listbox } from "@/components/common/Listbox";

export type TalentSortOption =
  | "latest"
  | "rating"
  | "credits_asc"
  | "completed"
  | "trust";

interface TalentSortSelectProps {
  value: TalentSortOption;
  onChange: (value: TalentSortOption) => void;
}

const options: { value: TalentSortOption; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating", label: "평점 높은 순" },
  { value: "credits_asc", label: "크레딧 낮은 순" },
  { value: "completed", label: "완료 건수 많은 순" },
  { value: "trust", label: "신뢰 점수 높은 순" },
];

export function TalentSortSelect({ value, onChange }: TalentSortSelectProps) {
  return (
    <div className="w-full">
      <Listbox
        label="재능 정렬"
        value={value}
        options={options}
        onChange={onChange}
        className=""
      />
    </div>
  );
}
