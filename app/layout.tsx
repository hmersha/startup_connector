import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabSpace",
  description: "A private space for startup collaboration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-gray-900">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</main>
      </body>
    </html>
  );
}
