"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo, BrandLogoContent } from "@/components/layout/BrandLogo";
import {
  getHeaderProfileImageUrl,
  type HeaderAuthState,
  readHeaderAuthState,
} from "@/components/layout/headerAuth";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { NotificationDropdown } from "@/components/notification/NotificationDropdown";
import { authApi } from "@/lib/api";
import {
  clearAuthSession,
  subscribeAuthChanged,
} from "@/lib/auth";

interface HeaderNavItem {
  href: string;
  label: string;
  isActive: boolean;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<HeaderAuthState>({
    isLoggedIn: false,
    nickname: null,
    profileImageUrl: null,
    role: null,
  });

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

  async function handleLogout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 API 실패 여부와 관계없이 로컬 세션은 정리합니다.
    } finally {
      clearAuthSession();
      router.push("/login");
    }
  }

  const isTalentActive =
    pathname === "/talents" ||
    (pathname.startsWith("/talents/") && pathname !== "/talents/new");
  const isTalentNewActive = pathname === "/talents/new";
  const isMatchesActive =
    pathname === "/matches" ||
    pathname.startsWith("/matches/") ||
    pathname === "/matchings" ||
    pathname.startsWith("/matchings/");
  const isTradesActive = pathname === "/trades" || pathname.startsWith("/trades/");
  const isChatsActive = pathname === "/chats" || pathname.startsWith("/chats/");
  const isCreditsActive = pathname === "/credits" || pathname.startsWith("/credits/");
  const isAdminActive = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdmin = authState.role === "ADMIN";

  const navItems: HeaderNavItem[] = [
    { href: "/talents", label: "재능 둘러보기", isActive: isTalentActive },
    ...(isAdmin
      ? [{ href: "/admin", label: "관리자", isActive: isAdminActive }]
      : [
        { href: "/talents/new", label: "재능 등록", isActive: isTalentNewActive },
        { href: "/matches", label: "매칭 추천", isActive: isMatchesActive },
        { href: "/trades", label: "거래", isActive: isTradesActive },
        { href: "/chats", label: "채팅", isActive: isChatsActive },
        { href: "/credits", label: "크레딧", isActive: isCreditsActive },
      ]),
  ];

  return (
    <>
      <header className="siteHeader">
        <div className="headerInner">
          <Link className="brandLogo" href="/" aria-label="Baton 홈" draggable={false}>
            <BrandLogoContent />
          </Link>

          <nav className="navMenu" aria-label="메인 메뉴">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.isActive ? "page" : undefined}
                className={item.isActive ? "active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions">
            {authState.isLoggedIn ? (
              <>
                <NotificationDropdown />
                <ProfileMenu
                  nickname={authState.nickname}
                  profileImageUrl={getHeaderProfileImageUrl(authState)}
                  isAdmin={isAdmin}
                  onLogout={handleLogout}
                />
              </>
            ) : (
              <>
                <Link href="/login" className="ghostBtn">
                  로그인
                </Link>
                <Link href="/signup" className="purpleBtn">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <style jsx global>{`
        .siteHeader {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 1100 !important;
          width: 100% !important;
          height: 64px !important;
          background: #ffffff !important;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .headerInner {
          max-width: 100% !important;
          height: 100%;
          margin: 0 auto;
          padding: 0 42px !important;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
        }

        .brandLogo,
        .brandLogoContent {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #15151f;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0;
          text-decoration: none;
          line-height: 1;
        }

        .brandLogo {
          justify-self: start;
        }

        .brandLogoContent strong,
        .brandLogoText {
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0;
        }

        .brandGlyph {
          position: relative;
          width: 24px;
          height: 22px;
          display: inline-flex;
          align-items: flex-end;
          gap: 4px;
        }

        .brandGlyph::before,
        .brandGlyph::after,
        .brandGlyph i {
          content: "";
          display: block;
          width: 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, #8c5bff 0%, #6d7cff 100%);
        }

        .brandGlyph::before {
          height: 16px;
        }

        .brandGlyph::after {
          height: 10px;
          transform: translateY(-6px);
        }

        .brandGlyph i:first-child {
          height: 20px;
          transform: translateY(2px);
        }

        .brandGlyph i:last-child {
          display: none;
        }

        .navMenu {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          font-size: 15px;
          font-weight: 600;
          color: #15151f;
        }

        .navMenu a {
          position: relative;
          color: #15151f;
          opacity: 0.92;
          text-decoration: none;
          white-space: nowrap;
          transition:
            color 0.24s ease,
            opacity 0.24s ease;
        }

        .navMenu a:hover,
        .navMenu a.active {
          color: #8c5bff;
          opacity: 1;
        }

        .headerActions {
          justify-self: end;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .ghostBtn,
        .purpleBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          padding: 0 18px;
          border-radius: 999px;
          font-size: 14px;
          line-height: 1;
          text-decoration: none;
          transition:
            transform 0.28s ease,
            box-shadow 0.28s ease,
            background 0.28s ease,
            border-color 0.28s ease;
          will-change: transform;
        }

        .ghostBtn {
          background: #ffffff;
          border: 1px solid rgba(140, 91, 255, 0.28);
          color: #8c5bff;
          font-weight: 600;
          box-shadow: none;
        }

        .purpleBtn {
          padding: 0 20px;
          border: 0;
          background: linear-gradient(135deg, #8c5bff 0%, #7b61ff 52%, #a779ff 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 10px 22px rgba(140, 91, 255, 0.3);
        }

        .ghostBtn:hover,
        .purpleBtn:hover {
          transform: translateY(-2px);
        }

        @media (max-width: 1180px) {
          .headerInner {
            max-width: 100%;
          }

          .navMenu {
            gap: 20px;
            font-size: 14px;
          }
        }

        @media (max-width: 1023px) {
          .siteHeader {
            height: 64px !important;
          }

          .headerInner {
            min-height: 64px;
            grid-template-columns: minmax(0, 1fr) auto;
            justify-content: normal;
            gap: 12px;
          }

          .navMenu {
            display: none;
          }

          .headerActions {
            justify-self: end;
          }
        }

        @media (max-width: 760px) {
          .headerInner {
            min-height: 60px !important;
            padding: 0 18px !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
          }

          .navMenu {
            display: none;
          }

          .ghostBtn {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .purpleBtn {
            height: 34px;
            padding: 0 12px;
          }
        }
      `}</style>
    </>
  );
}

export { BrandLogo };
