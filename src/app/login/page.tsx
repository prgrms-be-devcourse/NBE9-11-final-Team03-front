"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { extractUserIdFromLoginResponse, setAuthStorage } from "@/lib/auth";

const LOGIN_FAILURE_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

const schema = z.object({
  email: z.string().email("이메일 형식으로 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상 입력해 주세요."),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: LoginValues) {
    setSubmitError(null);

    try {
      const response = await authApi.login({
        email: values.email,
        password: values.password,
      });
      const userId = extractUserIdFromLoginResponse(response);

      if (userId === null) {
        setSubmitError("로그인은 성공했지만 사용자 정보를 확인하지 못했습니다.");
        return;
      }

      setAuthStorage(response.accessToken, userId, {
        nickname: null,
        profileImageUrl: null,
      });
      router.push("/talents");
    } catch {
      setSubmitError(LOGIN_FAILURE_MESSAGE);
    }
  }

  return (
    <AuthShell title="로그인" description="가입한 이메일과 비밀번호를 입력해 주세요.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field label="이메일" error={errors.email?.message}>
          <input {...register("email")} className="form-input" />
        </Field>
        <Field label="비밀번호" error={errors.password?.message}>
          <input
            type="password"
            {...register("password")}
            className="form-input"
          />
        </Field>
        {submitError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {submitError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-md bg-zinc-950 text-sm font-bold text-white disabled:opacity-60"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-[420px] flex-col py-12">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black text-zinc-950">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-zinc-800">
      {label}
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
