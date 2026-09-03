import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '金陵访古图｜我的南京国保足迹',
  description:
    '在南京地图上查看已到访、部分到访与尚未到访的全国重点文物保护单位。',
  openGraph: {
    title: '金陵访古图｜我的南京国保足迹',
    description: '55处112点，记录我与南京全国重点文物保护单位的相遇。',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
