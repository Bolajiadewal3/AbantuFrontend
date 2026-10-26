const TOKEN_KEY = "care_app_token";
const USER_KEY = "care_app_user";
const SUPER_ADMIN_TOKEN_KEY = "care_app_super_admin_token";

function readTokenClaims(token: string | null = localStorage.getItem(TOKEN_KEY)): Record<string, unknown> | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const authStorage = {
  setSession: (token: string, user: any) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
  },

  getToken: () => {
    const elevatedToken = localStorage.getItem(SUPER_ADMIN_TOKEN_KEY);
    const claims = readTokenClaims(elevatedToken);
    if (claims?.super_admin === "true" && typeof claims.exp === "number" && claims.exp * 1000 > Date.now()) {
      return elevatedToken;
    }
    if (elevatedToken) localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
    return localStorage.getItem(TOKEN_KEY);
  },

  setSuperAdminToken: (token: string) => localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token),

  clearSuperAdminToken: () => localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY),

  getElevatedTokenExpiry: () => {
    const claims = readTokenClaims(localStorage.getItem(SUPER_ADMIN_TOKEN_KEY));
    return claims?.super_admin === "true" && typeof claims.exp === "number"
      ? claims.exp * 1000
      : null;
  },

  isSuperAdmin: () => {
    const claims = readTokenClaims(localStorage.getItem(SUPER_ADMIN_TOKEN_KEY));
    return claims?.super_admin === "true" &&
      typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
  },

  getUser: () => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
  },

  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),
};
