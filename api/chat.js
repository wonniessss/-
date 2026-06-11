const MIN = 1;
const MAX = 45;
const PICK = 6;
const MODEL = 'gemini-2.5-flash-lite';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

const responseCache = new Map();

const FULL_SCHEMA = {
  type: 'object',
  properties: {
    fortune: { type: 'string' },
    sets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          main: { type: 'array', items: { type: 'integer' } },
          bonus: { type: 'integer' },
        },
        required: ['main', 'bonus'],
      },
    },
    explanation: { type: 'string' },
    reply: { type: 'string' },
  },
  required: ['fortune', 'sets', 'explanation', 'reply'],
};

const REPLY_ONLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
  },
  required: ['reply'],
};

function getTodayKST() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function getTodayKSTLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

function getCacheKey({ birthdate, mode, setCount, message, seq }) {
  const today = getTodayKST();
  if (mode === 'recommend') {
    return `rec:${birthdate}:${today}:${setCount}:${seq}`;
  }
  return `chat:${birthdate}:${today}:${message.trim().toLowerCase()}`;
}

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  responseCache.set(key, { time: Date.now(), data });
}

function buildPrompt({ birthdate, setCount, message, history, mode, fortuneContext, seq }) {
  const today = getTodayKSTLabel();

  if (mode === 'chat' && fortuneContext?.fortune) {
    const historyText = (history || [])
      .slice(-4)
      .map((m) => `${m.role === 'user' ? '???' : '??'}: ${m.content}`)
      .join('\n');

    return `?? ?? ?????. ?? ?? ??? ???? ??? ???? ????.
??? ?? ??? ???? ???? sets? ????.

- ????: ${birthdate}
- ??: ${today}
- ??? ??? ??: ${fortuneContext.fortune}
${fortuneContext.explanation ? `- ?? ?? ??: ${fortuneContext.explanation}` : ''}

${historyText ? `?? ??:\n${historyText}\n` : ''}
??? ??: ${message}

reply ??? 3~5???? ???? ??? ??? ?????.`;
  }

  const historyText = (history || [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? '???' : '??'}: ${m.content}`)
    .join('\n');

  const base = `??6/45 ?? ?? ?? ?????.
????? ?? ??? ??? ???? 1~45 ? 6?+??? 1?? ?????.
?? ???? ??? ???? ????.

- ????: ${birthdate}
- ??: ${today}
- ?? ? ?: ${setCount}
- ?? ??: ${seq}`;

  if (mode === 'recommend') {
    return `${base}

fortune(??? ?? 3~5??), sets(${setCount}?), explanation(??? ?? ?? ??), reply(??)? JSON?? ?????.
sets? main? 1~45 ?? ?? 6?, bonus? main? ?? ??.`;
  }

  return `${base}
${historyText ? `\n?? ??:\n${historyText}` : ''}

???: ${message}
?? ??? ??? sets ??, ??? sets? ? ??. reply? ?????.`;
}

function normalizeSet(raw) {
  if (!raw?.main || raw.bonus == null) return null;

  const main = [...new Set(raw.main.map(Number))]
    .filter((n) => Number.isInteger(n) && n >= MIN && n <= MAX)
    .sort((a, b) => a - b);

  const bonus = Number(raw.bonus);
  if (main.length !== PICK) return null;
  if (!Number.isInteger(bonus) || bonus < MIN || bonus > MAX) return null;
  if (main.includes(bonus)) return null;

  return { main, bonus };
}

function fillMissingSets(sets, count, birthdate, seq) {
  const valid = sets.map(normalizeSet).filter(Boolean);
  const used = new Set(valid.flatMap((s) => [...s.main, s.bonus]));

  let seed = birthdate.split('-').join('') * 1 + seq * 9973;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  while (valid.length < count) {
    const pool = [];
    for (let i = MIN; i <= MAX; i += 1) {
      if (!used.has(i)) pool.push(i);
    }
    if (pool.length < PICK + 1) break;

    const main = [];
    for (let i = 0; i < PICK; i += 1) {
      const idx = Math.floor(rng() * pool.length);
      main.push(pool.splice(idx, 1)[0]);
      used.add(main[main.length - 1]);
    }
    const bonusIdx = Math.floor(rng() * pool.length);
    const bonus = pool[bonusIdx];
    used.add(bonus);
    valid.push({ main: main.sort((a, b) => a - b), bonus });
  }

  return valid.slice(0, count);
}

function parseRetryDelayMs(errorText) {
  try {
    const json = JSON.parse(errorText);
    const retry = json?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'));
    if (retry?.retryDelay) {
      const sec = parseFloat(String(retry.retryDelay).replace('s', ''));
      if (!Number.isNaN(sec)) return Math.ceil(sec * 1000);
    }
    const match = errorText.match(/retry in ([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  } catch {
    // ignore
  }
  return 3000;
}

function formatApiError(status, errorText) {
  if (status === 429) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Gemini API ?? ?? ??? ??????. ?? ? ?? ?????, ?? ?? ?? ??? ??? ???.',
    };
  }
  return {
    status: status >= 400 && status < 500 ? status : 500,
    code: 'API_ERROR',
    message: `Gemini API ?? (${status})`,
  };
}

async function callGemini(apiKey, prompt, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const formatted = formatApiError(res.status, err);
    const error = new Error(formatted.message);
    error.status = formatted.status;
    error.code = formatted.code;
    error.raw = err;
    throw error;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini ??? ?? ????.');

  return JSON.parse(text);
}

async function callGeminiWithRetry(apiKey, prompt, schema) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await callGemini(apiKey, prompt, schema);
    } catch (error) {
      lastError = error;
      if (error.status === 429 && attempt < 2) {
        const delay = parseRetryDelayMs(error.raw || '');
        await new Promise((r) => setTimeout(r, delay + attempt * 1000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function buildLocalRecommend(birthdate, setCount, seq) {
  const sets = fillMissingSets([], setCount, birthdate, seq);
  const [, m, d] = birthdate.split('-').map(Number);
  return {
    fortune: `${m}? ${d}??? ?? ???? ?????? ???? ?? ????. ?? ????? ?? ???? ??, ?? ??? ??? ??? ?????. ??? ??? ???? ?????.`,
    sets,
    explanation: '???? ??? ?? ??? ??? ??? ?? ??? ??????. (API ?? ?? ? ?? ??)',
    reply: '?? ?? ???? ??? ??????.',
    fromFallback: true,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY ????? ???? ?????.' });
  }

  try {
    const {
      birthdate,
      setCount = 1,
      message = '',
      history = [],
      mode = 'recommend',
      fortuneContext = null,
      seq = 0,
      useFallback = false,
    } = req.body || {};

    if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      return res.status(400).json({ error: '??? ????(YYYY-MM-DD)? ?????.' });
    }

    const count = Math.min(Math.max(Number(setCount) || 1, 1), 5);
    const cacheKey = getCacheKey({ birthdate, mode, setCount: count, message, seq });

    if (!useFallback) {
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({ ...cached, fromCache: true });
      }
    }

    if (useFallback) {
      if (mode === 'recommend') {
        const local = buildLocalRecommend(birthdate, count, seq);
        return res.status(200).json(local);
      }
      return res.status(200).json({
        fortune: fortuneContext?.fortune || '',
        sets: [],
        explanation: '',
        reply: fortuneContext?.fortune
          ? `?? AI ?? ??? ?? ??? ??? ???? ??????.\n\n${fortuneContext.fortune}\n\n???? ?? ??, ??, ?? ? ????? ??? ???.`
          : '?? ?? ?? ?? ??? ?? ???.',
        fromFallback: true,
      });
    }

    const isChatWithContext = mode === 'chat' && fortuneContext?.fortune;
    const schema = isChatWithContext ? REPLY_ONLY_SCHEMA : FULL_SCHEMA;
    const prompt = buildPrompt({
      birthdate,
      setCount: count,
      message,
      history,
      mode,
      fortuneContext,
      seq,
    });

    let parsed;
    try {
      parsed = await callGeminiWithRetry(apiKey, prompt, schema);
    } catch (error) {
      if (error.code === 'QUOTA_EXCEEDED') {
        if (mode === 'recommend') {
          const local = buildLocalRecommend(birthdate, count, seq);
          return res.status(200).json(local);
        }
        if (fortuneContext?.fortune) {
          return res.status(200).json({
            fortune: fortuneContext.fortune,
            sets: [],
            explanation: '',
            reply: `AI ??? ??? ??? ??? ???? ??????.\n\n${fortuneContext.fortune}`,
            fromFallback: true,
          });
        }
        return res.status(429).json({ error: error.message, code: 'QUOTA_EXCEEDED' });
      }
      throw error;
    }

    let result;
    if (isChatWithContext) {
      result = {
        fortune: fortuneContext.fortune,
        sets: [],
        explanation: fortuneContext.explanation || '',
        reply: parsed.reply || '',
      };
    } else {
      const needsSets = mode === 'recommend' || (parsed.sets?.length > 0);
      result = {
        fortune: parsed.fortune || fortuneContext?.fortune || '',
        sets: needsSets ? fillMissingSets(parsed.sets || [], count, birthdate, seq) : [],
        explanation: parsed.explanation || '',
        reply: parsed.reply || parsed.fortune || '',
      };
    }

    setCache(cacheKey, result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || '?? ?? ? ??? ??????.',
      code: error.code || 'API_ERROR',
    });
  }
};
