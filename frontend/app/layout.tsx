import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scholar Agent",
  description: "Agent-enhanced paper reader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
