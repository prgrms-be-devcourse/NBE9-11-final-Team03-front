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
  nickname,
  profileImageUrl,
  isAdmin,
  onLogout,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayName = nickname?.trim() || "프로필";
  const placeholderText =
    displayName === "프로필" ? "프로필" : displayName.slice(0, 1);

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
        className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-xs font-black text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        {profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileImageUrl}
            alt="내 프로필 이미지"
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{placeholderText}</span>
        )}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-2 shadow-xl"
        >
          {profileMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
            >
              관리자
            </Link>
          ) : null}
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogoutClick}
            className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
