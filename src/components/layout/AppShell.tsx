"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { ScrollTopButton } from "@/components/layout/ScrollTopButton";

interface AppShellProps {
  children: ReactNode;
}

const CHROME_HIDDEN_PATHS = new Set(["/", "/login", "/signup"]);

function shouldHideChrome(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  if (CHROME_HIDDEN_PATHS.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/login/") || pathname.startsWith("/signup/");
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (shouldHideChrome(pathname)) {
    return (
      <>
        {children}
        <ScrollTopButton />
      </>
    );
  }

  return (
    <div className="app-fixed-shell flex min-h-dvh flex-col bg-zinc-50 pb-16 lg:pb-0">
      <Header />
      <main className="flex-1">{children}</main>
      <MobileNavigation />
      <ScrollTopButton />
    </div>
  );
}
