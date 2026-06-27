"use client";

interface TalentSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function TalentSearchBar({ value, onChange }: TalentSearchBarProps) {
  return (
    <label className="block">
      <span className="sr-only">재능 검색</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="현재 페이지에서 제목/카테고리 검색"
        className="h-11 w-full rounded-md border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
