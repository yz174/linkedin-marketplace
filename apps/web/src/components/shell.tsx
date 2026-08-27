'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icon';

type NavItem = { href: string; label: string; icon: IconName; count?: number };
type NavGroup = { heading: string; items: NavItem[] };

export const BRAND_NAV: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { href: '/brand/dashboard', label: 'Overview', icon: 'home' },
      { href: '/brand/campaigns', label: 'Campaigns', icon: 'file' },
      { href: '/brand/catalog', label: 'Catalog', icon: 'users' },
      { href: '/brand/collaborations', label: 'Collaborations', icon: 'inbox' },
      { href: '/brand/messenger', label: 'Messenger', icon: 'chat' }
    ]
  },
  {
    heading: 'Tools',
    items: [
      { href: '/brand/analytics', label: 'Analytics', icon: 'chart' },
      { href: '/brand/billing', label: 'Billing', icon: 'card' }
    ]
  },
  {
    heading: 'Support',
    items: [
      { href: '/brand/settings', label: 'Settings', icon: 'gear' },
      { href: '/brand/help', label: 'Help', icon: 'help' }
    ]
  }
];

export const CREATOR_NAV: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { href: '/creator/card', label: 'Your card', icon: 'card' },
      { href: '/creator/offers', label: 'Offers', icon: 'inbox' },
      { href: '/creator/assignments', label: 'Assignments', icon: 'file' },
      { href: '/creator/messenger', label: 'Messenger', icon: 'chat' }
    ]
  },
  {
    heading: 'Earnings',
    items: [
      { href: '/creator/payouts', label: 'Payouts', icon: 'wallet' },
      { href: '/creator/performance', label: 'Performance', icon: 'chart' }
    ]
  },
  {
    heading: 'Support',
    items: [
      { href: '/creator/settings', label: 'Settings', icon: 'gear' },
      { href: '/creator/help', label: 'Help', icon: 'help' }
    ]
  }
];

export function Sidebar({
  groups,
  name,
  sub,
  glyph
}: {
  groups: NavGroup[];
  name: string;
  sub: string;
  glyph: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="side">
      <div className="brandmark">
        <span className="glyph">{glyph}</span>
        <span>
          <span className="nm">{name}</span>
          <br />
          <span className="sub">{sub}</span>
        </span>
      </div>

      {groups.map((group) => (
        <div className="navgroup" key={group.heading}>
          <h4>{group.heading}</h4>
          {group.items.map((item) => (
            <Link
              key={item.href}
              className="nav"
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.count === undefined ? null : <span className="count">{item.count}</span>}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}

export function Topbar({ placeholder, right }: { placeholder: string; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <label className="search">
        <Icon name="search" />
        <input placeholder={placeholder} />
        <span className="kbd">⌘K</span>
      </label>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
