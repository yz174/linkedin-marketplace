import { redirect } from 'next/navigation';

export default async function CreatorLogin({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/?role=creator${next ? `&next=${encodeURIComponent(next)}` : ''}`);
}
