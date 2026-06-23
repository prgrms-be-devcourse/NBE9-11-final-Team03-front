import { Briefcase, Home, Sparkles, UserRound, Wallet } from "lucide-react";
import Link from "next/link";

const items = [
  { href: "/", label: "홈", icon: Home },
  { href: "/talents", label: "재능", icon: Briefcase },
  { href: "/matchings", label: "매칭", icon: Sparkles },
  { href: "/credits", label: "크레딧", icon: Wallet },
  { href: "/mypage", label: "마이", icon: UserRound },
];

export function MobileNavigation() {
  return (
    <nav
      aria-label="모바일 내비게이션"
      className="hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-zinc-600"
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
