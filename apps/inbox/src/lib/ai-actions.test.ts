import { beforeEach, describe, expect, it } from "vitest";
import { restoreDeskActions, runDeskAction, runWithPolicy } from "@helix/core";
import { inboxActions } from "./ai-actions";
import { buildDemoReply } from "./demo-assistant";
import { getThread, listAllThreads, loadDemoCatalog } from "./store";

const newCtx = () => ({ actor: "Helix AI · approved by test", touched: new Set<string>() });
const MAYA = "thr-mayanorthwin"; // urgent, awaiting review
const PRIYA = "thr-priyatechven"; // urgent, awaiting review
const NEWSLETTER = "thr-newsletterhv";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("inbox actions on the demo desk", () => {
  it("drafts a reply on its own, records the touched thread, and undo restores the old draft", async () => {
    const before = (await getThread(MAYA))?.draftReply;
    const ctx = newCtx();
    const r = await runWithPolicy(inboxActions, { action: "draft_reply", summary: "s", targets: [{ id: MAYA, label: "Maya" }] }, ctx, { canAutoRun: true });
    expect("executed" in r).toBe(true);
    expect(ctx.touched.has(MAYA)).toBe(true);

    const undo = "executed" in r ? JSON.parse(JSON.stringify(r.executed.undo)) : [];
    await restoreDeskActions(inboxActions, undo, newCtx());
    expect((await getThread(MAYA))?.draftReply).toBe(before);
  });

  it("archives a low-urgency newsletter on its own and undo brings it back", async () => {
    const r = await runWithPolicy(inboxActions, { action: "archive_threads", summary: "s", targets: [{ id: NEWSLETTER, label: "HVAC Weekly" }] }, newCtx(), { canAutoRun: true });
    expect("executed" in r).toBe(true);
    expect((await getThread(NEWSLETTER))?.status).toBe("archived");
    await restoreDeskActions(inboxActions, "executed" in r ? JSON.parse(JSON.stringify(r.executed.undo)) : [], newCtx());
    expect((await getThread(NEWSLETTER))?.status).toBe("open");
  });

  it("asks before archiving an urgent thread that is awaiting review, and changes nothing", async () => {
    const r = await runWithPolicy(inboxActions, { action: "archive_threads", summary: "s", targets: [{ id: MAYA, label: "Maya" }] }, newCtx(), { canAutoRun: true });
    expect("proposal" in r && r.reasons.join(" ")).toMatch(/urgent/i);
    expect((await getThread(MAYA))?.status).toBe("open");
  });

  it("never sends an email without a person, and changes nothing", async () => {
    const r = await runWithPolicy(inboxActions, { action: "send_reply", summary: "s", targets: [{ id: MAYA, label: "Maya" }] }, newCtx(), { canAutoRun: true });
    expect("proposal" in r && r.reasons.join(" ")).toMatch(/cannot be recalled/i);
    expect((await getThread(MAYA))?.status).toBe("open");
  });

  it("on the demo desk a confirmed send is recorded locally and labelled as not emailed", async () => {
    const ran = await runDeskAction(inboxActions, { action: "send_reply", targetIds: [MAYA] }, newCtx());
    expect(ran.done).toEqual([MAYA]);
    expect(ran.resultText).toMatch(/nothing was actually emailed/i);
    expect((await getThread(MAYA))?.status).toBe("sent");
  });

  it("snoozes a thread and undo clears the snooze", async () => {
    const ran = await runDeskAction(inboxActions, { action: "snooze_threads", targetIds: [PRIYA] }, newCtx());
    expect((await getThread(PRIYA))?.snoozeUntil).toBeTruthy();
    await restoreDeskActions(inboxActions, JSON.parse(JSON.stringify(ran.undo)), newCtx());
    expect((await getThread(PRIYA))?.snoozeUntil).toBeNull();
  });

  it("rejects tampered undo data and reports a missing thread as a failure", async () => {
    const back = await restoreDeskActions(inboxActions, [{ action: "archive_threads", id: MAYA, data: { status: "hacked" } }], newCtx());
    expect(back.done).toEqual([]);
    const r = await runDeskAction(inboxActions, { action: "draft_reply", targetIds: ["nope"] }, newCtx());
    expect(r.failed).toEqual([{ id: "nope", error: "Not found" }]);
  });
});

describe("inbox demo assistant on the demo desk", () => {
  it("lists urgent threads most urgent first", async () => {
    const a = buildDemoReply("What's urgent right now?", await listAllThreads()).answer;
    expect(a.indexOf("Maya Chen")).toBeLessThan(a.indexOf("Priya Shah"));
    expect(a).not.toContain("HVAC Weekly");
  });

  it("lists what needs a reply and what can be ignored", async () => {
    const threads = await listAllThreads();
    expect(buildDemoReply("Which emails need a reply?", threads).answer).toContain("Dana Ruiz");
    expect(buildDemoReply("What can I ignore?", threads).answer).toContain("HVAC Weekly");
  });

  it("parses draft, snooze, archive and send commands onto the right thread", async () => {
    const threads = await listAllThreads();
    expect(buildDemoReply("Draft a reply to Maya Chen", threads).proposal).toMatchObject({ action: "draft_reply", targets: [{ id: MAYA }] });
    expect(buildDemoReply("Snooze Priya Shah's email", threads).proposal).toMatchObject({ action: "snooze_threads", targets: [{ id: PRIYA }] });
    expect(buildDemoReply("Archive the HVAC Weekly newsletter", threads).proposal).toMatchObject({ action: "archive_threads", targets: [{ id: NEWSLETTER }] });
    const send = buildDemoReply("Send Maya Chen the reply", threads);
    expect(send.command).toBe(true);
    expect(send.proposal).toMatchObject({ action: "send_reply", targets: [{ id: MAYA }] });
  });

  it("says so when no email matches instead of guessing", async () => {
    const r = buildDemoReply("Archive the zeppelin email", await listAllThreads());
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/couldn.t find/i);
  });
});
