"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authApi, profileApi } from "@/lib/api";
import { extractAuthClaimsFromAccessToken, setAuthStorage } from "@/lib/auth";

const LOGIN_FAILURE_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

const schema = z.object({
  email: z.string().email("이메일 형식으로 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상 입력해 주세요."),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: LoginValues) {
    setSubmitError(null);
    setResetMessage(null);

    try {
      const response = await authApi.login({
        email: values.email,
        password: values.password,
      });
      const claims = extractAuthClaimsFromAccessToken(response.accessToken);
      const userId = claims.userId;

      if (userId === null) {
        setSubmitError("로그인은 성공했지만 사용자 정보를 확인하지 못했습니다.");
        return;
      }

      setAuthStorage(response.accessToken, userId, {
        role: claims.role,
        nickname: null,
        profileImageUrl: null,
      });

      try {
        const profile = await profileApi.getMe();
        setAuthStorage(response.accessToken, userId, {
          role: claims.role,
          nickname: profile.nickname,
          profileImageUrl: profile.profileImageUrl,
        });
      } catch {
        // 프로필 조회 실패와 무관하게 로그인은 유지한다.
      }

      router.push("/talents");
    } catch {
      setSubmitError(LOGIN_FAILURE_MESSAGE);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field label="이메일 주소" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            {...register("email")}
            className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition focus:border-violet-400 focus:ring-violet-100"
          />
        </Field>
        <Field label="비밀번호" error={errors.password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            {...register("password")}
            className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition focus:border-violet-400 focus:ring-violet-100"
          />
        </Field>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() =>
              setResetMessage("비밀번호 재설정 기능은 준비 중입니다.")
            }
            className="cursor-pointer text-sm font-black text-violet-500 transition hover:text-violet-600"
          >
            비밀번호 재설정
          </button>
        </div>
        {resetMessage ? (
          <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">
            {resetMessage}
          </p>
        ) : null}
        {submitError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {submitError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full cursor-pointer rounded-xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_38%,#78a9ff_72%,#79e4dd_100%)] text-lg font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#8250ff_0%,#8570ff_36%,#70a5ff_70%,#66ddd7_100%)] hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <div className="mt-8 text-center text-sm font-semibold text-zinc-500">
        계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-black text-violet-500 transition hover:text-violet-600"
        >
          회원가입하기
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,#f7fbff_0%,#edf5ff_42%,#f4efff_100%)] px-6 py-16">
      <div
        className="pointer-events-none absolute left-[12%] top-28 h-40 w-40 rounded-full bg-cyan-200/35 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[14%] top-16 h-52 w-52 rounded-full bg-violet-300/35 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex w-[480px] flex-col">
        <Link
          href="/"
          className="mx-auto mb-8 inline-flex items-center gap-3 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          aria-label="Baton 홈"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/baton-logo.svg"
            alt="Baton"
            className="h-12 w-auto"
          />
        </Link>
        <section className="rounded-3xl border border-white/80 bg-white/88 p-9 shadow-2xl shadow-violet-950/10 backdrop-blur">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-500">
              Welcome Back
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-zinc-950">
              로그인
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
              재능 교환과 매칭 제안을 이어서 확인해 보세요.
            </p>
          </div>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-black text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
      ) : null}
    </label>
  );
}
