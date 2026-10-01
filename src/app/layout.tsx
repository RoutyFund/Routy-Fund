import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Routy — Route trading fees into real-world assets",
  description: "Launch tokens, route creator fees, acquire canonical Robinhood Stock Tokens, and reward holders.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
