function normalizeSiteUrl(url: string) {
  if (!url) return "";
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "";

  if (envUrl) {
    return normalizeSiteUrl(envUrl);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function buildProfileUrl(username: string) {
  const base = getSiteUrl();
  const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "");
  return `${base}/profile/${safeUsername}`;
}

