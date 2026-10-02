export function modelForMethod(method: string | undefined): string {
  if (method === "BEAR") return "BEAR v2.4";
  if (method === "SPI") return "SPI v1.8";
  return "Helix match v1.2";
}

export function traceSuffix(parts: {
  model: string;
  prompt: string;
  match?: string;
  approval?: string;
}): string {
  const bits = [`model ${parts.model}`, `prompt ${parts.prompt}`];
  if (parts.match) bits.push(`match ${parts.match}`);
  if (parts.approval) bits.push(`approval ${parts.approval}`);
  return `— ${bits.join("; ")}`;
}

export function splitAuditDetail(detail: string): { summary: string; trace: string | null } {
  const marker = detail.indexOf("\n— ");
  if (marker === -1) return { summary: detail, trace: null };
  return { summary: detail.slice(0, marker), trace: detail.slice(marker + 3) };
}
