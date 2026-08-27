export function landingFrom(next: string | undefined, fallback: string) {
  return next?.startsWith('/brand/') || next?.startsWith('/creator/') ? next : fallback;
}
