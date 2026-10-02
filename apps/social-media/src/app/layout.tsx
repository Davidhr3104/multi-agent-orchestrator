import type { Metadata } from "next";
import { Geist_Mono, Inter, Sora, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listPosts, shellSession } from "@/lib/store";
import { TourHost } from "@/components/tour-host";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Helix for Social Media",
  description: "Content calendar, draft posts and readiness checks for your social team — every post approved by a person.",
  icons: { icon: "/logo-icon.png" },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [session, posts] = await Promise.all([shellSession(), listPosts()]);
  return (
    <html lang="en" className={`dark ${inter.variable} ${space.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <TooltipProvider>
          <AppShell session={session} posts={posts.map((post) => ({ id: post.id, caption: post.caption, channel: post.channel, scheduledFor: post.scheduledFor }))}>
            {children}
          </AppShell>
        </TooltipProvider>
        <TourHost />
      </body>
    </html>
  );
}
