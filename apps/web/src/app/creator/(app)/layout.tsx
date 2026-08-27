import { CREATOR_NAV, Sidebar } from '@/components/shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar groups={CREATOR_NAV} name="Your profile" sub="Contributor" glyph="C" />
      <div className="main">{children}</div>
    </div>
  );
}
