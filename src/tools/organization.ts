import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall, getOrgId, getAuthMode } from "../api-client.js";
import { getJwt } from "../index.js";

export function registerOrganizationTools(server: McpServer): void {
  server.registerTool("get_current_organization", {
    title: "Get Current Organization",
    description:
      "Returns details of the organization bound to this session. Requires scope: read:organization",
    inputSchema: {},
  }, async () => {
    const orgId = getOrgId();
    if (!orgId) {
      return {
        content: [{
          type: "text" as const,
          text: "No organization ID available. Provide x-organization-id header or use a token with org_id.",
        }],
        isError: true,
      };
    }

    return ugCall(`/api/organization/${orgId}`);
  });

  server.registerTool("list_organizations", {
    title: "List Organizations",
    description:
      "Lists all organizations the authenticated user belongs to. " +
      "Only available with Bearer token auth. Requires scope: read:organization",
    inputSchema: {},
  }, async () => {
    if (getAuthMode() === "apikey") {
      return {
        content: [{
          type: "text" as const,
          text: "list_organizations is not available with API key auth. API keys are scoped to a single organization.",
        }],
        isError: true,
      };
    }
    return ugCall("/api/auth/organization/list");
  });

  server.registerTool("get_token_info", {
    title: "Get Auth Info",
    description:
      "Returns info about the current authentication context (JWT claims or API key details).",
    inputSchema: {},
  }, async () => {
    const authMode = getAuthMode();

    if (authMode === "apikey") {
      const info = {
        auth_mode: "api_key",
        org_id: getOrgId(),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
      };
    }

    const jwt = getJwt();
    if (!jwt) {
      return {
        content: [{ type: "text" as const, text: "No token available." }],
        isError: true,
      };
    }

    const info = {
      auth_mode: "bearer",
      user_id: jwt.sub,
      name: (jwt as any).name,
      email: (jwt as any).email,
      org_id: (jwt as any).org_id ?? null,
      scopes: jwt.scope,
      audience: jwt.aud,
      issuer: jwt.iss,
      expires_at: jwt.exp ? new Date(jwt.exp * 1000).toISOString() : undefined,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
    };
  });
}
