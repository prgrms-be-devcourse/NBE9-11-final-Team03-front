"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { NotificationDropdown } from "@/components/notification/NotificationDropdown";
import { authApi } from "@/lib/api";
import {
  clearAuthSession,
  getStoredNickname,
  getStoredProfileImageUrl,
  isLoggedIn as getIsLoggedIn,
  subscribeAuthChanged,
} from "@/lib/auth";

const publicNavItems = [
  { href: "/talents", label: "재능 둘러보기" },
];

const authNavItems = [
  { href: "/talents", label: "재능 둘러보기" },
  { href: "/talents/new", label: "재능 등록" },
  { href: "/matches", label: "매칭 추천" },
  { href: "/chats", label: "채팅" },
  { href: "/credits", label: "크레딧 지갑" },
];

interface HeaderAuthState {
  isLoggedIn: boolean;
  nickname: string | null;
  profileImageUrl: string | null;
}

function readHeaderAuthState(): HeaderAuthState {
  return {
    isLoggedIn: getIsLoggedIn(),
    nickname: getStoredNickname(),
    profileImageUrl: getStoredProfileImageUrl(),
  };
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<HeaderAuthState>({
    isLoggedIn: false,
    nickname: null,
    profileImageUrl: null,
  });
  const navItems = authState.isLoggedIn ? authNavItems : publicNavItems;

  useEffect(() => {
    function syncAuthState(): void {
      setAuthState(readHeaderAuthState());
    }

    const timeoutId = window.setTimeout(syncAuthState, 0);
    const unsubscribe = subscribeAuthChanged(syncAuthState);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ): void {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    if (window.location.pathname === href) {
      window.location.reload();
      return;
    }

    window.location.assign(href);
  }

  function isActive(href: string): boolean {
    if (href === "/talents/new") {
      return pathname === "/talents/new";
    }
    if (href === "/talents") {
      return (
        pathname === "/talents" ||
        (pathname.startsWith("/talents/") && pathname !== "/talents/new")
      );
    }
    if (href === "/matches") {
      return pathname.startsWith("/matches");
    }
    if (href === "/credits") {
      return pathname.startsWith("/credits");
    }
    if (href === "/chats") {
      return pathname.startsWith("/chats");
    }
    return pathname === href;
  }

  async function handleLogout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 API 실패와 무관하게 브라우저 세션은 반드시 정리한다.
    } finally {
      clearAuthSession();
      router.push("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="fixed-container flex h-16 items-center justify-between">
        <Link href="/" className="rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
          <BrandLogo />
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => handleNavClick(event, item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                isActive(item.href)
                  ? "bg-teal-50 text-teal-800"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {authState.isLoggedIn ? (
            <>
              <NotificationDropdown />
              <ProfileMenu
                nickname={authState.nickname}
                profileImageUrl={authState.profileImageUrl}
                onLogout={handleLogout}
              />
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex cursor-pointer rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
