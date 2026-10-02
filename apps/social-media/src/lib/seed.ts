import type { Brand, Channel, Pillar, Post, PostStatus } from "./types";

/**
 * Demo brand: a small specialty coffee roaster. Every slot is placed relative to the day the demo loads,
 * so the calendar always shows the next four weeks. Nothing here is ever posted anywhere.
 */

export const DEMO_BRAND: Brand = {
  name: "Lumen Roasters",
  handle: "@lumenroasters",
  voice: ["warm", "specific", "plainspoken"],
  avoid: ["game-changer", "revolutionary", "guaranteed", "best ever", "synergy"],
  directives: "Warm and specific. Name the coffee or the process.\nnever: discount codes",
  channels: ["instagram", "linkedin", "x", "tiktok", "facebook"],
};

type SeedRow = {
  key: string;
  day: number;
  hour: number;
  channel: Channel;
  pillar: Pillar;
  status: PostStatus;
  createdBy?: Post["createdBy"];
  caption: string;
  hashtags: string[];
  asset: string;
  notes?: string[];
};

const ROWS: SeedRow[] = [
  {
    key: "ig-harvest-drop",
    day: 0,
    hour: 9,
    channel: "instagram",
    pillar: "product",
    status: "needs_review",
    caption:
      "Our Huila harvest lot is here. Red apple, panela and a long cocoa finish — roasted light so the fruit stays loud. Small batch: 120 bags this week. Tap the link in bio to grab one before Friday.",
    hashtags: ["specialtycoffee", "colombiancoffee", "lightroast", "coffeeroaster", "smallbatch"],
    asset: "Overhead shot of the Huila bag on the roasting table, morning light",
  },
  {
    key: "li-hiring-roaster",
    day: 0,
    hour: 14,
    channel: "linkedin",
    pillar: "behind_the_scenes",
    status: "approved",
    createdBy: "team",
    caption:
      "We're hiring a production roaster. You'll run our 15 kg Loring three days a week, cup every batch with the team, and help us dial in new lots as they land. Two years of roasting experience preferred; curiosity required. Read more and apply through the link in the comments.",
    hashtags: ["hiring", "coffeejobs"],
    asset: "Photo of the roaster with the production team, candid",
  },
  {
    key: "x-cupping-thread",
    day: 1,
    hour: 11,
    channel: "x",
    pillar: "education",
    status: "needs_review",
    caption: "Cupping score vs. what you taste at home: a short thread on why an 87 doesn't always beat an 85 in your mug. Reply with the brew method you use and we'll tailor the tips.",
    hashtags: ["coffee"],
    asset: "Cupping table close-up for the thread header",
  },
  {
    key: "tt-latte-art-fail",
    day: 1,
    hour: 18,
    channel: "tiktok",
    pillar: "community",
    status: "draft",
    caption: "Our head barista vs. a wobbly tulip. Round 7. Comment your best fail.",
    hashtags: ["latteart", "baristalife", "coffeetok"],
    asset: "15 s vertical clip, three failed pours then one clean tulip",
  },
  {
    key: "fb-open-house",
    day: 2,
    hour: 10,
    channel: "facebook",
    pillar: "community",
    status: "approved",
    createdBy: "team",
    caption: "Roastery open house this Saturday, 10am–1pm. Free tasting flight, a short roast demo at 11, and pastries from the bakery next door. Reserve a spot so we know how many cups to pour.",
    hashtags: ["openhouse"],
    asset: "Event card with date, time and address",
  },
  {
    key: "x-gamechanger",
    day: 3,
    hour: 9,
    channel: "x",
    pillar: "promo",
    status: "needs_review",
    caption: "Our new subscription is a total game-changer for your mornings. Fresh beans every two weeks, pause anytime. Sign up today.",
    hashtags: ["coffee", "subscription"],
    asset: "Subscription box on a doorstep",
    notes: ["Drafted by Helix AI from the subscription brief."],
  },
  {
    key: "ig-roast-curve",
    day: 3,
    hour: 17,
    channel: "instagram",
    pillar: "education",
    status: "draft",
    caption: "What a roast curve actually tells you.",
    hashtags: ["coffeescience"],
    asset: "Carousel: annotated roast curve, 4 slides",
  },
  {
    key: "li-sourcing-trip",
    day: 4,
    hour: 8,
    channel: "linkedin",
    pillar: "behind_the_scenes",
    status: "needs_review",
    caption:
      "Last month our green buyer spent nine days with three producer groups in Huila. We came back with two new lots, a price floor we committed to for the next three harvests, and a long list of things we want to do better on traceability. The full sourcing report is up on our site — read more through the link below.",
    hashtags: ["coffeesourcing", "traceability", "directtrade", "specialtycoffee", "supplychain", "sustainability", "coffee", "farming", "colombia"],
    asset: "Photo of the producer group at the washing station",
  },
  {
    key: "tt-grind-size",
    day: 5,
    hour: 19,
    channel: "tiktok",
    pillar: "education",
    status: "approved",
    caption: "Same beans, three grind sizes, three very different cups. Save this before your next pour-over.",
    hashtags: ["pourover", "coffeetips", "coffeetok"],
    asset: "Split-screen vertical: coarse / medium / fine with tasting notes",
  },
  {
    key: "fb-decaf",
    day: 6,
    hour: 12,
    channel: "facebook",
    pillar: "product",
    status: "changes",
    caption: "Decaf that doesn't taste like decaf. Swiss Water process, chocolate and orange. Order online or pick up at the roastery.",
    hashtags: ["decaf"],
    asset: "Decaf bag next to an evening cup",
    notes: ["Send back: mention it's caffeine-free 99.9%, legal asked for the exact figure."],
  },
  {
    key: "ig-community-cafe",
    day: 7,
    hour: 9,
    channel: "instagram",
    pillar: "community",
    status: "needs_review",
    caption:
      "Wholesale partner spotlight: Juniper Café has poured our Ethiopia lot for two years. We asked their owner what keeps regulars coming back — her answer was the slow bar, not the beans. Visit them on 5th & Pine and tell us what you order.",
    hashtags: ["cafepartner", "specialtycoffee", "supportlocal", "coffeeshop"],
    asset: "Portrait of the café owner at the slow bar",
  },
  {
    key: "x-shipping",
    day: 8,
    hour: 10,
    channel: "x",
    pillar: "promo",
    status: "draft",
    caption: "Free shipping on orders over $40 this week. Shop the roast menu.",
    hashtags: ["coffee"],
    asset: "Roast menu graphic",
  },
  {
    key: "li-wholesale",
    day: 9,
    hour: 9,
    channel: "linkedin",
    pillar: "product",
    status: "approved",
    createdBy: "team",
    caption:
      "Running a café or office kitchen? Our wholesale program includes weekly roasting to order, barista training for your team twice a year, and equipment service through our partner. Book a tasting at the roastery and bring the people who'll be behind the bar.",
    hashtags: ["wholesalecoffee", "cafeowners"],
    asset: "Wholesale bags stacked by the loading door",
  },
  {
    key: "tt-day-in-life",
    day: 10,
    hour: 18,
    channel: "tiktok",
    pillar: "behind_the_scenes",
    status: "needs_review",
    caption: "6am at the roastery: first batch, first cup, first mistake. Follow for the rest of the day.",
    hashtags: ["dayinthelife", "coffeeroaster", "coffeetok"],
    asset: "Vertical day-in-the-life montage, 30 s",
  },
  {
    key: "fb-subscription",
    day: 12,
    hour: 11,
    channel: "facebook",
    pillar: "promo",
    status: "draft",
    caption: "Never run out again. Our subscription ships fresh-roasted beans every two weeks and you can pause, skip or swap anytime. Sign up through the link.",
    hashtags: ["coffeesubscription"],
    asset: "",
  },
  {
    key: "ig-water",
    day: 13,
    hour: 17,
    channel: "instagram",
    pillar: "education",
    status: "approved",
    caption: "Your water is 98% of your cup. We brewed the same coffee with tap, filtered and mineral water — the filtered one won by a mile for us. Save this and try it at home this weekend.",
    hashtags: ["brewguide", "coffeetips", "specialtycoffee", "homebarista"],
    asset: "Three glasses of water and three cups, labelled",
  },
  {
    key: "x-holiday-blend",
    day: 15,
    hour: 9,
    channel: "x",
    pillar: "product",
    status: "needs_review",
    caption: "The holiday blend is back in a few days: cherry, clove and dark chocolate, roasted a touch darker for milk drinks. Reply 'notify' and we'll ping you the morning it drops.",
    hashtags: ["holidayblend"],
    asset: "Holiday blend label reveal",
  },
  {
    key: "li-carbon",
    day: 17,
    hour: 8,
    channel: "linkedin",
    pillar: "education",
    status: "draft",
    createdBy: "team",
    caption: "We measured our roastery's energy use for a year. Here's what surprised us.",
    hashtags: ["sustainability"],
    asset: "Chart of monthly energy use",
  },
  {
    key: "tt-holiday-teaser",
    day: 19,
    hour: 19,
    channel: "tiktok",
    pillar: "promo",
    status: "draft",
    caption: "Something cherry-red is roasting. Tomorrow. Turn on notifications.",
    hashtags: ["holidayblend", "coffeetok"],
    asset: "Teaser clip of the drum, red light",
  },
  {
    key: "ig-holiday-launch",
    day: 20,
    hour: 9,
    channel: "instagram",
    pillar: "product",
    status: "draft",
    caption:
      "The holiday blend is live. Cherry, clove and dark chocolate — built for lattes and long mornings. 300 bags this run. Shop through the link in bio.",
    hashtags: ["holidayblend", "specialtycoffee", "coffeeroaster", "giftideas"],
    asset: "Holiday blend bag with seasonal props",
  },
  {
    key: "fb-thank-you",
    day: 24,
    hour: 12,
    channel: "facebook",
    pillar: "community",
    status: "draft",
    caption: "Thank you for a record month at the roastery. Tell us which coffee should come back in spring.",
    hashtags: [],
    asset: "Team photo at the roastery door",
  },
];

export const HARBOR_BRAND: Brand = {
  name: "Harbor Goods",
  handle: "@harborgoods",
  voice: ["calm", "practical"],
  avoid: ["cheap", "luxury"],
  directives: "Plain and useful.\nnever: emojis",
  channels: ["instagram", "linkedin", "facebook"],
};

const HARBOR_ROWS: SeedRow[] = [
  {
    key: "ig-linen",
    day: 1,
    hour: 11,
    channel: "instagram",
    pillar: "product",
    status: "needs_review",
    caption: "Washed linen towels, hemmed in the shop. Sand, salt and a lot of rinse cycles. Grab a set from the link in bio.",
    hashtags: ["linen", "harborgoods", "home"],
    asset: "Folded linen on a wood bench",
  },
  {
    key: "li-workshop",
    day: 3,
    hour: 9,
    channel: "linkedin",
    pillar: "education",
    status: "approved",
    createdBy: "team",
    caption:
      "We cut our towel sizes down to two this year. Fewer SKUs, fuller shelves, and a clearer story for the shops that carry us. Read more if you are deciding what to stock.",
    hashtags: ["retail"],
    asset: "Sketch of the two sizes",
  },
  {
    key: "fb-market",
    day: 5,
    hour: 13,
    channel: "facebook",
    pillar: "community",
    status: "draft",
    caption: "Saturday market table, 9 to 1. Come feel the linen and tell us which color should come back in spring.",
    hashtags: ["market"],
    asset: "Market stall photo",
  },
  {
    key: "ig-cheap",
    day: 6,
    hour: 12,
    channel: "instagram",
    pillar: "promo",
    status: "needs_review",
    caption: "A cheap set of towels for the weekend. Shop the link in bio before Sunday.",
    hashtags: ["sale", "linen", "home"],
    asset: "Stack of towels",
  },
];

/** Builds the seed against `now`: slot `day` is that many days after today, at `hour` local time. */
export function buildSeedPosts(now: Date = new Date()): Post[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return ROWS.map((r) => {
    const at = new Date(start);
    at.setDate(at.getDate() + r.day);
    at.setHours(r.hour, 0, 0, 0);
    const approved = r.status === "approved";
    return {
      id: `seed-${r.key}`,
      channel: r.channel,
      pillar: r.pillar,
      scheduledFor: at.toISOString(),
      caption: r.caption,
      hashtags: [...r.hashtags],
      asset: r.asset,
      status: r.status,
      createdBy: r.createdBy ?? "helix_ai",
      notes: [...(r.notes ?? [])],
      ...(approved ? { approvedBy: "Marta (brand lead)", approvedAt: start.toISOString() } : {}),
    };
  });
}

export function buildHarborPosts(now: Date = new Date()): Post[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return HARBOR_ROWS.map((row) => {
    const at = new Date(start);
    at.setDate(at.getDate() + row.day);
    at.setHours(row.hour, 0, 0, 0);
    const approved = row.status === "approved";
    return {
      id: `harbor-${row.key}`,
      channel: row.channel,
      pillar: row.pillar,
      scheduledFor: at.toISOString(),
      caption: row.caption,
      hashtags: [...row.hashtags],
      asset: row.asset,
      status: row.status,
      createdBy: row.createdBy ?? "helix_ai",
      notes: [],
      ...(approved ? { approvedBy: "Lena (founder)", approvedAt: start.toISOString() } : {}),
    };
  });
}
