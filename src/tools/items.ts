import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall } from "../api-client.js";

export function registerItemTools(server: McpServer): void {
  server.registerTool("list_items", {
    title: "List Items",
    description: "List items in a batch. Requires scope: read:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      batchId: z.string().describe("Batch ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      limit: z.number().int().optional().describe("Max results"),
      page: z.number().int().optional().describe("Page number"),
    },
  }, async (args) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.page) params.set("page", String(args.page));
    const qs = params.toString();
    return ugCall(
      `/api/products/${args.productId}/batches/${args.batchId}/items${qs ? `?${qs}` : ""}`,
      { headers: { "x-organization-id": args.organizationId } },
    );
  });

  server.registerTool("create_items", {
    title: "Bulk Create Items",
    description: "Bulk-create items in a batch by providing ethereum addresses. Requires scope: deploy:batches",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      batchId: z.string().describe("Batch ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      items: z.array(z.object({
        ethereumAddress: z.string().describe("Ethereum address for the item"),
      })).min(1).max(500).describe("Array of items with ethereum addresses"),
    },
  }, async (args) => {
    return ugCall(
      `/api/products/${args.productId}/batches/${args.batchId}/items/bulk`,
      {
        method: "POST",
        headers: { "x-organization-id": args.organizationId },
        body: JSON.stringify({ items: args.items }),
      },
    );
  });

  server.registerTool("get_item", {
    title: "Get Item",
    description: "Get details of a specific item. Requires scope: read:products",
    inputSchema: {
      itemId: z.string().describe("Item ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/items/${args.itemId}`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("update_item", {
    title: "Update Item",
    description: "Update item fields. ethereumAddress is immutable. Requires scope: write:products",
    inputSchema: {
      itemId: z.string().describe("Item ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      title: z.string().optional().describe("Item title"),
      description: z.string().optional().describe("Item description"),
    },
  }, async (args) => {
    const { itemId, organizationId, ...body } = args;
    return ugCall(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "x-organization-id": organizationId },
      body: JSON.stringify(body),
    });
  });
}
