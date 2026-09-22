'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { buttonClasses } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

const steps = [
  { title: 'Analyze the job description', body: 'Responsibilities and required skills are extracted into a structured requirement list.' },
  { title: 'Research the company', body: 'The website is crawled, the hiring process is found, and public interview discussion is gathered.' },
  { title: 'Generate interview questions', body: 'Technical, behavioural and company-fit questions, each mapped back to a requirement.' },
  { title: 'Build flashcards', body: 'Key material condensed into review cards you can drill in a focused practice session.' },
  { title: 'Create a study schedule', body: 'Everything spread across the exact number of days you have before the interview.' },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function LandingPage() {
  const { user } = useAuth();
  const primaryHref = user ? '/generate' : '/register';
  const secondaryHref = user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Interview preparation, structured
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
                Turn Any Job Description Into Your Interview Plan.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
                Paste a job description, add the company website, and generate a
                structured interview preparation kit.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={primaryHref} className={buttonClasses('primary', 'lg')}>
                  Generate Your Kit
                </Link>
                <Link href={secondaryHref} className={buttonClasses('outline', 'lg')}>
                  View Dashboard
                </Link>
              </div>
            </motion.div>

            {/* Product preview as the visual hero — no AI glow art */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative hidden lg:block"
              aria-hidden="true"
            >
              <div className="rounded-xl border border-border bg-card p-6 shadow-lift">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                </div>

                {/* Mini progress timeline */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Extracting requirements', done: true },
                    { label: 'Researching company', done: true },
                    { label: 'Generating questions', done: false },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <span
                        className={
                          s.done
                            ? 'flex h-4 w-4 items-center justify-center rounded-full bg-success text-white'
                            : 'h-4 w-4 rounded-full border-2 border-primary border-t-transparent'
                        }
                      >
                        {s.done && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-xs text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Question category cards */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {['Technical', 'Behavioural', 'System design', 'Company fit'].map((c, i) => (
                    <div key={c} className="rounded-lg border border-border bg-background p-3">
                      <div className={`mb-2 h-2 w-10 rounded ${i % 2 ? 'bg-accent/40' : 'bg-primary/40'}`} />
                      <p className="text-xs font-medium text-muted">{c}</p>
                    </div>
                  ))}
                </div>

                {/* Flashcard hint */}
                <div className="mt-6 flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                  <div className="h-2 w-40 rounded bg-primary/20" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              From posting to preparation in five steps
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((s, i) => (
                <motion.div
                  key={s.title}
                  {...fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-xl border border-border bg-card p-6 shadow-soft"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-border bg-primary p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Walk in prepared.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/80">
              Build your first interview kit in a couple of minutes.
            </p>
            <div className="mt-7 flex justify-center">
              <Link href={primaryHref} className={buttonClasses('accent', 'lg')}>
                Generate Your Kit
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <p>AI Interview Prep Kit — structured interview preparation.</p>
          <p>Built with Next.js, Tailwind CSS and a Node.js pipeline.</p>
        </div>
      </footer>
    </div>
  );
}
