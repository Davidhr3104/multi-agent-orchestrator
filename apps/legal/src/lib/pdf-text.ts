import { extractText, getDocumentProxy } from "unpdf";

export async function pdfBufferToText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = extracted.text;
  if (Array.isArray(text)) return text.join("\n\n").trim();
  return String(text ?? "").trim();
}
