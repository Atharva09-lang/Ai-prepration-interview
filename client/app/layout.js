import { Manrope, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'AI Interview Prep Kit — Turn any job description into your interview plan',
    template: '%s · AI Interview Prep Kit',
  },
  description:
    'Paste a job description, add the company website, and generate a structured interview preparation kit: company brief, question bank, flashcards and a study schedule.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plex.variable}`}>
      <body className="min-h-dvh bg-background font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
