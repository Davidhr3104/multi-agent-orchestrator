import { loadDeskMessages } from "@/lib/load-desk";
import { RoutedView } from "./routed-view";

export default async function RoutedPage() {
  const { messages } = await loadDeskMessages();
  return <RoutedView initialThreads={messages.filter((m) => m.status === "routed")} />;
}
