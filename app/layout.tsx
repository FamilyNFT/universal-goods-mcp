import type { Metadata, Viewport } from "next";
import { Inter, Sofia_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const sofiaSans = Sofia_Sans({
  subsets: ["latin"],
  variable: "--font-sofia-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Scout - Digital Product Passport Data Collection",
  description:
    "AI-powered supplier chat for collecting Digital Product Passport data",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F5F6FC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sofiaSans.variable} bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
