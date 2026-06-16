import type { Metadata } from "next";
import { Inter, Manrope, Sora } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import { ClerkRootProvider } from "@/components/providers/clerk-root-provider";
import { THEME_STORAGE_KEY } from "@/lib/constants";
import { defaultMetadata, defaultViewport } from "@/lib/seo";
import { resolveThemeFromCookies } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = defaultMetadata;
export const viewport = defaultViewport;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_STORAGE_KEY)?.value;
  const resolvedCookie = cookieStore.get("pragma-theme-resolved")?.value;
  const { theme: defaultTheme, resolved: defaultResolved } =
    resolveThemeFromCookies(themeCookie, resolvedCookie);

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        `${inter.variable} ${sora.variable} ${manrope.variable} h-full`,
        defaultResolved === "dark" && "dark",
      )}
      data-theme={defaultResolved}
    >
      <body className="min-h-full font-sans antialiased">
        <ClerkRootProvider>
          <AppProviders
            defaultTheme={defaultTheme}
            defaultResolved={defaultResolved}
          >
            {children}
          </AppProviders>
        </ClerkRootProvider>
      </body>
    </html>
  );
}
