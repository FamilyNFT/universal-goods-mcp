import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJwt } from "../index.js";
import { getAuthMode, getOrgId, getApiKey } from "../api-client.js";

export function registerWhoamiTool(server: McpServer): void {
  server.registerTool(
    "whoami",
    {
      title: "Who Am I",
      description:
        "Returns identity information about the current authentication context.",
      inputSchema: {},
    },
    async () => {
      const authMode = getAuthMode();

      if (authMode === "apikey") {
        const apiKey = getApiKey();
        const orgId = getOrgId();
        const info = {
          auth_mode: "api_key",
          organization_id: orgId,
          api_key_prefix: apiKey ? apiKey.slice(0, 8) + "..." : null,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
        };
      }

      const jwt = getJwt();
      if (!jwt) {
        return {
          content: [{ type: "text" as const, text: "Not authenticated." }],
          isError: true,
        };
      }

      const info = {
        auth_mode: "bearer",
        user_id: jwt.sub,
        name: (jwt as any).name,
        email: (jwt as any).email,
        email_verified: (jwt as any).email_verified,
        scopes: jwt.scope,
        audience: jwt.aud,
        issuer: jwt.iss,
        expires_at: jwt.exp
          ? new Date(jwt.exp * 1000).toISOString()
          : undefined,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
      };
    },
  );
}
