import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
// import { ThemeScript } from "@/components/theme/ThemeScript";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";

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
    default: "CrossCurrent",
    template: "%s | CrossCurrent",
  },
  description: "CrossCurrent events and church registration platform",
  icons: {
    icon: [
      { url: "/cc-short.png", type: "image/png" },
      { url: "/cc-short-white.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/cc-short.png", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* <ThemeScript /> */}
        <ThemeProvider initialTheme={theme}>
          <main>
            <SiteHeader />
            {children}
          </main>
          <Toaster position="top-center" duration={5000} />
        </ThemeProvider>
      </body>
    </html>
  );
}
