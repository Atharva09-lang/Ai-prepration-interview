'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { ProgressTimeline } from '@/components/ProgressTimeline';
import { ErrorState } from '@/components/ErrorState';
import { api, ApiError } from '@/lib/api';
import { useJobPolling, deriveStageStates, deriveStageDetails } from '@/hooks/useJobPolling';

const JD_MIN = 10;
const JD_MAX = 20000;

const STEPS = [
  'Analyze job description',
  'Research company',
  'Generate interview questions',
  'Build flashcards',
  'Create study schedule',
];

function validate(values) {
  const errors = {};
  const jd = values.jd.trim();
  if (jd.length < JD_MIN) errors.jd = `Add a little more detail (min ${JD_MIN} characters).`;
  else if (jd.length > JD_MAX) errors.jd = `Too long (max ${JD_MAX.toLocaleString()} characters).`;

  try {
    const proto = new URL(values.company_url.trim()).protocol;
    if (proto !== 'http:' && proto !== 'https:') errors.company_url = 'Use an http(s) URL.';
  } catch {
    errors.company_url = 'Enter a valid company website URL.';
  }

  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    errors.days = 'Days must be a whole number between 1 and 365.';
  }
  return errors;
}

export default function GeneratePage() {
  const router = useRouter();
  const [values, setValues] = useState({ jd: '', company_url: '', days: '3' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [kitId, setKitId] = useState(null);
  const [failure, setFailure] = useState(null);

  const { job } = useJobPolling(jobId, {
    onTerminal: (j) => {
      if (j.status === 'succeeded' && kitId) {
        router.push(`/kits/${kitId}`);
      } else if (j.status === 'failed') {
        setFailure({
          message: j.error?.message ?? 'Something went wrong while generating your kit.',
        });
      }
    },
  });

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const res = await api.createKit({
        jd: values.jd.trim(),
        company_url: values.company_url.trim(),
        days: Number(values.days),
      });

      // A duplicate that is already ready: open it straight away.
      if (res.duplicate && res.status === 'ready') {
        router.push(`/kits/${res.kit_id}`);
        return;
      }
      if (res.duplicate && res.status === 'failed' && !res.job_id) {
        setSubmitError('This exact kit failed before. Adjust the input and retry.');
        setSubmitting(false);
        return;
      }

      setKitId(res.kit_id);
      if (res.job_id) setJobId(res.job_id);
      else router.push(`/kits/${res.kit_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not start generation. Try again.',
      );
      setSubmitting(false);
    }
  }

  function resetToForm() {
    setFailure(null);
    setJobId(null);
    setKitId(null);
    setSubmitting(false);
  }

  const generating = Boolean(jobId);
  const stageStates = deriveStageStates(job);
  const details = deriveStageDetails(job);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {!generating ? (
            <>
              <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  Create Interview Preparation Kit
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Paste the job description, add the company website, and tell us
                  how long you have. We&apos;ll handle the rest.
                </p>
              </header>

              <Card className="p-6 sm:p-8">
                <form onSubmit={onSubmit} className="space-y-5" noValidate>
                  {submitError && (
                    <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                      {submitError}
                    </div>
                  )}

                  <Textarea
                    label="Job Description"
                    name="jd"
                    rows={9}
                    placeholder="Paste the complete job description here..."
                    value={values.jd}
                    onChange={set('jd')}
                    error={errors.jd}
                    hint={`${values.jd.trim().length.toLocaleString()} / ${JD_MAX.toLocaleString()} characters`}
                  />

                  <Input
                    label="Company Website"
                    name="company_url"
                    type="url"
                    inputMode="url"
                    placeholder="https://company.com"
                    value={values.company_url}
                    onChange={set('company_url')}
                    error={errors.company_url}
                  />

                  <Input
                    label="Days Before Interview"
                    name="days"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={values.days}
                    onChange={set('days')}
                    error={errors.days}
                    hint="We spread the material across exactly this many days."
                  />

                  <Button type="submit" size="lg" className="w-full" loading={submitting}>
                    Generate Interview Kit
                  </Button>
                </form>
              </Card>

              <Card className="mt-6 p-6">
                <h2 className="text-sm font-semibold text-ink">What happens next</h2>
                <ol className="mt-3 space-y-2">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-3 text-sm text-muted">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface font-heading text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : (
            <Card className="p-6 sm:p-8">
              <header className="mb-6">
                <h1 className="text-xl font-bold tracking-tight text-ink">
                  Building your kit…
                </h1>
                <p className="mt-1 text-sm text-muted">
                  This runs a real research and generation pipeline. It can take a
                  minute — you can safely wait here.
                </p>
              </header>

              <ProgressTimeline stageStates={stageStates} details={details} />

              {failure ? (
                <div className="mt-6">
                  <ErrorState
                    title="Generation failed"
                    message={failure.message}
                    onRetry={resetToForm}
                    retryLabel="Back to the form"
                  />
                </div>
              ) : (
                kitId && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/kits/${kitId}`)}>
                      Open Interview Kit
                    </Button>
                  </div>
                )
              )}
            </Card>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
