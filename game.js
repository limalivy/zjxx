// ===== 字库：200 个常用汉字 =====
const CHAR_BANK = [
  '的','一','是','不','了','人','我','在','有','他',
  '这','中','大','来','上','国','个','到','说','们',
  '为','子','和','你','地','出','道','也','时','年',
  '得','就','那','要','下','以','生','会','自','着',
  '过','家','学','对','可','她','里','后','小','么',
  '心','多','天','而','能','好','都','然','没','日',
  '于','起','还','发','成','事','只','作','当','想',
  '看','文','无','开','手','十','用','主','行','方',
  '又','如','前','所','本','见','经','头','面','公',
  '同','三','已','老','从','动','两','长','知','民',
  '样','现','分','将','外','但','身','些','与','高',
  '意','进','把','法','此','实','回','二','理','美',
  '点','月','明','其','种','声','全','工','己','话',
  '正','治','战','体','水','力','军','很','名','使',
  '重','者','山','利','相','度','新','物','气','间',
  '并','关','比','或','最','通','系','问','制','向',
  '业','门','应','加','量','平','命','提','机','它',
  '第','展','万','去','电','教','少','各','代','百',
  '世','处','风','路','常','内','被','西','白','光',
  '金','具','安','合','变','口','先','打','花','觉'
];

// ===== 等级配置（运行时从 levels.json 加载，此为兜底） =====
let LEVELS = [
  { index: 0, name: '练气期', speedMult: 0.5 },
  { index: 1, name: '筑基期', speedMult: 1.0 },
  { index: 2, name: '金丹期', speedMult: 1.5 },
  { index: 3, name: '元婴期', speedMult: 2.0 },
  { index: 4, name: '化神期', speedMult: 2.5 },
];

// ===== DOM 引用 =====
const modeSelect = document.getElementById('mode-select');
const modeLevel = document.getElementById('mode-level');
const modeHighscore = document.getElementById('mode-highscore');
const gameContainer = document.getElementById('game-container');
const charArea = document.getElementById('char-area');
const charInput = document.getElementById('char-input');
const hpBarFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const scoreValue = document.getElementById('score-value');
const flashOverlay = document.getElementById('flash-overlay');
const speedSelectOverlay = document.getElementById('speed-select-overlay');
const pauseBtn = document.getElementById('pause-btn');
const backBtn = document.getElementById('back-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const timerDisplay = document.getElementById('timer-display');
const levelDisplay = document.getElementById('level-display');
const speedDisplay = document.getElementById('speed-display');
const tribulationOverlay = document.getElementById('tribulation-overlay');
const tribulationResultTitle = document.getElementById('tribulation-result-title');
const tribulationResultText = document.getElementById('tribulation-result-text');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverTitle = document.getElementById('gameover-title');
const finalScore = document.getElementById('final-score');
const highScoreInfo = document.getElementById('high-score-info');
const restartBtn = document.getElementById('restart-btn');
const tribulationRetryBtn = document.getElementById('tribulation-retry-btn');
const resumeBtn = document.getElementById('resume-btn');

// ===== 游戏状态 =====
const state = {
  mode: 'cultivate',           // 'cultivate' | 'tribulation' | 'trial'
  hp: 50,
  maxHp: 50,
  score: 0,
  isGameOver: false,
  isPaused: false,
  activeChars: [],             // { char, x, y, speed, el }
  spawnTimerId: null,
  animFrameId: null,
  isComposing: false,
  level: 0,                    // 修仙等级索引 0-4
  cultivateSpeed: 1.0,         // 修炼模式速度倍率
  trialHighScore: 0,
  tribulationTimer: 240,       // 渡劫剩余秒数
  tribulationTimerId: null,
  trialSpeedMult: 0.5,
  trialRampTimerId: null,
};

// ===== 字库索引（循环使用） =====
let charBankIndex = 0;
let shuffledBank = [...CHAR_BANK].sort(() => Math.random() - 0.5);

/** 获取下一个字（打乱后循环取用） */
function nextChar() {
  const ch = shuffledBank[charBankIndex];
  charBankIndex = (charBankIndex + 1) % shuffledBank.length;
  return ch;
}

// ===== 速度计算 =====
/** 获取当前模式的速度倍率 */
function getSpeedMultiplier() {
  if (state.mode === 'tribulation') {
    return LEVELS[state.level] ? LEVELS[state.level].speedMult : 1.0;
  }
  if (state.mode === 'trial') {
    return state.trialSpeedMult;
  }
  return state.cultivateSpeed; // 修炼模式
}

/** 生成一个掉落字 */
function spawnChar() {
  if (state.isGameOver) return;
  if (state.isPaused) return;
  if (state.activeChars.length >= 5) return;

  const char = nextChar();
  // X轴：手机全屏，桌面端约束在中间2/4区域
  const isMobile = window.innerWidth <= 768;
  const x = isMobile
    ? 20 + Math.random() * Math.max(0, window.innerWidth - 40)
    : window.innerWidth * 0.25 + Math.random() * (window.innerWidth * 0.5);
  const y = -(30 + Math.random() * 90);   // -30 ~ -120
  const baseSpeed = 0.5 + Math.random() * 0.7; // 0.5 ~ 1.2 px/frame
  const speed = baseSpeed * getSpeedMultiplier();

  const el = document.createElement('span');
  el.className = 'falling-char';
  el.textContent = char;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  charArea.appendChild(el);

  state.activeChars.push({ char, x, y, speed, el });
}

/** 开始定时刷新 */
function startSpawning() {
  stopSpawning();
  state.spawnTimerId = setInterval(() => {
    spawnChar();
  }, 2500);
}

/** 停止定时刷新 */
function stopSpawning() {
  if (state.spawnTimerId) {
    clearInterval(state.spawnTimerId);
    state.spawnTimerId = null;
  }
}

// ===== 游戏循环 =====
function gameLoop() {
  if (state.isGameOver) return;
  if (state.isPaused) {
    state.animFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  const screenBottom = window.innerHeight;

  // 倒序遍历（方便删除）
  for (let i = state.activeChars.length - 1; i >= 0; i--) {
    const ch = state.activeChars[i];
    ch.y += ch.speed;
    ch.el.style.top = ch.y + 'px';

    // 检测越界
    if (ch.y > screenBottom) {
      removeChar(i);
      takeDamage(2);
    }
  }

  state.animFrameId = requestAnimationFrame(gameLoop);
}

/** 移除指定索引的字（不扣血） */
function removeChar(index) {
  const ch = state.activeChars[index];
  ch.el.remove();
  state.activeChars.splice(index, 1);
}

/** 启动游戏循环 */
function startLoop() {
  if (state.animFrameId) return;
  state.animFrameId = requestAnimationFrame(gameLoop);
}

/** 停止游戏循环 */
function stopLoop() {
  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = null;
  }
}

// ===== HP 管理 =====
function takeDamage(amount) {
  if (state.isGameOver) return;

  state.hp = Math.max(0, state.hp - amount);
  updateHpBar();
  triggerFlash();

  if (state.hp <= 0) {
    handleGameOver();
  }
}

function updateHpBar() {
  const pct = (state.hp / state.maxHp) * 100;
  hpBarFill.style.width = pct + '%';
  hpBarFill.style.backgroundPosition = (100 - pct) + '% 50%';
  hpText.textContent = state.hp + ' / ' + state.maxHp;
}

// ===== 全屏闪烁 =====
function triggerFlash() {
  flashOverlay.classList.remove('fading');
  flashOverlay.classList.add('active');

  requestAnimationFrame(() => {
    flashOverlay.classList.remove('active');
    flashOverlay.classList.add('fading');
  });
}

// ===== 输入处理 =====
charInput.addEventListener('compositionstart', () => {
  state.isComposing = true;
});

charInput.addEventListener('compositionend', (e) => {
  state.isComposing = false;
  const text = e.data || charInput.value;
  if (text) {
    processInput(text);
  }
  charInput.value = '';
});

charInput.addEventListener('input', () => {
  if (!state.isComposing) {
    const text = charInput.value;
    if (text) {
      processInput(text);
      charInput.value = '';
    }
  }
});

/** 处理输入文本，匹配屏幕上的字 */
function processInput(text) {
  if (state.isGameOver) return;
  if (state.isPaused) return;

  const inputChar = text.slice(-1);
  if (!inputChar) return;

  let matched = false;
  for (let i = state.activeChars.length - 1; i >= 0; i--) {
    if (state.activeChars[i].char === inputChar) {
      popChar(i);
      state.score += 10;
      scoreValue.textContent = state.score;
      spawnChar();
      matched = true;
      break;
    }
  }

  if (!matched) {
    takeDamage(1);
  }
}

/** 消除字（带动画） */
function popChar(index) {
  const ch = state.activeChars[index];
  ch.el.classList.add('popping');

  ch.el.addEventListener('animationend', function handler() {
    ch.el.removeEventListener('animationend', handler);
    ch.el.remove();
  }, { once: true });

  state.activeChars.splice(index, 1);
}

// ===== 暂停（修炼模式专用） =====
function togglePause() {
  if (state.mode !== 'cultivate' || state.isGameOver) return;
  if (state.isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  state.isPaused = true;
  charInput.disabled = true;
  pauseOverlay.classList.remove('hidden');
  pauseBtn.textContent = '▶ 继续';
  pauseBtn.classList.add('resume-state');
}

function resumeGame() {
  state.isPaused = false;
  charInput.disabled = false;
  pauseOverlay.classList.add('hidden');
  pauseBtn.textContent = '⏸ 暂停';
  pauseBtn.classList.remove('resume-state');
  charInput.focus();
}

pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', resumeGame);
backBtn.addEventListener('click', backToMenu);

// ===== 修炼速度选择 =====
function showSpeedSelector() {
  speedSelectOverlay.classList.remove('hidden');
  // 高亮上次选择的速度
  document.querySelectorAll('.speed-option').forEach(btn => {
    const speed = parseFloat(btn.getAttribute('data-speed'));
    btn.classList.toggle('selected', speed === state.cultivateSpeed);
  });
}

document.querySelectorAll('.speed-option').forEach(btn => {
  btn.addEventListener('click', () => {
    state.cultivateSpeed = parseFloat(btn.getAttribute('data-speed'));
    saveData();
    speedSelectOverlay.classList.add('hidden');
    startMode('cultivate');
  });
});

document.getElementById('speed-back-btn').addEventListener('click', () => {
  speedSelectOverlay.classList.add('hidden');
});

// 键盘快捷键暂停
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    // 仅在修炼模式且未结束时有效
    if (state.mode === 'cultivate' && !state.isGameOver) {
      e.preventDefault();
      togglePause();
    }
  }
});

// ===== 渡劫计时器 =====
function startTribulationTimer() {
  state.tribulationTimer = 240;
  updateTimerDisplay();
  timerDisplay.classList.remove('hidden');

  state.tribulationTimerId = setInterval(() => {
    if (state.isPaused || state.isGameOver) return;
    state.tribulationTimer--;
    updateTimerDisplay();

    if (state.tribulationTimer <= 0) {
      tribulationSuccess();
    }
  }, 1000);
}

function stopTribulationTimer() {
  if (state.tribulationTimerId) {
    clearInterval(state.tribulationTimerId);
    state.tribulationTimerId = null;
  }
}

function updateTimerDisplay() {
  const min = Math.floor(state.tribulationTimer / 60);
  const sec = state.tribulationTimer % 60;
  timerDisplay.textContent = '剩余 ' + min + ':' + (sec < 10 ? '0' : '') + sec;
}

function tribulationSuccess() {
  state.isGameOver = true;
  stopLoop();
  stopSpawning();
  stopTribulationTimer();

  // 清除所有掉落字
  clearAllChars();

  charInput.disabled = true;

  if (state.level < 4) {
    state.level++;
  }
  saveData();

  tribulationResultTitle.textContent = '渡劫成功！';
  tribulationResultTitle.style.color = '#ffd700';
  tribulationResultText.textContent = '晋升至 ' + LEVELS[state.level].name;
  tribulationRetryBtn.textContent = '继续渡劫';
  tribulationOverlay.classList.remove('hidden');
}

// ===== 试炼速度递增 =====
function startTrialRamp() {
  state.trialSpeedMult = 0.5;
  updateSpeedDisplay();
  speedDisplay.classList.remove('hidden');

  state.trialRampTimerId = setInterval(() => {
    if (state.isGameOver) return;
    state.trialSpeedMult += 0.1;
    updateSpeedDisplay();
  }, 15000);
}

function stopTrialRamp() {
  if (state.trialRampTimerId) {
    clearInterval(state.trialRampTimerId);
    state.trialRampTimerId = null;
  }
}

function updateSpeedDisplay() {
  speedDisplay.textContent = '当前速度 x' + state.trialSpeedMult.toFixed(1);
}

// ===== 模式管理 =====
/** 进入一个游戏模式 */
function startMode(mode) {
  stopLoop();
  stopSpawning();
  stopTribulationTimer();
  stopTrialRamp();
  clearAllChars();

  state.mode = mode;
  state.hp = state.maxHp;
  state.score = 0;
  state.isGameOver = false;
  state.isPaused = false;
  state.activeChars = [];
  state.isComposing = false;
  state.tribulationTimer = 240;
  state.trialSpeedMult = 0.5;

  // 重置 UI
  updateHpBar();
  scoreValue.textContent = '0';
  charInput.disabled = false;
  charInput.value = '';
  charArea.innerHTML = '';
  gameoverOverlay.classList.add('hidden');
  tribulationOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  speedSelectOverlay.classList.add('hidden');
  flashOverlay.classList.remove('active', 'fading');
  highScoreInfo.classList.add('hidden');

  // 隐藏所有模式特定元素
  pauseBtn.classList.add('hidden');
  timerDisplay.classList.add('hidden');
  levelDisplay.classList.add('hidden');
  speedDisplay.classList.add('hidden');

  modeSelect.style.display = 'none';
  gameContainer.classList.remove('hidden');

  // 模式特定初始化
  if (mode === 'cultivate') {
    gameoverTitle.textContent = '道心破碎';
    pauseBtn.classList.remove('hidden');
    pauseBtn.textContent = '⏸ 暂停';
    pauseBtn.classList.remove('resume-state');
  } else if (mode === 'tribulation') {
    gameoverTitle.textContent = '渡劫失败';
    levelDisplay.textContent = '当前境界：' + LEVELS[state.level].name;
    levelDisplay.classList.remove('hidden');
    startTribulationTimer();
  } else if (mode === 'trial') {
    gameoverTitle.textContent = '试炼结束';
    highScoreInfo.classList.remove('hidden');
    highScoreInfo.textContent = '最高分：' + state.trialHighScore;
    startTrialRamp();
  }

  // 重新打乱字库
  shuffledBank = [...CHAR_BANK].sort(() => Math.random() - 0.5);
  charBankIndex = 0;

  // 初始生成 3 个字
  spawnChar();
  spawnChar();
  spawnChar();

  // 启动
  startSpawning();
  startLoop();
  charInput.focus();
}

/** 返回模式选择界面 */
function backToMenu() {
  stopLoop();
  stopSpawning();
  stopTribulationTimer();
  stopTrialRamp();
  clearAllChars();

  state.isGameOver = false;
  state.isPaused = false;
  state.activeChars = [];
  state.isComposing = false;

  charInput.disabled = false;
  charInput.value = '';
  charArea.innerHTML = '';

  gameContainer.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  tribulationOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  speedSelectOverlay.classList.add('hidden');
  flashOverlay.classList.remove('active', 'fading');

  // 更新模式选择界面的信息
  modeLevel.textContent = LEVELS[state.level].name;
  modeHighscore.textContent = state.trialHighScore;

  modeSelect.style.display = '';
}

function clearAllChars() {
  for (const ch of state.activeChars) {
    ch.el.remove();
  }
  state.activeChars = [];
}

// ===== 游戏结束处理 =====
function handleGameOver() {
  state.isGameOver = true;
  stopLoop();
  stopSpawning();

  if (state.mode === 'tribulation') {
    stopTribulationTimer();
    clearAllChars();
    charInput.disabled = true;
    tribulationResultTitle.textContent = '渡劫失败';
    tribulationResultTitle.style.color = '#f44336';
    tribulationResultText.textContent = '道心受挫 · 等级不变';
    tribulationRetryBtn.textContent = '重新渡劫';
    tribulationOverlay.classList.remove('hidden');
    return;
  }

  if (state.mode === 'trial') {
    stopTrialRamp();
    // 更新最高分
    if (state.score > state.trialHighScore) {
      state.trialHighScore = state.score;
      saveData();
    }
    highScoreInfo.textContent = '最高分：' + state.trialHighScore;
    highScoreInfo.classList.remove('hidden');
  }

  // 修炼 / 试炼通用结束
  clearAllChars();
  charInput.disabled = true;
  finalScore.textContent = '最终得分: ' + state.score;
  gameoverOverlay.classList.remove('hidden');
}

// ===== 重新开始（修炼 / 试炼用） =====
function restart() {
  state.hp = state.maxHp;
  state.score = 0;
  state.isGameOver = false;
  state.activeChars = [];
  state.isComposing = false;

  updateHpBar();
  scoreValue.textContent = '0';
  charInput.disabled = false;
  charInput.value = '';
  gameoverOverlay.classList.add('hidden');
  highScoreInfo.classList.add('hidden');
  charArea.innerHTML = '';

  shuffledBank = [...CHAR_BANK].sort(() => Math.random() - 0.5);
  charBankIndex = 0;

  if (state.mode === 'trial') {
    stopTrialRamp();
    state.trialSpeedMult = 0.5;
    updateSpeedDisplay();
    startTrialRamp();
  }

  spawnChar();
  spawnChar();
  spawnChar();
  startSpawning();
  startLoop();
  charInput.focus();
}

restartBtn.addEventListener('click', restart);

// ===== 渡劫重试 =====
tribulationRetryBtn.addEventListener('click', () => {
  tribulationOverlay.classList.add('hidden');
  startMode('tribulation');
});

// ===== 返回按钮 =====
document.querySelectorAll('[id^="back-menu-btn-"]').forEach(btn => {
  btn.addEventListener('click', backToMenu);
});

// ===== 模式选择卡片点击 =====
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.getAttribute('data-mode');
    if (mode === 'cultivate') {
      // 修炼模式：先选速度
      showSpeedSelector();
    } else {
      startMode(mode);
    }
  });
});

// ===== 保持输入框聚焦 =====
document.addEventListener('click', (e) => {
  if (state.isGameOver || state.isPaused) return;
  if (gameContainer.classList.contains('hidden')) return;
  // 不要抢暂停遮罩和结束遮罩的焦点
  if (e.target.closest('#pause-overlay, #gameover-overlay, #tribulation-overlay')) return;
  charInput.focus();
});

// ===== 窗口 resize 处理 =====
window.addEventListener('resize', () => {
  const maxX = window.innerWidth - 100;
  for (const ch of state.activeChars) {
    if (ch.x > maxX) {
      ch.x = maxX;
      ch.el.style.left = maxX + 'px';
    }
  }
});

// ===== 本地存储 =====
const SAVE_KEY = 'zijie-xiuxian-save';

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.level === 'number') state.level = data.level;
      if (typeof data.cultivateSpeed === 'number') state.cultivateSpeed = data.cultivateSpeed;
      if (typeof data.trialHighScore === 'number') state.trialHighScore = data.trialHighScore;
    }
  } catch (e) {
    // 忽略损坏的数据
  }
}

function saveData() {
  try {
    const data = {
      level: state.level,
      cultivateSpeed: state.cultivateSpeed,
      trialHighScore: state.trialHighScore,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // 忽略存储失败
  }
}

// ===== 游戏初始化 =====
async function init() {
  // 加载等级配置
  try {
    const resp = await fetch('levels.json');
    const data = await resp.json();
    if (data.levels && data.levels.length > 0) {
      LEVELS = data.levels;
    }
  } catch (e) {
    // 使用内置兜底配置
  }

  // 加载存档
  loadSaveData();

  // 显示模式选择界面
  modeLevel.textContent = LEVELS[state.level] ? LEVELS[state.level].name : '练气期';
  modeHighscore.textContent = state.trialHighScore;
}

// 启动！
init();
