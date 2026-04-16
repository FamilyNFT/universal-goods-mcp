import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "engagement.json");

export interface Engagement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  enterpriseName: string;
  supplierName: string;
  supplierEmail: string;
  status: "gathering" | "complete" | "minted";
  allFields: Array<{ name: string; label: string; required: boolean }>;
  missingFields: Array<{ name: string; label: string }>;
  filledByEnterprise: Record<string, string>;
  filledBySupplier: Record<string, string>;
  messages: Array<{ role: "agent" | "supplier"; content: string; timestamp: string }>;
}

export function readEngagement(): Engagement {
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

export function writeEngagement(eng: Engagement): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(eng, null, 2));
}
