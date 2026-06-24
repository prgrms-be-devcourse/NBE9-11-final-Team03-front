"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { validatePassword } from "@/lib/validation/password";

const PASSWORD_FORMAT_ERROR =
  "비밀번호 양식이 올바르지 않습니다. 영문, 숫자, 특수문자(!@#$%^*()_+~)를 포함한 8~20자로 입력해 주세요.";

const schema = z
  .object({
    email: z.string().email("이메일 형식으로 입력해 주세요."),
    password: z.string(),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
    nickname: z.string().min(1, "닉네임을 입력해 주세요."),
    profileImageUrl: z.string().optional(),
    introduction: z.string().min(5, "한줄 소개는 5자 이상 입력해 주세요."),
  })
  .superRefine((value, context) => {
    if (
      value.passwordConfirm.length > 0 &&
      value.password !== value.passwordConfirm
    ) {
      context.addIssue({
        code: "custom",
        message: "비밀번호가 일치하지 않습니다.",
        path: ["passwordConfirm"],
      });
    }

    const profileImageUrl = value.profileImageUrl?.trim();
    if (
      profileImageUrl &&
      !profileImageUrl.startsWith("http://") &&
      !profileImageUrl.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        message: "프로필 이미지 URL은 http:// 또는 https://로 시작해야 합니다.",
        path: ["profileImageUrl"],
      });
    }
  });

type SignupValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [profileImageUrlPreview, setProfileImageUrlPreview] = useState("");
  const [imageLoadError, setImageLoadError] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: SignupValues) {
    setSubmitError(null);
    const passwordError = validatePassword(values.email, values.password);

    if (passwordError) {
      setSubmitError(passwordError);
      return;
    }

    try {
      await authApi.signup({
        email: values.email.trim(),
        password: values.password,
        nickname: values.nickname.trim(),
        profileImageUrl: values.profileImageUrl?.trim() || null,
        introduction: values.introduction.trim(),
      });
      router.push("/login");
    } catch (error) {
      setSubmitError(getSignupErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto flex w-[420px] flex-col py-12">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black text-zinc-950">회원가입</h1>
        <Field label="이메일" error={errors.email?.message}><input {...register("email")} className="form-input" /></Field>
        <Field label="비밀번호" error={errors.password?.message}>
          <input
            type="password"
            maxLength={20}
            {...register("password")}
            className="form-input"
          />
          <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
            <p>
              영문, 숫자, 특수문자를 포함한 8~20자여야 합니다.
            </p>
            <p>
              같은 문자를 3번 연속 사용할 수 없고, 이메일 아이디를 포함할 수 없습니다.
            </p>
          </div>
        </Field>
        <Field label="비밀번호 확인" error={errors.passwordConfirm?.message}><input type="password" {...register("passwordConfirm")} className="form-input" /></Field>
        <Field label="닉네임" error={errors.nickname?.message}><input {...register("nickname")} className="form-input" /></Field>
        <Field
          label="프로필 이미지 URL"
          error={errors.profileImageUrl?.message}
        >
          <input
            {...register("profileImageUrl", {
              onChange: (event) => {
                setProfileImageUrlPreview(event.target.value.trim());
                setImageLoadError(false);
              },
            })}
            placeholder="https://example.com/profile.png"
            className="form-input"
          />
          {profileImageUrlPreview ? (
            <div className="mt-3 flex items-center gap-3">
              {!imageLoadError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={profileImageUrlPreview}
                  src={profileImageUrlPreview}
                  alt="프로필 이미지 미리보기"
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-200"
                  onLoad={() => setImageLoadError(false)}
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <span className="h-12 w-12 rounded-full bg-zinc-100 ring-1 ring-zinc-200" />
              )}
              {imageLoadError ? (
                <p className="text-xs font-semibold text-red-600">
                  이미지를 불러올 수 없습니다.
                </p>
              ) : (
                <p className="text-xs font-semibold text-zinc-500">
                  입력한 이미지가 프로필에 사용됩니다.
                </p>
              )}
            </div>
          ) : null}
        </Field>
        <Field label="한줄 소개" error={errors.introduction?.message}>
          <textarea
            {...register("introduction")}
            className="form-input min-h-24 resize-none"
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
          {isSubmitting ? "가입 중..." : "가입하기"}
        </button>
      </form>
    </div>
  );
}

function getSignupErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "회원가입 중 오류가 발생했습니다.";
  }

  if (
    error.message.includes("USER-400-001") ||
    error.message.includes("잘못된 비밀번호 양식입니다.")
  ) {
    return PASSWORD_FORMAT_ERROR;
  }

  return error.message;
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
