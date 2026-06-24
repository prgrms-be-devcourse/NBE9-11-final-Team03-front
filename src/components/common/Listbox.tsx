"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface ListboxOption<TValue extends string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

interface ListboxProps<TValue extends string> {
  label: string;
  value: TValue;
  options: ListboxOption<TValue>[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  className?: string;
}

export function Listbox<TValue extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "선택해 주세요",
  className = "mt-2",
}: ListboxProps<TValue>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 text-left text-sm font-semibold text-zinc-800 outline-none transition hover:border-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        <span className={selected ? "text-zinc-900" : "text-zinc-400"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-semibold transition ${
                  isSelected
                    ? "bg-teal-50 text-teal-800"
                    : "text-zinc-700 hover:bg-zinc-50"
                } disabled:cursor-not-allowed disabled:text-zinc-300`}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-teal-700" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
