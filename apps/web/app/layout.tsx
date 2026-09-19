import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Lam K. | Independent Engineer",
  description:
    "Independent Engineer building AI systems, distributed platforms, and embedded software. Exploring the boundaries between intelligent & silicon-level computing.",
  keywords: [
    "developer",
    "full-stack",
    "PHP",
    "Vue",
    "Python",
    "Rust",
    "FPGA",
    "Verilog",
  ],
  authors: [{ name: "Lam K.", url: "https://github.com/immane" }],
  openGraph: {
    title: "Lam K. | Independent Engineer",
    description: "Independent Engineer building AI systems, distributed platforms, and embedded software. Exploring the boundaries between intelligent & silicon-level computing.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen`}
      >
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
