'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { relativeTime, hostnameOf } from '@/lib/utils';

/**
 * A kit summary card used on the dashboard and My Kits pages.
 * The whole card is a link to the kit workspace.
 */
export function KitCard({ kit, index = 0 }) {
  const company = kit.company || hostnameOf(kit.company_url);
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="h-full"
    >
      <Link href={`/kits/${kit.id}`} className="block h-full">
        <Card interactive className="flex h-full flex-col p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <StatusBadge status={kit.status} />
            <span className="text-xs text-muted">
              {kit.days} day{kit.days === 1 ? '' : 's'}
            </span>
          </div>

          <h3 className="line-clamp-2 font-heading text-base font-semibold text-ink">
            {kit.title || 'Untitled role'}
          </h3>
          <p className="mt-1 truncate text-sm text-muted">{company}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <span className="text-xs text-muted">Updated {relativeTime(kit.updated_at)}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open kit
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </Card>
      </Link>
    </motion.li>
  );
}
