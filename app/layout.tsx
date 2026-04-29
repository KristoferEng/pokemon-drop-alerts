import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokémon Drop Alerts — Get texted the moment TCG cards drop",
  description:
    "Free SMS alerts the moment Pokémon TCG card products restock or new sets release at Pokémon Center, Target, Walmart, Best Buy, GameStop, and Costco.",
  openGraph: {
    title: "Pokémon Drop Alerts",
    description:
      "Free SMS alerts when Pokémon TCG cards drop at major US retailers.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
