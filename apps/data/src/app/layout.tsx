import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { CosmicParticles } from "@/components/cosmic-particles";
import { ThemeProvider, themeBootScript } from "@/components/theme-provider";
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
  title: "Helix Data — Excel desk",
  icons: { icon: "/helix-data-icon.png" },
  description: "Profile, clean with cell provenance, and export a new spreadsheet. Never overwrites the original.",
};

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
      <body className="cosmic-gradient-bg flex min-h-full flex-col overflow-x-hidden font-sans text-sm text-foreground antialiased">
        <ThemeProvider>
          <CosmicParticles />
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <AppShell>{children}</AppShell>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
