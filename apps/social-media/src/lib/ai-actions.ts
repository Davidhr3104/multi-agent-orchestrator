import type { DeskActionRegistry } from "@helix/core";
import { addNote, getPostRaw, putPost, reschedulePost, reviewPost } from "@/lib/store";
import type { Channel, Pillar, Post, PostStatus } from "@/lib/types";

/**
 * What Helix AI may do on the Social desk, and when it may do it alone.
 *   add_note          internal note on a post                         -> auto (+Undo)
 *   submit_for_review move a draft into the approval queue            -> auto (+Undo)
 *   request_changes   send a post back with a reason                  -> auto (+Undo), bulk asks
 *   reschedule_post   move a post's slot                              -> auto for drafts, asks once approved
 *   approve_post      sign off a post for publishing                  -> always asks a person
 * Nothing here publishes: no network is connected, so approval is a recorded sign-off only.
 */

export type SocialCtx = { actor: string };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const names = (l: string[]) => l.join(", ");

const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];
const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];
const STATUSES: PostStatus[] = ["draft", "needs_review", "changes", "approved", "published"];

type PostSnapshot = { post: Post };

function isSnapshot(d: unknown): d is PostSnapshot {
  const p = (d as { post?: Record<string, unknown> } | null)?.post;
  return (
    !!p &&
    typeof p.id === "string" &&
    CHANNELS.includes(p.channel as Channel) &&
    PILLARS.includes(p.pillar as Pillar) &&
    STATUSES.includes(p.status as PostStatus) &&
    typeof p.scheduledFor === "string" &&
    !Number.isNaN(Date.parse(p.scheduledFor as string)) &&
    typeof p.caption === "string" &&
    typeof p.asset === "string" &&
    Array.isArray(p.hashtags) &&
    p.hashtags.every((t) => typeof t === "string") &&
    Array.isArray(p.notes) &&
    p.notes.every((t) => typeof t === "string") &&
    (p.createdBy === "helix_ai" || p.createdBy === "team")
  );
}

async function snapshot(id: string): Promise<PostSnapshot | null> {
  const post = await getPostRaw(id);
  return post ? { post } : null;
}

async function restore(id: string, data: unknown): Promise<boolean> {
  if (!isSnapshot(data)) throw new Error("Invalid undo data");
  if (data.post.id !== id) throw new Error("Undo data does not match this post");
  if (!(await getPostRaw(id))) return false;
  await putPost(data.post);
  return true;
}

const noteOf = (p: Record<string, unknown>) => (typeof p.note === "string" ? p.note.trim() : "");

const bulk = (ids: string[]) => (ids.length > 3 ? { level: "confirm" as const, reasons: [`Bulk change (${ids.length} posts)`] } : { level: "auto" as const, reasons: [] });

export const socialActions: DeskActionRegistry<SocialCtx> = {
  add_note: {
    name: "add_note",
    validate: (p) => (noteOf(p) ? null : "A note needs text"),
    assess: async (ids) => bulk(ids),
    snapshot,
    apply: (id, p, ctx) => addNote(id, ctx.actor, noteOf(p)),
    restore,
    resultText: (done, failed) => `Added a note to ${plural(done.length, "post")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI noted ${names(l)}`,
  },

  submit_for_review: {
    name: "submit_for_review",
    assess: async (ids) => bulk(ids),
    snapshot,
    apply: async (id, p, ctx) => (await reviewPost(id, "submit", ctx.actor, noteOf(p) || undefined)) !== null,
    restore,
    resultText: (done, failed) => `Moved ${plural(done.length, "post")} into the approval queue.${failed ? ` ${failed} couldn't move.` : ""}`,
    announce: (l) => `Helix AI sent ${names(l)} to review`,
  },

  request_changes: {
    name: "request_changes",
    validate: (p) => (noteOf(p) ? null : "Say what needs to change"),
    assess: async (ids) => bulk(ids),
    snapshot,
    apply: async (id, p, ctx) => (await reviewPost(id, "changes", ctx.actor, noteOf(p))) !== null,
    restore,
    resultText: (done, failed) => `Sent ${plural(done.length, "post")} back with your note.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI sent back ${names(l)}`,
  },

  reschedule_post: {
    name: "reschedule_post",
    validate: (p) => (typeof p.when === "string" && !Number.isNaN(Date.parse(p.when)) ? null : "A valid new date is required"),
    assess: async (ids) => {
      const posts = await Promise.all(ids.map(getPostRaw));
      const approved = posts.filter((p) => p?.status === "approved").length;
      if (approved) return { level: "confirm", reasons: [`${plural(approved, "post")} already approved — moving it changes what a person signed off`] };
      return bulk(ids);
    },
    snapshot,
    apply: (id, p) => reschedulePost(id, p.when as string),
    restore,
    resultText: (done, failed) => `Rescheduled ${plural(done.length, "post")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI rescheduled ${names(l)}`,
  },

  approve_post: {
    name: "approve_post",
    assess: async () => ({ level: "confirm", reasons: ["Approving a post is a person's sign-off"] }),
    snapshot,
    apply: async (id, p, ctx) => (await reviewPost(id, "approve", ctx.actor, noteOf(p) || undefined)) !== null,
    restore,
    resultText: (done, failed) =>
      `Approved ${plural(done.length, "post")}. Nothing was published — no social network is connected yet.${failed ? ` ${failed} couldn't be approved.` : ""}`,
    announce: (l) => `Approved ${names(l)} (not published)`,
  },
};
