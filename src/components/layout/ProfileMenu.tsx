"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ProfileMenuProps {
  nickname: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  onLogout: () => void;
}

const profileMenuItems = [
  { href: "/mypage", label: "마이페이지" },
  { href: "/profile/edit", label: "프로필 수정" },
  { href: "/trades", label: "내 거래" },
  { href: "/matches?tab=received", label: "받은 제안" },
  { href: "/matches?tab=sent", label: "보낸 제안" },
  { href: "/chats", label: "채팅" },
  { href: "/credits", label: "크레딧 지갑" },
];

export function ProfileMenu({
  profileImageUrl,
  isAdmin,
  onLogout,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (
        target instanceof Node &&
        containerRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleLogoutClick(): void {
    setIsOpen(false);
    onLogout();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="프로필 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c5bff] focus-visible:ring-offset-2 ${isOpen
            ? "border-[#d9ccff] bg-[#f4f0ff] shadow-sm shadow-violet-500/10"
            : "border-zinc-200 bg-white hover:border-[#d9ccff] hover:bg-[#f8f5ff]"
          }`}
      >
        {profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileImageUrl}
            alt="내 프로필 이미지"
            className="h-full w-full object-cover"
          />
        ) : (
          <DefaultProfileAvatar />
        )}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-lg border border-[#d9ccff] bg-white py-2 shadow-[0_18px_42px_rgba(80,60,160,0.16)]"
        >
          {profileMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-[#f4f0ff] hover:text-[#8c5bff]"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-[#f4f0ff] hover:text-[#8c5bff]"
            >
              관리자
            </Link>
          ) : null}
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogoutClick}
            className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-[#f4f0ff]"
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DefaultProfileAvatar() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="24" fill="#8C5BFF" />
      <circle cx="24" cy="17" r="8" fill="#E7D8F5" />
      <path
        d="M10 42C10 32.6 16.2 27.2 24 27.2C31.8 27.2 38 32.6 38 42H10Z"
        fill="#E7D8F5"
      />
    </svg>
  );
}
