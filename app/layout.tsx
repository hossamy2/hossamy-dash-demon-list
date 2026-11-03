import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hossamy Dash Demon List',
  description: 'Community demon levels, verified records, and leaderboard for Hossamy Dash.',
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
