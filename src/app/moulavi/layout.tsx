import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "شعری از مولوی",
  description: "انتخاب تصادفی اشعار مولانا جلال‌الدین رومی با معنی و صوت",
};

export default function MoulaviLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
