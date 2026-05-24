'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin/placares', label: 'Placares' },
  { href: '/admin/ranking',  label: 'Ranking' },
  { href: '/admin/usuarios', label: 'Usuários' },
] as const;

export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-trovao-card border-b border-trovao-border px-4">
      <div className="max-w-2xl mx-auto flex items-center gap-1 h-12">
        <span className="text-trovao-gold font-bold text-sm mr-4">Admin</span>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname.startsWith(href)
                ? 'bg-trovao-gold text-trovao-base'
                : 'text-trovao-muted hover:text-white'
            }`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
