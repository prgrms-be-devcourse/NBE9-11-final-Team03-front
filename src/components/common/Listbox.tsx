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
  placement?: "auto" | "top" | "bottom";
}

export function Listbox<TValue extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "선택해 주세요",
  className = "mt-2",
  placement = "auto",
}: ListboxProps<TValue>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldOpenUpward, setShouldOpenUpward] = useState(false);
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePlacement = () => {
      if (placement === "top") {
        setShouldOpenUpward(true);
        return;
      }

      if (placement === "bottom") {
        setShouldOpenUpward(false);
        return;
      }

      const container = rootRef.current;

      if (container === null) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const estimatedDropdownHeight = Math.min(options.length * 40 + 12, 288);
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      setShouldOpenUpward(
        spaceBelow < estimatedDropdownHeight || spaceBelow < spaceAbove,
      );
    };

    updatePlacement();

    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, options.length, placement]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-lg border border-[#d9ccff] bg-white px-4 text-left text-sm font-bold text-zinc-900 shadow-sm shadow-violet-950/[0.03] outline-none transition hover:border-[#c8b7ff] hover:bg-[#fbf9ff] focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
      >
        <span className={selected ? "text-zinc-900" : "text-zinc-400"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition ${isOpen ? "rotate-180" : ""
            }`}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className={`absolute z-[1200] max-h-72 w-full overflow-y-auto rounded-lg border border-[#d9ccff] bg-white p-1.5 shadow-[0_18px_42px_rgba(80,60,160,0.16)] ${shouldOpenUpward ? "bottom-full mb-2" : "top-full mt-2"
            }`}
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
                className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-bold transition ${isSelected
                  ? "bg-[#f4f0ff] text-[#8c5bff]"
                  : "text-zinc-700 hover:bg-[#f8f5ff] hover:text-[#8c5bff]"
                  } disabled:cursor-not-allowed disabled:text-zinc-300`}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-[#8c5bff]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
