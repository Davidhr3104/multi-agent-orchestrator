import mammoth from "mammoth";

export async function docxBufferToText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return String(result.value ?? "").trim();
}
