import type { Metadata } from "next";
import { Fredoka, Space_Mono } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["400", "600", "700"],
});

const mono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Reposeer | Codebase Architecture Seer",
  description: "Static AST analysis and architectural intelligence for Python repositories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${fredoka.variable} ${mono.variable}`}>
      <body className="bg-[#030908] text-slate-100 antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
