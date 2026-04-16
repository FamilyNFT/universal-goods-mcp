import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readEngagement, writeEngagement } from "@/lib/engagement-store";
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Vercel AI Gateway (vck_ key) or direct Anthropic API key
const useGateway = !!process.env.AI_GATEWAY_API_KEY;
const client = new Anthropic(
  useGateway
    ? { apiKey: process.env.AI_GATEWAY_API_KEY, baseURL: "https://ai-gateway.vercel.sh" }
    : { apiKey: process.env.ANTHROPIC_API_KEY }
);
const MODEL = useGateway ? "anthropic/claude-sonnet-4-20250514" : "claude-sonnet-4-20250514";

interface UploadedFile {
  name: string;
  type: string;
  data: string; // base64
}

/** Extract text from a file. Returns text content or null if it should be sent as native content block. */
function extractTextFromFile(file: UploadedFile): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();

  // .docx → pandoc to extract text
  if (ext === "docx" || file.type.includes("wordprocessingml") || file.type === "application/msword") {
    const tmp = mkdtempSync(join(tmpdir(), "chat-"));
    const inPath = join(tmp, file.name);
    writeFileSync(inPath, Buffer.from(file.data, "base64"));
    try {
      const text = execFileSync("pandoc", [inPath, "-t", "plain", "--wrap=none"], {
        encoding: "utf-8",
        timeout: 15000,
      });
      return `[Document: ${file.name}]\n${text}`;
    } catch {
      return `[Document: ${file.name}] (failed to extract text)`;
    } finally {
      try { unlinkSync(inPath); } catch {}
    }
  }

  // .csv / .txt → decode directly
  if (ext === "csv" || ext === "txt" || file.type.startsWith("text/")) {
    const text = Buffer.from(file.data, "base64").toString("utf-8");
    return `[File: ${file.name}]\n${text}`;
  }

  // PDF and images → use native Anthropic content blocks (return null)
  return null;
}

export async function GET() {
  const eng = readEngagement();

  const fields = eng.allFields.map((f) => {
    const enterpriseVal = eng.filledByEnterprise[f.name] ?? null;
    const supplierVal = eng.filledBySupplier[f.name] ?? null;
    return {
      name: f.name,
      label: f.label,
      required: f.required,
      value: supplierVal ?? enterpriseVal,
      source: supplierVal ? "supplier" : enterpriseVal ? "enterprise" : null,
    };
  });

  return NextResponse.json({ ...eng, fields });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  const { engagementId } = await params;
  const body = await request.json();
  const supplierMessage: string = body.message ?? "";
  const files: UploadedFile[] = body.files ?? [];

  if (!supplierMessage.trim() && files.length === 0) {
    return NextResponse.json({ error: "message or files required" }, { status: 400 });
  }

  const eng = readEngagement();

  if (eng.id !== engagementId) {
    return NextResponse.json({ error: "engagement not found" }, { status: 404 });
  }

  // Build the content that gets stored in conversation history
  const fileNames = files.map((f) => f.name);
  const storedContent = fileNames.length
    ? `${supplierMessage}${supplierMessage ? "\n" : ""}[Attached: ${fileNames.join(", ")}]`
    : supplierMessage;

  // Append supplier message
  eng.messages.push({
    role: "supplier",
    content: storedContent,
    timestamp: new Date().toISOString(),
  });

  // Calculate still-missing fields
  const stillMissing = eng.missingFields.filter(
    (f) => !eng.filledBySupplier[f.name]
  );

  const alreadyCollected = Object.entries(eng.filledBySupplier)
    .map(([k, v]) => {
      const label = eng.allFields.find((f) => f.name === k)?.label ?? k;
      return `${label}: ${v}`;
    })
    .join("\n");

  // Build conversation history for Claude
  // All messages except the last one are plain text
  const previousMessages = eng.messages.slice(0, -1).map((m) => ({
    role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  // The latest message (just added) may include file content blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestContentBlocks: any[] = [];
  const textParts: string[] = [];
  if (supplierMessage.trim()) textParts.push(supplierMessage);

  for (const file of files) {
    const extracted = extractTextFromFile(file);
    if (extracted) {
      textParts.push(extracted);
    } else if (file.type === "application/pdf") {
      if (textParts.length) {
        latestContentBlocks.push({ type: "text", text: textParts.join("\n\n") });
        textParts.length = 0;
      }
      latestContentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      });
    } else if (file.type.startsWith("image/")) {
      if (textParts.length) {
        latestContentBlocks.push({ type: "text", text: textParts.join("\n\n") });
        textParts.length = 0;
      }
      latestContentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: file.type, data: file.data },
      });
    }
  }
  if (textParts.length) {
    latestContentBlocks.push({ type: "text", text: textParts.join("\n\n") });
  }

  const latestMessage: Anthropic.MessageParam = {
    role: "user" as const,
    content: latestContentBlocks.length > 0 ? latestContentBlocks : storedContent,
  };

  const conversationHistory = [...previousMessages, latestMessage];

  const systemPrompt = `You are Scout, a friendly data-collection assistant helping complete a Digital Product Passport.

Product: ${eng.productName} (SKU: ${eng.sku})
Enterprise: ${eng.enterpriseName}
Supplier: ${eng.supplierName}

STILL MISSING FIELDS (${stillMissing.length} remaining):
${stillMissing.map((f) => `- ${f.label} (key: ${f.name})`).join("\n")}

ALREADY COLLECTED FROM SUPPLIER:
${alreadyCollected || "(none yet)"}

ENTERPRISE-PROVIDED CONTEXT:
${Object.entries(eng.filledByEnterprise).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

RULES:
- Be warm, brief (1-3 sentences), and professional.
- Extract precise values from the supplier's message and map them to field keys.
- The supplier may attach documents (spec sheets, certificates, etc.). Extract ALL relevant field values from the document content. A single document may fill many fields at once.
- If a value is ambiguous, ask ONE clarifying question.
- Set status to "complete" ONLY when ALL missing fields listed above have values.
- Never fabricate or guess data — only record what the supplier explicitly provides or what is clearly stated in attached documents.
- Do NOT mention: blockchain, NFT, crypto, Web3, gas fees, wallet, on-chain, decentralised.

Respond with JSON ONLY, no markdown fences:
{"reply": "your message to the supplier", "fieldUpdates": {"field_key": "extracted value"}, "status": "gathering" | "complete"}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON response — handle markdown fences and plain text fallback
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: { reply: string; fieldUpdates: Record<string, string>; status: "gathering" | "complete" };
    try {
      // Try extracting JSON object from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      // Model returned plain text — use it as the reply directly
      parsed = { reply: cleaned, fieldUpdates: {}, status: "gathering" };
    }

    // Apply field updates
    for (const [key, value] of Object.entries(parsed.fieldUpdates)) {
      if (value && value.trim()) {
        eng.filledBySupplier[key] = value.trim();
      }
    }

    // Append agent reply
    eng.messages.push({
      role: "agent",
      content: parsed.reply,
      timestamp: new Date().toISOString(),
    });

    // Update status if complete
    if (parsed.status === "complete") {
      eng.status = "complete";
    }

    writeEngagement(eng);

    // Build merged fields view
    const fields = eng.allFields.map((f) => {
      const enterpriseVal = eng.filledByEnterprise[f.name] ?? null;
      const supplierVal = eng.filledBySupplier[f.name] ?? null;
      return {
        name: f.name,
        label: f.label,
        required: f.required,
        value: supplierVal ?? enterpriseVal,
        source: supplierVal ? "supplier" : enterpriseVal ? "enterprise" : null,
      };
    });

    return NextResponse.json({
      reply: parsed.reply,
      fieldUpdates: parsed.fieldUpdates,
      status: eng.status,
      fields,
    });
  } catch (err: unknown) {
    const error = err as Error & { status?: number; message?: string };
    console.error("[chat] Error:", error.status, error.message);
    console.error("[chat] Stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to process message", detail: error.message },
      { status: 500 }
    );
  }
}
