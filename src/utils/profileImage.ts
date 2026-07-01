import type { UserRole } from "@/lib/api";

export const ADMIN_PROFILE_IMAGE_URL = "/admin-profile-blue.jpg";
export const DEFAULT_USER_PROFILE_IMAGE_URL = "/user-profile-purple.jpg";

export function getUserProfileImageUrl(
  profileImageUrl: string | null | undefined,
): string {
  const imageUrl = profileImageUrl?.trim();
  return imageUrl || DEFAULT_USER_PROFILE_IMAGE_URL;
}

export function getRoleProfileImageUrl(
  profileImageUrl: string | null | undefined,
  role: UserRole | null | undefined,
): string {
  if (role === "ADMIN") {
    return ADMIN_PROFILE_IMAGE_URL;
  }

  return getUserProfileImageUrl(profileImageUrl);
}
