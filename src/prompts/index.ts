import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  // ─── Product Creation Workflow ──────────────────────────────────────────
  server.registerPrompt("create_product_workflow", {
    title: "Create a Product",
    description:
      "Step-by-step guide to create a product, fill its data sections, create a batch, and generate items.",
    argsSchema: {
      organizationId: z.string().describe("Organization ID to create the product in"),
      productName: z.string().describe("Name of the product to create"),
    },
  }, async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Create a new product called "${args.productName}" in organization ${args.organizationId} and fill in its data sections.

Follow these steps:

1. **Create the product** using create_product with the title "${args.productName}"
2. **Discover available sections** using list_entity_types with appliesTo="product"
3. **For each relevant section**, use get_schema to understand the data shape, then use set_entity_detail to fill it with appropriate data
4. **Verify** using get_product_checklist to confirm data is filled
5. **Create a batch** using create_batch under the product
6. **Generate items** using create_items in the batch

Report progress after each step.`,
        },
      },
    ],
  }));

  // ─── Product Data Entry ────────────────────────────────────────────────
  server.registerPrompt("fill_product_data", {
    title: "Fill Product Data Sections",
    description:
      "Discover and fill all data sections for an existing product using the schema registry.",
    argsSchema: {
      organizationId: z.string().describe("Organization ID"),
      productId: z.string().describe("Product ID to fill data for"),
    },
  }, async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Fill all data sections for product ${args.productId} in organization ${args.organizationId}.

Follow these steps:

1. **Get current state** using list_entity_details with entityType="product" to see what sections are already filled
2. **Discover all available sections** using list_entity_types with appliesTo="product"
3. **For each unfilled section**:
   a. Use get_schema with the section's typeUri to get the JSON Schema
   b. Generate appropriate data that conforms to the schema
   c. Use set_entity_detail to save the data
4. **Verify** using get_product_checklist

Ask me for any product-specific information you need to fill in (e.g. materials, dimensions, certifications).`,
        },
      },
    ],
  }));

  // ─── Batch Deployment ──────────────────────────────────────────────────
  server.registerPrompt("prepare_batch_for_deployment", {
    title: "Prepare Batch for Deployment",
    description:
      "Guide through preparing a batch with items for on-chain deployment.",
    argsSchema: {
      organizationId: z.string().describe("Organization ID"),
      productId: z.string().describe("Product ID"),
      batchId: z.string().describe("Batch ID to prepare"),
      itemCount: z.string().optional().describe("Number of items to generate (default: 10)"),
    },
  }, async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Prepare batch ${args.batchId} (product ${args.productId}, org ${args.organizationId}) for deployment.

Follow these steps:

1. **Check batch status** using get_batch to see current state and item count
2. **Fill batch data sections** if needed:
   a. Use list_entity_types with appliesTo="batch"
   b. For each section, get_schema then set_entity_detail
3. **Generate items** if the batch has no items: use create_items with count=${args.itemCount || "10"}
4. **Transition to ready** using update_batch_state with state="ready"
5. **Report status** with a summary of the batch, items, and filled sections

Note: Actual on-chain deployment (locking the batch, creating merkle tree) requires the web UI. This workflow prepares the batch with all data needed for deployment.`,
        },
      },
    ],
  }));

  // ─── Product Audit ─────────────────────────────────────────────────────
  server.registerPrompt("audit_product_compliance", {
    title: "Audit Product Compliance",
    description:
      "Review a product's data completeness against all available schema sections and report gaps.",
    argsSchema: {
      organizationId: z.string().describe("Organization ID"),
      productId: z.string().describe("Product ID to audit"),
    },
  }, async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Audit the data completeness of product ${args.productId} in organization ${args.organizationId}.

Follow these steps:

1. **Get product details** using get_product
2. **Get checklist** using get_product_checklist
3. **List filled sections** using list_entity_details with entityType="product"
4. **List all available sections** using list_entity_types with appliesTo="product"
5. **Compare** filled vs available sections
6. **For each filled section**, use get_entity_detail to check data quality:
   - Are required fields populated?
   - Are values reasonable (not placeholder text)?
   - Are dates current?
7. **Check batches** using list_batches: are there batches? What states are they in?
8. **Check items** for each batch using list_items

Produce a compliance report with:
- Overall completeness percentage
- Filled sections (with quality notes)
- Missing sections (with severity: required vs optional)
- Batch/item status
- Recommendations for next steps`,
        },
      },
    ],
  }));

  // ─── Organization Overview ─────────────────────────────────────────────
  server.registerPrompt("organization_overview", {
    title: "Organization Overview",
    description:
      "Get a comprehensive overview of an organization's products, batches, and items.",
    argsSchema: {
      organizationId: z.string().describe("Organization ID"),
    },
  }, async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Give me a comprehensive overview of organization ${args.organizationId}.

1. **List all products** using list_products
2. **For each product**:
   a. Get the checklist using get_product_checklist
   b. List batches using list_batches
   c. For each batch, note state and item count
3. **Summarize** in a table:
   - Product name | Data sections filled | Batches | Items | Deployment status
4. **Identify** products that need attention (missing data, no batches, etc.)`,
        },
      },
    ],
  }));
}
