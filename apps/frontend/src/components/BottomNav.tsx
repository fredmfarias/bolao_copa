'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Trophy, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/jogos',   icon: Home,   label: 'Jogos'   },
  { href: '/boloes',  icon: Users,  label: 'Bolões'  },
  { href: '/ranking', icon: Trophy, label: 'Ranking' },
  { href: '/perfil',  icon: User,   label: 'Perfil'  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-trovao-card border-t border-trovao-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? 'text-trovao-gold' : 'text-trovao-muted hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
