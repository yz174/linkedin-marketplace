import { CREATOR_NAV, Sidebar } from '@/components/shell';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell with-rail">
      <Sidebar groups={CREATOR_NAV} name="Your profile" sub="Contributor" glyph="C" />
      <div className="main">{children}</div>
    </div>
  );
}
