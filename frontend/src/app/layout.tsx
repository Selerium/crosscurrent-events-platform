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

function decodeUserFromCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>
) {
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      name: payload.name,
      role: payload.role,
      firstTime: payload.firstTime,
      approved: payload.approved ?? false,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // const cookieStore = await cookies();
  // const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  // const user = decodeUserFromCookie(cookieStore);

  return (
    <html
      lang="en"
      // data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* <ThemeScript /> */}
        {/* <ThemeProvider initialTheme={theme}> */}
        <main>
          {/* <SiteHeader user={user} /> */}
          {children}
        </main>
        <Toaster position="top-center" duration={5000} />
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
