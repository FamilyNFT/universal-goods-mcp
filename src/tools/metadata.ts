import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ugCall } from "../api-client.js";

const entityTypeEnum = z.enum(["product", "batch", "item", "facility"]);

export function registerMetadataTools(server: McpServer): void {
  server.registerTool("list_entity_details", {
    title: "List Entity Details",
    description:
      "List all data sections filled for a product, batch, item, or facility. " +
      "Each section corresponds to a schema type. Requires scope: read:metadata",
    inputSchema: {
      entityType: entityTypeEnum.describe("Entity type"),
      entityId: z.string().describe("Entity ID"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(`/api/metadata/${args.entityType}/${args.entityId}/details`, {
      headers: { "x-organization-id": args.organizationId },
    });
  });

  server.registerTool("get_entity_detail", {
    title: "Get Entity Detail Section",
    description:
      "Get a specific data section for an entity by its slug. " +
      "Returns the stored data along with the schema definition. Requires scope: read:metadata",
    inputSchema: {
      entityType: entityTypeEnum.describe("Entity type"),
      entityId: z.string().describe("Entity ID"),
      slug: z.string().describe("Section slug (e.g. 'identification', 'sustainability', 'composition')"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(
      `/api/metadata/${args.entityType}/${args.entityId}/detail/${args.slug}`,
      { headers: { "x-organization-id": args.organizationId } },
    );
  });

  server.registerTool("set_entity_detail", {
    title: "Set Entity Detail Section",
    description:
      "Create or update a data section for a product, batch, item, or facility. " +
      "The data must conform to the JSON Schema for the given section type. " +
      "Use list_schemas or get_schema to discover the expected data shape. Requires scope: write:metadata",
    inputSchema: {
      entityType: entityTypeEnum.describe("Entity type"),
      entityId: z.string().describe("Entity ID"),
      slug: z.string().describe("Section slug"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
      title: z.string().describe("Display title for the detail section"),
      visibility: z.enum(["public", "private", "selective"]).default("public").describe("Visibility level for this section"),
      typeUri: z.string().optional().describe("Schema type URI (helps the server resolve the schema)"),
      data: z.record(z.any()).describe("Section data conforming to the schema"),
    },
  }, async (args) => {
    const { entityType, entityId, slug, organizationId, ...body } = args;
    return ugCall(`/api/metadata/${entityType}/${entityId}/detail/${slug}`, {
      method: "PUT",
      headers: { "x-organization-id": organizationId },
      body: JSON.stringify(body),
    });
  });

  server.registerTool("delete_entity_detail", {
    title: "Delete Entity Detail Section",
    description: "Remove a data section from an entity. Requires scope: write:metadata",
    inputSchema: {
      entityType: entityTypeEnum.describe("Entity type"),
      entityId: z.string().describe("Entity ID"),
      slug: z.string().describe("Section slug to delete"),
      organizationId: z.string().optional().describe("Organization ID (defaults to token's org_id)"),
    },
  }, async (args) => {
    return ugCall(
      `/api/metadata/${args.entityType}/${args.entityId}/detail/${args.slug}`,
      {
        method: "DELETE",
        headers: { "x-organization-id": args.organizationId },
      },
    );
  });

  server.registerTool("list_entity_types", {
    title: "List Entity Types (Schema Registry)",
    description:
      "List available schema types from the type registry, optionally filtered by what they apply to " +
      "(product, batch, item, facility). Use this to discover which sections can be filled for an entity.",
    inputSchema: {
      appliesTo: entityTypeEnum.optional().describe("Filter by entity type"),
    },
  }, async (args) => {
    const params = args.appliesTo ? `?appliesTo=${args.appliesTo}` : "";
    return ugCall(`/api/metadata/types${params}`);
  });
}
