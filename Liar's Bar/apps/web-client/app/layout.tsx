import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import { defaultTheme } from '@liars-bar/ui';
import LandscapeOrientationLock from './LandscapeOrientationLock';
import './globals.css';

export const metadata: Metadata = {
  title: "Liar's Bar",
  description: '骗子酒馆游戏',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

const themeStyle = defaultTheme.variables as CSSProperties;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme={defaultTheme.name} style={themeStyle}>
      <body>
        <LandscapeOrientationLock />
        {children}
      </body>
    </html>
  );
}
