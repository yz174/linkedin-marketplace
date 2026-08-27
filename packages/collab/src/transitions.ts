import {
  MAX_COUNTER_ROUNDS,
  TERMINAL_STATES,
  type Actor,
  type CollabEvent,
  type CollabState,
  type Effect
} from '@lm/contracts';

export type Collaboration = {
  state: CollabState;
  counterRounds: number;
  trackedLink: string | null;
  postUrl: string | null;
  lastCounterBy: Actor | null;
};

export type Move = {
  event: CollabEvent;
  actor: Actor;
  postUrl?: string | null;
};

export type Refusal =
  | 'illegal_transition'
  | 'wrong_actor'
  | 'cannot_accept_own_counter'
  | 'counter_rounds_exhausted'
  | 'tracked_link_missing'
  | 'post_url_missing'
  | 'already_terminal';

export type Outcome =
  | {
      ok: true;
      to: CollabState;
      effects: Effect[];
      counterRounds: number;
      lastCounterBy: Actor | null;
    }
  | { ok: false; reason: Refusal; message: string };

type Rule = {
  from: CollabState;
  event: CollabEvent;
  actors: readonly Actor[];
  to: CollabState;
  effects?: Effect[];
};

const RULES: readonly Rule[] = [
  { from: 'invited', event: 'accept', actors: ['creator'], to: 'accepted', effects: ['hold_escrow', 'count_acceptance'] },
  { from: 'invited', event: 'decline', actors: ['creator'], to: 'declined' },
  { from: 'invited', event: 'counter', actors: ['creator'], to: 'countered' },
  { from: 'invited', event: 'expire', actors: ['system'], to: 'expired' },

  { from: 'countered', event: 'accept', actors: ['brand', 'creator'], to: 'accepted', effects: ['hold_escrow', 'count_acceptance'] },
  { from: 'countered', event: 'decline', actors: ['brand', 'creator'], to: 'declined' },
  { from: 'countered', event: 'counter', actors: ['brand', 'creator'], to: 'countered' },
  { from: 'countered', event: 'expire', actors: ['system'], to: 'expired' },

  { from: 'accepted', event: 'share_brief', actors: ['brand'], to: 'brief_shared' },
  { from: 'brief_shared', event: 'submit_draft', actors: ['creator'], to: 'draft_submitted' },

  { from: 'draft_submitted', event: 'approve', actors: ['brand'], to: 'draft_approved', effects: ['mint_tracked_link'] },
  { from: 'draft_submitted', event: 'request_revision', actors: ['brand'], to: 'revision_requested' },
  { from: 'revision_requested', event: 'submit_draft', actors: ['creator'], to: 'draft_submitted' },

  { from: 'draft_approved', event: 'schedule', actors: ['creator'], to: 'scheduled' },
  { from: 'scheduled', event: 'publish', actors: ['creator'], to: 'published' },
  { from: 'published', event: 'verify', actors: ['system'], to: 'verified', effects: ['count_delivery'] },
  { from: 'verified', event: 'pay', actors: ['system'], to: 'paid', effects: ['release_escrow'] }
];

const ESCROW_HELD_FROM: readonly CollabState[] = [
  'accepted',
  'brief_shared',
  'draft_submitted',
  'revision_requested',
  'draft_approved',
  'scheduled',
  'published'
];

export function isTerminal(state: CollabState) {
  return TERMINAL_STATES.includes(state);
}

export function allowedEvents(collab: Collaboration, actor: Actor): CollabEvent[] {
  const events = RULES.filter(
    (rule) => rule.from === collab.state && rule.actors.includes(actor)
  ).map((rule) => rule.event);

  if (!isTerminal(collab.state) && actor !== 'system') events.push('cancel');

  return [...new Set(events)].filter(
    (event) => transition(collab, { event, actor, postUrl: collab.postUrl }).ok
  );
}

export function transition(collab: Collaboration, move: Move): Outcome {
  if (isTerminal(collab.state)) {
    return refuse('already_terminal', `This assignment is ${collab.state} and cannot change.`);
  }

  if (move.event === 'cancel') {
    if (move.actor === 'system') {
      return refuse('wrong_actor', 'Only a brand or a creator can cancel.');
    }
    const effects: Effect[] = ESCROW_HELD_FROM.includes(collab.state) ? ['refund_escrow'] : [];
    return {
      ok: true,
      to: 'cancelled',
      effects,
      counterRounds: collab.counterRounds,
      lastCounterBy: collab.lastCounterBy
    };
  }

  const forState = RULES.filter((rule) => rule.from === collab.state && rule.event === move.event);

  if (forState.length === 0) {
    return refuse(
      'illegal_transition',
      `Cannot ${move.event} an assignment that is ${collab.state}.`
    );
  }

  const rule = forState.find((candidate) => candidate.actors.includes(move.actor));
  if (!rule) {
    return refuse(
      'wrong_actor',
      `A ${move.actor} cannot ${move.event} an assignment that is ${collab.state}.`
    );
  }

  if (
    move.event === 'accept' &&
    collab.state === 'countered' &&
    collab.lastCounterBy === move.actor
  ) {
    return refuse(
      'cannot_accept_own_counter',
      'You made the last offer. The other side has to answer it.'
    );
  }

  if (move.event === 'counter' && collab.counterRounds >= MAX_COUNTER_ROUNDS) {
    return refuse(
      'counter_rounds_exhausted',
      `Negotiation is capped at ${MAX_COUNTER_ROUNDS} rounds. Accept or decline.`
    );
  }

  if (move.event === 'publish') {
    if (!collab.trackedLink) {
      return refuse(
        'tracked_link_missing',
        'A post cannot be marked published without its tracked link.'
      );
    }
    if (!move.postUrl) {
      return refuse('post_url_missing', 'Publishing needs the URL of the live post.');
    }
  }

  return {
    ok: true,
    to: rule.to,
    effects: rule.effects ?? [],
    counterRounds: move.event === 'counter' ? collab.counterRounds + 1 : collab.counterRounds,
    lastCounterBy: move.event === 'counter' ? move.actor : collab.lastCounterBy
  };
}

function refuse(reason: Refusal, message: string): Outcome {
  return { ok: false, reason, message };
}
