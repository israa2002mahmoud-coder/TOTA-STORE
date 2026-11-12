import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOTA STORE | كل اختياراتك في مكان واحد",
  description: "متجر TOTA STORE متعدد الأقسام",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
