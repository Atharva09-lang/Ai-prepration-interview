'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Read-as-text, click-to-edit field. Edits feel immediate: the value updates
 * optimistically on save, and Escape cancels without committing.
 */
export function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = 'Empty',
  className,
  editClass,
  label,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => setDraft(value ?? ''), [value]);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    if (ref.current instanceof HTMLTextAreaElement) {
      ref.current.setSelectionRange(draft.length, draft.length);
    } else {
      ref.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === (value ?? '').trim()) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  const shared = {
    ref,
    value: draft,
    disabled: saving,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    },
    'aria-label': label,
    className: cn(
      'w-full rounded-md border border-primary bg-card px-2.5 py-1.5 text-sm text-ink',
      'focus:outline-none focus:ring-2 focus:ring-primary/30',
      editClass,
    ),
  };

  if (editing) {
    return multiline ? (
      <textarea rows={Math.min(10, Math.max(3, draft.split('\n').length))} {...shared} />
    ) : (
      <input type="text" {...shared} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'group block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        'hover:bg-surface focus-visible:bg-surface',
        !(value ?? '').trim() && 'text-muted italic',
        className,
      )}
      aria-label={`${label}. Activate to edit.`}
    >
      <span className="whitespace-pre-wrap">{(value ?? '').trim() || placeholder}</span>
      <span
        className="ml-2 align-middle text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      >
        ✎
      </span>
    </button>
  );
}
