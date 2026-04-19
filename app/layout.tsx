import type { Metadata } from "next";
import { Inter, Poppins, Noto_Sans_SC } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "路小理 Lexora - 交通纠纷法律助手",
  description: "把事故线索，整理成可行动的答案。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${poppins.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="h-full m-0 text-[var(--color-text-primary)]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
