import type { Metadata } from "next";
import { Fredoka, Space_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    <html lang="en" data-theme="default" data-color-scheme="dark" className={`${fredoka.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`try {
            var preference = localStorage.getItem("reposeer-theme");
            if (preference === "default" || preference === "light" || preference === "dark") {
              var dark = preference === "dark" || (preference === "default" && window.matchMedia("(prefers-color-scheme: dark)").matches);
              var root = document.documentElement;
              root.dataset.theme = preference;
              root.dataset.colorScheme = dark ? "dark" : "light";
              root.classList.toggle("dark", dark);
              root.style.colorScheme = dark ? "dark" : "light";
            }
          } catch (error) {
            console.error("Unable to apply the saved theme before page render.", error);
          }`}
        </Script>
      </head>
      <body className="bg-[#030908] text-slate-100 antialiased min-h-screen font-sans">
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
