import { checklistFresh } from "./showings";
import type { Lead, MarketZone, Property, Seller, Showing } from "./types";

/**
 * Demo catalog: 10 properties, 20 buyer leads, 7 sellers and 4 market zones. Everything here is sample data —
 * the UI labels it as such and it disappears once the desk goes live.
 */

const day = 86_400_000;

export const DEMO_ZONES: MarketZone[] = [
  { id: "zone-riverside", name: "Riverside", avgPricePerSqm: 4_550, medianDaysOnMarket: 41, yoyChangePct: 4.2, activeListings: 6, source: "demo", trend: { perSqm: [4_420, 4_450, 4_470, 4_500, 4_520, 4_550], daysOnMarket: [48, 46, 45, 44, 42, 41] } },
  { id: "zone-downtown", name: "Downtown", avgPricePerSqm: 6_900, medianDaysOnMarket: 33, yoyChangePct: 6.1, activeListings: 14, source: "demo", trend: { perSqm: [6_610, 6_680, 6_720, 6_790, 6_850, 6_900], daysOnMarket: [36, 37, 35, 34, 34, 33] } },
  { id: "zone-northgate", name: "Northgate", avgPricePerSqm: 3_450, medianDaysOnMarket: 47, yoyChangePct: 2.8, activeListings: 9, source: "demo", trend: { perSqm: [3_390, 3_400, 3_420, 3_410, 3_440, 3_450], daysOnMarket: [44, 45, 47, 46, 48, 47] } },
  { id: "zone-eastfield", name: "Eastfield", avgPricePerSqm: 2_950, medianDaysOnMarket: 55, yoyChangePct: -0.9, activeListings: 7, source: "demo", trend: { perSqm: [2_980, 2_970, 2_975, 2_960, 2_955, 2_950], daysOnMarket: [50, 51, 53, 52, 54, 55] } },
];

type PropertySeed = Property;

const P = (p: PropertySeed): PropertySeed => p;

export const PROPERTY_SEEDS: PropertySeed[] = [
  P({ id: "prop-riverside-loft", title: "Riverside Loft with Terrace", address: "214 Canal St", zone: "Riverside", kind: "loft", price: 485_000, sqm: 98, beds: 2, baths: 2, amenities: ["Terrace", "Gym", "Parking"], status: "active", daysOnMarket: 12, description: "Double-height loft steps from the river walk, with a 20 m² private terrace.", cover: ["#1B2A47", "#C9A24B"] }),
  P({ id: "prop-oak-house", title: "Oak Avenue Family House", address: "48 Oak Ave", zone: "Northgate", kind: "house", price: 720_000, sqm: 210, beds: 4, baths: 3, amenities: ["Garden", "Garage", "Fireplace"], status: "active", daysOnMarket: 27, description: "Four-bedroom family home on a quiet street, walking distance to two schools.", cover: ["#22324F", "#8FA3C4"] }),
  P({ id: "prop-skyline-penthouse", title: "Skyline Penthouse", address: "1 Harbor Tower", zone: "Downtown", kind: "penthouse", price: 1_450_000, sqm: 185, beds: 3, baths: 3, amenities: ["Rooftop pool", "Concierge", "Parking", "Gym"], status: "active", daysOnMarket: 9, description: "Full-floor penthouse with 360° views and a private elevator lobby.", cover: ["#0F1B33", "#D9B45C"] }),
  P({ id: "prop-maple-condo", title: "Maple Court 2-Bed", address: "77 Maple Ct, Unit 5B", zone: "Riverside", kind: "apartment", price: 340_000, sqm: 74, beds: 2, baths: 1, amenities: ["Balcony", "Storage"], status: "active", daysOnMarket: 36, description: "Bright corner unit, renovated kitchen, low monthly fees.", cover: ["#2A3B5C", "#B5C2D9"] }),
  P({ id: "prop-hillcrest-townhouse", title: "Hillcrest Townhouse", address: "9 Hillcrest Ln", zone: "Northgate", kind: "townhouse", price: 560_000, sqm: 142, beds: 3, baths: 2, amenities: ["Patio", "Garage"], status: "reserved", daysOnMarket: 44, description: "End-of-row townhouse with a private patio and finished basement.", cover: ["#1E2E4C", "#A88A3D"] }),
  P({ id: "prop-marina-apartment", title: "Marina View Apartment", address: "300 Marina Blvd", zone: "Downtown", kind: "apartment", price: 615_000, sqm: 96, beds: 2, baths: 2, amenities: ["Sea view", "Pool", "Concierge"], status: "active", daysOnMarket: 18, description: "High-floor apartment facing the marina in a full-service building.", cover: ["#16294A", "#7FA0D6"] }),
  P({ id: "prop-elm-starter", title: "Elm Street Starter Home", address: "15 Elm St", zone: "Eastfield", kind: "house", price: 289_000, sqm: 95, beds: 2, baths: 1, amenities: ["Yard"], status: "active", daysOnMarket: 52, description: "Cozy two-bedroom with a fenced yard, ideal for first-time buyers.", cover: ["#263657", "#9FB0CC"] }),
  P({ id: "prop-cedar-villa", title: "Cedar Ridge Villa", address: "2 Cedar Ridge", zone: "Northgate", kind: "house", price: 1_180_000, sqm: 320, beds: 5, baths: 4, amenities: ["Pool", "Garden", "Home office", "Garage"], status: "active", daysOnMarket: 15, description: "Contemporary villa on a landscaped double lot with a heated pool.", cover: ["#0D1730", "#C9A24B"] }),
  P({ id: "prop-canal-studio", title: "Canal Street Studio", address: "260 Canal St", zone: "Riverside", kind: "loft", price: 215_000, sqm: 44, beds: 1, baths: 1, amenities: ["Bike storage"], status: "draft", daysOnMarket: 0, description: "Compact studio in a converted warehouse. Draft — photos pending.", cover: ["#2C3E60", "#8C9CB8"] }),
  P({ id: "prop-birch-duplex", title: "Birch Lane Duplex", address: "31 Birch Ln", zone: "Eastfield", kind: "townhouse", price: 395_000, sqm: 128, beds: 3, baths: 2, amenities: ["Terrace", "Parking"], status: "sold", daysOnMarket: 61, description: "Two-level duplex with a sunny terrace. Sold last month.", cover: ["#1A2845", "#6F86AE"] }),
];

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

type LeadSeed = Omit<Lead, "createdAt" | "notes"> & { daysAgo: number; notes?: string[] };
const L = (l: LeadSeed): Lead => {
  const { daysAgo, notes, ...rest } = l;
  return { ...rest, createdAt: iso(daysAgo), notes: notes ?? [] };
};

export const LEAD_SEEDS: Lead[] = [
  L({ id: "lead-ana-torres", name: "Ana Torres", email: "ana.torres@example.com", phone: "+1 555 010 0101", source: "Website form", message: "We're relocating for work next month and love the Riverside loft. Pre-approved up to 520k, can visit this week.", budget: 520_000, zones: ["Riverside"], bedsMin: 2, timelineMonths: 1, financing: "preapproved", stage: "new", interestedIn: "prop-riverside-loft", daysAgo: 1 }),
  L({ id: "lead-marcus-webb", name: "Marcus Webb", email: "marcus.webb@example.com", phone: "+1 555 010 0108", source: "Zillow", message: "Looking for a family house with a garden, 4 bedrooms. Selling our current home first.", budget: 750_000, zones: ["Northgate"], bedsMin: 4, timelineMonths: 4, financing: "needs_financing", stage: "contacted", lastContactAt: iso(2), daysAgo: 6 }),
  L({ id: "lead-sofia-reyes", name: "Sofia Reyes", email: "sofia.reyes@example.com", phone: "+1 555 010 0102", source: "Referral", message: "Cash buyer interested in the penthouse. Can close in 30 days.", budget: 1_500_000, zones: ["Downtown"], bedsMin: 3, timelineMonths: 1, financing: "cash", stage: "visit", lastContactAt: iso(1), interestedIn: "prop-skyline-penthouse", daysAgo: 8 }),
  L({ id: "lead-liam-oconnor", name: "Liam O'Connor", email: "liam.oconnor@example.com", source: "Instagram", message: "Just browsing for now.", budget: 0, zones: [], bedsMin: 0, timelineMonths: null, financing: "unknown", stage: "new", daysAgo: 3 }),
  L({ id: "lead-priya-nair", name: "Priya Nair", email: "priya.nair@example.com", phone: "+1 555 010 0109", source: "Website form", message: "First-time buyer, want a two-bedroom near the river under 350k. Mortgage pre-approval in progress.", budget: 350_000, zones: ["Riverside"], bedsMin: 2, timelineMonths: 3, financing: "needs_financing", stage: "new", interestedIn: "prop-maple-condo", daysAgo: 2 }),
  L({ id: "lead-jordan-hale", name: "Jordan Hale", email: "jordan.hale@example.com", phone: "+1 555 010 0103", source: "Referral", message: "Investor looking for two rental-ready units in Riverside or Eastfield, cash.", budget: 600_000, zones: ["Riverside", "Eastfield"], bedsMin: 1, timelineMonths: 2, financing: "cash", stage: "contacted", lastContactAt: iso(4), daysAgo: 12 }),
  L({ id: "lead-elena-petrova", name: "Elena Petrova", email: "elena.petrova@example.com", phone: "+1 555 010 0105", source: "Idealista", message: "Want a marina-view apartment, 2 beds, budget flexible around 600k.", budget: 630_000, zones: ["Downtown"], bedsMin: 2, timelineMonths: 3, financing: "preapproved", stage: "new", interestedIn: "prop-marina-apartment", daysAgo: 4 }),
  L({ id: "lead-david-kim", name: "David Kim", email: "david.kim@example.com", phone: "+1 555 010 0104", source: "Website form", message: "Family of five needs 5 bedrooms and a pool. Ready to move this quarter.", budget: 1_250_000, zones: ["Northgate"], bedsMin: 5, timelineMonths: 3, financing: "preapproved", stage: "visit", lastContactAt: iso(3), interestedIn: "prop-cedar-villa", daysAgo: 10 }),
  L({ id: "lead-hannah-berg", name: "Hannah Berg", email: "hannah.berg@example.com", source: "Zillow", message: "Downsizing, want a low-maintenance apartment with a balcony.", budget: 360_000, zones: ["Riverside", "Downtown"], bedsMin: 2, timelineMonths: 6, financing: "cash", stage: "contacted", lastContactAt: iso(9), daysAgo: 20 }),
  L({ id: "lead-omar-farouk", name: "Omar Farouk", email: "omar.farouk@example.com", source: "Facebook", message: "Interested in anything under 300k.", budget: 300_000, zones: [], bedsMin: 2, timelineMonths: null, financing: "unknown", stage: "new", daysAgo: 5 }),
  L({ id: "lead-chloe-martin", name: "Chloe Martin", email: "chloe.martin@example.com", source: "Website form", message: "Need a starter home with a yard for our dog. Pre-approved for 300k.", budget: 300_000, zones: ["Eastfield"], bedsMin: 2, timelineMonths: 2, financing: "preapproved", stage: "new", interestedIn: "prop-elm-starter", daysAgo: 1 }),
  L({ id: "lead-victor-lopez", name: "Victor Lopez", email: "victor.lopez@example.com", source: "Referral", message: "Considering the Hillcrest townhouse but it shows as reserved. Any similar?", budget: 580_000, zones: ["Northgate"], bedsMin: 3, timelineMonths: 2, financing: "preapproved", stage: "contacted", lastContactAt: iso(5), daysAgo: 14 }),
  L({ id: "lead-grace-okafor", name: "Grace Okafor", email: "grace.okafor@example.com", source: "Instagram", message: "Love the loft photos! When is the next open house?", budget: 500_000, zones: ["Riverside"], bedsMin: 2, timelineMonths: 5, financing: "needs_financing", stage: "new", interestedIn: "prop-riverside-loft", daysAgo: 7 }),
  L({ id: "lead-noah-fischer", name: "Noah Fischer", email: "noah.fischer@example.com", source: "Website form", message: "Wanted a house in Eastfield last spring — still thinking.", budget: 400_000, zones: ["Eastfield"], bedsMin: 3, timelineMonths: 9, financing: "needs_financing", stage: "contacted", lastContactAt: iso(45), daysAgo: 70 }),
  L({ id: "lead-isabel-cruz", name: "Isabel Cruz", email: "isabel.cruz@example.com", phone: "+1 555 010 0110", source: "Idealista", message: "Looking for a luxury apartment downtown with concierge, cash purchase, immediate.", budget: 1_000_000, zones: ["Downtown"], bedsMin: 2, timelineMonths: 1, financing: "cash", stage: "new", daysAgo: 0 }),
  L({ id: "lead-ethan-brooks", name: "Ethan Brooks", email: "ethan.brooks@example.com", source: "Facebook", message: "Send me your listings.", budget: 0, zones: [], bedsMin: 0, timelineMonths: null, financing: "unknown", stage: "contacted", lastContactAt: iso(38), daysAgo: 55 }),
  L({ id: "lead-mia-rossi", name: "Mia Rossi", email: "mia.rossi@example.com", source: "Referral", message: "We're expecting a baby and need 3 bedrooms with a garden before the spring.", budget: 640_000, zones: ["Northgate", "Eastfield"], bedsMin: 3, timelineMonths: 5, financing: "preapproved", stage: "new", daysAgo: 6 }),
  L({ id: "lead-lucas-silva", name: "Lucas Silva", email: "lucas.silva@example.com", phone: "+1 555 010 0106", source: "Zillow", message: "Made an offer on another property last week, keeping options open.", budget: 480_000, zones: ["Riverside"], bedsMin: 2, timelineMonths: 2, financing: "preapproved", stage: "offer", lastContactAt: iso(1), daysAgo: 18 }),
  L({ id: "lead-tom-becker", name: "Tom Becker", email: "tom.becker@example.com", phone: "+1 555 010 0107", source: "Website form", message: "We sold our flat and are ready to buy in Eastfield. Cash from the sale, want to view the Birch Lane duplex or something similar this week.", budget: 420_000, zones: ["Eastfield"], bedsMin: 3, timelineMonths: 1, financing: "cash", stage: "new", daysAgo: 0 }),
  L({ id: "lead-zara-ahmed", name: "Zara Ahmed", email: "zara.ahmed@example.com", source: "Website form", message: "Relocating from abroad in about six months, want to line up viewings by video.", budget: 700_000, zones: ["Downtown", "Riverside"], bedsMin: 2, timelineMonths: 6, financing: "preapproved", stage: "new", daysAgo: 9 }),
];

type SellerSeed = Omit<Seller, "createdAt" | "lastContactAt"> & { daysAgo: number; contactedDaysAgo?: number };
const S = (s: SellerSeed): Seller => {
  const { daysAgo, contactedDaysAgo, ...rest } = s;
  return { ...rest, createdAt: iso(daysAgo), lastContactAt: contactedDaysAgo === undefined ? undefined : iso(contactedDaysAgo) };
};

export const SELLER_SEEDS: Seller[] = [
  S({ id: "seller-margaret-liu", name: "Margaret Liu", email: "margaret.liu@example.com", source: "Referral", address: "1 Harbor Tower", zone: "Downtown", kind: "penthouse", sqm: 185, beds: 3, askingPrice: 1_450_000, stage: "listed", propertyId: "prop-skyline-penthouse", notes: "Relocating abroad; flexible on closing date, firm on price.", daysAgo: 30, contactedDaysAgo: 2 }),
  S({ id: "seller-robert-hayes", name: "Robert Hayes", email: "robert.hayes@example.com", source: "Past client", address: "48 Oak Ave", zone: "Northgate", kind: "house", sqm: 210, beds: 4, askingPrice: 720_000, stage: "listed", propertyId: "prop-oak-house", notes: "Wants weekly updates on showings.", daysAgo: 40, contactedDaysAgo: 6 }),
  S({ id: "seller-carmen-diaz", name: "Carmen Diaz", email: "carmen.diaz@example.com", source: "Website form", address: "9 Hillcrest Ln", zone: "Northgate", kind: "townhouse", sqm: 142, beds: 3, askingPrice: 560_000, stage: "listed", propertyId: "prop-hillcrest-townhouse", notes: "Reserved; waiting on the buyer's mortgage.", daysAgo: 60, contactedDaysAgo: 3 }),
  S({ id: "seller-peter-novak", name: "Peter Novak", email: "peter.novak@example.com", phone: "+1 555 0142", source: "Door knock", address: "22 Canal St", zone: "Riverside", kind: "loft", sqm: 90, beds: 2, askingPrice: 470_000, stage: "valuation", notes: "Inherited loft. Wants a price opinion before deciding to sell.", daysAgo: 9, contactedDaysAgo: 4 }),
  S({ id: "seller-henrik-larsen", name: "Henrik Larsen", email: "henrik.larsen@example.com", source: "Referral", address: "410 Marina Blvd", zone: "Downtown", kind: "apartment", sqm: 82, beds: 2, askingPrice: 560_000, stage: "agreement", notes: "Agreed on terms verbally; needs the listing agreement to sign.", daysAgo: 15, contactedDaysAgo: 1 }),
  S({ id: "seller-aisha-bello", name: "Aisha Bello", email: "aisha.bello@example.com", source: "Website form", address: "7 Willow Rd", zone: "Eastfield", kind: "house", sqm: 120, beds: 3, askingPrice: null, stage: "prospect", notes: "Thinking of selling next year, asked what her house might be worth.", daysAgo: 3 }),
  S({ id: "seller-sam-ortiz", name: "Sam Ortiz", email: "sam.ortiz@example.com", source: "Zillow", address: "55 Birch Ln", zone: "Eastfield", kind: "townhouse", sqm: 118, beds: 3, askingPrice: 450_000, stage: "lost", notes: "Listed with another agency.", daysAgo: 50, contactedDaysAgo: 20 }),
];

/** Sample showings placed around today so the calendar always has a past visit, today's and upcoming ones. */
export function buildSeedShowings(now: number): Showing[] {
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const created = new Date(now - 3 * day).toISOString();
  const list = (done: number) => checklistFresh().map((c, i) => ({ ...c, done: i < done }));
  return [
    {
      id: "show-sofia-penthouse",
      leadId: "lead-sofia-reyes",
      propertyId: "prop-skyline-penthouse",
      startsAt: at(-1, 16),
      durationMin: 60,
      status: "done",
      checklist: list(5),
      feedback: { interest: "high", objections: ["Fees"], notes: "Loved the terrace and views. Asked for the building's monthly fees in writing before making an offer.", recordedBy: "Agent", recordedAt: at(-1, 17, 15) },
      createdBy: "Agent",
      createdAt: created,
    },
    {
      id: "show-lucas-loft",
      leadId: "lead-lucas-silva",
      propertyId: "prop-riverside-loft",
      startsAt: at(-3, 12),
      durationMin: 45,
      status: "done",
      checklist: list(5),
      feedback: { interest: "medium", objections: ["Price", "Parking"], notes: "Likes the layout; thinks it's priced above the other Riverside lofts and needs a second parking space.", recordedBy: "Agent", recordedAt: at(-3, 13) },
      createdBy: "Agent",
      createdAt: created,
    },
    { id: "show-jordan-maple", leadId: "lead-jordan-hale", propertyId: "prop-maple-condo", startsAt: at(0, 15), durationMin: 45, status: "scheduled", checklist: list(3), createdBy: "Agent", createdAt: created },
    { id: "show-david-villa", leadId: "lead-david-kim", propertyId: "prop-cedar-villa", startsAt: at(1, 10), durationMin: 60, status: "scheduled", checklist: list(2), createdBy: "Agent", createdAt: created },
    { id: "show-ana-loft", leadId: "lead-ana-torres", propertyId: "prop-riverside-loft", startsAt: at(2, 18), durationMin: 45, status: "scheduled", checklist: list(0), createdBy: "Agent", createdAt: created },
  ];
}
