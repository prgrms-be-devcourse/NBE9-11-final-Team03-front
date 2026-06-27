import type { ApiResponse, UserLoginRes } from "./types";
import {
  clearAuthSession,
  extractAuthClaimsFromAccessToken,
  setAuthSession,
} from "@/lib/auth";

const DEFAULT_API_BASE_URL = "http://localhost:8080";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const API_BASE_URL =
  ENV_API_BASE_URL === undefined
    ? DEFAULT_API_BASE_URL
    : ENV_API_BASE_URL.replace(/\/+$/, "");

export const ACCESS_TOKEN_STORAGE_KEY = "baton_access_token";

export interface ApiRequestOptions
  extends Omit<RequestInit, "body" | "credentials"> {
  body?: BodyInit | object | null;
  query?: object;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor({
    status,
    code,
    message,
  }: {
    status: number;
    code?: string;
    message: string;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function shouldAttemptReissue(path: string): boolean {
  return (
    !path.includes("/api/v1/auth/login") &&
    !path.includes("/api/v1/auth/signup") &&
    !path.includes("/api/v1/auth/reissue") &&
    !path.includes("/api/v1/auth/email-send") &&
    !path.includes("/api/v1/auth/email-verification")
  );
}

export function buildApiUrl(path: string, query?: object): string {
  const pathname = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE_URL) {
    const url = new URL(`${API_BASE_URL}${pathname}`);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  const searchParams = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function shouldStringifyBody(
  body: ApiRequestOptions["body"],
): body is object {
  if (body === null || body === undefined) {
    return false;
  }

  return (
    typeof body === "object" &&
    !(body instanceof Blob) &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof ArrayBuffer)
  );
}

function toRequestBody(
  body: ApiRequestOptions["body"],
  isJsonBody: boolean,
): BodyInit | null | undefined {
  if (isJsonBody) {
    return JSON.stringify(body);
  }

  return body as BodyInit | null | undefined;
}

async function parseApiResponse<T>(
  response: Response,
): Promise<ApiResponse<T> | null> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

async function executeRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{
  response: Response;
  apiResponse: ApiResponse<T> | null;
}> {
  const { body, query, headers: optionHeaders, ...requestOptions } = options;
  const headers = new Headers(optionHeaders);
  const token = getAccessToken();
  const isJsonBody = shouldStringifyBody(body);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (isJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path, query), {
    ...requestOptions,
    body: toRequestBody(body, isJsonBody),
    credentials: "include",
    headers,
  });

  return {
    response,
    apiResponse: await parseApiResponse<T>(response),
  };
}

async function reissueAccessToken(): Promise<boolean> {
  const response = await fetch(buildApiUrl("/api/v1/auth/reissue"), {
    method: "POST",
    credentials: "include",
  });
  const apiResponse = await parseApiResponse<UserLoginRes>(response);

  if (!response.ok || !apiResponse || apiResponse.success === false) {
    return false;
  }

  const accessToken = apiResponse.data?.accessToken;
  if (!accessToken) {
    return false;
  }

  const claims = extractAuthClaimsFromAccessToken(accessToken);
  if (claims.userId === null) {
    return false;
  }

  setAuthSession({
    accessToken,
    userId: claims.userId,
    role: claims.role,
  });

  return true;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  let { response, apiResponse } = await executeRequest<T>(path, options);

  if (response.status === 401 && shouldAttemptReissue(path)) {
    const didReissue = await reissueAccessToken();

    if (didReissue) {
      ({ response, apiResponse } = await executeRequest<T>(path, options));
    } else {
      clearAuthSession();
    }
  }

  if (response.status === 401 && shouldAttemptReissue(path)) {
    clearAuthSession();
  }

  if (!apiResponse) {
    throw new ApiError({
      status: response.status,
      message: response.statusText || "API 응답을 처리할 수 없습니다.",
    });
  }

  if (!response.ok || apiResponse.success === false) {
    throw new ApiError({
      status: response.status,
      code: apiResponse.code,
      message: apiResponse.message,
    });
  }

  return apiResponse.data;
}
