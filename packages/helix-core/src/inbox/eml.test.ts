import { describe, it, expect } from "vitest";
import { parseEml, matchThread, type MatchableThread } from "./eml";
// EmailThread is not exported from @helix/core (it lives only in apps/inbox/src/lib/types.ts as an
// app-local type). Per the brief's Step 2 caveat, we use the shared package's own minimal
// MatchableThread shape (id, subject, fromEmail, toEmail) rather than importing an app-local type
// into packages/helix-core.

const SAMPLE_EML = `From: Jane Doe <jane@example.com>
To: triage@company.io
Subject: Question about pricing
Message-Id: <abc123@mail.example.com>
Date: Wed, 23 Sep 2026 14:00:00 +0000
Content-Type: text/plain

Hi, what's your enterprise pricing?
`;

const REPLY_EML = `From: triage@company.io
To: jane@example.com
Subject: Re: Question about pricing
Message-Id: <def456@mail.example.com>
In-Reply-To: <abc123@mail.example.com>
References: <abc123@mail.example.com>
Date: Wed, 23 Sep 2026 15:00:00 +0000
Content-Type: text/plain

Our enterprise plan starts at $999/mo.
`;

describe("parseEml", () => {
  it("extracts subject, from, message id, and body", async () => {
    const parsed = await parseEml(SAMPLE_EML);
    expect(parsed.subject).toBe("Question about pricing");
    expect(parsed.fromEmail).toBe("jane@example.com");
    expect(parsed.rfcMessageId).toBe("<abc123@mail.example.com>");
    expect(parsed.textBody).toContain("enterprise pricing");
  });

  it("extracts In-Reply-To and References", async () => {
    const parsed = await parseEml(REPLY_EML);
    expect(parsed.inReplyTo).toBe("<abc123@mail.example.com>");
    expect(parsed.references).toEqual(["<abc123@mail.example.com>"]);
  });
});

describe("matchThread", () => {
  const existingThread: MatchableThread = {
    id: "thr-1",
    subject: "Question about pricing",
    fromEmail: "jane@example.com",
    toEmail: "triage@company.io",
  };

  it("matches by rfcMessageId found in References", async () => {
    const parsed = await parseEml(REPLY_EML);
    const found = matchThread(parsed, [existingThread], [
      { threadId: "thr-1", rfcMessageId: "<abc123@mail.example.com>" },
    ]);
    expect(found?.id).toBe("thr-1");
  });

  it("falls back to subject + participant match when no Message-Id match", async () => {
    const parsed = await parseEml(SAMPLE_EML);
    const found = matchThread(parsed, [existingThread], []);
    expect(found?.id).toBe("thr-1");
  });

  it("returns null when nothing matches", async () => {
    const unrelated = { ...existingThread, subject: "Totally different", fromEmail: "other@x.com" };
    const parsed = await parseEml(SAMPLE_EML);
    const found = matchThread(parsed, [unrelated], []);
    expect(found).toBeNull();
  });
});
