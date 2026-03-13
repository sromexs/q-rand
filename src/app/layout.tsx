import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "آیه‌ای از قرآن",
  description: "انتخاب تصادفی آیات قرآن کریم با ترجمه فارسی",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/q-rand-icon-192.png" />
        <link rel="apple-touch-icon" href="/q-rand-icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
