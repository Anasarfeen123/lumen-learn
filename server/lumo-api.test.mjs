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

describe('Fish Audio voice', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.FISH_API_KEY;
    delete process.env.FISH_VOICE_ID;
  });

  function callSpeech(body) {
    const req = new EventEmitter();
    Object.assign(req, { method: 'POST', url: '/api/lumo/speech', destroy() {} });
    return new Promise((resolve) => {
      const res = {
        statusCode: 200, headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end(data) { resolve({ status: this.statusCode, headers: this.headers, body: data }); },
      };
      lumoApi(req, res);
      queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); });
    });
  }

  it('asks Fish for the free model with the chosen voice and a slower pace for words', async () => {
    process.env.FISH_API_KEY = 'fish-test';
    process.env.FISH_VOICE_ID = 'voice123';
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(Buffer.from('ID3fake-mp3'), { status: 200 });
    };
    const r = await callSpeech({ text: 'rabbit', style: 'word', voice: 'voice123' });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('audio/mpeg');
    expect(calls[0].url).toBe('https://api.fish.audio/v1/tts');
    expect(calls[0].init.headers.model).toBe('s2.1-pro-free');
    expect(calls[0].init.headers.authorization).toBe('Bearer fish-test');
    const sent = JSON.parse(calls[0].init.body);
    expect(sent).toMatchObject({ text: 'rabbit', reference_id: 'voice123', format: 'mp3' });
    expect(sent.prosody.speed).toBeLessThan(1);
  });

  it('when the free quota is used up, Lumo still speaks with the local voice', async () => {
    const { localEngine } = await import('./local-tts.mjs');
    if (!(await localEngine())) return; // no espeak-ng/Piper on this machine
    process.env.FISH_API_KEY = 'fish-test';
    globalThis.fetch = async () => new Response('quota', { status: 402 });
    const r = await callSpeech({ text: 'Fresh line for the quota test.', style: 'lumo' });
    expect(r.status).toBe(200);
    expect(r.headers['x-lumo-voice']).toBe('local');
  });
});
