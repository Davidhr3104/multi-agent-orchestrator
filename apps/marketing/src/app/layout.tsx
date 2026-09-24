import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-marketing",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-marketing",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix for Marketing · Performance Engine",
  description:
    "Join ad spend to Helix lead scores. Pause or scale campaigns with evidence and a human in the loop. Meta/Google stay stubs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col overflow-x-hidden bg-background font-sans text-on-surface"
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
