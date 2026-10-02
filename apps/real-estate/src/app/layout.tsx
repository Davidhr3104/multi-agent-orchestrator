import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AppShell, type NavBadges } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { needsFeedback, sameDay } from "@/lib/showings";
import { listDrafts, listSellers, listShowings } from "@/lib/store";
import { TourHost } from "@/components/tour-host";
import type { DeskNotice } from "@/components/notification-bell";
import { THEME_BOOT } from "@/lib/theme";
import { fmtTime } from "@/lib/when";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Helix for Real Estate",
  description: "AI listings, buyer scoring and property matching for real-estate agents — every action approved by you.",
  icons: { icon: "/logo-icon.png" },
};

export const dynamic = "force-dynamic";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function deskSignals(): Promise<{ badges: NavBadges; notices: DeskNotice[] }> {
  const [drafts, showings, sellers] = await Promise.all([listDrafts(), listShowings(), listSellers()]);
  const now = Date.now();
  const leftToday = showings.filter((s) => s.status === "scheduled" && sameDay(Date.parse(s.startsAt), now) && Date.parse(s.startsAt) > now);
  const awaiting = showings.filter((s) => needsFeedback(s, now));
  const pending = drafts.filter((d) => d.status === "pending").length;
  const prospects = sellers.filter((s) => s.stage === "prospect").length;
  return {
    badges: {
      "/calendar": { count: leftToday.length + awaiting.length, label: `${plural(leftToday.length, "showing")} left today, ${awaiting.length} waiting for feedback` },
      "/outreach": { count: pending, label: `${plural(pending, "draft")} waiting for your approval` },
      "/sellers": { count: prospects, label: `${plural(prospects, "new prospect")} to qualify` },
    },
    notices: [
      { id: "feedback", kind: "feedback", count: awaiting.length, href: awaiting.length === 1 ? `/calendar/${awaiting[0].id}` : "/calendar#feedback", title: "Visit feedback missing", detail: `${plural(awaiting.length, "visit")} ended without notes` },
      { id: "today", kind: "showing", count: leftToday.length, href: "/calendar", title: "Showings left today", detail: leftToday[0] ? `Next at ${fmtTime(leftToday[0].startsAt)}` : "" },
      { id: "drafts", kind: "draft", count: pending, href: "/outreach", title: "Drafts to approve", detail: "Helix wrote them; nothing is sent until you do" },
      { id: "sellers", kind: "seller", count: prospects, href: "/sellers#qualify", title: "Seller prospects to qualify", detail: "Review before they enter your inventory" },
    ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { badges, notices } = await deskSignals();
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full bg-background">
        <TooltipProvider>
          <AppShell badges={badges} notices={notices}>
            {children}
          </AppShell>
        </TooltipProvider>
        <TourHost />
      </body>
    </html>
  );
}
