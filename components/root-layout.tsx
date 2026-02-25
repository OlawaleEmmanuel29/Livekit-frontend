import { Public_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import '@/styles/globals.css';

export const metadata = {
  title: 'LiveKit Embedded Voice Agent',
  description: 'LiveKit Embedded Voice Agent',
};

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

interface RootLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// We use "export function" so that other files can find it by name
export async function RootLayout({ children, className }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('scroll-smooth', className)}>
      <body
        className={cn(
          publicSans.variable, 
          'font-sans overflow-x-hidden antialiased'
        )}
      >
        {children}
      </body>
    </html>
  );
}

// We also keep "export default" just in case Vercel prefers it
export default RootLayout;
