"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { authApi } from "@/lib/api";
import { validatePassword } from "@/lib/validation/password";

const PASSWORD_FORMAT_ERROR =
  "비밀번호 양식이 올바르지 않습니다. 영문, 숫자, 특수문자(!@#$%^*()_+~)를 포함한 8~20자로 입력해 주세요.";

const EMAIL_VERIFICATION_COOLDOWN_SECONDS = 300;
const EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY =
  "baton-email-verification-cooldown";

const schema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "이메일을 입력해 주세요.")
      .email("이메일 형식으로 입력해 주세요."),
    password: z.string().min(1, "비밀번호를 입력해 주세요."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
    nickname: z
      .string()
      .trim()
      .min(3, "닉네임은 3자 이상 입력해 주세요.")
      .max(10, "닉네임은 10자 이하로 입력해 주세요."),
    profileImageUrl: z.string().optional(),
    introduction: z
      .string()
      .trim()
      .min(5, "한줄 소개는 5자 이상 입력해 주세요."),
  })
  .superRefine((value, context) => {
    const passwordError = validatePassword(value.email, value.password);

    if (passwordError) {
      context.addIssue({
        code: "custom",
        message: passwordError,
        path: ["password"],
      });
    }

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

type MessageTone = "success" | "warning" | "error" | "info";

interface EmailMessage {
  tone: MessageTone;
  text: string;
}

type EmailVerificationCooldowns = Record<string, number>;


export default function SignupPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailMessage, setEmailMessage] = useState<EmailMessage | null>(null);
  const [emailCooldownModalMessage, setEmailCooldownModalMessage] = useState<string | null>(null);
  const [emailCooldowns, setEmailCooldowns] =
    useState<EmailVerificationCooldowns>(() => getStoredEmailVerificationCooldowns());
  const [cooldownTick, setCooldownTick] = useState(0);
  const [verificationRequestedEmail, setVerificationRequestedEmail] = useState<
    string | null
  >(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState<EmailMessage | null>(
    null,
  );
  const [checkedNickname, setCheckedNickname] = useState<string | null>(null);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [profileImageUrlPreview, setProfileImageUrlPreview] = useState("");
  const [imageLoadError, setImageLoadError] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(schema) });

  const currentEmail = useWatch({ control, name: "email" })?.trim() ?? "";
  const currentNickname = useWatch({ control, name: "nickname" })?.trim() ?? "";
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const emailCooldownExpiresAt =
    normalizedCurrentEmail.length > 0
      ? (emailCooldowns[normalizedCurrentEmail] ?? null)
      : null;
  const emailCooldownRemainingSeconds = getEmailCooldownRemainingSeconds(
    emailCooldownExpiresAt,
    cooldownTick,
  );
  const isCurrentEmailOnCooldown =
    normalizedCurrentEmail.length > 0 && emailCooldownRemainingSeconds > 0;
  const isEmailVerified =
    verifiedEmail !== null &&
    normalizedCurrentEmail.length > 0 &&
    verifiedEmail === normalizedCurrentEmail;
  const isEmailChangedAfterVerification =
    verifiedEmail !== null &&
    normalizedCurrentEmail.length > 0 &&
    verifiedEmail !== normalizedCurrentEmail;
  const isVerificationTargetChanged =
    verificationRequestedEmail !== null &&
    normalizedCurrentEmail.length > 0 &&
    verificationRequestedEmail !== normalizedCurrentEmail;
  const canVerifyEmail =
    emailVerificationCode.length === 6 &&
    verificationRequestedEmail !== null &&
    verificationRequestedEmail === normalizedCurrentEmail;
  const normalizedCurrentNickname = currentNickname.trim();
  const isNicknameChecked =
    checkedNickname !== null &&
    normalizedCurrentNickname.length > 0 &&
    checkedNickname === normalizedCurrentNickname;
  const isNicknameChangedAfterCheck =
    checkedNickname !== null &&
    normalizedCurrentNickname.length > 0 &&
    checkedNickname !== normalizedCurrentNickname;

  useEffect(() => {
    if (
      emailCooldownExpiresAt === null ||
      emailCooldownExpiresAt <= Date.now()
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      setCooldownTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [emailCooldownExpiresAt]);

  async function handleSendEmailVerification() {
    setSubmitError(null);
    setEmailMessage(null);
    setVerifiedEmail(null);
    setEmailVerificationCode("");

    const parsedEmail = z.string().trim().email().safeParse(currentEmail);
    if (!parsedEmail.success) {
      setEmailMessage({
        tone: "warning",
        text: "이메일 형식으로 입력해 주세요.",
      });
      return;
    }

    const email = normalizeEmail(parsedEmail.data);

    const cooldownRemainingSeconds = getEmailCooldownRemainingSeconds(
      emailCooldowns[email] ?? null,
      cooldownTick,
    );

    if (cooldownRemainingSeconds > 0) {
      const cooldownMessage = `이미 인증번호를 발송했습니다. ${formatCountdown(
        cooldownRemainingSeconds,
      )} 후 재전송할 수 있습니다.`;

      setEmailMessage(null);
      setEmailCooldownModalMessage(cooldownMessage);
      return;
    }

    setIsCheckingEmail(true);

    try {
      await authApi.sendEmail({ email });

      const cooldownExpiresAt =
        Date.now() + EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000;

      setEmailCooldowns((currentCooldowns) => {
        const nextCooldowns = {
          ...currentCooldowns,
          [email]: cooldownExpiresAt,
        };
        storeEmailVerificationCooldowns(nextCooldowns);
        return nextCooldowns;
      });
      setCooldownTick(0);
      setVerificationRequestedEmail(email);
      setEmailMessage(null);
    } catch (error) {
      const errorMessage = getEmailErrorMessage(
        error,
        "이메일 확인에 실패했습니다.",
      );

      if (isEmailVerificationAlreadySentError(error)) {
        const cooldownExpiresAt =
          Date.now() + EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000;

        setEmailCooldowns((currentCooldowns) => {
          const nextCooldowns = {
            ...currentCooldowns,
            [email]: cooldownExpiresAt,
          };
          storeEmailVerificationCooldowns(nextCooldowns);
          return nextCooldowns;
        });
        setCooldownTick(0);
      }

      setVerificationRequestedEmail(null);

      if (isEmailVerificationAlreadySentError(error)) {
        setEmailCooldownModalMessage(errorMessage);
        setEmailMessage(null);
      } else {
        setEmailMessage({
          tone: "error",
          text: errorMessage,
        });
      }
    } finally {
      setIsCheckingEmail(false);
    }
  }

  async function handleVerifyEmail() {
    setSubmitError(null);

    if (verificationRequestedEmail === null) {
      setEmailMessage({
        tone: "warning",
        text: "먼저 이메일 중복 확인을 진행해 주세요.",
      });
      return;
    }

    if (isVerificationTargetChanged) {
      setEmailMessage({
        tone: "warning",
        text: "이메일이 변경되었습니다. 다시 중복 확인을 진행해 주세요.",
      });
      return;
    }

    if (!/^\d{6}$/.test(emailVerificationCode)) {
      setEmailMessage({
        tone: "warning",
        text: "인증번호는 6자리 숫자로 입력해 주세요.",
      });
      return;
    }

    setIsVerifyingEmail(true);

    try {
      await authApi.verifyEmail({
        email: normalizedCurrentEmail,
        verificationCode: emailVerificationCode,
      });
      setVerifiedEmail(normalizedCurrentEmail);
      setEmailMessage({
        tone: "success",
        text: "이메일 인증이 완료되었습니다.",
      });
    } catch (error) {
      setVerifiedEmail(null);
      setEmailMessage({
        tone: "error",
        text: getEmailErrorMessage(error, "인증번호 확인에 실패했습니다."),
      });
    } finally {
      setIsVerifyingEmail(false);
    }
  }

  async function handleCheckNickname() {
    setSubmitError(null);
    setNicknameMessage(null);
    setCheckedNickname(null);

    const parsedNickname = z
      .string()
      .trim()
      .min(3, "닉네임은 3자 이상 입력해 주세요.")
      .max(10, "닉네임은 10자 이하로 입력해 주세요.")
      .safeParse(currentNickname);

    if (!parsedNickname.success) {
      setNicknameMessage({
        tone: "warning",
        text:
          parsedNickname.error.issues[0]?.message ?? "닉네임을 확인해 주세요.",
      });
      return;
    }

    const nickname = parsedNickname.data.trim();
    setIsCheckingNickname(true);

    try {
      await checkNicknameAvailability(nickname);
      setCheckedNickname(nickname);
      setNicknameMessage({
        tone: "success",
        text: "사용 가능한 닉네임입니다.",
      });
    } catch (error) {
      setCheckedNickname(null);
      setNicknameMessage({
        tone: "error",
        text: getNicknameErrorMessage(error),
      });
    } finally {
      setIsCheckingNickname(false);
    }
  }

  async function onSubmit(values: SignupValues) {
    setSubmitError(null);
    const normalizedEmail = normalizeEmail(values.email);

    if (verifiedEmail !== normalizedEmail) {
      setSubmitError("이메일 중복 확인과 인증을 완료해 주세요.");
      return;
    }

    if (checkedNickname !== values.nickname.trim()) {
      setSubmitError("닉네임 중복 확인을 완료해 주세요.");
      return;
    }

    const passwordError = validatePassword(normalizedEmail, values.password);

    if (passwordError) {
      setSubmitError(passwordError);
      return;
    }

    try {
      await authApi.signup({
        email: normalizedEmail,
        password: values.password.trim(),
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
    <AuthShell>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Field
          label="이메일 주소"
          error={errors.email?.message}
          help="중복 확인을 누르면 사용 가능한 이메일인지 확인하고 인증번호를 발송합니다."
        >
          <div className="grid grid-cols-[1fr_132px] gap-2 max-sm:grid-cols-1">
            <input
              type="email"
              autoComplete="email"
              {...register("email")}
              className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition focus:border-violet-400 focus:ring-violet-100"
            />
            <button
              type="button"
              disabled={
                isCheckingEmail ||
                isVerifyingEmail ||
                isSubmitting ||
                currentEmail.length === 0
              }
              onClick={handleSendEmailVerification}
              className="h-12 cursor-pointer rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-500 shadow-sm shadow-violet-950/5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {isCheckingEmail ? "확인 중..." : "중복 확인"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_132px] gap-2 max-sm:grid-cols-1">
            <input
              value={emailVerificationCode}
              onChange={(event) =>
                setEmailVerificationCode(
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 인증번호"
              className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold tracking-[0.18em] shadow-sm shadow-zinc-950/5 transition placeholder:font-normal placeholder:tracking-normal focus:border-violet-400 focus:ring-violet-100"
            />
            <button
              type="button"
              disabled={isVerifyingEmail || isSubmitting || !canVerifyEmail}
              onClick={handleVerifyEmail}
              className="h-12 cursor-pointer rounded-xl bg-zinc-950 px-4 text-sm font-black text-white shadow-sm shadow-zinc-950/10 transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {isVerifyingEmail ? "확인 중..." : "인증 확인"}
            </button>
          </div>

          {emailMessage ? (
            <StatusMessage tone={emailMessage.tone}>
              {emailMessage.text}
            </StatusMessage>
          ) : null}
          {isCurrentEmailOnCooldown ? (
            <StatusMessage tone="info">
              인증번호가 전송되었습니다.{" "}
              {formatCountdown(emailCooldownRemainingSeconds)} 후 재전송할 수
              있습니다.
            </StatusMessage>
          ) : null}
          {isEmailChangedAfterVerification ? (
            <StatusMessage tone="warning">
              인증 완료 후 이메일이 변경되었습니다. 다시 중복 확인과 인증을
              진행해 주세요.
            </StatusMessage>
          ) : null}
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="비밀번호" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="new-password"
              maxLength={20}
              {...register("password")}
              className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition focus:border-violet-400 focus:ring-violet-100"
            />
          </Field>
          <Field label="비밀번호 확인" error={errors.passwordConfirm?.message}>
            <input
              type="password"
              autoComplete="new-password"
              maxLength={20}
              {...register("passwordConfirm")}
              className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition focus:border-violet-400 focus:ring-violet-100"
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-violet-50/70 px-4 py-3 text-xs font-semibold leading-6 text-violet-700 ring-1 ring-violet-100">
          영문, 숫자, 특수문자(!@#$%^*()_+~)를 포함한 8~20자여야 합니다.
          <br />
          같은 문자를 3번 연속 사용할 수 없고, 이메일 아이디를 포함할 수
          없습니다.
        </div>

        <Field
          label="닉네임"
          error={errors.nickname?.message}
          help="닉네임은 3~10자로 입력한 뒤 중복 확인을 진행해 주세요."
        >
          <div className="grid grid-cols-[1fr_132px] gap-2 max-sm:grid-cols-1">
            <input
              {...register("nickname", {
                onChange: () => {
                  setCheckedNickname(null);
                  setNicknameMessage(null);
                },
              })}
              maxLength={10}
              placeholder="3~10자"
              className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition placeholder:font-normal focus:border-violet-400 focus:ring-violet-100"
            />
            <button
              type="button"
              disabled={
                isCheckingNickname ||
                isSubmitting ||
                normalizedCurrentNickname.length === 0
              }
              onClick={handleCheckNickname}
              className="h-12 cursor-pointer rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-500 shadow-sm shadow-violet-950/5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {isCheckingNickname ? "확인 중..." : "중복 확인"}
            </button>
          </div>

          {nicknameMessage ? (
            <StatusMessage tone={nicknameMessage.tone}>
              {nicknameMessage.text}
            </StatusMessage>
          ) : null}
          {isNicknameChangedAfterCheck ? (
            <StatusMessage tone="warning">
              중복 확인 후 닉네임이 변경되었습니다. 다시 중복 확인을 진행해
              주세요.
            </StatusMessage>
          ) : null}
        </Field>

        <Field
          label="프로필 이미지 URL"
          error={errors.profileImageUrl?.message}
          optional
        >
          <input
            {...register("profileImageUrl", {
              onChange: (event) => {
                setProfileImageUrlPreview(event.target.value.trim());
                setImageLoadError(false);
              },
            })}
            placeholder="https://example.com/profile.png"
            className="form-input h-12 rounded-xl border-zinc-200 bg-white/90 px-4 text-[15px] font-semibold shadow-sm shadow-zinc-950/5 transition placeholder:font-normal placeholder:text-zinc-400 focus:border-violet-400 focus:ring-violet-100"
          />
          {profileImageUrlPreview ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
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
            maxLength={120}
            placeholder="어떤 재능을 나누고 싶은지 짧게 소개해 주세요."
            className="form-input min-h-28 resize-none rounded-xl border-zinc-200 bg-white/90 px-4 py-3 text-[15px] font-semibold leading-6 shadow-sm shadow-zinc-950/5 transition placeholder:font-normal placeholder:text-zinc-400 focus:border-violet-400 focus:ring-violet-100"
          />
        </Field>

        {submitError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !isEmailVerified || !isNicknameChecked}
          className="h-12 w-full cursor-pointer rounded-xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_38%,#78a9ff_72%,#79e4dd_100%)] text-lg !font-bold text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#8250ff_0%,#8570ff_36%,#70a5ff_70%,#66ddd7_100%)] hover:shadow-xl hover:shadow-violet-400/25 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
        >
          {isSubmitting ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <div className="mt-8 text-center text-sm font-semibold text-zinc-500">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-black text-violet-500 transition hover:text-violet-600"
        >
          로그인하기
        </Link>
      </div>

      {emailCooldownModalMessage ? (
        <EmailCooldownModal
          message={emailCooldownModalMessage}
          onClose={() => setEmailCooldownModalMessage(null)}
        />
      ) : null}
    </AuthShell>
  );
}

function EmailCooldownModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="email-cooldown-modal-title"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-20 sm:pt-24"
    >
      <div className="pointer-events-auto relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-[0_28px_90px_rgba(39,39,42,0.24)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_58%,#79e4dd_100%)]" />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4f0ff_0%,#eff8ff_100%)] text-4xl text-violet-500 shadow-lg shadow-violet-400/10">
          ⏱
        </div>
        <h2
          id="email-cooldown-modal-title"
          className="mt-6 text-2xl font-black tracking-[-0.03em] text-zinc-950"
        >
          인증번호를 이미 발송했습니다
        </h2>
        <p className="mt-4 text-sm font-bold leading-7 text-zinc-500">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_38%,#78a9ff_72%,#79e4dd_100%)] text-base font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25"
        >
          확인
        </button>
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,#f7fbff_0%,#edf5ff_42%,#f4efff_100%)] px-4 py-12 sm:px-6">
      <div
        className="pointer-events-none absolute left-[11%] top-28 h-44 w-44 rounded-full bg-cyan-200/35 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[13%] top-14 h-56 w-56 rounded-full bg-violet-300/35 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-12 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-white/50 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-[620px] flex-col">
        <Link
          href="/"
          className="mx-auto mb-7 inline-flex items-center gap-3 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          aria-label="Baton 홈"
        >
          <BrandLogo compact />
        </Link>

        <section className="rounded-3xl border border-white/80 bg-white/88 p-6 shadow-2xl shadow-violet-950/10 backdrop-blur sm:p-8">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-500">
              Join Baton
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-zinc-950">
              회원가입
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
              이메일 인증 후 재능 교환을 시작할 프로필을 만들어 주세요.
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
  help,
  optional = false,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-black text-zinc-800">
      <span className="flex items-center gap-2">
        {label}
        {optional ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-black text-zinc-400">
            선택
          </span>
        ) : null}
      </span>
      {help ? (
        <p className="mt-1 text-xs font-semibold text-zinc-500">{help}</p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
      ) : null}
    </label>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: MessageTone;
  children: ReactNode;
}) {
  const toneClassName = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    error: "bg-red-50 text-red-700 ring-red-100",
    info: "bg-violet-50 text-violet-700 ring-violet-100",
  }[tone];

  return (
    <p
      className={`mt-2 rounded-xl px-4 py-3 text-xs font-semibold ring-1 ${toneClassName}`}
    >
      {children}
    </p>
  );
}

async function checkNicknameAvailability(nickname: string): Promise<void> {
  const response = await authApi.checkNickname({ nickname });

  if (!response.usableNickname) {
    throw new Error("이미 사용 중인 닉네임입니다.");
  }
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

  if (
    error.message.includes("USER-400-007") ||
    error.message.includes("이메일 인증이 완료되지 않았습니다.")
  ) {
    return "이메일 인증이 완료되지 않았습니다. 중복 확인과 인증번호 확인을 다시 진행해 주세요.";
  }

  if (
    error.message.includes("USER-409-001") ||
    error.message.includes("이미 존재하는 사용자입니다.")
  ) {
    return "이미 가입된 이메일 또는 닉네임입니다.";
  }

  if (
    error.message.includes("USER-409-002") ||
    error.message.includes("가입할 수 없는 이메일입니다.")
  ) {
    return "가입할 수 없는 이메일입니다.";
  }

  return error.message;
}

function getNicknameErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "닉네임 중복 확인에 실패했습니다.";
  }

  if (
    error.message.includes("USER-409-001") ||
    error.message.includes("이미 존재하는 사용자입니다.")
  ) {
    return "이미 사용 중인 닉네임입니다.";
  }

  if (
    error.message.includes("404") ||
    error.message.includes("Not Found") ||
    error.message.includes("찾을 수 없습니다")
  ) {
    return "닉네임 중복 확인 API를 찾을 수 없습니다. 백엔드 API 경로를 확인해 주세요.";
  }

  return error.message;
}

function isEmailVerificationAlreadySentError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("USER-429-001") ||
      error.message.includes("이미 인증번호가 발송되었습니다"))
  );
}

function getEmailErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes("USER-409-001") ||
    error.message.includes("이미 존재하는 사용자입니다.")
  ) {
    return "이미 가입된 이메일입니다.";
  }

  if (
    error.message.includes("USER-409-002") ||
    error.message.includes("가입할 수 없는 이메일입니다.")
  ) {
    return "가입할 수 없는 이메일입니다.";
  }

  if (isEmailVerificationAlreadySentError(error)) {
    return "이미 인증번호가 발송되었습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (
    error.message.includes("USER-400-006") ||
    error.message.includes("인증 코드가 일치하지 않습니다.")
  ) {
    return "인증번호가 일치하지 않습니다.";
  }

  if (
    error.message.includes("USER-400-005") ||
    error.message.includes("인증 코드가 만료되었습니다.")
  ) {
    return "인증번호가 만료되었습니다. 다시 중복 확인을 진행해 주세요.";
  }

  if (
    error.message.includes("USER-404-002") ||
    error.message.includes("이메일 인증 요청을 찾을 수 없습니다.")
  ) {
    return "이메일 인증 요청을 찾을 수 없습니다. 다시 중복 확인을 진행해 주세요.";
  }

  if (
    error.message.includes("USER-400-008") ||
    error.message.includes("최대 인증 시도 횟수를 초과했습니다.")
  ) {
    return "최대 인증 시도 횟수를 초과했습니다. 다시 중복 확인을 진행해 주세요.";
  }

  return error.message;
}

function getStoredEmailVerificationCooldowns(): EmailVerificationCooldowns {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(
      EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY,
    );

    if (storedValue === null) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as unknown;

    if (!isRecord(parsedValue)) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY);
      return {};
    }

    const now = Date.now();

    if (
      typeof parsedValue.email === "string" &&
      typeof parsedValue.expiresAt === "number"
    ) {
      if (parsedValue.expiresAt <= now) {
        window.localStorage.removeItem(EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY);
        return {};
      }

      return {
        [normalizeEmail(parsedValue.email)]: parsedValue.expiresAt,
      };
    }

    const validCooldowns = Object.entries(parsedValue).reduce<
      EmailVerificationCooldowns
    >((cooldowns, [email, expiresAt]) => {
      if (typeof expiresAt === "number" && expiresAt > now) {
        cooldowns[normalizeEmail(email)] = expiresAt;
      }

      return cooldowns;
    }, {});

    if (Object.keys(validCooldowns).length === 0) {
      window.localStorage.removeItem(EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY);
    }

    return validCooldowns;
  } catch {
    window.localStorage.removeItem(EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY);
    return {};
  }
}

function storeEmailVerificationCooldowns(
  cooldowns: EmailVerificationCooldowns,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  const validCooldowns = Object.entries(cooldowns).reduce<
    EmailVerificationCooldowns
  >((nextCooldowns, [email, expiresAt]) => {
    if (expiresAt > now) {
      nextCooldowns[normalizeEmail(email)] = expiresAt;
    }

    return nextCooldowns;
  }, {});

  if (Object.keys(validCooldowns).length === 0) {
    window.localStorage.removeItem(EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    EMAIL_VERIFICATION_COOLDOWN_STORAGE_KEY,
    JSON.stringify(validCooldowns),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getEmailCooldownRemainingSeconds(
  expiresAt: number | null,
  tick: number,
): number {
  void tick;

  if (expiresAt === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const safeTotalSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeTotalSeconds / 60);
  const seconds = safeTotalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
