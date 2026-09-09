import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPATIAL — AI 인테리어 스튜디오",
  description: "사진으로 영감을 얻고, 3D에서 직접 완성하는 나의 매장.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
