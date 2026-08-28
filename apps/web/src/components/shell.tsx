'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from './icon';

type NavItem = { href: string; label: string; icon: IconName; count?: number };
type NavGroup = { heading: string; items: NavItem[] };

export const BRAND_NAV: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { href: '/brand/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/brand/campaigns', label: 'Campaigns', icon: 'file' },
      { href: '/brand/catalog', label: 'Catalog', icon: 'users' },
      { href: '/brand/collaborations', label: 'Collaborations', icon: 'inbox' },
      { href: '/brand/messenger', label: 'Messenger', icon: 'chat' }
    ]
  },
  {
    heading: 'Tools',
    items: [{ href: '/brand/billing', label: 'Billing', icon: 'card' }]
  },
  {
    heading: 'Support',
    items: [{ href: '/brand/settings', label: 'Settings', icon: 'gear' }]
  }
];

export const CREATOR_NAV: NavGroup[] = [
  {
    heading: 'General',
    items: [
      { href: '/creator/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/creator/offers', label: 'Offers', icon: 'inbox' },
      { href: '/creator/messenger', label: 'Messenger', icon: 'chat' }
    ]
  },
  {
    heading: 'Earnings',
    items: [{ href: '/creator/payouts', label: 'Payouts', icon: 'wallet' }]
  }
];

export function Sidebar({
  groups,
  name,
  sub,
  glyph,
  side,
  account
}: {
  groups: NavGroup[];
  name: string;
  sub: string;
  glyph: string;
  side: 'brand' | 'creator';
  account: { label: string; initials: string };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch(`/bff/${side}/logout`, { method: 'POST', credentials: 'include' });
    router.push('/');
    router.refresh();
  }

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

      <nav className="side-nav">
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
      </nav>

      <div className="side-foot">
        <div className="account">
          <span className="av sm">{account.initials}</span>
          <span className="account-id" title={account.label}>
            {account.label}
          </span>
          <button type="button" className="account-out" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
