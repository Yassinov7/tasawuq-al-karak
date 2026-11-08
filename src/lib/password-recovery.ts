export type RecoveryCredentials = { access_token: string; refresh_token: string } | { token_hash: string };

// Never accept an ordinary signed-in session as proof of a recovery link.
export function parseRecoveryLink(raw: string): RecoveryCredentials | null {
  try {
    const url = new URL(raw);
    const route = `${url.hostname}${url.pathname}`;
    if (!route.endsWith("reset-password") || !["taswoqalkarak:", "exp:", "exps:"].includes(url.protocol)) return null;
    const params = new URLSearchParams(url.hash ? url.hash.slice(1) : url.search.slice(1));
    if (params.get("type") !== "recovery" || params.has("error") || params.has("error_code")) return null;
    const access_token = params.get("access_token"), refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) return { access_token, refresh_token };
    const token_hash = params.get("token_hash");
    return token_hash ? { token_hash } : null;
  } catch { return null; }
}
