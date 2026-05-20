import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import { ClerkRootProvider } from "@/components/providers/clerk-root-provider";
import { APP_DESCRIPTION, APP_NAME, THEME_STORAGE_KEY } from "@/lib/constants";
import { resolveThemeFromCookies } from "@/lib/theme";
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
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
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
