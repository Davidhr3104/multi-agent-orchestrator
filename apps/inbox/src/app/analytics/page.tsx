import { loadDeskMessages } from "@/lib/load-desk";
import { InboxAnalyticsView } from "./analytics-view";

export default async function InboxAnalyticsPage() {
  const { messages } = await loadDeskMessages();
  return <InboxAnalyticsView initialMessages={messages} />;
}
