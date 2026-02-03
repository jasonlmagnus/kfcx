import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "KFCX - NPS Insight Platform",
  description: "Korn Ferry Customer Centricity - NPS Interview Insight Platform",
  icons: { icon: "/kf-icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-60">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
