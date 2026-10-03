import Link from "next/link";
import { AskHelixButton } from "@/components/global-copilot";

type Step = { title: string; body: string; href?: string; open?: string; ask?: string };

const STEPS: Step[] = [
  {
    title: "1. Start on the Dashboard",
    body: "Active listings, hot buyers, listings nobody has visited in 15+ days and your draft approval rate. Hottest buyers have one-click WhatsApp, email and Book showing. Set your commission rate once and the dashboard shows commission in pipeline — Helix never guesses the rate.",
    href: "/",
    open: "Open Dashboard",
  },
  {
    title: "2. Ask Helix AI from anywhere",
    body: "Press Ctrl+K (⌘K on Mac) on any page, or use Ask Helix in the sidebar. Work in plain language; every answer links to the buyer or property it mentions. Helix AI can make mistakes, so check before acting.",
    ask: "Who are my hottest buyers?",
  },
  {
    title: "3. Read the score",
    body: "Hover or click any Hot/Warm/Cold badge to see how the score is built: budget, timeline, financing, specificity and engagement, with each one's points and share. Leads also get an intent label — investor, end buyer or tenant — from words in their own message.",
    href: "/leads",
    open: "Open Leads",
  },
  {
    title: "4. Filter buyers in one bar",
    body: "Type facets straight into the Leads search: zone:riverside stage:visit intent:investor fin:cash <500k. Each one becomes a chip you can remove. Switch to Pipeline to drag buyers between stages.",
    href: "/leads?q=intent%3Ainvestor",
    open: "Try a facet search",
  },
  {
    title: "5. Match buyers and properties",
    body: "Hover a property card and pick Matching buyers: a side panel ranks open buyers with the fit breakdown (budget 40, location 30, bedrooms 20, availability 10). The camera icon opens the media viewer.",
    href: "/properties",
    open: "Open Properties",
  },
  {
    title: "6. Book, move and debrief showings",
    body: "Up-next showings have Ask to confirm (opens your WhatsApp or mail), Move, Cancel and .ics export. Calendar isn't two-way synced with Google or Outlook yet, so moving or cancelling notifies nobody — tell the buyer yourself.",
    href: "/calendar",
    open: "Open Calendar",
  },
  {
    title: "7. Approve outreach",
    body: "Helix drafts new-listing alerts and cold-buyer check-ins in the tone you pick. Preview each as email, WhatsApp or SMS. Tick several drafts and use Review & approve: you see the full list before confirming. Approving never sends anything. Once email (Resend) or SMS/WhatsApp (Twilio) is connected, an approved draft shows Send buttons, and each send asks you to confirm the buyer and channel first.",
    href: "/outreach",
    open: "Open Outreach",
    ask: "Draft check-ins for cold buyers",
  },
  {
    title: "8. Promote a listing",
    body: "Promo copy asks for the channel first — Instagram, portal or WhatsApp — then copies text written only from the listing's own details. Helix publishes nothing.",
  },
  {
    title: "9. Qualify and win sellers",
    body: "New owner prospects get four checks — asking price, price vs your own listings, buyers who could fit, and contact details — before you accept them into your pipeline or decline them.",
    href: "/sellers#qualify",
    open: "Qualify prospects",
  },
  {
    title: "10. Check Analytics and export",
    body: "Inventory turnover by zone and type, price-review candidates (a rule, not a prediction), pipeline, sources and every action Helix ran. Export report saves a PDF through your browser's print dialog. No revenue, hours-saved or ROI estimates: no sales data is connected to back them up.",
    href: "/analytics",
    open: "Open Analytics",
  },
  {
    title: "11. Undo anything",
    body: "Changes made with a button show a toast in the bottom-right corner with Undo for a few seconds. Changes asked for in Ask Helix AI keep their Undo in the chat.",
  },
  {
    title: "12. Settings, data and demo",
    body: "Switch light or dark mode, set draft tone and commission rate, export buyers, listings, sellers and showings as CSV, and see which integrations are connected. Until you import your own data the desk shows a sample agency, always labelled demo.",
    href: "/settings",
    open: "Open Settings",
  },
];

export default function HelpPage() {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">How to use</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Score buyers, match them to properties and follow up faster. The AI proposes; you approve anything that is published or sent.</p>
        </div>
        <Link href="/?tour=1" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
          Take the tour
        </Link>
      </header>
      <ol className="grid gap-3 lg:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.title} className="flex flex-col rounded-xl border border-border bg-card/80 p-5">
            <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            {s.href || s.ask ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.href ? (
                  <Link href={s.href} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-accent">
                    {s.open} →
                  </Link>
                ) : null}
                {s.ask ? <AskHelixButton question={s.ask} /> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Helix for Real Estate does not publish to portals, give legal advice or produce official valuations, and it never invents market data.
      </p>
    </>
  );
}
