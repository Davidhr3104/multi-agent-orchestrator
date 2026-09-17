import { InboxDashboard } from "@/components/inbox-dashboard";
import { loadDeskMessages } from "@/lib/load-desk";

export default async function HomePage() {
  const { messages, persistence } = await loadDeskMessages();
  return <InboxDashboard initialMessages={messages} initialPersistence={persistence} />;
}
