"use client";

import {
  BriefcaseBusiness,
  Handshake,
  LogIn,
  type LucideIcon,
  MessageCircle,
  PlusCircle,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isLoggedIn as getIsLoggedIn,
  subscribeAuthChanged,
} from "@/lib/auth";

interface MobileNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

function isTalentActive(pathname: string): boolean {
  return (
    pathname === "/talents" ||
    (pathname.startsWith("/talents/") && pathname !== "/talents/new")
  );
}

const signedInItems: MobileNavItem[] = [
  {
    href: "/talents",
    label: "재능",
    icon: BriefcaseBusiness,
    isActive: isTalentActive,
  },
  {
    href: "/talents/new",
    label: "등록",
    icon: PlusCircle,
    isActive: (pathname) => pathname === "/talents/new",
  },
  {
    href: "/matches",
    label: "매칭",
    icon: Sparkles,
    isActive: (pathname) =>
      pathname === "/matches" || pathname.startsWith("/matchings"),
  },
  {
    href: "/trades",
    label: "거래",
    icon: Handshake,
    isActive: (pathname) =>
      pathname === "/trades" || pathname.startsWith("/trades/"),
  },
  {
    href: "/chats",
    label: "채팅",
    icon: MessageCircle,
    isActive: (pathname) => pathname === "/chats",
  },
];

const signedOutItems: MobileNavItem[] = [
  {
    href: "/talents",
    label: "재능",
    icon: BriefcaseBusiness,
    isActive: isTalentActive,
  },
  {
    href: "/login",
    label: "로그인",
    icon: LogIn,
    isActive: (pathname) => pathname === "/login",
  },
  {
    href: "/signup",
    label: "회원가입",
    icon: UserPlus,
    isActive: (pathname) => pathname === "/signup",
  },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    function syncAuthState(): void {
      setIsLoggedIn(getIsLoggedIn());
    }

    const timeoutId = window.setTimeout(syncAuthState, 0);
    const unsubscribe = subscribeAuthChanged(syncAuthState);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const items = isLoggedIn ? signedInItems : signedOutItems;
  const gridClassName = items.length === 3 ? "grid-cols-3" : "grid-cols-5";

  return (
    <nav
      aria-label="모바일 내비게이션"
      className="fixed inset-x-0 bottom-0 z-40 w-full border-t border-zinc-200 bg-white/95 shadow-[0_-8px_24px_rgba(24,24,27,0.08)] backdrop-blur lg:hidden"
    >
      <div className={`grid ${gridClassName} min-w-0 pb-[env(safe-area-inset-bottom)]`}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-black transition ${
                isActive
                  ? "text-[#8c5bff]"
                  : "text-zinc-500 hover:text-zinc-950"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
