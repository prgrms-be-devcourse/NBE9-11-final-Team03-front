import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileNavigation } from "./MobileNavigation";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-fixed-shell flex min-h-dvh flex-col bg-zinc-50">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileNavigation />
    </div>
  );
}
