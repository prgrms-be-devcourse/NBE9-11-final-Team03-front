"use client";

import { Listbox } from "@/components/common/Listbox";
import type { TalentSortType } from "@/lib/api";

export type TalentSortOption = TalentSortType;

interface TalentSortSelectProps {
  value: TalentSortOption;
  onChange: (value: TalentSortOption) => void;
}

const options: { value: TalentSortOption; label: string }[] = [
  { value: "LATEST", label: "최신순" },
  { value: "RATING", label: "평점 높은 순" },
  { value: "POPULAR", label: "완료 건수 많은 순" },
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
