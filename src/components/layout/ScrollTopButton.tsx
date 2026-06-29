"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

function canScrollPage(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.scrollHeight > window.innerHeight + 80;
}

export function ScrollTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function syncVisibility(): void {
      setIsVisible(canScrollPage() && window.scrollY > 260);
    }

    syncVisibility();
    window.addEventListener("scroll", syncVisibility, { passive: true });
    window.addEventListener("resize", syncVisibility);

    return () => {
      window.removeEventListener("scroll", syncVisibility);
      window.removeEventListener("resize", syncVisibility);
    };
  }, []);

  function handleClick(): void {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <button
      type="button"
      aria-label="페이지 맨 위로 이동"
      onClick={handleClick}
      className={`fixed right-6 bottom-24 z-50 inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white/92 text-violet-600 shadow-xl shadow-violet-950/15 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 lg:bottom-8 ${
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.8} aria-hidden="true" />
    </button>
  );
}
