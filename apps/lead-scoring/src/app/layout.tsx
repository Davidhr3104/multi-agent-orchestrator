import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listLeads } from "@/lib/store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix for Leads",
  description:
    "Classify inbound contacts, score fit, human review, mock CRM handoff.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const leads = await listLeads();
  const initialNewCount = leads.filter((l) => (l.pipelineStage ?? "new") === "new").length;
  const initialReviewCount = leads.filter((l) => l.needsReview).length;
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider>
          <AppShell initialNewCount={initialNewCount} initialReviewCount={initialReviewCount}>
            {children}
          </AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
