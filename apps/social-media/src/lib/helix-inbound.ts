import type { Channel } from "./types";

/** A draft that another Helix asked Social to schedule. Demo rows are labeled. Nothing is published from here. */
export type HelixInbound = {
  id: string;
  source: "marketing" | "commerce" | "real-estate" | "video" | "edit";
  title: string;
  caption: string;
  channel: Channel;
  cite: string;
  at: string;
  status: "waiting" | "accepted" | "dismissed";
  demo: boolean;
};

export const DEMO_INBOUND: HelixInbound[] = [
  {
    id: "in-mkt-1",
    source: "marketing",
    title: "Ad that spent on spam",
    caption: "The Dallas heat-pump ad spent $840 this week and 11 of 14 forms scored under 30. We paused it. Tell the audience we still take qualified installs — tap to book a site visit.",
    channel: "linkedin",
    cite: "Helix for Marketing · campaign heat-pump-dallas · spend $840 · spam forms 11/14 (invented)",
    at: "2026-10-06T14:00:00.000Z",
    status: "waiting",
    demo: true,
  },
  {
    id: "in-com-1",
    source: "commerce",
    title: "SKU waiting on image",
    caption: "Huila 12oz is in the catalog with a price and 120 bags, but the store write is held — no pack shot. When the photo lands we can post the drop. Link in bio when Commerce releases the hold.",
    channel: "instagram",
    cite: "Helix for Commerce · SKU A-19 · hold: missing image (invented)",
    at: "2026-10-06T16:30:00.000Z",
    status: "waiting",
    demo: true,
  },
  {
    id: "in-re-1",
    source: "real-estate",
    title: "New listing packet",
    caption: "3/2 in East Dallas, listed today. Pre-approved buyers only in the comments. Tour times go through the listing desk — we do not quote a price in DMs.",
    channel: "facebook",
    cite: "Helix for Real Estate · listing packet p.2 · score 81 (invented)",
    at: "2026-10-05T18:00:00.000Z",
    status: "waiting",
    demo: true,
  },
];

export const SOURCE_LABEL: Record<HelixInbound["source"], string> = {
  marketing: "Helix for Marketing",
  commerce: "Helix for Commerce",
  "real-estate": "Helix for Real Estate",
  video: "Helix for Video",
  edit: "Helix for Edit",
};
