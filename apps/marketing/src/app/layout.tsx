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
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col overflow-x-hidden bg-[#08090d] font-sans text-[#F3F4F6]"
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
