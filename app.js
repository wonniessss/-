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
const birthdateEl = document.getElementById('birthdate');
const birthdateErrorEl = document.getElementById('birthdateError');
const chatMessagesEl = document.getElementById('chatMessages');
const chatFormEl = document.getElementById('chatForm');
const chatInputEl = document.getElementById('chatInput');
const chatSendBtnEl = document.getElementById('chatSendBtn');

let setCount = 1;
let isDrawing = false;
let chatHistory = [];

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

async function requestFortune({ mode, message = '' }) {
  const res = await fetch(API_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birthdate: birthdateEl.value,
      setCount,
      message,
      history: chatHistory,
      mode,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '운세 분석에 실패했습니다.');
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
  const rollingBalls = ballsEl.querySelectorAll('.ball');

  for (let i = 0; i < PICK; i++) {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 120));
    const newBall = createBall(main[i], 0);
    rollingBalls[i].replaceWith(newBall);
  }

  await new Promise((r) => setTimeout(r, 280 + Math.random() * 120));
  const bonusBall = createBall(bonus, 0);
  rollingBalls[PICK].replaceWith(bonusBall);

  copyBtn.disabled = false;
}

async function displayRecommendations(data) {
  if (!data.sets?.length) {
    throw new Error('번호 추천 결과를 받지 못했습니다. 다시 시도해 주세요.');
  }

  emptyStateEl.style.display = 'none';
  resultsEl.innerHTML = '';

  if (data.fortune) {
    resultsEl.appendChild(createFortuneCard(data.fortune, data.explanation));
  }

  const setElements = data.sets.map((nums, i) => createLottoSet(nums, i, true));
  setElements.forEach(({ set }) => resultsEl.appendChild(set));

  for (const { balls, copyBtn, main, bonus } of setElements) {
    await animateReveal(balls, main, bonus, copyBtn);
    await new Promise((r) => setTimeout(r, 100));
  }
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
  isDrawing = true;
  drawBtn.disabled = true;
  chatSendBtnEl.disabled = true;
  chatInputEl.disabled = true;
  drawBtn.classList.add('drawing');
  appendLoadingMessage();

  try {
    const data = await requestFortune({ mode: 'recommend' });
    removeLoadingMessage();
    addBotResponses(data, true);
    await displayRecommendations(data);
  } catch (error) {
    removeLoadingMessage();
    appendChatMessage('bot', error.message || '운세 분석에 실패했습니다. Vercel에 GEMINI_API_KEY가 설정되어 있는지 확인해 주세요.');
  }

  isDrawing = false;
  drawBtn.disabled = false;
  chatSendBtnEl.disabled = false;
  chatInputEl.disabled = false;
  drawBtn.classList.remove('drawing');
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
  appendChatMessage('user', message);
  chatHistory.push({ role: 'user', content: message });
  chatInputEl.value = '';

  isDrawing = true;
  drawBtn.disabled = true;
  chatSendBtnEl.disabled = true;
  chatInputEl.disabled = true;
  appendLoadingMessage();

  try {
    const data = await requestFortune({ mode: 'chat', message });
    removeLoadingMessage();

    const wantsNumbers = /번호|로또|추천|행운/.test(message);
    addBotResponses(data, wantsNumbers && data.sets?.length > 0);

    if (wantsNumbers && data.sets?.length > 0) {
      await displayRecommendations(data);
    }
  } catch (error) {
    removeLoadingMessage();
    appendChatMessage('bot', error.message || '답변 생성에 실패했습니다.');
  }

  isDrawing = false;
  drawBtn.disabled = false;
  chatSendBtnEl.disabled = false;
  chatInputEl.disabled = false;
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

birthdateEl.addEventListener('input', clearBirthdateError);
birthdateEl.addEventListener('change', clearBirthdateError);

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
