import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { extractDocFields, DocType } from "@/lib/docFields";

const TEMPLATE_MAP: Record<DocType, string> = {
  "和解协议": "交通事故和解协议.docx",
  "民事起诉状": "民事起诉状.docx",
  "证据目录": "证据目录.docx",
};

export async function POST(request: NextRequest) {
  let body: { rawText?: unknown; docType?: unknown };
  try {
    body = await request.json() as { rawText?: unknown; docType?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { rawText, docType } = body;

  if (typeof rawText !== "string" || !rawText.trim()) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }
  if (!docType || !Object.keys(TEMPLATE_MAP).includes(docType as string)) {
    return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
  }

  const validDocType = docType as DocType;
  const templatePath = join(process.cwd(), "doc", "template", TEMPLATE_MAP[validDocType]);

  let templateContent: Buffer;
  try {
    templateContent = readFileSync(templatePath);
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 500 });
  }

  let outputBuffer: Buffer;
  try {
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter() {
        return "___";
      },
    });
    const fields = extractDocFields(rawText, validDocType);
    doc.render(fields);
    outputBuffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  } catch (err) {
    console.error("[generate-doc] docxtemplater error:", err);
    return NextResponse.json({ error: "Document generation failed" }, { status: 500 });
  }

  const fileName = `${validDocType}.docx`;
  return new NextResponse(new Uint8Array(outputBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
