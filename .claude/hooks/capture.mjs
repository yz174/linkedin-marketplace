#!/usr/bin/env node
// Appends one PROMPT or RESPONSE entry per turn to .agent-logs/<session>.md
// Wired in .claude/settings.json: UserPromptSubmit -> prompt, Stop -> response.
// Must print nothing on stdout: UserPromptSubmit stdout is injected as context.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODE = process.argv[2];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG_DIR = path.join(ROOT, '.agent-logs');
const AUTHOR = 'yz174';
const PROJECT = path.basename(ROOT);
const TOOL = 'claude-code';

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
    setTimeout(() => resolve(buf), 5000).unref?.();
  });
}

function readTranscript(p) {
  if (!p || !fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

function lastModel(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const m = entries[i]?.message;
    if (entries[i].type === 'assistant' && m?.model) return m.model;
  }
  return 'unknown';
}

// Real user prompt, not a tool_result carrier.
function isUserPrompt(e) {
  if (e.type !== 'user' || e.isSidechain) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && !c.some((b) => b?.type === 'tool_result');
}

// Final response = text blocks of the last assistant message in the current turn.
// Scanning stops at the last real user prompt so an aborted turn cannot
// resurrect text from an earlier one.
function finalResponse(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (isUserPrompt(e)) return null;
    if (e.type !== 'assistant' || e.isSidechain) continue;
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((b) => b?.type === 'text' && b.text?.trim())
      .map((b) => b.text)
      .join('\n');
    if (text.trim()) return { text: text.trim(), model: e.message?.model || 'unknown' };
  }
  return null;
}

function sessionFile(sessionId) {
  const existing = fs
    .readdirSync(LOG_DIR)
    .find((f) => f.endsWith(`_${sessionId}.md`));
  return existing ? path.join(LOG_DIR, existing) : null;
}

function createSessionFile(sessionId, iso, model) {
  const stamp = iso.slice(0, 19).replace('T', '_').replace(/:/g, '-');
  const file = path.join(LOG_DIR, `${stamp}_${sessionId}.md`);
  const head =
    `---\n` +
    `session_id: ${sessionId}\n` +
    `date: ${iso.slice(0, 10)}\n` +
    `author: ${AUTHOR}\n` +
    `model: ${model}\n` +
    `tool: ${TOOL}\n` +
    `project: ${PROJECT}\n` +
    `total_exchanges: 0\n` +
    `first_prompt_time: ${iso}\n` +
    `last_prompt_time: ${iso}\n` +
    `---\n\n` +
    `# Session Log - ${iso.slice(0, 10)}\n\n` +
    `Session: \`${sessionId.slice(0, 8)}\` | Project: \`${PROJECT}\` | Author: \`${AUTHOR}\`\n\n` +
    `---\n\n`;
  fs.writeFileSync(file, head, 'utf8');
  return file;
}

// Rewrites frontmatter counters only. Entries are never touched.
function bumpFrontmatter(file, iso, model) {
  const body = fs.readFileSync(file, 'utf8');
  const end = body.indexOf('\n---\n', 4);
  if (!body.startsWith('---\n') || end === -1) return;
  const fm = body.slice(4, end + 1);
  const rest = body.slice(end + 1);
  const prompts = (rest.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length;
  const next = fm
    .replace(/^total_exchanges: .*$/m, `total_exchanges: ${prompts}`)
    .replace(/^last_prompt_time: .*$/m, `last_prompt_time: ${iso}`)
    .replace(/^model: .*$/m, `model: ${model}`);
  fs.writeFileSync(file, `---\n${next}${rest}`, 'utf8');
}

function counts(file) {
  const s = fs.readFileSync(file, 'utf8');
  return {
    prompts: (s.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length,
    responses: (s.match(/^\[LOG_ENTRY type=RESPONSE /gm) || []).length,
  };
}

function append(file, type, num, sessionId, iso, model, text) {
  const entry =
    `[LOG_ENTRY type=${type} num=${num} session=${sessionId.slice(0, 8)}]\n` +
    `timestamp: ${iso}\n` +
    `model: ${model}\n\n` +
    `${text}\n\n\n`;
  fs.appendFileSync(file, entry, 'utf8');
}

const raw = await readStdin();
let p = {};
try { p = JSON.parse(raw); } catch { /* ignore */ }

const sessionId = p.session_id || p.sessionId;
if (!sessionId) process.exit(0);

fs.mkdirSync(LOG_DIR, { recursive: true });
const iso = new Date().toISOString();
const entries = readTranscript(p.transcript_path);
const model = p.model || lastModel(entries);

let file = sessionFile(sessionId);

if (MODE === 'prompt') {
  const text = p.prompt ?? '';
  if (!file) file = createSessionFile(sessionId, iso, model);
  const { prompts } = counts(file);
  append(file, 'PROMPT', prompts + 1, sessionId, iso, model, text);
  bumpFrontmatter(file, iso, model);
} else if (MODE === 'response') {
  if (!file) process.exit(0);
  const { prompts, responses } = counts(file);
  if (responses >= prompts) process.exit(0); // already logged this turn
  const fin = finalResponse(entries);
  if (!fin) process.exit(0);
  append(file, 'RESPONSE', responses + 1, sessionId, iso, fin.model, fin.text);
  bumpFrontmatter(file, iso, fin.model);
}

process.exit(0);
