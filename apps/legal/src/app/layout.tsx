import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MaybeDeskShell } from "@/components/maybe-desk-shell";
import { LegalOnboardingHost } from "@/components/legal-onboarding-host";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Helix for Legal — Enterprise RFP Intelligence & Document Analysis",
  description:
    "Extract RFP fields, fact-check evidence, score match for injury-law / clinical analysis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${ibmPlexMono.variable} h-full bg-[#0B0F19] text-[#9CA3AF] antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#0B0F19] font-sans text-xs text-[#9CA3AF]">
        <TooltipProvider>
          <MaybeDeskShell>{children}</MaybeDeskShell>
          <LegalOnboardingHost />
        </TooltipProvider>
      </body>
    </html>
  );
}
