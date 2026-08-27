export function money(minor: number) {
  return `€${(minor / 100).toLocaleString('en-IE', { maximumFractionDigits: 0 })}`;
}

export function count(value: number) {
  return value.toLocaleString('en-IE');
}

export function percent(value: number | null, digits = 1) {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
