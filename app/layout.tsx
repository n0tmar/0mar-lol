import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://0mar.lol"),
  title: {
    default: "ملفات عمر | 0MAR",
    template: "%s | 0MAR",
  },
  description:
    "ملفات وأدوات ومحتوى عمر الحامي، بروابط مباشرة وبدون إعلانات مزعجة.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ملفات عمر | 0MAR",
    description:
      "كل الملفات والأدوات التي أشاركها معكم، في مكان واحد وبدون روابط مزعجة.",
    url: "https://0mar.lol",
    siteName: "0MAR",
    locale: "ar_SA",
    type: "website",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icons/icon-180.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "0MAR",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15151a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
