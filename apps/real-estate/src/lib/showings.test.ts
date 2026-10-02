import { beforeEach, describe, expect, it } from "vitest";
import { handleExecuteBody, runWithPolicy } from "@helix/core";
import { realEstateActions } from "./ai-actions";
import { buildDemoReply } from "./demo-assistant";
import { conflictsWith, needsFeedback, parseWhen } from "./showings";
import { getLead, getShowing, getZone, listDrafts, listLeads, listProperties, listShowings, loadDemoCatalog } from "./store";

const ctx = { actor: "You" };
const inDays = (d: number, h: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("parseWhen", () => {
  const now = new Date(2026, 8, 30, 10, 0).getTime(); // Wednesday
  it("reads tomorrow / today / weekdays with a time", () => {
    expect(parseWhen("tomorrow at 5pm", now)).toEqual(new Date(2026, 9, 1, 17, 0));
    expect(parseWhen("today at 17:30", now)).toEqual(new Date(2026, 8, 30, 17, 30));
    expect(parseWhen("on friday at 11am", now)).toEqual(new Date(2026, 9, 2, 11, 0));
    expect(parseWhen("wednesday at 9am", now)).toEqual(new Date(2026, 9, 7, 9, 0));
  });
  it("treats a bare 'at 5' as the afternoon and refuses to guess a missing day or time", () => {
    expect(parseWhen("tomorrow at 5", now)?.getHours()).toBe(17);
    expect(parseWhen("tomorrow", now)).toBeNull();
    expect(parseWhen("at 5pm", now)).toBeNull();
  });
});

describe("showings", () => {
  it("seeds past, today's and upcoming visits, with feedback on the finished ones", async () => {
    const all = await listShowings();
    expect(all.some((s) => s.status === "done" && s.feedback)).toBe(true);
    expect(all.some((s) => s.status === "scheduled" && Date.parse(s.startsAt) > Date.now())).toBe(true);
  });

  it("books a showing alone, refuses an overlapping slot, and Undo removes it", async () => {
    const startsAt = inDays(5, 11);
    const out = await runWithPolicy(
      realEstateActions,
      { action: "schedule_showing", summary: "x", targets: [{ id: "lead-elena-petrova", label: "Elena" }], params: { propertyId: "prop-marina-apartment", startsAt, durationMin: 45 } },
      ctx,
      { canAutoRun: true }
    );
    if (!("executed" in out)) throw new Error("expected booking to run");
    expect(out.executed.resultText).toMatch(/no invite was sent/);
    const booked = (await listShowings()).find((s) => s.leadId === "lead-elena-petrova");
    expect(booked?.status).toBe("scheduled");
    expect(conflictsWith(await listShowings(), startsAt, 30)).toHaveLength(1);

    const clash = await handleExecuteBody(realEstateActions, { action: "schedule_showing", targetIds: ["lead-tom-becker"], params: { propertyId: "prop-elm-starter", startsAt } }, ctx);
    expect((clash.body.failed as { error: string }[])[0].error).toMatch(/Overlaps with Elena Petrova/);

    await handleExecuteBody(realEstateActions, { action: "restore", entries: out.executed.undo }, ctx);
    expect((await listShowings()).some((s) => s.leadId === "lead-elena-petrova")).toBe(false);
  });

  it("won't book a listing that isn't active, or a time in the past", async () => {
    const sold = await handleExecuteBody(realEstateActions, { action: "schedule_showing", targetIds: ["lead-tom-becker"], params: { propertyId: "prop-birch-duplex", startsAt: inDays(3, 10) } }, ctx);
    expect((sold.body.failed as { error: string }[])[0].error).toMatch(/only active listings/);
    const past = await handleExecuteBody(realEstateActions, { action: "schedule_showing", targetIds: ["lead-tom-becker"], params: { propertyId: "prop-elm-starter", startsAt: inDays(-2, 10) } }, ctx);
    expect((past.body.failed as { error: string }[])[0].error).toMatch(/already passed/);
  });

  it("records feedback once a visit started, logs the contact, and Undo puts both back", async () => {
    const r = await handleExecuteBody(realEstateActions, { action: "schedule_showing", targetIds: ["lead-noah-fischer"], params: { propertyId: "prop-elm-starter", startsAt: new Date(Date.now() + 60_000).toISOString() } }, ctx);
    const id = (await listShowings()).find((s) => s.leadId === "lead-noah-fischer")!.id;
    expect(r.status).toBe(200);
    const early = await handleExecuteBody(realEstateActions, { action: "record_feedback", targetIds: [id], params: { interest: "high" } }, ctx);
    expect((early.body.failed as { error: string }[])[0].error).toMatch(/hasn't started/);

    const s = (await getShowing(id))!;
    const { putShowing } = await import("./store");
    await putShowing({ ...s, startsAt: new Date(Date.now() - 60 * 60_000).toISOString() });
    expect(needsFeedback((await getShowing(id))!, Date.now())).toBe(true);
    const before = (await getLead("lead-noah-fischer"))!.lastContactAt;

    const fb = await handleExecuteBody(realEstateActions, { action: "record_feedback", targetIds: [id], params: { interest: "medium", objections: ["Price"], notes: "Wants a bigger yard" } }, ctx);
    expect((await getShowing(id))?.feedback).toMatchObject({ interest: "medium", objections: ["Price"], recordedBy: "You" });
    expect((await getLead("lead-noah-fischer"))!.lastContactAt).not.toBe(before);

    await handleExecuteBody(realEstateActions, { action: "restore", entries: fb.body.undo }, ctx);
    expect((await getShowing(id))?.status).toBe("scheduled");
    expect((await getLead("lead-noah-fischer"))!.lastContactAt).toBe(before);
  });

  it("ticks the pre-visit checklist", async () => {
    await handleExecuteBody(realEstateActions, { action: "toggle_checklist", targetIds: ["show-ana-loft"], params: { index: 0 } }, ctx);
    expect((await getShowing("show-ana-loft"))?.checklist[0].done).toBe(true);
  });

  it("turns 'book a showing for <buyer> ... tomorrow at 5pm' into a booking for that slot", async () => {
    const r = buildDemoReply("Book a showing for Tom Becker at the Elm Street starter home tomorrow at 5pm", await listLeads(), await listProperties(), await getZone(), Date.now(), await listDrafts(), await listShowings());
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "schedule_showing", targets: [{ id: "lead-tom-becker" }], params: { propertyId: "prop-elm-starter" } });
    expect(new Date(r.proposal!.params!.startsAt as string).getHours()).toBe(17);
    const ask = buildDemoReply("Book a showing for Tom Becker at the Elm Street starter home", await listLeads(), await listProperties(), await getZone(), Date.now());
    expect(ask.proposal).toBeUndefined();
    expect(ask.answer).toMatch(/When should/);
  });
});
