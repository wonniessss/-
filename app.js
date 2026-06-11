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

let setCount = 1;
let isDrawing = false;

function getBallColor(num) {
  if (num <= 10) return 'yellow';
  if (num <= 20) return 'blue';
  if (num <= 30) return 'red';
  if (num <= 40) return 'gray';
  return 'green';
}

function generateNumbers() {
  const pool = Array.from({ length: MAX }, (_, i) => i + MIN);
  const main = [];

  for (let i = 0; i < PICK; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    main.push(pool.splice(idx, 1)[0]);
  }

  const bonusIdx = Math.floor(Math.random() * pool.length);
  const bonus = pool[bonusIdx];

  return {
    main: main.sort((a, b) => a - b),
    bonus,
  };
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

async function draw() {
  if (isDrawing) return;
  isDrawing = true;
  drawBtn.disabled = true;
  drawBtn.classList.add('drawing');

  emptyStateEl.style.display = 'none';
  resultsEl.innerHTML = '';

  const allNumbers = Array.from({ length: setCount }, () => generateNumbers());
  const setElements = allNumbers.map((nums, i) => createLottoSet(nums, i, true));

  setElements.forEach(({ set }) => resultsEl.appendChild(set));

  for (const { balls, copyBtn, main, bonus } of setElements) {
    await animateReveal(balls, main, bonus, copyBtn);
    await new Promise((r) => setTimeout(r, 100));
  }

  isDrawing = false;
  drawBtn.disabled = false;
  drawBtn.classList.remove('drawing');
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
