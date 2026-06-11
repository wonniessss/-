const { createClient } = require('@supabase/supabase-js');

function validatePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

function validateEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Supabase 환경변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.',
    });
  }

  try {
    const { name, phone, email } = req.body || {};
    const trimmedName = String(name || '').trim();

    if (!trimmedName || trimmedName.length > 30) {
      return res.status(400).json({ error: '올바른 이름을 입력해 주세요.' });
    }

    const phoneDigits = validatePhone(phone);
    if (!phoneDigits) {
      return res.status(400).json({ error: '올바른 전화번호를 입력해 주세요.' });
    }

    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: '올바른 이메일을 입력해 주세요.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('signups')
      .insert({
        name: trimmedName,
        phone: phoneDigits,
        email: normalizedEmail,
      })
      .select('id, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
      }
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: '가입 정보 저장에 실패했습니다.' });
    }

    return res.status(201).json({
      success: true,
      id: data.id,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error('Signup API error:', error);
    return res.status(500).json({ error: '가입 처리 중 오류가 발생했습니다.' });
  }
};
