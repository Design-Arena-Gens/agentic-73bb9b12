export const metadata = {
  title: "Desert Convoy Cinematic",
  description: "15s camera choreography over a desert convoy"
};

import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

