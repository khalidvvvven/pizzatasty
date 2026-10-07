'use client';

import Link from 'next/link';
import { useI18n } from '@/components/providers/AppProviders';

export default function NotFound() {
  const { locale, dict } = useI18n();
  return (
    <div className="container" style={{ display: 'grid', justifyItems: 'center', gap: 16, padding: '64px 16px', textAlign: 'center' }}>
      <img src="/food/pizza-choco-banane.svg" alt="" width={160} height={160} />
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontStretch: '80%' }}>{dict.notFound.title}</h1>
      <p style={{ color: 'var(--c-ink-2)' }}>{dict.notFound.text}</p>
      <Link href={`/${locale}/menu`} className="btn btn-primary btn-lg">
        {dict.notFound.cta}
      </Link>
    </div>
  );
}
