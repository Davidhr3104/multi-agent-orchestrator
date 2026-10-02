export const KNOWLEDGE_LINKS_KEY = "helix-inbox-knowledge-links";

export type KnowledgeLinks = { drive: string; notion: string };

export function readKnowledgeLinks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWLEDGE_LINKS_KEY) ?? "{}") as Partial<KnowledgeLinks>;
    return [raw.drive, raw.notion].filter((url): url is string => typeof url === "string" && url.startsWith("https://")).slice(0, 2);
  } catch {
    return [];
  }
}

export function readKnowledgeForm(): KnowledgeLinks {
  if (typeof window === "undefined") return { drive: "", notion: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWLEDGE_LINKS_KEY) ?? "{}") as Partial<KnowledgeLinks>;
    return { drive: raw.drive ?? "", notion: raw.notion ?? "" };
  } catch {
    return { drive: "", notion: "" };
  }
}
