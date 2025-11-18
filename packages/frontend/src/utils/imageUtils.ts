/**
 * Get the full URL for an avatar image
 * @param avatarPath - The avatar path from the database (e.g., "/uploads/avatars/avatar-123.jpg" or "https://example.com/avatar.png")
 * @returns The full URL to the avatar image
 */
export const getAvatarUrl = (avatarPath?: string | null): string | null => {
  if (!avatarPath) return null;
  
  // If it's already a full URL, return it as is
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return avatarPath;
  }
  
  // If it's a local path, use relative path (uploads are served directly, not through /api)
  // If VITE_API_URL is set, use it, otherwise use relative path
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return `${apiUrl}${avatarPath}`;
  }
  
  // Use relative path (works with proxy or same origin)
  return avatarPath;
};

/**
 * Get the full URL for a banner image
 * @param bannerPath - The banner path from the database (e.g., "/uploads/banners/banner-123.jpg" or "https://example.com/banner.png")
 * @returns The full URL to the banner image
 */
export const getBannerUrl = (bannerPath?: string | null): string | null => {
  if (!bannerPath) return null;
  
  // If it's already a full URL, return it as is
  if (bannerPath.startsWith("http://") || bannerPath.startsWith("https://")) {
    return bannerPath;
  }
  
  // If it's a local path, use relative path (uploads are served directly, not through /api)
  // If VITE_API_URL is set, use it, otherwise use relative path
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return `${apiUrl}${bannerPath}`;
  }
  
  // Use relative path (works with proxy or same origin)
  return bannerPath;
};

/**
 * Get the full URL for a server icon image
 * @param iconPath - The icon path from the database (e.g., "/uploads/server-icons/server-icon-123.jpg" or "https://example.com/icon.png")
 * @returns The full URL to the server icon image
 */
export const getServerIconUrl = (iconPath?: string | null): string | null => {
  if (!iconPath) return null;
  
  // If it's already a full URL, return it as is
  if (iconPath.startsWith("http://") || iconPath.startsWith("https://")) {
    return iconPath;
  }
  
  // If it's a local path, use relative path (uploads are served directly, not through /api)
  // If VITE_API_URL is set, use it, otherwise use relative path
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return `${apiUrl}${iconPath}`;
  }
  
  // Use relative path (works with proxy or same origin)
  return iconPath;
};

