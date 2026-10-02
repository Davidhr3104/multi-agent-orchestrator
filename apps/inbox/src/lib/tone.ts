import type { InboxPersona } from "@/lib/agent-profile";

export function toneHint(input: {
  category: string;
  sentiment: string;
  leadIntent?: boolean;
  persona?: InboxPersona;
  draftTone?: string;
}): string {
  if (input.persona === "sales" || input.leadIntent) {
    return "Sales desk: name the buying signal, treat urgency as the match score, and route to a seller. Do not grant a discount.";
  }
  if (input.category === "meeting") {
    return "Executive desk: confirm the meeting in one formal sentence. Drop anything that is cold outreach.";
  }
  if (input.sentiment === "urgent") {
    return "Executive desk: acknowledge the deadline first, then the next step. Keep the tone formal.";
  }
  const tone = input.draftTone ? ` Saved tone: ${input.draftTone}.` : "";
  return `Executive desk: short and formal. Filter noise.${tone}`;
}
