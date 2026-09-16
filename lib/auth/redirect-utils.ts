/**
 * Utilities to safely handle redirection back to the originating page after authentication.
 * Includes open-redirect protection and referrer fallback.
 */

const BLOCKED_REDIRECT_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
];

/**
 * Validates and sanitizes a candidate return URL.
 * Ensures the URL is internal to prevent open-redirect vulnerabilities.
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback: string = "/"
): string {
  if (!url || typeof url !== "string") return fallback;

  const trimmed = url.trim();

  // Disallow javascript:, data:, or malformed protocols
  if (
    !trimmed ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return fallback;
  }

  // Disallow protocol-relative URLs like "//evil.com"
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // If it's a relative path starting with single "/"
  if (trimmed.startsWith("/")) {
    const pathnameOnly = trimmed.split("?")[0].split("#")[0];
    if (BLOCKED_REDIRECT_PATHS.includes(pathnameOnly)) {
      return fallback;
    }
    return trimmed;
  }

  // If it's an absolute URL, only permit if same origin
  try {
    if (typeof window !== "undefined") {
      const parsed = new URL(trimmed, window.location.origin);
      if (parsed.origin === window.location.origin) {
        if (BLOCKED_REDIRECT_PATHS.includes(parsed.pathname)) {
          return fallback;
        }
        return parsed.pathname + parsed.search + parsed.hash;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

/**
 * Determines the target redirect URL from searchParams or client document.referrer.
 */
export function getAuthRedirectTarget(
  searchParams?: { get: (key: string) => string | null } | null,
  fallback: string = "/"
): string {
  // 1. Explicit query parameter check
  if (searchParams) {
    const candidate =
      searchParams.get("callbackUrl") ||
      searchParams.get("redirect") ||
      searchParams.get("from");

    if (candidate) {
      const safe = getSafeRedirectUrl(candidate, "");
      if (safe && safe !== "/") {
        return safe;
      }
    }
  }

  // 2. Client-side document.referrer fallback
  if (typeof window !== "undefined" && document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      if (refUrl.origin === window.location.origin) {
        const safeRef = getSafeRedirectUrl(
          refUrl.pathname + refUrl.search + refUrl.hash,
          ""
        );
        if (safeRef && safeRef !== "/") {
          return safeRef;
        }
      }
    } catch {
      // Ignore URL parse error
    }
  }

  return fallback;
}

/**
 * Builds a link to /login or /register carrying the current path as callbackUrl.
 */
export function buildAuthHref(
  basePath: "/login" | "/register",
  currentPathname?: string | null,
  currentSearchParams?: string | null
): string {
  if (!currentPathname) return basePath;

  const fullPath =
    currentPathname + (currentSearchParams ? `?${currentSearchParams}` : "");

  const isAuthOrHome =
    fullPath === "/" ||
    BLOCKED_REDIRECT_PATHS.some((p) => fullPath.startsWith(p));

  if (isAuthOrHome) {
    return basePath;
  }

  return `${basePath}?callbackUrl=${encodeURIComponent(fullPath)}`;
}
