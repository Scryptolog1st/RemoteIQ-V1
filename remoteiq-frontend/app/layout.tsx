// remoteiq-frontend/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/app/providers";
import { BrandingProvider } from "./providers/BrandingProvider";
import { ToastProvider } from "@/lib/toast";
import Toaster from "@/components/ui/toaster";

export const runtime = "nodejs";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RemoteIQ",
  description: "Next-generation Remote Monitoring & Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <ToastProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <BrandingProvider>
              <Providers>{children}</Providers>
            </BrandingProvider>
          </ThemeProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
