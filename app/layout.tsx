import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memorate",
  description: "A personal catalog of things you try, buy and experience.",
  applicationName: "Memorate",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Memorate" },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }, { url: "/icons/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" }, { url: "/icons/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" }] },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f2eae6" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
