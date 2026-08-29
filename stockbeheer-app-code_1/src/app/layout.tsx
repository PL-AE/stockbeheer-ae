import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockbeheer All Events",
  description: "Stockbeheer & reservaties voor All Events",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
