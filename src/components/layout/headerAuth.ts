import type { UserRole } from "@/lib/api";
import {
  getStoredNickname,
  getStoredProfileImageUrl,
  getStoredUserRole,
  isLoggedIn as getIsLoggedIn,
} from "@/lib/auth";

export const ADMIN_PROFILE_IMAGE_URL = "/admin-profile-blue.jpg";

export interface HeaderAuthState {
  isLoggedIn: boolean;
  nickname: string | null;
  profileImageUrl: string | null;
  role: UserRole | null;
}

export function readHeaderAuthState(): HeaderAuthState {
  return {
    isLoggedIn: getIsLoggedIn(),
    nickname: getStoredNickname(),
    profileImageUrl: getStoredProfileImageUrl(),
    role: getStoredUserRole(),
  };
}

export function getHeaderProfileImageUrl(
  authState: HeaderAuthState,
): string | null {
  if (authState.role === "ADMIN") {
    return ADMIN_PROFILE_IMAGE_URL;
  }

  return authState.profileImageUrl;
}
