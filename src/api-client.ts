const UG_API_URL = process.env.UG_API_URL ?? "https://app.universalgoods.xyz/api/server";

let _rawToken: string | null = null;
let _apiKey: string | null = null;
let _orgId: string | null = null;
let _authMode: "bearer" | "apikey" = "bearer";

export function setRawToken(token: string | null): void {
  _rawToken = token;
}

export function getRawToken(): string | null {
  return _rawToken;
}

export function setApiKey(apiKey: string | null): void {
  _apiKey = apiKey;
}

export function getApiKey(): string | null {
  return _apiKey;
}

export function setOrgId(orgId: string | null): void {
  _orgId = orgId;
}

export function getOrgId(): string | null {
  return _orgId;
}

export function setAuthMode(mode: "bearer" | "apikey"): void {
  _authMode = mode;
}

export function getAuthMode(): "bearer" | "apikey" {
  return _authMode;
}

/** Strip undefined values from headers so TS doesn't complain */
function cleanHeaders(
  h: Record<string, string | undefined> | HeadersInit | undefined,
): Record<string, string> {
  if (!h) return {};
  const raw = h as Record<string, string | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export type UgRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string | undefined>;
};

export async function ugFetch(
  path: string,
  init?: UgRequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (_authMode === "apikey") {
    if (!_apiKey) throw new Error("No API key configured");
    headers["x-api-key"] = _apiKey;
  } else {
    if (!_rawToken) throw new Error("No auth token available");
    headers["Authorization"] = `Bearer ${_rawToken}`;
  }

  // Auto-include org ID if available
  if (_orgId) {
    headers["x-organization-id"] = _orgId;
  }

  return fetch(`${UG_API_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...cleanHeaders(init?.headers),
    },
  });
}

/** Helper: call ugFetch and return JSON or error content for MCP */
export async function ugCall(
  path: string,
  init?: UgRequestInit,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }> {
  try {
    const res = await ugFetch(path, init);
    const text = await res.text();

    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Error ${res.status}: ${text}` }],
        isError: true,
      };
    }

    // Pretty-print JSON responses
    try {
      const json = JSON.parse(text);
      return {
        content: [{ type: "text", text: JSON.stringify(json, null, 2) }],
      };
    } catch {
      return { content: [{ type: "text", text }] };
    }
  } catch (err) {
    return {
      content: [
        { type: "text", text: `Request failed: ${(err as Error).message}` },
      ],
      isError: true,
    };
  }
}
