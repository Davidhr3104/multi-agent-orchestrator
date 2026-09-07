import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MaybeDeskShell } from "@/components/maybe-desk-shell";
import { CosmicParticles } from "@/components/cosmic-particles";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InboxOnboardingHost } from "@/components/inbox-onboarding-host";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Helix for Inbox — EA Triage Command Center",
  description: "Rank, draft, and route emails with autonomous multi-agent assistance.",
};

const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');r.dataset.theme=t;r.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrains.variable} h-full bg-background text-foreground antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="cosmic-gradient-bg flex min-h-full flex-col overflow-x-hidden font-sans text-sm text-foreground antialiased selection:bg-accent/25">
        <ThemeProvider>
          <TooltipProvider delay={300}>
            <CosmicParticles />
            <div className="relative z-10 flex min-h-full flex-1 flex-col">
              <MaybeDeskShell>{children}</MaybeDeskShell>
            </div>
            <InboxOnboardingHost />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
