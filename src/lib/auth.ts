import type { UserLoginRes, UserRole } from "@/lib/api/types";

export const ACCESS_TOKEN_STORAGE_KEY = "baton_access_token";
export const USER_ID_STORAGE_KEY = "baton_user_id";
export const USER_ROLE_STORAGE_KEY = "baton_user_role";
export const PROFILE_IMAGE_URL_STORAGE_KEY = "baton_profile_image_url";
export const NICKNAME_STORAGE_KEY = "baton_nickname";
export const AUTH_CHANGED_EVENT = "auth-changed";
export const LAST_TALENT_ID_STORAGE_PREFIX = "baton:lastTalentId";

const REFRESH_TOKEN_STORAGE_KEYS = [
  "refreshToken",
  "refresh_token",
  "baton_refresh_token",
];

interface AuthSessionParams {
  accessToken: string;
  userId: number;
  role?: UserRole | null;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export interface AuthTokenClaims {
  userId: number | null;
  role: UserRole | null;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function subscribeAuthChanged(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );

  return globalThis.atob(padded);
}

function toUserRole(value: unknown): UserRole | null {
  return value === "USER" || value === "ADMIN" ? value : null;
}

export function extractAuthClaimsFromAccessToken(
  accessToken: string,
): AuthTokenClaims {
  const [, payload] = accessToken.split(".");

  if (payload) {
    try {
      const parsed = JSON.parse(base64UrlDecode(payload)) as {
        sub?: unknown;
        role?: unknown;
      };
      const userId = Number(parsed.sub);

      return {
        userId: Number.isInteger(userId) && userId > 0 ? userId : null,
        role: toUserRole(parsed.role),
      };
    } catch {
      return {
        userId: null,
        role: null,
      };
    }
  }

  return {
    userId: null,
    role: null,
  };
}

export function extractUserIdFromLoginResponse(
  response: UserLoginRes,
): number | null {
  return extractAuthClaimsFromAccessToken(response.accessToken).userId;
}

export function getAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

export function getStoredUserId(): number | null {
  const storedUserId = getStorage()?.getItem(USER_ID_STORAGE_KEY);
  const userId = storedUserId === undefined || storedUserId === null
    ? NaN
    : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function getStoredUserRole(): UserRole | null {
  const value = getStorage()?.getItem(USER_ROLE_STORAGE_KEY);
  return toUserRole(value);
}

export function getStoredProfileImageUrl(): string | null {
  const value = getStorage()?.getItem(PROFILE_IMAGE_URL_STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function getStoredNickname(): string | null {
  const value = getStorage()?.getItem(NICKNAME_STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function hasStoredAccessToken(): boolean {
  return isLoggedIn();
}

export function getLastTalentIdStorageKey(userId: number): string {
  return `${LAST_TALENT_ID_STORAGE_PREFIX}:${userId}`;
}

export function getStoredLastTalentId(userId: number | null): number | null {
  if (userId === null) {
    return null;
  }

  const storedTalentId = getStorage()?.getItem(getLastTalentIdStorageKey(userId));
  const talentId = storedTalentId === undefined || storedTalentId === null
    ? NaN
    : Number(storedTalentId);

  return Number.isInteger(talentId) && talentId > 0 ? talentId : null;
}

export function setStoredLastTalentId(userId: number, talentId: number): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  if (
    Number.isInteger(userId) &&
    userId > 0 &&
    Number.isInteger(talentId) &&
    talentId > 0
  ) {
    storage.setItem(getLastTalentIdStorageKey(userId), String(talentId));
  }
}

export function clearStoredLastTalentId(
  userId: number,
  talentId?: number,
): void {
  const storage = getStorage();

  if (!storage || !Number.isInteger(userId) || userId <= 0) {
    return;
  }

  const key = getLastTalentIdStorageKey(userId);

  if (talentId === undefined || storage.getItem(key) === String(talentId)) {
    storage.removeItem(key);
  }
}

export function setAuthSession({
  accessToken,
  userId,
  role,
  nickname,
  profileImageUrl,
}: AuthSessionParams): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  storage.setItem(USER_ID_STORAGE_KEY, String(userId));

  if (role !== undefined) {
    if (role) {
      storage.setItem(USER_ROLE_STORAGE_KEY, role);
    } else {
      storage.removeItem(USER_ROLE_STORAGE_KEY);
    }
  }

  if (nickname !== undefined) {
    const nextNickname = nickname?.trim();
    if (nextNickname) {
      storage.setItem(NICKNAME_STORAGE_KEY, nextNickname);
    } else {
      storage.removeItem(NICKNAME_STORAGE_KEY);
    }
  }

  if (profileImageUrl !== undefined) {
    const nextProfileImageUrl = profileImageUrl?.trim();
    if (nextProfileImageUrl) {
      storage.setItem(PROFILE_IMAGE_URL_STORAGE_KEY, nextProfileImageUrl);
    } else {
      storage.removeItem(PROFILE_IMAGE_URL_STORAGE_KEY);
    }
  }

  notifyAuthChanged();
}

export function setAuthStorage(
  accessToken: string,
  userId: number,
  options: Pick<AuthSessionParams, "role" | "nickname" | "profileImageUrl"> = {},
): void {
  setAuthSession({
    accessToken,
    userId,
    ...options,
  });
}

export function clearAuthSession(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  storage.removeItem(USER_ID_STORAGE_KEY);
  storage.removeItem(USER_ROLE_STORAGE_KEY);
  storage.removeItem(PROFILE_IMAGE_URL_STORAGE_KEY);
  storage.removeItem(NICKNAME_STORAGE_KEY);
  REFRESH_TOKEN_STORAGE_KEYS.forEach((key) => storage.removeItem(key));

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);

    if (key?.toLowerCase().includes("refresh")) {
      storage.removeItem(key);
    }
  }

  notifyAuthChanged();
}

export function clearAuthStorage(): void {
  clearAuthSession();
}
