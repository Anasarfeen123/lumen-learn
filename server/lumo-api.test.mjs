import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { lumoApi, validInsight, validSummary } from './lumo-api.mjs';

function call(method, url, body) {
  const req = new EventEmitter();
  Object.assign(req, { method, url, destroy() {} });
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(data) { resolve({ status: this.statusCode, body: data ? JSON.parse(data) : null }); },
    };
    lumoApi(req, res, () => resolve({ status: 'next' }));
    queueMicrotask(() => {
      if (body) req.emit('data', Buffer.from(JSON.stringify(body)));
      req.emit('end');
    });
  });
}

describe('lumo api', () => {
  const key = process.env.GROQ_API_KEY;
  afterEach(() => { process.env.GROQ_API_KEY = key; });

  it('passes through anything that is not an API route', async () => {
    expect((await call('GET', '/index.html')).status).toBe('next');
  });

  it('answers 204 when no key is configured, so the app uses templates', async () => {
    delete process.env.GROQ_API_KEY;
    expect((await call('POST', '/api/lumo/insight', { template: 'Hi' })).status).toBe(204);
  });

  it('rejects other methods', async () => {
    expect((await call('GET', '/api/lumo/insight')).status).toBe(405);
  });

  it('validates replies exactly like the browser does', () => {
    expect(validInsight('Vowel teams are getting easier. I can tell!')).toBe(true);
    expect(validInsight('This is easy now.')).toBe(false);
    expect(validSummary('{name} practised for 24 minutes.', { m: 24 })).toBe(true);
    expect(validSummary('{name} practised for 25 minutes.', { m: 24 })).toBe(false);
  });
});

describe('Groq call', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.GROQ_API_KEY;
  });

  function mockGroq(content) {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] }), { status: 200 });
      }
      calls.push({ url, init, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    return calls;
  }

  it('sends an OpenAI-style request with the key server-side, and returns a valid line', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const calls = mockGroq('{"text": "Vowel teams feel friendlier now. Nice work!"}');
    const r = await call('POST', '/api/lumo/insight', { template: 'Vowel teams are getting easier. I can tell!', context: { tag: 'vowel-team' } });
    expect(r).toEqual({ status: 200, body: { text: 'Vowel teams feel friendlier now. Nice work!' } });
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(calls[0].init.headers.authorization).toBe('Bearer test-key');
    expect(calls[0].body.messages[0].role).toBe('system');
    expect(calls[0].body.model).toBe('openai/gpt-oss-120b');
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' });
  });

  it('refuses a reply that breaks the rules, so the template is kept', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    mockGroq('{"text": "That was wrong, but 2 more tries!"}');
    expect((await call('POST', '/api/lumo/insight', { template: 'x' })).status).toBe(422);
  });

  it('never invents numbers in the grown-up summary', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    mockGroq('{"text": "{name} practised for 30 minutes this week."}');
    expect((await call('POST', '/api/lumo/summary', { stats: { minutesThisWeek: 24 } })).status).toBe(422);
  });
});
