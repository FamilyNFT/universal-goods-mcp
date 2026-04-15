import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall } from "../api-client.js";

export function registerSchemaTools(server: McpServer): void {
  server.registerTool("list_schemas", {
    title: "List Schemas",
    description: "List all available product schemas (type registry). Schemas define the data structure for products, batches, and items.",
    inputSchema: {},
  }, async () => {
    return ugCall("/api/schemas");
  });

  server.registerTool("get_schema", {
    title: "Get Schema",
    description: "Get a schema by ID or typeUri. Returns the JSON Schema, form schema, and UI schema.",
    inputSchema: {
      id: z.string().describe("Schema ID or typeUri"),
    },
  }, async (args) => {
    return ugCall(`/api/schemas/${encodeURIComponent(args.id)}`);
  });
}
