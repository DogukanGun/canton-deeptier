import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One cheap, schema-constrained call: invoice image/PDF -> structured fields to
// prefill the Mint form. Optional and cost-capped; if no key is configured the
// Mint form falls back to manual entry / the "Use sample invoice" button.
const InvoiceSchema = z.object({
  debtor: z.string().describe("buyer / debtor company name on the invoice"),
  faceAmount: z.number().describe("total invoice amount as a plain number, no currency symbol or separators"),
  maturity: z.string().describe("payment due date in ISO format YYYY-MM-DD; best guess if only a term is given"),
  instrumentId: z.string().optional().describe("invoice number / id if present"),
});

export async function POST(req: Request) {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!gatewayKey && !openaiKey) {
    return NextResponse.json({ available: false, reason: "no AI key configured" });
  }

  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ available: false, reason: "no file" });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ available: false, reason: "file too large (max 5MB)" });
    }
    bytes = new Uint8Array(await file.arrayBuffer());
    mediaType = file.type || "image/png";
  } catch {
    return NextResponse.json({ available: false, reason: "could not read upload" });
  }

  // Prefer the Vercel AI Gateway (provider/model string); else the OpenAI key.
  const modelId = process.env.AI_INVOICE_MODEL || "openai/gpt-4o-mini";
  const model = gatewayKey ? modelId : openai(modelId.replace(/^openai\//, ""));
  const maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 400);

  const isPdf = mediaType.includes("pdf");
  const filePart = isPdf
    ? { type: "file" as const, data: bytes, mediaType: "application/pdf" }
    : { type: "image" as const, image: bytes };

  try {
    const { object } = await generateObject({
      model: model as never,
      schema: InvoiceSchema,
      temperature: 0,
      maxOutputTokens,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the confirmed-payable fields from this invoice. Return the total amount as a number. If only a payment term (e.g. Net 90) is shown, compute an approximate ISO due date.",
            },
            filePart,
          ],
        },
      ],
    });
    return NextResponse.json(object);
  } catch (e) {
    // Never block the Mint flow on AI failure.
    return NextResponse.json({ available: false, reason: (e as Error).message });
  }
}
