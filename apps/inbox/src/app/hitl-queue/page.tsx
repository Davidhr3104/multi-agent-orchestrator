import { loadDeskMessages } from "@/lib/load-desk";
import { HitlQueueView } from "./hitl-queue-view";

export default async function HITLQueuePage() {
  const { messages } = await loadDeskMessages();
  const threads = messages.filter((m) => m.needsReview);
  return <HitlQueueView initialThreads={threads} />;
}
