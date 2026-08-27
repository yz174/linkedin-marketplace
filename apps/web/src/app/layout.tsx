import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loopwork Marketplace',
  description: 'Book LinkedIn creators for B2B campaigns.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
