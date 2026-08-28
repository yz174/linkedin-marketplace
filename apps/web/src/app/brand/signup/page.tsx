import { redirect } from 'next/navigation';

export default async function BrandSignup({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/?role=brand&mode=signup${next ? `&next=${encodeURIComponent(next)}` : ''}`);
}
