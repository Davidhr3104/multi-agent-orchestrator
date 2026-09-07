export function formatUsdNumber(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatIsoDate(value: string): string {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  return new Date(t).toISOString().slice(0, 10);
}

export function formatUsdAmount(raw: string): string {
  const t = raw.trim();
  if (!t || /unspecified|tbd|n\/a|not stated/i.test(t)) return "—";
  const k = t.match(/\$?\s*([\d,.]+)\s*k\b/i);
  if (k) {
    const n = parseFloat(k[1].replace(/,/g, "")) * 1000;
    if (Number.isFinite(n)) {
      return formatUsdNumber(n);
    }
  }
  const cleaned = t.replace(/[^0-9.]/g, "");
  if (!cleaned) return t;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return t;
  return formatUsdNumber(num);
}
