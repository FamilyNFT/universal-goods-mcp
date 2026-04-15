import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { setRawToken, setOrgId, setApiKey, setAuthMode } from "./api-client.js";
import { registerWhoamiTool } from "./tools/whoami.js";
import { registerProductTools } from "./tools/products.js";
import { registerBatchTools } from "./tools/batches.js";
import { registerItemTools } from "./tools/items.js";
import { registerSchemaTools } from "./tools/schemas.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerPrompts } from "./prompts/index.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const AUTH_ISSUER = process.env.AUTH_ISSUER ?? "http://localhost:4060/api/auth";
const AUTH_SERVER = process.env.AUTH_SERVER ?? AUTH_ISSUER;
const RESOURCE_URL = process.env.RESOURCE_URL ?? "http://localhost:3100";
const PORT = parseInt(process.env.PORT ?? "3100", 10);

const JWKS = createRemoteJWKSet(new URL(`${AUTH_SERVER}/jwks`));

// ─── Per-request JWT context ────────────────────────────────────────────────

let _currentJwt: JWTPayload | null = null;

export function getJwt(): JWTPayload | null {
  return _currentJwt;
}

// ─── MCP Server factory ─────────────────────────────────────────────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "universal-goods",
    version: "0.1.0",
  });

  registerWhoamiTool(server);
  registerProductTools(server);
  registerBatchTools(server);
  registerItemTools(server);
  registerSchemaTools(server);
  registerMetadataTools(server);
  registerOrganizationTools(server);
  registerPrompts(server);

  return server;
}

// ─── JWT verification ───────────────────────────────────────────────────────

async function verifyBearer(
  authHeader: string | undefined,
): Promise<{ jwt: JWTPayload; rawToken: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawToken = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(rawToken, JWKS, {
      issuer: AUTH_ISSUER,
    });
    return { jwt: payload, rawToken };
  } catch (err) {
    console.error("[MCP] JWT verification failed:", (err as Error).message);
    return null;
  }
}

// ─── Hono app ───────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(logger());
app.use(cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// OAuth Protected Resource Metadata (RFC 9728)
app.get("/.well-known/oauth-protected-resource", (c) => {
  return c.json({
    resource: RESOURCE_URL,
    authorization_servers: [AUTH_SERVER],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      "openid", "profile", "email", "offline_access",
      "read:products", "read:metadata", "read:passports", "read:schemas", "read:organization",
      "write:products", "write:metadata", "write:credentials",
      "manage:organization", "manage:billing",
      "deploy:batches", "sign:transactions",
    ],
  });
});

// API Key authentication
function verifyApiKey(
  c: { req: { header: (name: string) => string | undefined } },
): { apiKey: string; orgId: string } | null {
  const apiKey = c.req.header("x-api-key");
  const orgId = c.req.header("x-organization-id");
  if (!apiKey || !orgId) return null;
  return { apiKey, orgId };
}

// MCP transport endpoint
app.all("/mcp", async (c) => {
  // Try API key auth first, then fall back to Bearer JWT
  const apiKeyResult = verifyApiKey(c);
  const bearerResult = apiKeyResult ? null : await verifyBearer(c.req.header("authorization"));

  if (!apiKeyResult && !bearerResult) {
    return c.json({ error: "unauthorized" }, 401, {
      "WWW-Authenticate": `Bearer resource_metadata="${RESOURCE_URL}/.well-known/oauth-protected-resource"`,
    });
  }

  if (apiKeyResult) {
    _currentJwt = null;
    setAuthMode("apikey");
    setApiKey(apiKeyResult.apiKey);
    setOrgId(apiKeyResult.orgId);
    setRawToken(null);
  } else if (bearerResult) {
    _currentJwt = bearerResult.jwt;
    setAuthMode("bearer");
    setRawToken(bearerResult.rawToken);
    setOrgId((bearerResult.jwt as any).org_id ?? null);
    setApiKey(null);
  }

  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(c.env.incoming, c.env.outgoing);
  } finally {
    _currentJwt = null;
    setRawToken(null);
    setApiKey(null);
    setOrgId(null);
    setAuthMode("bearer");
  }

  return undefined as any;
});

// ─── Start ──────────────────────────────────────────────────────────────────

export default app;

// Only start the server directly when not running under Vite dev server
if (!import.meta.env?.DEV) {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[UG MCP] Listening on http://localhost:${PORT}/mcp`);
    console.log(`[UG MCP] Auth issuer: ${AUTH_ISSUER}`);
    console.log(`[UG MCP] Resource URL: ${RESOURCE_URL}`);
  });
}
