import { ACCOUNT_TYPES, COLLAB_EVENTS, COLLAB_STATES, MEMBER_ROLES, SECTORS } from '@lm/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const EMBEDDING_DIMS = 768;

const citext = customType<{ data: string }>({
  dataType: () => 'citext'
});

const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => `vector(${EMBEDDING_DIMS})`,
  toDriver: (value) => `[${value.join(',')}]`,
  fromDriver: (value) => JSON.parse(value) as number[]
});

export const accountType = pgEnum('account_type', ACCOUNT_TYPES);
export const sector = pgEnum('sector', SECTORS);
export const memberRole = pgEnum('member_role', MEMBER_ROLES);
export const collabState = pgEnum('collab_state', COLLAB_STATES);
export const collabEvent = pgEnum('collab_event', COLLAB_EVENTS);
export const actorKind = pgEnum('actor_kind', ['brand', 'creator', 'system']);
export const campaignSource = pgEnum('campaign_source', ['ai', 'url', 'document']);
export const walletOwner = pgEnum('wallet_owner', ['workspace', 'creator', 'escrow', 'platform']);
export const ledgerKind = pgEnum('ledger_kind', [
  'topup',
  'hold',
  'release',
  'refund',
  'withdraw'
]);
export const holdState = pgEnum('hold_state', ['held', 'released', 'refunded']);

export const users = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: citext('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    accountType: accountType('account_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('user_email_key').on(t.email)]
);

export const sessions = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('session_token_key').on(t.token), index('session_user_idx').on(t.userId)]
);

export const accounts = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    issuer: text('issuer').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('account_user_idx').on(t.userId)]
);

export const verifications = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)]
);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('workspace_members_key').on(t.workspaceId, t.userId)]
);

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: citext('email').notNull(),
    role: memberRole('role').notNull().default('member'),
    invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('workspace_invites_workspace_idx').on(t.workspaceId, t.createdAt),
    uniqueIndex('workspace_invites_pending_key')
      .on(t.workspaceId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    check('workspace_invites_role_not_owner', sql`${t.role} <> 'owner'`)
  ]
);

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    productUrl: text('product_url').notNull(),
    icpSummary: text('icp_summary').notNull(),
    icpPoints: jsonb('icp_points').$type<string[]>().notNull(),
    buyerTitles: jsonb('buyer_titles').$type<string[]>().notNull().default([]),
    sectors: sector('sectors').array().notNull(),
    icpEmbedding: vector('icp_embedding'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('brands_workspace_key').on(t.workspaceId),
    check('brands_sectors_len', sql`cardinality(${t.sectors}) between 1 and 3`)
  ]
);

export const creators = pgTable(
  'creators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contributorNumber: integer('contributor_number').generatedAlwaysAsIdentity({ startWith: 100 }),
    profileUrl: text('profile_url').notNull(),
    name: text('name').notNull(),
    headline: text('headline').notNull().default(''),
    bio: text('bio').notNull().default(''),
    photoUrl: text('photo_url'),
    topics: sector('topics').array().notNull(),
    ratePerPostMinor: bigint('rate_per_post_minor', { mode: 'number' }).notNull(),
    followers: integer('followers').notNull().default(0),
    engagementRate: real('engagement_rate'),
    postsPerWeek: real('posts_per_week').notNull().default(0),
    acceptedCount: integer('accepted_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    openSlots: integer('open_slots').notNull().default(2),
    fingerprintEmbedding: vector('fingerprint_embedding'),
    listed: boolean('listed').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('creators_user_key').on(t.userId),
    uniqueIndex('creators_profile_url_key').on(t.profileUrl),
    index('creators_topics_idx').using('gin', t.topics),
    check('creators_topics_len', sql`cardinality(${t.topics}) between 1 and 3`),
    check('creators_rate_nonneg', sql`${t.ratePerPostMinor} >= 0`),
    check('creators_delivered_lte_accepted', sql`${t.deliveredCount} <= ${t.acceptedCount}`)
  ]
);

export const linkedinSnapshots = pgTable(
  'linkedin_profile_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileUrl: text('profile_url').notNull(),
    provider: text('provider').notNull(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('linkedin_snapshots_url_idx').on(t.profileUrl, t.fetchedAt)]
);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    objective: text('objective').notNull(),
    keyMessages: jsonb('key_messages').$type<string[]>().notNull().default([]),
    doNot: jsonb('do_not').$type<string[]>().notNull().default([]),
    deliverable: text('deliverable').notNull(),
    budgetMinMinor: bigint('budget_min_minor', { mode: 'number' }).notNull(),
    budgetMaxMinor: bigint('budget_max_minor', { mode: 'number' }).notNull(),
    source: campaignSource('source').notNull(),
    sourceRef: text('source_ref'),
    landingUrl: text('landing_url').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('campaigns_brand_idx').on(t.brandId),
    check('campaigns_budget_order', sql`${t.budgetMinMinor} <= ${t.budgetMaxMinor}`)
  ]
);

export const collaborations = pgTable(
  'collaborations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    state: collabState('state').notNull().default('invited'),
    feeMinor: bigint('fee_minor', { mode: 'number' }).notNull(),
    counterFeeMinor: bigint('counter_fee_minor', { mode: 'number' }),
    counterRounds: integer('counter_rounds').notNull().default(0),
    lastCounterBy: actorKind('last_counter_by'),
    messageSeq: bigint('message_seq', { mode: 'number' }).notNull().default(0),
    trackedLink: text('tracked_link'),
    postUrl: text('post_url'),
    draft: text('draft'),
    publishBy: timestamp('publish_by', { withTimezone: true }),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('collaborations_reference_key').on(t.reference),
    uniqueIndex('collaborations_campaign_creator_key').on(t.campaignId, t.creatorId),
    index('collaborations_creator_idx').on(t.creatorId, t.state),
    check('collaborations_fee_nonneg', sql`${t.feeMinor} >= 0`),
    check('collaborations_rounds_capped', sql`${t.counterRounds} between 0 and 3`),
    check(
      'collaborations_published_needs_link',
      sql`${t.state} not in ('published', 'verified', 'paid') or ${t.trackedLink} is not null`
    )
  ]
);

export const collaborationEvents = pgTable(
  'collaboration_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collaborationId: uuid('collaboration_id')
      .notNull()
      .references(() => collaborations.id, { onDelete: 'cascade' }),
    event: collabEvent('event').notNull(),
    actor: actorKind('actor').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    fromState: collabState('from_state').notNull(),
    toState: collabState('to_state').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('collaboration_events_collab_idx').on(t.collaborationId, t.createdAt)]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey(),
    collaborationId: uuid('collaboration_id')
      .notNull()
      .references(() => collaborations.id, { onDelete: 'cascade' }),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    sender: actorKind('sender').notNull(),
    senderUserId: text('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('messages_collab_seq_key').on(t.collaborationId, t.seq),
    index('messages_collab_seq_idx').on(t.collaborationId, t.seq),
    check('messages_seq_positive', sql`${t.seq} > 0`),
    check('messages_body_length', sql`char_length(${t.body}) between 1 and 4000`)
  ]
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner: walletOwner('owner').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'cascade' }),
    balanceMinor: bigint('balance_minor', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('wallets_workspace_key').on(t.workspaceId),
    uniqueIndex('wallets_creator_key').on(t.creatorId),
    uniqueIndex('wallets_singleton_key')
      .on(t.owner)
      .where(sql`${t.owner} in ('escrow', 'platform')`),
    check(
      'wallets_owner_matches_column',
      sql`(${t.owner} = 'workspace' and ${t.workspaceId} is not null and ${t.creatorId} is null)
       or (${t.owner} = 'creator' and ${t.creatorId} is not null and ${t.workspaceId} is null)
       or (${t.owner} in ('escrow', 'platform') and ${t.workspaceId} is null and ${t.creatorId} is null)`
    ),
    check(
      'wallets_only_platform_goes_negative',
      sql`${t.owner} = 'platform' or ${t.balanceMinor} >= 0`
    )
  ]
);

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryGroup: uuid('entry_group').notNull(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    kind: ledgerKind('kind').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    collaborationId: uuid('collaboration_id').references(() => collaborations.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('ledger_entries_group_idx').on(t.entryGroup),
    index('ledger_entries_wallet_idx').on(t.walletId, t.createdAt),
    uniqueIndex('ledger_entries_group_wallet_key').on(t.entryGroup, t.walletId),
    check('ledger_entries_never_zero', sql`${t.amountMinor} <> 0`)
  ]
);

export const escrowHolds = pgTable(
  'escrow_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collaborationId: uuid('collaboration_id')
      .notNull()
      .references(() => collaborations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    state: holdState('state').notNull().default('held'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp('settled_at', { withTimezone: true })
  },
  (t) => [
    uniqueIndex('escrow_holds_collab_key').on(t.collaborationId),
    index('escrow_holds_open_idx').on(t.state, t.workspaceId),
    check('escrow_holds_amount_positive', sql`${t.amountMinor} > 0`),
    check(
      'escrow_holds_settled_has_time',
      sql`${t.state} = 'held' or ${t.settledAt} is not null`
    )
  ]
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code').notNull(),
    responseBody: jsonb('response_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('idempotency_keys_user_idx').on(t.userId, t.createdAt)]
);

export const linkClicks = pgTable(
  'link_clicks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collaborationId: uuid('collaboration_id')
      .notNull()
      .references(() => collaborations.id, { onDelete: 'cascade' }),
    visitorHash: text('visitor_hash').notNull(),
    clickedOn: date('clicked_on').notNull(),
    hits: integer('hits').notNull().default(1),
    firstAt: timestamp('first_at', { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp('last_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('link_clicks_visitor_day_key').on(t.collaborationId, t.visitorHash, t.clickedOn),
    index('link_clicks_collab_idx').on(t.collaborationId, t.clickedOn),
    check('link_clicks_hits_positive', sql`${t.hits} > 0`)
  ]
);
