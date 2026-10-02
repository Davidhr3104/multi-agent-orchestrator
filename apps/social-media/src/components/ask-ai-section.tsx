"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AiToast, DemoBanner, useAiDeskEvents } from "@/components/ai-desk-events";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { parseCompose } from "@/lib/compose";

const PROMPTS = [
  { label: "Customer story · LinkedIn", text: "Create a LinkedIn post about a customer story and send it to review" },
  { label: "This week's product · Instagram", text: "Draft an Instagram post about this week's product" },
  { label: "How the team works · X", text: "Write an X post about how the team works" },
  { label: "Behind the scenes · TikTok", text: "Create a TikTok post from a behind-the-scenes moment" },
];

/** Refetches the server-rendered page whenever Helix AI, a review button or Reset demo changes the desk. */
export function DeskRefresher() {
  const router = useRouter();
  const { toast } = useAiDeskEvents(() => router.refresh());
  return <AiToast message={toast} />;
}

export function DeskChrome({ brand }: { brand: string }) {
  return (
    <>
      <DeskRefresher />
      <DemoBanner message={`${brand} is sample data. Approving a post records a sign-off and publishes nothing.`} />
    </>
  );
}

export function AskAiSection() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const query = text.trim();
    if (!parseCompose(query)) {
      window.dispatchEvent(new CustomEvent("helix:open-palette", { detail: { query } }));
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ href?: string; message?: string }>("/api/desk", { action: "compose", text: query });
      notifyDesk(data.message ?? "Draft saved. Nothing was published.");
      setText("");
      if (data.href) router.push(data.href);
      router.refresh();
    } catch (err) {
      notifyDesk(err instanceof Error ? err.message : "Couldn't build the draft");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="ask-helix" aria-labelledby="ask-helix-title" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-xl lg:p-8">
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid items-center gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(247,81,161,0.8)]" />
            Helix · brand voice
          </p>
          <div>
            <h2 id="ask-helix-title" className="font-[family-name:var(--font-sora)] text-[22px] leading-7 font-bold tracking-tight text-foreground">
              Ask Helix
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Name a channel and what the post should say. Helix drafts it from the voice saved on this brand. A person still approves it, and nothing is published.
            </p>
          </div>
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 rounded-xl bg-muted p-1.5 sm:flex-row sm:items-center">
            <label htmlFor="ask-helix-input" className="sr-only">
              Ask Helix to draft a post
            </label>
            <span className="hidden pl-2 text-secondary-foreground sm:inline-flex" aria-hidden>
              <Sparkles className="size-4" />
            </span>
            <input
              id="ask-helix-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Create a LinkedIn post about a customer story and send it to review"
              className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_16px_rgba(247,81,161,0.35)] disabled:opacity-50"
            >
              {busy ? "Drafting…" : "Draft"}
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Prompts</span>
            {PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => setText(prompt.text)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
        <figure className="relative lg:col-span-5">
          <div className="overflow-hidden rounded-xl bg-background shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helix-desk.jpg" alt="" className="h-64 w-full object-cover lg:h-72" />
            <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg bg-background/80 px-2.5 py-2 text-[11px] text-foreground backdrop-blur">
              <span>Drafts stay here until someone approves them.</span>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
