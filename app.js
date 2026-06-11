const MIN = 1;
const MAX = 45;
const PICK = 6;
const MAX_SETS = 5;

const setCountEl = document.getElementById('setCount');
const decreaseBtn = document.getElementById('decreaseBtn');
const increaseBtn = document.getElementById('increaseBtn');
const drawBtn = document.getElementById('drawBtn');
const resultsEl = document.getElementById('results');
const emptyStateEl = document.getElementById('emptyState');
const resultsLoadingEl = document.getElementById('resultsLoading');
const resultsOutputEl = document.getElementById('resultsOutput');
const birthdateEl = document.getElementById('birthdate');
const birthdateErrorEl = document.getElementById('birthdateError');
const chatMessagesEl = document.getElementById('chatMessages');
const chatFormEl = document.getElementById('chatForm');
const chatInputEl = document.getElementById('chatInput');
const chatSendBtnEl = document.getElementById('chatSendBtn');

let setCount = 1;
let isDrawing = false;
let chatHistory = [];
let activeBirthdate = '';
let sessionFortune = null;
let recommendSeq = 0;

const API_CHAT_URL = '/api/chat';

function validateBirthdate() {
  const value = birthdateEl.value;
  if (!value) {
    return { valid: false, message: '생년월일을 입력해 주세요.' };
  }

  const date = new Date(value + 'T00:00:00');
  const [y, m, d] = value.split('-').map(Number);
  if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
    return { valid: false, message: '올바른 생년월일을 입력해 주세요.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return { valid: false, message: '오늘 이후 날짜는 입력할 수 없습니다.' };
  }

  if (y < 1900) {
    return { valid: false, message: '1900년 이후 날짜를 입력해 주세요.' };
  }

  return { valid: true };
}

function showBirthdateError(message) {
  birthdateEl.classList.add('is-error');
  birthdateErrorEl.textContent = message;
  birthdateErrorEl.hidden = false;
}

function clearBirthdateError() {
  birthdateEl.classList.remove('is-error');
  birthdateErrorEl.hidden = true;
}

function resetUiState() {
  removeLoadingMessage();
  isDrawing = false;
  drawBtn.disabled = false;
  chatSendBtnEl.disabled = false;
  chatInputEl.disabled = false;
  drawBtn.classList.remove('drawing');
}

function resetChatForNewBirthdate() {
  chatHistory = [];
  chatMessagesEl.innerHTML = '';
  appendChatMessage('bot', '생년월일이 변경되었어요. 새로운 운세 기반 번호 추천을 받아보세요!');
}

function onBirthdateChange() {
  clearBirthdateError();
  const value = birthdateEl.value;

  if (value && value !== activeBirthdate) {
    if (activeBirthdate) {
      sessionFortune = null;
      recommendSeq = 0;
      resetChatForNewBirthdate();
      clearResultsOutput();
      showEmptyState();
    }
    activeBirthdate = value;
    resetUiState();
  }
}

function saveSessionFortune(data) {
  if (data.fortune) {
    sessionFortune = {
      fortune: data.fortune,
      explanation: data.explanation || '',
    };
  }
}

function localChatReply(message) {
  if (!sessionFortune?.fortune) {
    return '먼저 운세 기반 번호 추천 버튼으로 오늘의 운세와 번호를 받아보세요!';
  }

  const { fortune, explanation } = sessionFortune;
  const topics = [
    { re: /연애|애정|사랑|썸|이별/, label: '연애운', tip: '감정 표현에 솔직함이 행운을 부릅니다.' },
    { re: /금전|돈|재물|투자|당첨/, label: '금전운', tip: '과욕보다는 계획적인 선택이 좋습니다.' },
    { re: /건강|컨디션|피로|운동/, label: '건강운', tip: '충분한 휴식과 규칙적인 생활 리듬이 중요합니다.' },
    { re: /직장|일|취업|시험|면접|학업/, label: '직장·학업운', tip: '꾸준함과 집중력이 성과로 이어집니다.' },
  ];

  const topic = topics.find((t) => t.re.test(message));
  if (topic) {
    return `[${topic.label}]\n\n${fortune}\n\n${topic.tip}${explanation ? `\n\n추천 번호와의 연결: ${explanation}` : ''}`;
  }

  return `${fortune}\n\n${explanation ? `번호 추천과 연결하면: ${explanation}\n\n` : ''}연애, 금전, 건강 등 구체적인 주제로 질문해 주시면 운세에 맞춰 조언해 드릴게요.`;
}

function appendChatMessage(role, text, label) {
  const msg = document.createElement('div');
  msg.className = `chat-message chat-message--${role}`;

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'chat-message__label';
    labelEl.textContent = label;
    msg.appendChild(labelEl);
  }

  const p = document.createElement('p');
  p.textContent = text;
  msg.appendChild(p);
  chatMessagesEl.appendChild(msg);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return msg;
}

function appendLoadingMessage() {
  const msg = document.createElement('div');
  msg.className = 'chat-message chat-message--loading';
  msg.id = 'chatLoading';
  msg.textContent = '오늘의 운세를 분석하고 있어요...';
  chatMessagesEl.appendChild(msg);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return msg;
}

function removeLoadingMessage() {
  document.getElementById('chatLoading')?.remove();
}

function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildLocalRecommend(birthdate, count, seq) {
  const rng = createSeededRng(Number(birthdate.replace(/-/g, '')) + seq * 9973);
  const sets = [];

  for (let s = 0; s < count; s += 1) {
    const pool = Array.from({ length: MAX }, (_, i) => i + MIN);
    const main = [];
    for (let i = 0; i < PICK; i += 1) {
      const idx = Math.floor(rng() * pool.length);
      main.push(pool.splice(idx, 1)[0]);
    }
    const bonusIdx = Math.floor(rng() * pool.length);
    sets.push({ main: main.sort((a, b) => a - b), bonus: pool[bonusIdx] });
  }

  const [, m, d] = birthdate.split('-').map(Number);
  return {
    fortune: `${m}월 ${d}일생의 오늘 에너지는 차분하면서도 집중력이 높은 날입니다. 작은 행운도 스스로 만드는 흐름이에요.`,
    sets,
    explanation: '생년월일과 오늘 날짜를 반영해 행운의 숫자 조합을 구성했습니다.',
    reply: '',
    fromFallback: true,
  };
}

function showEmptyState() {
  emptyStateEl.hidden = false;
  resultsLoadingEl.hidden = true;
}

function showResultsLoading() {
  emptyStateEl.hidden = true;
  resultsLoadingEl.hidden = false;
  clearResultsOutput();
}

function clearResultsOutput() {
  resultsOutputEl.innerHTML = '';
}

function showResultsError(message) {
  clearResultsOutput();
  const err = document.createElement('p');
  err.className = 'results-error';
  err.textContent = message;
  resultsOutputEl.appendChild(err);
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function requestFortune({ mode, message = '', useFallback = false }) {
  let res;
  try {
    res = await fetch(API_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birthdate: birthdateEl.value,
        setCount,
        message,
        history: chatHistory,
        mode,
        fortuneContext: sessionFortune,
        seq: recommendSeq,
        useFallback,
      }),
    });
  } catch {
    if (mode === 'recommend') {
      return buildLocalRecommend(birthdateEl.value, setCount, recommendSeq);
    }
    throw new Error('서버에 연결할 수 없습니다. Vercel 배포 환경에서 이용해 주세요.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    if (mode === 'recommend') {
      return buildLocalRecommend(birthdateEl.value, setCount, recommendSeq);
    }
    throw new Error('서버 응답을 처리할 수 없습니다.');
  }

  if (!res.ok) {
    if (mode === 'recommend') {
      return buildLocalRecommend(birthdateEl.value, setCount, recommendSeq);
    }
    if (data.code === 'QUOTA_EXCEEDED' && !useFallback) {
      return requestFortune({ mode, message, useFallback: true });
    }
    throw new Error(data.error || '운세 분석에 실패했습니다.');
  }

  if (data.fromFallback && mode === 'chat' && !data.reply && sessionFortune) {
    data.reply = localChatReply(message);
  }

  return data;
}

function createFortuneCard(fortune, explanation) {
  const card = document.createElement('article');
  card.className = 'fortune-card';

  const title = document.createElement('h3');
  title.className = 'fortune-card__title';
  title.textContent = '오늘의 운세';

  const fortuneEl = document.createElement('p');
  fortuneEl.className = 'fortune-card__fortune';
  fortuneEl.textContent = fortune;

  card.append(title, fortuneEl);

  if (explanation) {
    const explanationEl = document.createElement('p');
    explanationEl.className = 'fortune-card__explanation';
    explanationEl.textContent = explanation;
    card.appendChild(explanationEl);
  }

  return card;
}

function addBotResponses(data, includeNumbers) {
  if (includeNumbers) {
    if (data.fortune) {
      appendChatMessage('bot', data.fortune, '오늘의 운세');
      chatHistory.push({ role: 'assistant', content: data.fortune });
    }
    if (data.explanation) {
      appendChatMessage('bot', data.explanation, '번호 추천 이유');
      chatHistory.push({ role: 'assistant', content: data.explanation });
    }
  } else {
    const reply = data.reply || data.fortune;
    if (reply) {
      appendChatMessage('bot', reply);
      chatHistory.push({ role: 'assistant', content: reply });
    }
  }

  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }
}

function getBallColor(num) {
  if (num <= 10) return 'yellow';
  if (num <= 20) return 'blue';
  if (num <= 30) return 'red';
  if (num <= 40) return 'gray';
  return 'green';
}

function createBall(num, delay) {
  const ball = document.createElement('div');
  ball.className = `ball ${getBallColor(num)}`;
  ball.textContent = num;
  ball.style.animationDelay = `${delay}ms`;
  return ball;
}

function createRollingBall(delay) {
  const ball = document.createElement('div');
  ball.className = 'ball gray rolling';
  ball.textContent = '?';
  ball.style.animationDelay = `${delay}ms`;
  return ball;
}

function createLottoSet({ main, bonus }, index, animate) {
  const set = document.createElement('div');
  set.className = 'lotto-set';
  set.style.animationDelay = `${index * 80}ms`;

  const label = document.createElement('span');
  label.className = 'set-label';
  label.textContent = `${index + 1}조`;

  const balls = document.createElement('div');
  balls.className = 'balls';

  if (animate) {
    for (let i = 0; i < PICK; i++) {
      balls.appendChild(createRollingBall(i * 60));
    }
    const separator = document.createElement('span');
    separator.className = 'bonus-separator';
    separator.textContent = '+';
    balls.appendChild(separator);

    const bonusLabel = document.createElement('span');
    bonusLabel.className = 'bonus-label';
    bonusLabel.textContent = '보너스';
    balls.appendChild(bonusLabel);
    balls.appendChild(createRollingBall(PICK * 60));
  } else {
    main.forEach((num, i) => {
      balls.appendChild(createBall(num, i * 60));
    });

    const separator = document.createElement('span');
    separator.className = 'bonus-separator';
    separator.textContent = '+';
    balls.appendChild(separator);

    const bonusLabel = document.createElement('span');
    bonusLabel.className = 'bonus-label';
    bonusLabel.textContent = '보너스';
    balls.appendChild(bonusLabel);
    balls.appendChild(createBall(bonus, PICK * 60));
  }

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.type = 'button';
  copyBtn.textContent = '복사';
  copyBtn.disabled = animate;

  copyBtn.addEventListener('click', async () => {
    const text = `${main.join(', ')} + ${bonus}`;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '완료!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = '복사';
        copyBtn.classList.remove('copied');
      }, 1500);
    } catch {
      copyBtn.textContent = '실패';
      setTimeout(() => { copyBtn.textContent = '복사'; }, 1500);
    }
  });

  set.append(label, balls, copyBtn);
  return { set, balls, copyBtn, main, bonus };
}

async function animateReveal(ballsEl, main, bonus, copyBtn) {
  for (let i = 0; i < PICK; i++) {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 120));
    const rolling = ballsEl.querySelector('.ball.rolling');
    if (!rolling) break;
    rolling.replaceWith(createBall(main[i], 0));
  }

  await new Promise((r) => setTimeout(r, 280 + Math.random() * 120));
  const bonusRolling = ballsEl.querySelector('.ball.rolling');
  if (bonusRolling) {
    bonusRolling.replaceWith(createBall(bonus, 0));
  }

  copyBtn.disabled = false;
}

async function displayRecommendations(data) {
  if (!data.sets?.length) {
    if (!data.fortune) {
      throw new Error('번호 추천 결과를 받지 못했습니다. 다시 시도해 주세요.');
    }
    data = { ...data, ...buildLocalRecommend(birthdateEl.value, setCount, recommendSeq) };
  }

  emptyStateEl.hidden = true;
  resultsLoadingEl.hidden = true;
  clearResultsOutput();

  if (data.fortune) {
    resultsOutputEl.appendChild(createFortuneCard(data.fortune, data.explanation));
  }

  const setElements = data.sets.map((nums, i) => createLottoSet(nums, i, true));
  setElements.forEach(({ set }) => resultsOutputEl.appendChild(set));

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  for (const { balls, copyBtn, main, bonus } of setElements) {
    await animateReveal(balls, main, bonus, copyBtn);
    await new Promise((r) => setTimeout(r, 100));
  }

  showSignupModalIfNeeded();
}

async function draw() {
  if (isDrawing) return;

  const birthdateCheck = validateBirthdate();
  if (!birthdateCheck.valid) {
    showBirthdateError(birthdateCheck.message);
    birthdateEl.focus();
    return;
  }

  clearBirthdateError();
  if (!activeBirthdate) activeBirthdate = birthdateEl.value;

  recommendSeq += 1;
  isDrawing = true;
  drawBtn.disabled = true;
  chatSendBtnEl.disabled = true;
  chatInputEl.disabled = true;
  drawBtn.classList.add('drawing');
  appendLoadingMessage();
  showResultsLoading();

  try {
    const data = await requestFortune({ mode: 'recommend' });
    removeLoadingMessage();
    saveSessionFortune(data);

    if (data.fromFallback) {
      appendChatMessage('bot', 'AI 연결이 어려워 로컬 운세 기반 번호를 추천했습니다.');
    }

    addBotResponses(data, true);
    await displayRecommendations(data);
  } catch (error) {
    removeLoadingMessage();
    showEmptyState();
    showResultsError(error.message || '운세 분석에 실패했습니다.');
    appendChatMessage('bot', error.message || '운세 분석에 실패했습니다.');
  } finally {
    resetUiState();
  }
}

async function handleChatSubmit(e) {
  e.preventDefault();
  if (isDrawing) return;

  const message = chatInputEl.value.trim();
  if (!message) return;

  const birthdateCheck = validateBirthdate();
  if (!birthdateCheck.valid) {
    showBirthdateError(birthdateCheck.message);
    birthdateEl.focus();
    return;
  }

  clearBirthdateError();
  if (!activeBirthdate) activeBirthdate = birthdateEl.value;

  appendChatMessage('user', message);
  chatHistory.push({ role: 'user', content: message });
  chatInputEl.value = '';

  isDrawing = true;
  drawBtn.disabled = true;
  chatSendBtnEl.disabled = true;
  chatInputEl.disabled = true;
  appendLoadingMessage();

  try {
    const wantsNumbers = /번호|로또|추천|행운/.test(message);
    let data;

    if (!wantsNumbers && sessionFortune?.fortune) {
      try {
        data = await requestFortune({ mode: 'chat', message });
      } catch {
        data = { reply: localChatReply(message), sets: [], fortune: sessionFortune.fortune };
      }
    } else {
      if (wantsNumbers) recommendSeq += 1;
      data = await requestFortune({ mode: 'chat', message });
      if (data.fortune) saveSessionFortune(data);
    }

    removeLoadingMessage();

    if (data.fromFallback && !wantsNumbers) {
      appendChatMessage('bot', data.reply || localChatReply(message));
      chatHistory.push({ role: 'assistant', content: data.reply || localChatReply(message) });
    } else {
      addBotResponses(data, wantsNumbers && data.sets?.length > 0);
    }

    if (wantsNumbers && data.sets?.length > 0) {
      await displayRecommendations(data);
    }
  } catch (error) {
    removeLoadingMessage();
    const fallback = localChatReply(message);
    if (sessionFortune?.fortune) {
      appendChatMessage('bot', fallback);
      chatHistory.push({ role: 'assistant', content: fallback });
    } else {
      appendChatMessage('bot', error.message || '답변 생성에 실패했습니다.');
    }
  } finally {
    resetUiState();
  }
}

function updateStepper() {
  setCountEl.textContent = setCount;
  decreaseBtn.disabled = setCount <= 1;
  increaseBtn.disabled = setCount >= MAX_SETS;
}

decreaseBtn.addEventListener('click', () => {
  if (setCount > 1) {
    setCount--;
    updateStepper();
  }
});

increaseBtn.addEventListener('click', () => {
  if (setCount < MAX_SETS) {
    setCount++;
    updateStepper();
  }
});

drawBtn.addEventListener('click', draw);
chatFormEl.addEventListener('submit', handleChatSubmit);

birthdateEl.addEventListener('input', onBirthdateChange);
birthdateEl.addEventListener('change', onBirthdateChange);

const today = new Date();
birthdateEl.max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

updateStepper();

const HISTORY_PAGE_SIZE = 30;
const HISTORY_DATA_URLS = [
  'data/lotto-history.json',
  'https://smok95.github.io/lotto/results/all.json',
];

const historySearchEl = document.getElementById('historySearch');
const historyStatusEl = document.getElementById('historyStatus');
const historyListEl = document.getElementById('historyList');
const loadMoreBtn = document.getElementById('loadMoreBtn');

let historyData = [];
let historyFiltered = [];
let historyVisible = 0;

function formatDate(isoDate) {
  const date = new Date(isoDate);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function formatPrize(amount) {
  if (!amount) return '-';
  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);
  if (eok > 0 && man > 0) return `${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만원`;
  if (eok > 0) return `${eok.toLocaleString('ko-KR')}억원`;
  return `${man.toLocaleString('ko-KR')}만원`;
}

function getFirstPrize(divisions) {
  const first = divisions?.[0];
  if (first?.prize) return first;
  return null;
}

function appendBalls(container, numbers, bonus) {
  numbers.forEach((num) => {
    container.appendChild(createBall(num, 0));
  });

  const separator = document.createElement('span');
  separator.className = 'bonus-separator';
  separator.textContent = '+';
  container.appendChild(separator);

  const bonusLabel = document.createElement('span');
  bonusLabel.className = 'bonus-label';
  bonusLabel.textContent = '보너스';
  container.appendChild(bonusLabel);
  container.appendChild(createBall(bonus, 0));
}

function createHistoryItem(draw) {
  const item = document.createElement('article');
  item.className = 'history-item';

  const meta = document.createElement('div');
  meta.className = 'history-meta';

  const drawEl = document.createElement('span');
  drawEl.className = 'history-draw';
  drawEl.textContent = `${draw.draw_no}회`;

  const dateEl = document.createElement('span');
  dateEl.className = 'history-date';
  dateEl.textContent = formatDate(draw.date);

  meta.append(drawEl, dateEl);

  const balls = document.createElement('div');
  balls.className = 'balls balls--small';
  appendBalls(balls, draw.numbers, draw.bonus_no);

  const prizeRow = document.createElement('div');
  prizeRow.className = 'history-prize';

  const firstPrize = getFirstPrize(draw.divisions);
  if (firstPrize) {
    const label = document.createElement('span');
    label.className = 'prize-label';
    label.textContent = '1등';

    const amount = document.createElement('span');
    amount.className = 'prize-amount';
    amount.textContent = formatPrize(firstPrize.prize);

    const winners = document.createElement('span');
    winners.className = 'prize-winners';
    winners.textContent = `(${firstPrize.winners.toLocaleString('ko-KR')}명)`;

    prizeRow.append(label, amount, winners);
  } else {
    const none = document.createElement('span');
    none.className = 'prize-none';
    none.textContent = '1등 당첨자 없음';
    prizeRow.appendChild(none);
  }

  item.append(meta, balls, prizeRow);
  return item;
}

function renderHistoryPage() {
  const slice = historyFiltered.slice(0, historyVisible);
  historyListEl.replaceChildren(...slice.map(createHistoryItem));

  const hasMore = historyVisible < historyFiltered.length;
  loadMoreBtn.hidden = !hasMore;

  if (historyFiltered.length === 0) {
    historyStatusEl.textContent = '검색 결과가 없습니다.';
  } else {
    historyStatusEl.textContent = `총 ${historyFiltered.length.toLocaleString('ko-KR')}회 · 최신순`;
  }
}

function filterHistory(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    historyFiltered = [...historyData].reverse();
  } else {
    const drawNo = Number(trimmed);
    historyFiltered = historyData.filter((d) => String(d.draw_no).includes(trimmed));
    if (Number.isInteger(drawNo) && drawNo > 0) {
      const exact = historyData.find((d) => d.draw_no === drawNo);
      historyFiltered = exact ? [exact] : historyFiltered;
    }
  }
  historyVisible = HISTORY_PAGE_SIZE;
  renderHistoryPage();
}

async function loadHistory() {
  historyStatusEl.textContent = '당첨 기록을 불러오는 중...';

  for (const url of HISTORY_DATA_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      historyData = await res.json();
      filterHistory('');
      return;
    } catch {
      // try next source
    }
  }

  historyStatusEl.textContent = '당첨 기록을 불러오지 못했습니다. 로컬 서버로 실행해 주세요.';
}

historySearchEl.addEventListener('input', (e) => {
  filterHistory(e.target.value);
});

loadMoreBtn.addEventListener('click', () => {
  historyVisible += HISTORY_PAGE_SIZE;
  renderHistoryPage();
});

loadHistory();

/* ── Signup modal ── */
const signupModal = document.getElementById('signupModal');
const signupForm = document.getElementById('signupForm');
const signupModalClose = document.getElementById('signupModalClose');
const signupLaterBtn = document.getElementById('signupLaterBtn');
const signupErrorEl = document.getElementById('signupError');
const SUBSCRIBED_KEY = 'lotto_subscribed';
const DISMISS_SESSION_KEY = 'lotto_signup_dismissed';

function showSignupModalIfNeeded() {
  if (localStorage.getItem(SUBSCRIBED_KEY)) return;
  if (sessionStorage.getItem(DISMISS_SESSION_KEY)) return;
  signupModal.hidden = false;
  signupModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('signupName')?.focus();
}

function hideSignupModal() {
  signupModal.hidden = true;
  signupModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  signupErrorEl.hidden = true;
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function submitSignup({ name, phone, email }) {
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, email }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '가입에 실패했습니다.');
  }
  return data;
}

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupErrorEl.hidden = true;

  const name = document.getElementById('signupName').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const submitBtn = signupForm.querySelector('button[type="submit"]');

  if (!name) {
    signupErrorEl.textContent = '이름을 입력해 주세요.';
    signupErrorEl.hidden = false;
    return;
  }
  if (!validatePhone(phone)) {
    signupErrorEl.textContent = '올바른 전화번호를 입력해 주세요.';
    signupErrorEl.hidden = false;
    return;
  }
  if (!validateEmail(email)) {
    signupErrorEl.textContent = '올바른 이메일을 입력해 주세요.';
    signupErrorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '가입 중...';

  try {
    await submitSignup({ name, phone, email });
    localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify({ name, phone, email, at: Date.now() }));
    hideSignupModal();
    appendChatMessage('bot', `${name}님, 가입이 완료되었습니다! 다음 AI 맞춤 번호 추천을 기대해 주세요.`);
    signupForm.reset();
  } catch (error) {
    signupErrorEl.textContent = error.message || '가입에 실패했습니다.';
    signupErrorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '무료 가입하기';
  }
});

signupModalClose.addEventListener('click', () => {
  sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
  hideSignupModal();
});

signupLaterBtn.addEventListener('click', () => {
  sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
  hideSignupModal();
});

signupModal.addEventListener('click', (e) => {
  if (e.target === signupModal) {
    sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
    hideSignupModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !signupModal.hidden) {
    sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
    hideSignupModal();
  }
});

/* ── Reviews ── */
const reviewsListEl = document.getElementById('reviewsList');
const reviewForm = document.getElementById('reviewForm');
const USER_REVIEWS_KEY = 'lotto_user_reviews';

const EXAMPLE_REVIEWS = [
  {
    name: '김*수',
    location: '서울 강남',
    prize: '19억 2,400만원',
    text: 'AI 운세 추천 번호로 1등 당첨! 3개월간 꾸준히 추천받은 번호 조합이었는데, 생년월일 기반 운세가 정말 잘 맞더라고요. 주변에도 꼭 추천하고 있습니다.',
    example: true,
  },
  {
    name: '이*영',
    location: '부산 해운대',
    prize: '26억 7,480만원',
    text: '처음엔 반신반의했는데 챗봇 운세 추천 번호로 1등에 당첨됐습니다. 특히 보너스 번호까지 맞춰서 2등이 아닌 1등이 됐어요. 인생이 바뀌었습니다!',
    example: true,
  },
  {
    name: '박*민',
    location: '대구 수성',
    prize: '14억 5,200만원',
    text: '매주 AI 추천 알림 받고 번호 구매했더니 드디어 1등! 운세 설명이 구체적이라 믿음이 갔고, 실제로 행운이 찾아왔네요.',
    example: true,
  },
  {
    name: '최*현',
    location: '인천 연수',
    prize: '21억 8,000만원',
    text: '로또는 운이라고만 생각했는데, 생년월일+오늘 운세 조합 추천이 이렇게 강력할 줄 몰랐어요. 가족과 여행 계획 중입니다!',
    example: true,
  },
];

function getUserReviews() {
  try {
    return JSON.parse(localStorage.getItem(USER_REVIEWS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUserReview(review) {
  const reviews = getUserReviews();
  reviews.unshift(review);
  localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(reviews.slice(0, 20)));
}

function createReviewCard({ name, location, prize, text, example }) {
  const card = document.createElement('article');
  card.className = `review-card${example ? ' review-card--example' : ''}`;

  const header = document.createElement('div');
  header.className = 'review-card__header';

  const authorWrap = document.createElement('div');

  const author = document.createElement('span');
  author.className = 'review-card__author';
  author.textContent = name;

  const meta = document.createElement('span');
  meta.className = 'review-card__meta';
  meta.textContent = location ? ` · ${location}` : '';

  authorWrap.append(author, meta);

  const badge = document.createElement('span');
  badge.className = 'review-card__badge';
  badge.textContent = example ? '1등 당첨 예시' : '이용 후기';

  header.append(authorWrap, badge);

  const textEl = document.createElement('p');
  textEl.className = 'review-card__text';
  textEl.textContent = text;

  card.append(header, textEl);

  if (prize) {
    const prizeEl = document.createElement('p');
    prizeEl.className = 'review-card__prize';
    prizeEl.textContent = `당첨금 ${prize}`;
    card.appendChild(prizeEl);
  }

  return card;
}

function renderReviews() {
  const userReviews = getUserReviews();
  const all = [...userReviews, ...EXAMPLE_REVIEWS];
  reviewsListEl.replaceChildren(...all.map(createReviewCard));
}

reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('reviewName').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  if (!name || !text) return;

  saveUserReview({
    name,
    location: '방금 전',
    prize: '',
    text,
    example: false,
  });

  reviewForm.reset();
  renderReviews();
  reviewsListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

renderReviews();
