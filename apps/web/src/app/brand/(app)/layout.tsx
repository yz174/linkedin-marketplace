import { BRAND_NAV, Sidebar } from '@/components/shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar groups={BRAND_NAV} name="Loopwork" sub="Workspace" glyph="L" />
      <div className="main">{children}</div>
    </div>
  );
}
