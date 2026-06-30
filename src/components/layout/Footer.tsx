import { BrandLogo } from "@/components/layout/BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#080812] text-zinc-300">
      <div className="fixed-container grid gap-10 py-10 text-sm sm:py-12 lg:grid-cols-[1.35fr_0.8fr_1fr]">
        <div className="flex max-w-md flex-col gap-4">
          <div className="[&_.brandLogoContent]:text-white [&_.brandLogoText]:!text-white">
            <BrandLogo compact />
          </div>
          <p className="font-semibold leading-7 text-zinc-300">
            재능을 교환하고 거래하는 매칭 플랫폼
          </p>
          <p className="leading-7 text-zinc-400">
            본 서비스는 프로그래머스 데브코스 최종 프로젝트로 제작된 포트폴리오용 서비스입니다.
          </p>
        </div>

        <nav aria-label="푸터 서비스 링크" className="flex flex-col gap-3">
          <h2 className="text-base font-black text-white">서비스</h2>
          {["서비스 소개", "이용약관", "개인정보처리방침", "고객지원", "GitHub"].map((label) => (
            <a
              key={label}
              href="#"
              className="w-fit font-semibold text-zinc-300 transition hover:text-violet-300"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-black text-white">고객지원</h2>
          <p className="font-semibold text-zinc-300">이메일: baton.team@example.com</p>
          <p className="font-semibold text-zinc-300">문의 가능 시간: 평일 10:00 ~ 18:00</p>
          <p className="font-semibold text-zinc-300">GitHub Issue 문의 가능</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-xs font-semibold text-zinc-400 sm:flex-row sm:items-center sm:justify-between lg:col-span-3">
          <p>© 2026 BATON Team. All rights reserved.</p>
          <p>Powered by Programmers Devcourse NBE9-11-final-Team03</p>
        </div>
      </div>
    </footer>
  );
}
