// Client for Lumo's language endpoints. Only aggregate numbers and tags are
// ever sent: never the learner's name, never anything the learner typed.
// The template is always shown first; an AI line replaces it only if it
// arrives in time and passes validation.

const INSIGHT_BANNED = ['wrong', 'bad', 'fail', 'easy', 'dyslexia', 'disorder', 'test', 'score', 'problem'];
const SUMMARY_BANNED = ['dyslexia', 'disorder', 'diagnosis', 'behind', 'below average', 'fail', 'struggle', 'score', 'percent'];

function hasBanned(text: string, banned: string[]): boolean {
  const lower = text.toLowerCase();
  return banned.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

export function validInsight(text: string): boolean {
  const words = text.trim().split(/\s+/);
  return text.trim().length > 0 && words.length <= 14 && !/\d/.test(text) && !hasBanned(text, INSIGHT_BANNED);
}

export function validSummary(text: string, stats: unknown): boolean {
  if (!text.trim()) return false;
  const sentences = text.split(/[.!?]+(\s|$)/).filter((s) => s.trim());
  if (sentences.length > 5 || hasBanned(text, SUMMARY_BANNED)) return false;
  const allowed = new Set(JSON.stringify(stats).match(/\d+/g) ?? []);
  return (text.match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

// Static hosting (e.g. GitHub Pages) has no server: build with VITE_LUMO_API=off.
const API = import.meta.env.VITE_LUMO_API ?? '/api/lumo';

async function post(path: string, body: unknown, timeoutMs: number): Promise<string | null> {
  if (API === 'off') return null;
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) return null; // 204: AI not configured; use the template
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === 'string' ? data.text.trim() : null;
  } catch {
    return null;
  }
}

/** Rephrase a template insight in Lumo's voice, or null to keep the template. */
export async function rephraseInsight(template: string, context: Record<string, string>): Promise<string | null> {
  const text = await post('/insight', { template, context }, 2500);
  return text && validInsight(text) ? text : null;
}

/** Weekly grown-up summary from aggregate stats. `{name}` is filled in on the device. */
export async function writeSummary(stats: object): Promise<string | null> {
  const text = await post('/summary', { stats }, 4000);
  return text && validSummary(text, stats) ? text : null;
}
