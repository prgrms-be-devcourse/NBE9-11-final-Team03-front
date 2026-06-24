import { BrandLogo } from "@/components/layout/BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="fixed-container flex flex-col gap-2 py-8 text-sm text-zinc-500">
        <div>
          <BrandLogo compact />
        </div>
        <p>돈 없이 재능으로 협업 경험을 만드는 주니어 재능 교환 플랫폼</p>
      </div>
    </footer>
  );
}
