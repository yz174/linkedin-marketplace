import { ACCOUNT_TYPES, SECTORS } from '@lm/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
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
export const memberRole = pgEnum('member_role', ['owner', 'admin', 'member']);

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
