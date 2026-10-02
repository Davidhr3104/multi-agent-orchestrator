import { beforeEach, describe, expect, it } from "vitest";
import { getPost, listPosts, loadDemoCatalog, reviewPost, setSessionRole, switchWorkspace } from "./store";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("workspaces", () => {
  it("keeps each brand's calendar separate", async () => {
    expect((await listPosts()).some((post) => post.id.startsWith("harbor-"))).toBe(false);
    await switchWorkspace("harbor");
    const harbor = await listPosts();
    expect(harbor.every((post) => post.id.startsWith("harbor-"))).toBe(true);
    expect(await getPost("seed-ig-harvest-drop")).toBeNull();
    await switchWorkspace("lumen");
    expect(await getPost("seed-ig-harvest-drop")).not.toBeNull();
  });

  it("blocks a creator from approving", async () => {
    await setSessionRole("creator");
    await expect(reviewPost("seed-ig-harvest-drop", "approve", "Priya")).rejects.toThrow(/Creators draft/);
  });
});
