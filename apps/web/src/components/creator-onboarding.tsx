'use client';

import { SECTORS, type Sector } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Fetched = {
  profile: { name: string; headline: string; about: string; followers: number };
  fingerprint: {
    engagementRate: number | null;
    postsPerWeek: number;
    postsSampled: number;
    postsWithEngagement: number;
  };
  provider: string;
};

const MAX_TOPICS = 3;

const BANDS = [
  { label: 'Under 5k followers', median: '€84', published: '30%' },
  { label: '5k to 25k followers', median: '€300', published: '64%' },
  { label: '25k to 50k followers', median: '€588', published: '65%' }
];

export function CreatorOnboarding() {
  const router = useRouter();

  const [profileUrl, setProfileUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [needsPaste, setNeedsPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [topics, setTopics] = useState<Sector[]>([]);
  const [rate, setRate] = useState('340');

  async function fetchProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch('/bff/creator/linkedin/fetch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ profileUrl, pastedProfile: pasted.trim() || undefined })
    });

    const payload = (await response.json().catch(() => null)) as
      | (Fetched & { message?: string })
      | null;

    setBusy(false);

    if (!response.ok || !payload) {
      setNeedsPaste(true);
      setError(
        payload?.message ??
          'Could not read that profile. Paste the text from your LinkedIn page instead.'
      );
      return;
    }

    setFetched(payload);
    setName(payload.profile.name);
    setHeadline(payload.profile.headline.slice(0, 300));
    setBio(payload.profile.about.slice(0, 600));
  }

  async function save() {
    setBusy(true);
    setError(null);

    const response = await fetch('/bff/creator/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        profileUrl,
        name,
        headline,
        bio,
        topics,
        ratePerPostMinor: Math.round(Number(rate) * 100)
      })
    });

    if (response.ok) {
      router.push('/creator/card');
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setError(payload?.message ?? 'Could not save that profile.');
    setBusy(false);
  }

  function toggleTopic(topic: Sector) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((t) => t !== topic)
        : current.length >= MAX_TOPICS
          ? current
          : [...current, topic]
    );
  }

  if (!fetched) {
    return (
      <div className="onb">
        <form className="onb-main" onSubmit={fetchProfile}>
          <span className="t-lbl">Step 1 of 2</span>
          <h1>One link, then you are in</h1>
          <p className="lede">
            No OAuth, no password, no app permissions. We read your public profile the same way
            anyone in an incognito window would, then you confirm every field.
          </p>

          {error ? <div className="alert">{error}</div> : null}

          <section className="onb-block">
            <label className="field">
              <span>Your LinkedIn profile</span>
              <input
                required
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/yourname"
              />
            </label>

            {needsPaste ? (
              <label className="field">
                <span>Paste your profile text</span>
                <textarea
                  className="area"
                  rows={7}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="Copy your headline, about section, and a few recent posts."
                />
              </label>
            ) : null}
          </section>

          {busy ? (
            <div className="reading">
              <span className="reading-bar">
                <i />
              </span>
              <span className="t-sm muted">Reading your profile and recent posts</span>
            </div>
          ) : (
            <div className="onb-actions">
              <button className="btn" type="submit">
                Read my profile
              </button>
            </div>
          )}
        </form>

        <aside className="onb-aside">
          <div className="card">
            <div className="card-head">
              <h3>What we never do</h3>
            </div>
            <div className="card-body">
              <p className="t-sm muted" style={{ lineHeight: 1.55 }}>
                We never ask for your login, we cannot post on your behalf, and we store nothing
                about your connections or messages. Only what is on your public profile and the text
                of your own posts.
              </p>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  const eng = fetched.fingerprint.engagementRate;

  return (
    <div className="onb">
      <div className="onb-main">
        <span className="t-lbl">Step 2 of 2</span>
        <h1>Check what came back</h1>
        <p className="lede">
          Engagement and cadence are computed from your posts, not typed in by you. That is why
          brands trust the number.
        </p>

        {error ? <div className="alert">{error}</div> : null}

        <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 'var(--s6)' }}>
          <Fig label="Followers" value={fetched.profile.followers.toLocaleString()} />
          <Fig label="Engagement" value={eng === null ? 'Unknown' : `${(eng * 100).toFixed(1)}%`} />
          <Fig label="Posts / week" value={String(fetched.fingerprint.postsPerWeek)} />
          <Fig label="Posts read" value={String(fetched.fingerprint.postsSampled)} />
        </div>

        {eng === null ? (
          <p className="note" style={{ marginTop: 'var(--s3)' }}>
            Engagement could not be measured from your recent posts. Your card will say so rather
            than show a made-up number, and it fills in after your first tracked campaign.
          </p>
        ) : null}

        <section className="onb-block">
          <h2>Your details</h2>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Headline</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </label>
          <label className="field">
            <span>How you describe your writing</span>
            <textarea className="area" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
        </section>

        <section className="onb-block">
          <h2>Topics</h2>
          <p className="hint">
            Brands pick from this same list. Pick what you actually write about, not what pays best.
            {' '}
            {topics.length} of {MAX_TOPICS} chosen.
          </p>
          <div className="chips">
            {SECTORS.map((topic) => (
              <button
                key={topic}
                type="button"
                className="chip"
                data-on={topics.includes(topic) ? '1' : undefined}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </section>

        <section className="onb-block">
          <h2>Your rate</h2>
          <label className="field" style={{ maxWidth: 200 }}>
            <span>Euros per sponsored post</span>
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" />
          </label>
          <table className="tbl">
            <thead>
              <tr>
                <th>Band</th>
                <th className="r">Median fee</th>
                <th className="r">Published rate</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((band) => (
                <tr key={band.label}>
                  <td>{band.label}</td>
                  <td className="r num">{band.median}</td>
                  <td className="r num">{band.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 'var(--s3)' }}>
            Posts under €200 get published about 30% of the time across the industry. Pricing low
            reads as low commitment, and it shows up in your delivery record.
          </p>
        </section>

        <div className="onb-actions">
          <button className="btn" onClick={save} disabled={busy || topics.length === 0 || !name}>
            {busy ? 'Saving…' : 'Build my card'}
          </button>
          <button className="btn ghost" type="button" onClick={() => setFetched(null)}>
            Back
          </button>
        </div>
      </div>

      <aside className="onb-aside">
        <div className="card">
          <div className="card-head">
            <h3>Where this came from</h3>
          </div>
          <div className="card-body">
            <div className="peek-row">
              <span className="k">Provider</span>
              <span className="v">{fetched.provider}</span>
            </div>
            <div className="peek-row">
              <span className="k">Posts sampled</span>
              <span className="v">{fetched.fingerprint.postsSampled}</span>
            </div>
            <div className="peek-row" style={{ borderBottom: 0 }}>
              <span className="k">With engagement</span>
              <span className="v">{fetched.fingerprint.postsWithEngagement}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="top">
        <span>{label}</span>
      </div>
      <div className="row">
        <span className="val">{value}</span>
      </div>
    </div>
  );
}
