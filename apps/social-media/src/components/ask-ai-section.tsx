"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MorphPanel } from "@helix/ui";
import { AiToast, DemoBanner, useAiDeskEvents } from "@/components/ai-desk-events";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { parseCompose } from "@/lib/compose";

function openAsk(question?: string) {
  window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question } }));
}

const PROMPTS = [
  { label: "Customer story · LinkedIn", question: "Create a LinkedIn post about a customer story and send it to review" },
  { label: "This week's product · Instagram", question: "Draft an Instagram post about this week's product" },
  { label: "How the team works · X", question: "Write an X post about how the team works" },
  { label: "Behind the scenes · TikTok", question: "Create a TikTok post from a behind-the-scenes moment" },
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
  const [busy, setBusy] = useState(false);

  async function run(query: string) {
    const q = query.trim();
    if (!q || busy) return;
    if (!parseCompose(q)) {
      openAsk(q);
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ href?: string; message?: string }>("/api/desk", { action: "compose", text: q });
      notifyDesk(data.message ?? "Draft saved. Nothing was published.");
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
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(247,81,161,0.8)]" />
            Helix · brand voice
          </p>
          <div>
            <h2 id="ask-helix-title" className="font-[family-name:var(--font-sora)] text-[22px] leading-7 font-bold tracking-tight text-foreground">
              <button type="button" onClick={() => openAsk()} className="cursor-pointer text-left hover:text-primary">
                Ask Helix
              </button>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Name a channel and what the post should say. Helix drafts it from the voice saved on this brand. A person still approves it, and nothing is published.
            </p>
          </div>
          <MorphPanel
            title="Ask Helix for Social"
            logoSrc="/logo-icon.png"
            avatarDesk="social"
            accent="#f751a1"
            accentInk="#570032"
            placeholder="Create a LinkedIn post about a customer story and send it to review"
            busy={busy}
            chips={PROMPTS}
            onAsk={(q) => void run(q)}
          />
        </div>
        <figure className="relative lg:col-span-5">
          <button
            type="button"
            onClick={() => openAsk()}
            aria-label="Open Ask Helix AI"
            className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-background text-left shadow-2xl transition-transform hover:scale-[1.01]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helix-desk.jpg" alt="" className="h-64 w-full object-cover lg:h-72" />
            <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-2 text-xs text-foreground backdrop-blur">
              <span>Drafts stay here until someone approves them.</span>
              <span className="shrink-0 font-semibold text-primary">Ask Helix →</span>
            </span>
          </button>
        </figure>
      </div>
    </section>
  );
}

/** Opens Ask Helix AI in the main column of the app shell. */
export function AskHelixButton({
  question,
  children,
  className,
  ...rest
}: { question?: string; children: ReactNode; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick">) {
  return (
    <button type="button" className={className} onClick={() => openAsk(question)} {...rest}>
      {children}
    </button>
  );
}
