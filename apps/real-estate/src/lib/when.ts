/** Server-side date labels. The desk renders these on the server only, so there is no hydration drift. */

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const fmtWhen = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;

const pad = (n: number) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD and HH:MM, the formats <input type="date|time"> expect. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
