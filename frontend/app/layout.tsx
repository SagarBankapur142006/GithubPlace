import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ideora - Premium Tech Acquisitions",
  description:
    "The exclusive marketplace for visionary entrepreneurs to acquire high-potential tech projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
