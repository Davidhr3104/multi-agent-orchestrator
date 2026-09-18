import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { listOrders, listProducts } from "@/lib/store";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix for Commerce",
  description: "Enterprise commerce operations and fraud intelligence.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full bg-background antialiased">
        <ThemeProvider>
          <TooltipProvider>
            <AppShell
              initialOrdersNeedingReview={orders.filter((o) => o.requiresReview).length}
              initialInventoryAlerts={products.filter((p) => p.restockRecommended).length}
            >
              {children}
            </AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
