import Link from "next/link";
import { SetupChecklist } from "@/components/setup-checklist";
const STEPS = [
  { title: "1. Start on the Dashboard", body: "See how many posts wait for review, how many of those pass every readiness check, what's approved and what goes out in the next 7 days." },
  {
    title: "2. Ask Helix AI",
    body: 'Click Ask Helix and work in plain language: "What needs review?", "Which posts aren\'t ready?", "Explain the Instagram post today". Every answer links to the post it mentions. Helix AI can make mistakes, so check before acting.',
  },
  {
    title: "3. Read the readiness score",
    body: "Open any post to see Why this score: length for its channel, hashtag count, call to action, brand voice and visual brief, each with its points and the reason. The score checks form, not taste — whether the post is good is your call.",
  },
  {
    title: "4. Approve or send back",
    body: "Approve, Request changes and Send to review are buttons on every post. Helix AI can send posts back, move them or add notes for you (with Undo); approving always waits for a person. A post that breaks a channel's hard limit or uses a word the brand avoids can't be approved until it's fixed.",
  },
  {
    title: "5. Rewrite in the draft",
    body: "Open a post and use the co-pilot on a selection or the whole caption: make it concise, add emojis, shift the tone, or add a call to action. Brand voice holds the standing directives. Rewriting an approved post sends it back to review.",
  },
  {
    title: "6. Repurpose, comment, and preview",
    body: "An approved post can start a draft for another channel. Comments record creator, client and admin feedback, and each rewrite keeps the previous caption. The preview is a mock of the destination feed, not the live network. Stock frames can be attached; the image prompt is text only.",
  },
  {
    title: "7. Calendar",
    body: "Filter the grid by channel, pillar or approval status, and export that view as CSV, JSON or PDF. The dashboard flags a pillar that disappears for several days. Suggested times are publishing habits, not this account's analytics.",
  },
  {
    title: "8. Approve a perfect queue",
    body: "Approve all 100/100 signs off every post already in review with a perfect readiness score. Posts under 100 stay in the queue. Nothing is published.",
  },
  {
    title: "9. Demo data",
    body: "Until you bring your own calendar the desk shows two sample brands, Lumen Roasters and Harbor Goods. Reset demo restores both, the owner role and the Starter plan.",
  },
  {
    title: "10. Workspaces, roles and reports",
    body: "The sidebar switches brands. Each workspace keeps its own calendar, brand voice and library. Team sets the session role (owner, manager, creator, client), the approval path and the plan. Auto-fix spends one credit to repair form up to a score of 100. Analytics counts the planned calendar only — there is no engagement. Webhooks record events on this desk and do not call the URL.",
  },
];

export default function HelpPage() {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">How to use</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Plan the calendar, check every draft and approve what goes out. The AI drafts and organizes; a person approves every post.</p>
        </div>
        <Link href="/?tour=1" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
          Take the tour
        </Link>
      </header>
      <SetupChecklist />
      <ol className="max-w-3xl space-y-3">
        {STEPS.map((s) => (
          <li key={s.title} className="rounded-xl border border-border bg-card/80 p-5">
            <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="max-w-3xl rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Helix never publishes on its own. With a Meta token it reads real Instagram and Facebook results into Analytics. Instagram, Facebook and LinkedIn posts go out only when a person approves a post, presses Publish on it, and the operator has set HELIX_SOCIAL_PUBLISH=live. X and TikTok are token-only: nothing is sent there.
      </p>
    </>
  );
}
