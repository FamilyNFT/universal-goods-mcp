import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall } from "../api-client.js";

export function registerProductTools(server: McpServer): void {
  server.registerTool("list_products", {
    title: "List Products",
    description: "List products for an organization. Requires scope: read:products",
    inputSchema: {
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      categoryId: z.string().optional().describe("Filter by category ID"),
      limit: z.number().int().optional().describe("Max results (default 50)"),
      page: z.number().int().optional().describe("Page number"),
    },
  }, async (args) => {
    const params = new URLSearchParams();
    if (args.organizationId) params.set("organizationId", args.organizationId);
    if (args.categoryId) params.set("categoryId", args.categoryId);
    if (args.limit) params.set("limit", String(args.limit));
    if (args.page) params.set("page", String(args.page));
    return ugCall(`/api/products?${params}`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("get_product", {
    title: "Get Product",
    description: "Get details of a specific product. Requires scope: read:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/products/${args.productId}`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("create_product", {
    title: "Create Product",
    description: "Create a new product in an organization. Requires scope: write:products",
    inputSchema: {
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      title: z.string().describe("Product title"),
      description: z.string().optional().describe("Product description"),
      categoryId: z.string().optional().describe("Category ID"),
      imageUrl: z.string().optional().describe("Product image URL"),
    },
  }, async (args) => {
    const { organizationId, ...body } = args;
    return ugCall("/api/products", {
      method: "POST",
      headers: { "x-organization-id": organizationId },
      body: JSON.stringify({ ...body, organizationId }),
    });
  });

  server.registerTool("update_product", {
    title: "Update Product",
    description: "Update fields on an existing product. Requires scope: write:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      imageUrl: z.string().optional().describe("New image URL"),
    },
  }, async (args) => {
    const { productId, organizationId, ...body } = args;
    return ugCall(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "x-organization-id": organizationId },
      body: JSON.stringify(body),
    });
  });

  server.registerTool("list_categories", {
    title: "List Categories",
    description: "List all product categories. Requires scope: read:products",
    inputSchema: {},
  }, async () => {
    return ugCall("/api/categories");
  });

  server.registerTool("get_product_checklist", {
    title: "Get Product Checklist",
    description: "Get the onboarding/setup status for a product. Requires scope: read:products",
    inputSchema: {
      productId: z.string().describe("Product ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/products/${args.productId}/checklist`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });
}
