const MIN = 1;
const MAX = 45;
const PICK = 6;
const MODEL = 'gemini-2.5-flash-lite';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    fortune: {
      type: 'string',
      description: '????? ?? ??? ???? ? ??? ?? (3~5??, ???)',
    },
    sets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          main: {
            type: 'array',
            items: { type: 'integer' },
            description: '1~45 ?? ?? ?? ?? 6?',
          },
          bonus: {
            type: 'integer',
            description: '1~45 ?? ??? ?? (main? ?? ??)',
          },
        },
        required: ['main', 'bonus'],
      },
    },
    explanation: {
      type: 'string',
      description: '?? ??? ??? ??? ??? ?? (???)',
    },
    reply: {
      type: 'string',
      description: '??? ??? ?? ?? ?? (???)',
    },
  },
  required: ['fortune', 'sets', 'explanation', 'reply'],
};

function getTodayKST() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

function buildPrompt({ birthdate, setCount, message, history, mode }) {
  const today = getTodayKST();
  const historyText = (history || [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? '???' : '??'}: ${m.content}`)
    .join('\n');

  const base = `??? ?? ?? ?? ?? ?????.
????? ?? ??? ???? ??? ??? ????, ??6/45 ??(1~45 ? 6?+??? 1?)? ?????.
??? ??·?? ????, ??? ???? ??? ??? ???? ?????.

- ????: ${birthdate}
- ?? ??: ${today}
- ?? ? ?: ${setCount}`;

  if (historyText) {
    return `${base}

?? ??:
${historyText}

??? ???: ${message || '??? ??? ???? ?? ??? ??? ???.'}

${mode === 'recommend'
    ? `??? ??(fortune)? ????, ??? ${setCount}?? ?? ??(sets)? ? ??? ??? ??(explanation)? ??? ??? ?????. reply?? fortune? explanation? ????? ??? ???.`
    : `??? ??? reply? ????. ?? ??? ????? sets? ${setCount}?? ???? explanation? ?????. ??? ??? sets? ? ??? ???.`}`;
  }

  return `${base}

${mode === 'recommend'
    ? `??? ??(fortune)? ????, ${setCount}?? ?? ??(sets)? ?? ?? ?? ??(explanation)? ?????. reply?? ?? ??? ????.`
    : `??? ???: ${message}\nreply? ???, ?? ? sets? explanation? ?????.`}`;
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

function fillMissingSets(sets, count) {
  const valid = sets.map(normalizeSet).filter(Boolean);
  const used = new Set(valid.flatMap((s) => [...s.main, s.bonus]));

  while (valid.length < count) {
    const pool = [];
    for (let i = MIN; i <= MAX; i += 1) {
      if (!used.has(i)) pool.push(i);
    }
    if (pool.length < PICK + 1) break;

    const main = [];
    for (let i = 0; i < PICK; i += 1) {
      const idx = Math.floor(Math.random() * pool.length);
      main.push(pool.splice(idx, 1)[0]);
      used.add(main[main.length - 1]);
    }
    const bonusIdx = Math.floor(Math.random() * pool.length);
    const bonus = pool[bonusIdx];
    used.add(bonus);
    valid.push({ main: main.sort((a, b) => a - b), bonus });
  }

  return valid.slice(0, count);
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return JSON.parse(text);
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
    const { birthdate, setCount = 1, message = '', history = [], mode = 'recommend' } = req.body || {};

    if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      return res.status(400).json({ error: '??? ????(YYYY-MM-DD)? ?????.' });
    }

    const count = Math.min(Math.max(Number(setCount) || 1, 1), 5);
    const prompt = buildPrompt({ birthdate, setCount: count, message, history, mode });
    const parsed = await callGemini(apiKey, prompt);

    const sets = mode === 'recommend' || (parsed.sets?.length > 0)
      ? fillMissingSets(parsed.sets || [], count)
      : [];

    return res.status(200).json({
      fortune: parsed.fortune || '',
      sets,
      explanation: parsed.explanation || '',
      reply: parsed.reply || parsed.fortune || '',
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: error.message || '?? ?? ? ??? ??????.' });
  }
};
