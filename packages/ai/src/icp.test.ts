import { expect, test } from 'bun:test';
import { clamp } from './icp';

test('clamp leaves a short string untouched', () => {
  expect(clamp('Sells payroll software to SMB finance teams.', 600)).toBe(
    'Sells payroll software to SMB finance teams.'
  );
});

test('clamp trims a long summary to a sentence boundary under the limit', () => {
  const long =
    'Sells contract lifecycle management to mid-market legal teams. ' +
    'Buyers are general counsel and legal ops leads at companies of 200 to 2000 staff. ' +
    'The wedge is redlining speed and an audit trail regulators accept. ' +
    'Expansion runs through procurement once legal has adopted it.';
  const out = clamp(long, 100);
  expect(out.length).toBeLessThanOrEqual(100);
  expect(out.endsWith('.')).toBe(true);
  expect(out).toBe('Sells contract lifecycle management to mid-market legal teams.');
});

test('clamp falls back to a word boundary when no sentence end is near', () => {
  const noStops = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
  const out = clamp(noStops, 30);
  expect(out.length).toBeLessThanOrEqual(30);
  expect(out.endsWith(' ')).toBe(false);
  expect(noStops.startsWith(out)).toBe(true);
});

test('clamp result stays well above the contract minimums', () => {
  const summary = 'x'.repeat(5000);
  expect(clamp(summary, 600).length).toBeGreaterThan(20);
  const title = 'y'.repeat(400);
  expect(clamp(title, 80).length).toBeGreaterThan(2);
});
