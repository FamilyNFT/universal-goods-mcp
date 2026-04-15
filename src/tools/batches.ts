import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall } from "../api-client.js";

export function registerBatchTools(server: McpServer): void {
  server.registerTool("list_batches", {
    title: "List Batches",
    description: "List batches for a product. Requires scope: read:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/products/${args.productId}/batches`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("create_batch", {
    title: "Create Batch",
    description: "Create a new batch under a product. Requires scope: write:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      title: z.string().optional().describe("Batch title"),
      description: z.string().optional().describe("Batch description"),
    },
  }, async (args) => {
    const { productId, organizationId, ...body } = args;
    return ugCall(`/api/products/${productId}/batches`, {
      method: "POST",
      headers: { "x-organization-id": organizationId },
      body: JSON.stringify(body),
    });
  });

  server.registerTool("get_batch", {
    title: "Get Batch",
    description: "Get batch details including item count. Requires scope: read:products",
    inputSchema: {
      batchId: z.string().describe("Batch ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/batches/${args.batchId}`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("update_batch_state", {
    title: "Update Batch State",
    description: "Transition a batch state. Valid transitions: draft -> ready -> locked. Requires scope: write:products",
    inputSchema: {
      batchId: z.string().describe("Batch ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      state: z.enum(["draft", "ready", "locked"]).describe("Target state"),
    },
  }, async (args) => {
    return ugCall(`/api/batches/${args.batchId}`, {
      method: "PATCH",
      headers: { "x-organization-id": args.organizationId },
      body: JSON.stringify({ state: args.state }),
    });
  });
}
