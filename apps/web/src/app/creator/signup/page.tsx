import { redirect } from 'next/navigation';

export default async function CreatorSignup({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/?role=creator&mode=signup${next ? `&next=${encodeURIComponent(next)}` : ''}`);
}
