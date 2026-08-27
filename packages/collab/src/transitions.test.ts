import { expect, test } from 'bun:test';
import {
  COLLAB_EVENTS,
  COLLAB_STATES,
  MAX_COUNTER_ROUNDS,
  TERMINAL_STATES,
  type Actor,
  type CollabEvent,
  type CollabState
} from '@lm/contracts';
import { allowedEvents, isTerminal, transition, type Collaboration } from './transitions';

const at = (state: CollabState, over: Partial<Collaboration> = {}): Collaboration => ({
  state,
  counterRounds: 0,
  trackedLink: null,
  postUrl: null,
  lastCounterBy: null,
  ...over
});

const ACTORS: Actor[] = ['brand', 'creator', 'system'];

test('the happy path runs invited to paid', () => {
  let collab = at('invited');
  const path: [Parameters<typeof transition>[1], CollabState][] = [
    [{ event: 'accept', actor: 'creator' }, 'accepted'],
    [{ event: 'share_brief', actor: 'brand' }, 'brief_shared'],
    [{ event: 'submit_draft', actor: 'creator' }, 'draft_submitted'],
    [{ event: 'approve', actor: 'brand' }, 'draft_approved'],
    [{ event: 'schedule', actor: 'creator' }, 'scheduled'],
    [{ event: 'publish', actor: 'creator', postUrl: 'https://x/post' }, 'published'],
    [{ event: 'verify', actor: 'system' }, 'verified'],
    [{ event: 'pay', actor: 'system' }, 'paid']
  ];

  for (const [move, expected] of path) {
    const result = transition(collab, move);
    if (!result.ok) throw new Error(`${move.event} refused: ${result.message}`);
    expect(result.to).toBe(expected);
    collab = at(result.to, {
      counterRounds: result.counterRounds,
      trackedLink: result.effects.includes('mint_tracked_link') ? 'lpwk.co/a1' : collab.trackedLink,
      postUrl: move.postUrl ?? collab.postUrl
    });
  }

  expect(collab.state).toBe('paid');
});

test('approving mints the tracked link', () => {
  const result = transition(at('draft_submitted'), { event: 'approve', actor: 'brand' });
  expect(result.ok && result.effects).toContain('mint_tracked_link');
});

test('publishing without a tracked link is refused', () => {
  const result = transition(at('scheduled'), {
    event: 'publish',
    actor: 'creator',
    postUrl: 'https://x/post'
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.reason).toBe('tracked_link_missing');
});

test('publishing without a post url is refused', () => {
  const result = transition(at('scheduled', { trackedLink: 'lpwk.co/a1' }), {
    event: 'publish',
    actor: 'creator'
  });
  expect(!result.ok && result.reason).toBe('post_url_missing');
});

test('published is unreachable from every state without going through approve', () => {
  for (const state of COLLAB_STATES) {
    if (state === 'scheduled') continue;
    const result = transition(at(state, { trackedLink: 'lpwk.co/a1' }), {
      event: 'publish',
      actor: 'creator',
      postUrl: 'https://x/post'
    });
    expect(result.ok).toBe(false);
  }
});

test('counter rounds are capped', () => {
  let collab = at('invited');
  for (let round = 0; round < MAX_COUNTER_ROUNDS; round += 1) {
    const actor: Actor = round % 2 === 0 ? 'creator' : 'brand';
    const result = transition(collab, { event: 'counter', actor });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    collab = at(result.to, {
      counterRounds: result.counterRounds,
      lastCounterBy: result.lastCounterBy
    });
  }

  expect(collab.counterRounds).toBe(MAX_COUNTER_ROUNDS);
  const blocked = transition(collab, { event: 'counter', actor: 'brand' });
  expect(!blocked.ok && blocked.reason).toBe('counter_rounds_exhausted');
});

test('nobody can accept their own counter', () => {
  const creatorCountered = at('countered', { counterRounds: 1, lastCounterBy: 'creator' });
  const self = transition(creatorCountered, { event: 'accept', actor: 'creator' });
  expect(!self.ok && self.reason).toBe('cannot_accept_own_counter');

  const other = transition(creatorCountered, { event: 'accept', actor: 'brand' });
  expect(other.ok).toBe(true);
});

test('accepting your own counter stays blocked after the cap', () => {
  const capped = at('countered', { counterRounds: MAX_COUNTER_ROUNDS, lastCounterBy: 'brand' });
  expect(transition(capped, { event: 'accept', actor: 'brand' }).ok).toBe(false);
  expect(transition(capped, { event: 'accept', actor: 'creator' }).ok).toBe(true);
});

test('a capped negotiation can still be accepted or declined', () => {
  const exhausted = at('countered', { counterRounds: MAX_COUNTER_ROUNDS, lastCounterBy: 'creator' });
  expect(transition(exhausted, { event: 'accept', actor: 'brand' }).ok).toBe(true);
  expect(transition(exhausted, { event: 'decline', actor: 'brand' }).ok).toBe(true);
});

test('a brand cannot accept its own invitation', () => {
  const result = transition(at('invited'), { event: 'accept', actor: 'brand' });
  expect(!result.ok && result.reason).toBe('wrong_actor');
});

test('a creator cannot approve their own draft', () => {
  const result = transition(at('draft_submitted'), { event: 'approve', actor: 'creator' });
  expect(!result.ok && result.reason).toBe('wrong_actor');
});

test('a creator cannot share the brief', () => {
  const result = transition(at('accepted'), { event: 'share_brief', actor: 'creator' });
  expect(!result.ok && result.reason).toBe('wrong_actor');
});

test('revision loops back and can repeat', () => {
  const first = transition(at('draft_submitted'), { event: 'request_revision', actor: 'brand' });
  expect(first.ok && first.to).toBe('revision_requested');

  const again = transition(at('revision_requested'), { event: 'submit_draft', actor: 'creator' });
  expect(again.ok && again.to).toBe('draft_submitted');
});

test('cancelling refunds escrow only once it is held', () => {
  const beforeHold = transition(at('invited'), { event: 'cancel', actor: 'brand' });
  expect(beforeHold.ok && beforeHold.effects).toEqual([]);

  const afterHold = transition(at('draft_approved'), { event: 'cancel', actor: 'brand' });
  expect(afterHold.ok && afterHold.effects).toContain('refund_escrow');
});

test('the system cannot cancel', () => {
  const result = transition(at('accepted'), { event: 'cancel', actor: 'system' });
  expect(!result.ok && result.reason).toBe('wrong_actor');
});

test('terminal states refuse everything', () => {
  for (const state of TERMINAL_STATES) {
    expect(isTerminal(state)).toBe(true);
    for (const event of COLLAB_EVENTS) {
      for (const actor of ACTORS) {
        const result = transition(at(state, { trackedLink: 'x', postUrl: 'y' }), { event, actor });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('already_terminal');
      }
    }
  }
});

test('acceptance holds escrow and counts toward the delivery record', () => {
  const result = transition(at('invited'), { event: 'accept', actor: 'creator' });
  expect(result.ok && result.effects).toEqual(['hold_escrow', 'count_acceptance']);
});

test('verification counts the delivery and payment releases escrow', () => {
  const verified = transition(at('published', { trackedLink: 'x', postUrl: 'y' }), {
    event: 'verify',
    actor: 'system'
  });
  expect(verified.ok && verified.effects).toContain('count_delivery');

  const paid = transition(at('verified'), { event: 'pay', actor: 'system' });
  expect(paid.ok && paid.effects).toContain('release_escrow');
});

test('every state and event pair either transitions or refuses with a reason', () => {
  for (const state of COLLAB_STATES) {
    for (const event of COLLAB_EVENTS) {
      for (const actor of ACTORS) {
        const result = transition(at(state, { trackedLink: 'x', postUrl: 'y' }), { event, actor });
        if (result.ok) {
          expect(COLLAB_STATES).toContain(result.to);
        } else {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }
    }
  }
});

test('no rule ever transitions a state to itself except countering', () => {
  for (const state of COLLAB_STATES) {
    for (const event of COLLAB_EVENTS) {
      for (const actor of ACTORS) {
        const result = transition(at(state, { trackedLink: 'x', postUrl: 'y' }), { event, actor });
        if (result.ok && result.to === state) expect(event).toBe('counter');
      }
    }
  }
});

test('allowedEvents reflects what the actor can actually do', () => {
  const forCreator: CollabEvent[] = ['accept', 'cancel', 'counter', 'decline'];
  expect(allowedEvents(at('invited'), 'creator').sort()).toEqual(forCreator.sort());
  expect(allowedEvents(at('invited'), 'brand')).toEqual(['cancel']);
  expect(allowedEvents(at('paid'), 'brand')).toEqual([]);
});

test('allowedEvents hides countering once the cap is reached', () => {
  const exhausted = at('countered', { counterRounds: MAX_COUNTER_ROUNDS });
  expect(allowedEvents(exhausted, 'brand')).not.toContain('counter');
  expect(allowedEvents(exhausted, 'brand')).toContain('accept');
});

test('allowedEvents hides publish until a tracked link exists', () => {
  expect(allowedEvents(at('scheduled'), 'creator')).not.toContain('publish');
  expect(
    allowedEvents(at('scheduled', { trackedLink: 'x', postUrl: 'y' }), 'creator')
  ).toContain('publish');
});

test('an accepted assignment that never publishes expires and refunds the hold', () => {
  const accepted = { state: 'accepted', counterRounds: 1, trackedLink: null, postUrl: null, lastCounterBy: null } as const;
  const outcome = transition(accepted, { event: 'expire', actor: 'system' });

  expect(outcome.ok).toBe(true);
  expect(outcome.ok && outcome.to).toBe('expired');
  expect(outcome.ok && outcome.effects).toContain('refund_escrow');
});

test('an unanswered invitation expires without a refund, because nothing was held', () => {
  const invited = { state: 'invited', counterRounds: 0, trackedLink: null, postUrl: null, lastCounterBy: null } as const;
  const outcome = transition(invited, { event: 'expire', actor: 'system' });

  expect(outcome.ok).toBe(true);
  expect(outcome.ok && outcome.to).toBe('expired');
  expect(outcome.ok && outcome.effects).toEqual([]);
});

test('a published post is past the clock and cannot be expired', () => {
  const published = { state: 'published', counterRounds: 0, trackedLink: 'lpwk.co/x', postUrl: 'https://x.test/p', lastCounterBy: null } as const;
  const outcome = transition(published, { event: 'expire', actor: 'system' });

  expect(outcome.ok).toBe(false);
});

test('only the system expires an assignment', () => {
  const accepted = { state: 'accepted', counterRounds: 0, trackedLink: null, postUrl: null, lastCounterBy: null } as const;

  expect(transition(accepted, { event: 'expire', actor: 'brand' }).ok).toBe(false);
  expect(transition(accepted, { event: 'expire', actor: 'creator' }).ok).toBe(false);
});

test('expire never appears as a button for either side', () => {
  const accepted = { state: 'accepted', counterRounds: 0, trackedLink: null, postUrl: null, lastCounterBy: null } as const;

  expect(allowedEvents(accepted, 'brand')).not.toContain('expire');
  expect(allowedEvents(accepted, 'creator')).not.toContain('expire');
});
