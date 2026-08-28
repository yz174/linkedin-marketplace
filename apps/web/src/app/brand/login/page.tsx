import { redirect } from 'next/navigation';

export default async function BrandLogin({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/?role=brand${next ? `&next=${encodeURIComponent(next)}` : ''}`);
}
