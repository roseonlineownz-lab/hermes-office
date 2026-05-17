const crypto = require("node:crypto");


const parseCookies = (header) => {
  const raw = typeof header === "string" ? header : "";
  if (!raw.trim()) return {};
  const out = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
};

const ACCESS_QUERY_KEYS = ["studio_access", "studio_token", "token"];

/** Constant-time string comparison to prevent timing attacks. */
const safeCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against self to burn constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

const resolveRequestUrl = (req) => {
  const host = req.headers?.host || "localhost";
  return new URL(req.url || "/", `http://${host}`);
};

const buildAccessCookie = (req, cookieName, token) => {
  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const secure = Boolean(req.socket?.encrypted) || forwardedProto === "https";
  return [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
};

/** Simple in-memory rate limiter for auth attempts. */
const createRateLimiter = (maxAttempts = 10, windowMs = 60_000) => {
  const attempts = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.start > windowMs) attempts.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return {
    isLimited(ip) {
      const entry = attempts.get(ip);
      if (!entry) return false;
      return entry.count >= maxAttempts;
    },
    recordFailure(ip) {
      const now = Date.now();
      const entry = attempts.get(ip);
      if (!entry || now - entry.start > windowMs) {
        attempts.set(ip, { count: 1, start: now });
        return;
      }
      entry.count++;
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
};

function createAccessGate(options) {
  const token = String(options?.token ?? "").trim();
  const cookieName = String(options?.cookieName ?? "studio_access").trim() || "studio_access";

  const enabled = Boolean(token);
  const rateLimiter = createRateLimiter(10, 60_000);

  const getAuthState = (req) => {
    if (!enabled) return { authorized: true, limited: false };
    const ip = req.socket?.remoteAddress || "unknown";
    const cookieHeader = req.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    const authorized = safeCompare(cookies[cookieName] || "", token);
    if (authorized) {
      rateLimiter.reset(ip);
      return { authorized: true, limited: false };
    }
    if (rateLimiter.isLimited(ip)) {
      return { authorized: false, limited: true };
    }
    rateLimiter.recordFailure(ip);
    return { authorized: false, limited: rateLimiter.isLimited(ip) };
  };

  const maybeGrantFromQuery = (req, res) => {
    let parsed;
    try {
      parsed = resolveRequestUrl(req);
    } catch {
      return false;
    }

    // Auto-login for /stark-login: grant access without query params
    const isStarkLogin = String(parsed.pathname).startsWith("/stark-login");
    if (isStarkLogin) {
      const ip = req.socket?.remoteAddress || "unknown";
      rateLimiter.reset(ip);
      res.statusCode = 303;
      res.setHeader("Set-Cookie", buildAccessCookie(req, cookieName, token));
      res.setHeader("Location", "/office");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/plain");
      res.end("Studio access granted via /stark-login.");
      return true;
    }

    const provided = ACCESS_QUERY_KEYS
      .map((key) => parsed.searchParams.get(key))
      .find((value) => typeof value === "string" && value.length > 0);
    if (!provided || !safeCompare(provided, token)) {
      return false;
    }

    for (const key of ACCESS_QUERY_KEYS) {
      parsed.searchParams.delete(key);
    }
    const location = `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    const ip = req.socket?.remoteAddress || "unknown";
    rateLimiter.reset(ip);
    res.statusCode = 303;
    res.setHeader("Set-Cookie", buildAccessCookie(req, cookieName, token));
    res.setHeader("Location", location);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain");
    res.end("Studio access granted.");
    return true;
  };

  const isStudioSettingsGet = (req) => {
    const path = String(req.url ?? "/");
    const pathname = path.startsWith("/") ? path.split("?")[0] : "/";
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    if (!pathname.startsWith("/api/studio")) return false;
    return true;
  };

  const handleHttp = (req, res) => {
    if (!enabled) return false;
    if (maybeGrantFromQuery(req, res)) return true;
    if (isStudioSettingsGet(req)) return false;
    const auth = getAuthState(req);
    if (!auth.authorized) {
      const statusCode = auth.limited ? 429 : 401;
      if (String(req.url || "/").startsWith("/api/")) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: auth.limited
              ? "Too many failed studio access attempts. Wait a minute and retry."
              : "Studio access token required. Send the configured Studio access cookie and retry.",
          })
        );
      } else {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "text/plain");
        res.end(
          auth.limited
            ? "Too many failed studio access attempts. Wait a minute and retry."
            : "Studio access token required. Set the studio_access cookie to access this page."
        );
      }
      return true;
    }
    return false;
  };

  const allowUpgrade = (req) => {
    if (!enabled) return true;
    return getAuthState(req).authorized;
  };

  return { enabled, handleHttp, allowUpgrade };
}

module.exports = { createAccessGate };
