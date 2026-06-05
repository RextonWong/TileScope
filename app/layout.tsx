import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TileScope — Ceramic Tile Defect Inspection AI",
  description:
    "AI-powered ceramic tile quality inspection. Upload photos of a tile to detect defects, compute an ISO 10545-2 quality grade, and generate a PDF report.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 antialiased font-sans">
        {children}
        <Toaster theme="dark" richColors />
      </body>
    </html>
  );
}
