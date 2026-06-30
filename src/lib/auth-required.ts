import { ApiError } from "@/lib/api/client";

const AUTH_REQUIRED_MESSAGES = [
  "로그인 후",
  "인증이 필요",
  "unauthorized",
  "forbidden",
  "401",
  "403",
];

export function isAuthRequiredError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }

  if (error instanceof Error) {
    return isAuthRequiredMessage(error.message);
  }

  return typeof error === "string" && isAuthRequiredMessage(error);
}

export function isAuthRequiredMessage(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();

  return AUTH_REQUIRED_MESSAGES.some((authMessage) =>
    normalizedMessage.includes(authMessage),
  );
}
