import type { UserRole } from "@/lib/api";
import {
  getStoredNickname,
  getStoredProfileImageUrl,
  getStoredUserRole,
  isLoggedIn as getIsLoggedIn,
} from "@/lib/auth";
import { getRoleProfileImageUrl } from "@/utils/profileImage";

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
): string {
  return getRoleProfileImageUrl(authState.profileImageUrl, authState.role);
}
