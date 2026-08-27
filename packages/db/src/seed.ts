import { embedDocument } from '@lm/ai';
import type { Sector } from '@lm/contracts';
import { like } from 'drizzle-orm';
import { createDb, createPool } from './client';
import { creators, users } from './schema';

type SeedCreator = {
  name: string;
  topics: [Sector, ...Sector[]];
  followers: number;
  engagementRate: number | null;
  postsPerWeek: number;
  rate: number;
  accepted: number;
  delivered: number;
  corpus: string;
};

const SEED: SeedCreator[] = [
  { name: 'Priya Raghunathan', corpus: 'Territory design, comp plans, and why your revenue forecast is wrong. Quota attainment is a lagging indicator of how long a rep waits for an answer.', topics: ['RevOps', 'Sales', 'B2B SaaS'], followers: 8412, engagementRate: 0.072, postsPerWeek: 2.4, rate: 34000, accepted: 18, delivered: 17 },
  { name: 'Léa Fontaine', corpus: 'Lifecycle marketing and attribution. Last touch survives because it is the only model nobody has to defend in a meeting.', topics: ['MarTech', 'B2B SaaS'], followers: 6890, engagementRate: 0.083, postsPerWeek: 2.7, rate: 28000, accepted: 25, delivered: 24 },
  { name: 'Rachel Osei', corpus: 'Talent operations and sourcing at small companies. A take-home test asks a candidate to fund your evaluation process with their weekend.', topics: ['Recruiting', 'HR Tech'], followers: 9760, engagementRate: 0.078, postsPerWeek: 2.9, rate: 37000, accepted: 20, delivered: 19 },
  { name: 'Amara Boateng', corpus: 'Hiring process design, interview scorecards, and the cost of a slow loop. A four week interview loop is a signal that nobody owns the decision.', topics: ['HR Tech', 'Recruiting'], followers: 5180, engagementRate: 0.091, postsPerWeek: 3.1, rate: 21000, accepted: 30, delivered: 29 },
  { name: 'Elias Nordmark', corpus: 'Compensation bands, levelling frameworks, and the arithmetic behind equity offers. A framework nobody can apply without asking HR is a queue.', topics: ['HR Tech'], followers: 2050, engagementRate: 0.126, postsPerWeek: 1.9, rate: 12000, accepted: 0, delivered: 0 },
  { name: 'Tomás Lindqvist', corpus: 'Developer tooling and the parts that break in production. Every build system eventually grows a plugin API and stops being a build system.', topics: ['DevTools', 'B2B SaaS'], followers: 14207, engagementRate: 0.048, postsPerWeek: 1.8, rate: 52000, accepted: 25, delivered: 22 },
  { name: 'Marcus Ferreira', corpus: 'Outbound that is not spam. Call breakdowns, objection handling, and why the eighth message is the one that finally said something.', topics: ['Sales'], followers: 4220, engagementRate: 0.104, postsPerWeek: 4, rate: 18000, accepted: 42, delivered: 41 },
  { name: 'Chidi Okonkwo', corpus: 'Detection engineering and incident write-ups. Your coverage number measures how many rules you wrote, not how much you can see.', topics: ['Cybersecurity'], followers: 11650, engagementRate: 0.056, postsPerWeek: 2, rate: 43000, accepted: 22, delivered: 20 },
  { name: 'Sana Qureshi', corpus: 'Data platform work and evaluation methodology. A benchmark you cannot reproduce is a press release with a table in it.', topics: ['Data and AI'], followers: 19320, engagementRate: 0.039, postsPerWeek: 1.4, rate: 61000, accepted: 18, delivered: 15 },
  { name: 'Hana Sato', corpus: 'Product design critique and design systems that survive contact with engineering. Four hundred components is a codebase with a Figma file attached.', topics: ['Design'], followers: 22480, engagementRate: 0.062, postsPerWeek: 1.6, rate: 59000, accepted: 20, delivered: 18 },
  { name: 'Dmitri Alvarez', corpus: 'Freight operations and warehouse throughput. Your ETA is a promise made by a system that has never met a customs office.', topics: ['Logistics'], followers: 3140, engagementRate: 0.112, postsPerWeek: 2.2, rate: 15000, accepted: 12, delivered: 11 },
  { name: 'Jonas Weill', corpus: 'Payments infrastructure and interchange economics. Settlement timing is where fintech margins actually live.', topics: ['FinTech'], followers: 31940, engagementRate: 0.021, postsPerWeek: 0.9, rate: 78000, accepted: 14, delivered: 10 },
  { name: 'Nadia Haddad', corpus: 'Factory floor operations, throughput constraints, and why your OEE number flatters the bottleneck you refuse to look at.', topics: ['Manufacturing'], followers: 7300, engagementRate: 0.058, postsPerWeek: 1.5, rate: 26000, accepted: 9, delivered: 8 },
  { name: 'Tobias Lund', corpus: 'Game studio production, live ops cadence, and why a roadmap survives exactly one playtest.', topics: ['Gaming'], followers: 26800, engagementRate: 0.067, postsPerWeek: 3.4, rate: 64000, accepted: 16, delivered: 14 }
];

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '-');

const pool = createPool();
const db = createDb(pool);

try {
  await db.delete(users).where(like(users.email, '%@seed.test'));

  for (const entry of SEED) {
    const id = crypto.randomUUID();
    const handle = slug(entry.name);

    await db.insert(users).values({
      id,
      name: entry.name,
      email: `${handle}@seed.test`,
      accountType: 'creator'
    });

    const embedding = await embedDocument(entry.corpus);

    await db.insert(creators).values({
      userId: id,
      profileUrl: `https://www.linkedin.com/in/${handle}`,
      name: entry.name,
      headline: entry.topics.join(', '),
      bio: '',
      topics: entry.topics,
      ratePerPostMinor: entry.rate,
      followers: entry.followers,
      engagementRate: entry.engagementRate,
      postsPerWeek: entry.postsPerWeek,
      acceptedCount: entry.accepted,
      deliveredCount: entry.delivered,
      fingerprintEmbedding: embedding
    });
  }

  console.log(`seeded ${SEED.length} creators`);
} finally {
  await pool.end();
}
