import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepTier — anchor credit, deep & private",
  description:
    "Deep-tier supply-chain finance on Canton: an anchor's confirmed payable reaches tier-2/3 suppliers with load-bearing privacy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
