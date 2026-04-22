import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greymatter Intake",
  description: "Patient intake and internal operations dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
