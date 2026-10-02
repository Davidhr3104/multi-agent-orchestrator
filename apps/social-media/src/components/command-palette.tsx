"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { parseCompose } from "@/lib/compose";
import { channelLabel, snippet } from "@/lib/format";
import type { ShellSession } from "@/lib/store";
import type { Channel } from "@/lib/types";

export type PalettePost = { id: string; caption: string; channel: Channel; scheduledFor: string };

const PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/posts", label: "Posts" },
  { href: "/analytics", label: "Analytics" },
  { href: "/library", label: "Library" },
  { href: "/team", label: "Team" },
  { href: "/brand", label: "Brand voice" },
  { href: "/connections", label: "Connections" },
  { href: "/help", label: "How to use" },
];

type Item = { id: string; label: string; hint: string; run: () => void };

export function CommandPalette({ session, posts, showTrigger = true }: { session: ShellSession; posts: PalettePost[]; showTrigger?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        setCursor(0);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpen(event: Event) {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query ?? "";
      setQuery(query);
      setCursor(0);
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("helix:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("helix:open-palette", onOpen);
    };
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const command = parseCompose(query);
    const compose: Item[] = command
      ? [
          {
            id: "compose",
            label: `Draft a ${channelLabel(command.channel)} post${command.submit ? " and send it to review" : ""}`,
            hint: command.topic,
            run: () => {
              void postJson<{ href?: string; message?: string }>("/api/desk", { action: "compose", text: query }).then((data) => {
                notifyDesk(data.message ?? "Draft saved. Nothing was published.");
                if (data.href) router.push(data.href);
                router.refresh();
              }).catch((err: unknown) => notifyDesk(err instanceof Error ? err.message : "Couldn't build the draft"));
            },
          },
        ]
      : [];
    const pages: Item[] = PAGES.filter((page) => !q || page.label.toLowerCase().includes(q)).map((page) => ({
      id: `page-${page.href}`,
      label: page.label,
      hint: "Page",
      run: () => router.push(page.href),
    }));
    const brands: Item[] = session.workspaces
      .filter((workspace) => !q || workspace.name.toLowerCase().includes(q))
      .map((workspace) => ({
        id: `ws-${workspace.id}`,
        label: workspace.name,
        hint: workspace.id === session.workspaceId ? "Current workspace" : "Switch workspace",
        run: () => {
          if (workspace.id === session.workspaceId) {
            router.push("/");
            return;
          }
          void postJson("/api/workspace", { action: "switch", id: workspace.id }).then(() => {
            notifyDesk(`Switched to ${workspace.name}.`);
            router.push("/");
            router.refresh();
          });
        },
      }));
    const drafts: Item[] = posts
      .filter((post) => !q || post.caption.toLowerCase().includes(q) || channelLabel(post.channel).toLowerCase().includes(q))
      .slice(0, 8)
      .map((post) => ({
        id: `post-${post.id}`,
        label: snippet(post.caption, 72),
        hint: channelLabel(post.channel),
        run: () => router.push(`/posts/${post.id}`),
      }));
    return [...compose, ...pages, ...brands, ...drafts].slice(0, 12);
  }, [posts, query, router, session]);

  useEffect(() => {
    setCursor(0);
  }, [query, open]);

  function go(index: number) {
    const item = items[index];
    if (!item) return;
    setOpen(false);
    item.run();
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="inline-flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card/80 px-3 text-sm text-muted-foreground hover:text-foreground sm:w-auto"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search the desk</span>
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-md" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(items.length - 1, value + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(0, value - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(cursor);
                }
              }}
              placeholder="Create a LinkedIn post about a customer story and send it to review"
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground focus:outline-none"
            />
            <ul className="max-h-80 overflow-y-auto py-2">
              {items.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li> : null}
              {items.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(index)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${index === cursor ? "bg-accent text-foreground" : "text-foreground"}`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
