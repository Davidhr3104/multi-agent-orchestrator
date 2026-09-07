import type { EmailThread, InboxMessage } from "@/lib/types";

export const DESK_COOKIE = "helix_inbox_desk_v1";

export type ThreadPatch = Partial<
  Pick<
    EmailThread,
    | "status"
    | "needsReview"
    | "isRead"
    | "isStarred"
    | "category"
    | "routeTo"
    | "draftReply"
    | "snoozeUntil"
    | "updatedAt"
    | "sentiment"
    | "urgencyScore"
    | "aiConfidence"
    | "reasoning"
    | "draftTone"
    | "engine"
  >
>;

export type DeskCookieState = {
  v: 1;
  patches: Record<string, ThreadPatch>;
};

export function emptyDeskState(): DeskCookieState {
  return { v: 1, patches: {} };
}

function readCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function readDeskCookie(req: Request): DeskCookieState {
  const raw = readCookieHeader(req.headers.get("cookie"), DESK_COOKIE);
  if (!raw) return emptyDeskState();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as DeskCookieState;
    if (parsed?.v !== 1 || !parsed.patches || typeof parsed.patches !== "object") {
      return emptyDeskState();
    }
    return { v: 1, patches: parsed.patches };
  } catch {
    return emptyDeskState();
  }
}

export function deskCookieHeader(state: DeskCookieState): string {
  const value = encodeURIComponent(JSON.stringify(state));
  return `${DESK_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly`;
}

export function upsertDeskPatch(
  state: DeskCookieState,
  id: string,
  patch: ThreadPatch
): DeskCookieState {
  return {
    v: 1,
    patches: {
      ...state.patches,
      [id]: {
        ...state.patches[id],
        ...patch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      },
    },
  };
}

export function patchFromThread(thread: EmailThread | InboxMessage): ThreadPatch {
  return {
    status: thread.status,
    needsReview: thread.needsReview,
    isRead: thread.isRead,
    isStarred: thread.isStarred,
    category: thread.category,
    routeTo: thread.routeTo,
    draftReply: thread.draftReply,
    snoozeUntil: thread.snoozeUntil,
    updatedAt: thread.updatedAt,
    sentiment: thread.sentiment,
    urgencyScore: thread.urgencyScore,
    aiConfidence: thread.aiConfidence,
    reasoning: thread.reasoning,
    draftTone: thread.draftTone,
    engine: thread.engine,
  };
}

export function applyThreadPatches<T extends EmailThread>(
  threads: T[],
  patches: Record<string, ThreadPatch>
): T[] {
  if (!patches || Object.keys(patches).length === 0) return threads;
  return threads.map((thread) => {
    const patch = patches[thread.id];
    return patch ? { ...thread, ...patch } : thread;
  });
}

export function jsonWithDeskCookie(
  data: unknown,
  state: DeskCookieState,
  init?: { status?: number }
): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": deskCookieHeader(state),
    },
  });
}
