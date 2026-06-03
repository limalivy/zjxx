// ===== 字集管理（运行时从 data/char-sets.json 加载） =====
// 所有可用字集：{ name -> words[] }
const charSets = {};

// 当前使用的字集（init 中从清单加载后设置）
let activeCharBank = [];
let activeCharSetName = '';

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
const charsetName = document.getElementById('charset-name');
const charsetPrev = document.getElementById('charset-prev');
const charsetNext = document.getElementById('charset-next');
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
const cultivateTimer = document.getElementById('cultivate-timer');
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
  lastFrameTime: 0,             // 上一帧时间戳，用于 delta time
  // 修炼模式：练习系统
  practiceList: [],            // 当前高概率掉落的字
  pendingPractice: [],         // 等待 10 秒后激活 [{char, activateAt}]
  consecutiveCorrect: 0,       // 连续正确次数
  pendingWrong: null,          // 用户刚输入错的字符
  gameStartTime: 0,            // 本局开始时间戳
  cultivateTimerId: null,      // 修炼计时器
  lastScreenHeight: 0,         // 上一帧屏幕高度（检测键盘弹起）
  practicedChars: new Set(),    // 修炼模式：本轮已正确打出的字
};

// ===== 字库索引（循环使用） =====
let charBankIndex = 0;
let shuffledBank = [...activeCharBank].sort(() => Math.random() - 0.5);

/** 获取下一个字（打乱后循环取用，修炼模式优先未练字、练习字有更高概率） */
function nextChar() {
  // 修炼模式：练习列表中的字有 50% 概率被选中
  if (state.mode === 'cultivate' && state.practiceList.length > 0 && Math.random() < 0.5) {
    return state.practiceList[Math.floor(Math.random() * state.practiceList.length)];
  }
  // 修炼模式：80% 概率优先出未练过的字
  if (state.mode === 'cultivate') {
    const unpracticed = activeCharBank.filter(c => !state.practicedChars.has(c));
    if (unpracticed.length === 0) {
      state.practicedChars.clear();
      unpracticed.push(...activeCharBank);
    }
    if (Math.random() < 0.8) {
      return unpracticed[Math.floor(Math.random() * unpracticed.length)];
    }
  }
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

// ===== 练习系统（修炼模式） =====
/** 将字加入延迟练习队列，10 秒后激活高概率掉落 */
function addToPractice(char) {
  // 避免重复添加（已在 pending 或 practice 中）
  if (state.practiceList.includes(char)) return;
  if (state.pendingPractice.some(p => p.char === char)) return;
  state.pendingPractice.push({ char, activateAt: Date.now() + 10000 });
}

/** 生成一个掉落字 */
function spawnChar() {
  if (state.isGameOver) return;
  if (state.isPaused) return;
  if (state.activeChars.length >= 5) return;

  let char = nextChar();
  // 同屏不能出现一样的字，最多重试 10 次
  for (let retry = 0; retry < 10; retry++) {
    if (state.activeChars.some(c => c.char === char)) {
      char = nextChar();
    } else {
      break;
    }
  }
  // X轴：手机全屏，桌面端约束在中间2/4区域
  const isMobile = window.innerWidth <= 768;
  const x = isMobile
    ? 20 + Math.random() * Math.max(0, window.innerWidth - 40)
    : window.innerWidth * 0.25 + Math.random() * (window.innerWidth * 0.5);
  const y = -(30 + Math.random() * 90);   // -30 ~ -120
  // 速度以 1080p 60Hz 为基准：转为 px/s 并按屏幕高度等比缩放
  const REFERENCE_HEIGHT = 1080;
  const REFERENCE_FPS = 60;
  const baseSpeedPxPerSec = (0.5 + Math.random() * 0.7) * REFERENCE_FPS * 2; // 60~144 px/s（1080p 基准）
  const heightScale = window.innerHeight / REFERENCE_HEIGHT;
  const mobileFactor = window.innerWidth <= 768 ? 0.7 : 1.0;
  const speed = baseSpeedPxPerSec * getSpeedMultiplier() * heightScale * mobileFactor; // px/s

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
  const now = Date.now();

  // 计算帧间隔（秒），首帧用 1/60 避免跳跃
  const deltaTime = state.lastFrameTime ? (now - state.lastFrameTime) / 1000 : 1 / 60;
  state.lastFrameTime = now;

  // 检测键盘弹起导致的屏幕高度骤降（手机常见）
  const heightDrop = state.lastScreenHeight - screenBottom;
  if (heightDrop > 100 && state.lastScreenHeight > 0) {
    // 键盘弹起，将底部字上移而非杀死
    for (const ch of state.activeChars) {
      if (ch.y > screenBottom - 60) {
        ch.y = Math.max(10, screenBottom - 60 - Math.random() * 80);
        ch.el.style.top = ch.y + 'px';
      }
    }
  }
  state.lastScreenHeight = screenBottom;

  // 修炼模式：延迟练习字 10 秒后激活
  if (state.mode === 'cultivate' && state.pendingPractice.length > 0) {
    for (let i = state.pendingPractice.length - 1; i >= 0; i--) {
      if (state.pendingPractice[i].activateAt <= now) {
        const char = state.pendingPractice[i].char;
        if (!state.practiceList.includes(char)) {
          state.practiceList.push(char);
        }
        state.pendingPractice.splice(i, 1);
      }
    }
  }

  // 倒序遍历（方便删除）
  for (let i = state.activeChars.length - 1; i >= 0; i--) {
    const ch = state.activeChars[i];
    ch.y += ch.speed * deltaTime;
    ch.el.style.top = ch.y + 'px';

    // 检测越界
    if (ch.y > screenBottom) {
      // 修炼模式：掉落的字加入练习列表
      if (state.mode === 'cultivate') {
        addToPractice(ch.char);
      }
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

      // 修炼模式：记录已练字
      if (state.mode === 'cultivate') {
        state.practicedChars.add(inputChar);
      }

      // 修炼模式：如果之前有 pendingWrong，当前匹配到的字就是用户本想打的字
      if (state.mode === 'cultivate' && state.pendingWrong) {
        addToPractice(inputChar);
        state.pendingWrong = null;
        state.consecutiveCorrect = 0;
      } else if (state.mode === 'cultivate') {
        state.consecutiveCorrect++;
        if (state.consecutiveCorrect >= 2) {
          state.practiceList = [];
          state.pendingPractice = [];
          state.consecutiveCorrect = 0;
        }
      }

      matched = true;
      break;
    }
  }

  if (!matched) {
    if (state.mode === 'cultivate') {
      // 记录 pendingWrong，下次正确输入的字即为目标错字
      state.pendingWrong = inputChar;
      state.consecutiveCorrect = 0;
    }
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
const speedInput = document.getElementById('speed-input');
const speedConfirmBtn = document.getElementById('speed-confirm-btn');
const speedBackBtn2 = document.getElementById('speed-back-btn');

function showSpeedSelector() {
  speedInput.value = state.cultivateSpeed;
  speedSelectOverlay.classList.remove('hidden');
  speedInput.focus();
}

speedConfirmBtn.addEventListener('click', () => {
  const speed = parseFloat(speedInput.value);
  if (isNaN(speed) || speed <= 0) return;
  state.cultivateSpeed = Math.round(speed * 10) / 10; // 保留一位小数
  saveData();
  speedSelectOverlay.classList.add('hidden');
  startMode('cultivate');
});

// 回车也可确认
speedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    speedConfirmBtn.click();
  }
});

speedBackBtn2.addEventListener('click', () => {
  speedSelectOverlay.classList.add('hidden');
});

// 键盘快捷键暂停
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
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

  if (state.level < LEVELS.length - 1) {
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

// ===== 修炼计时器 =====
function startCultivateTimer() {
  state.gameStartTime = Date.now();
  cultivateTimer.classList.remove('hidden');
  updateCultivateTimer();
  state.cultivateTimerId = setInterval(() => {
    if (state.isPaused || state.isGameOver) return;
    updateCultivateTimer();
  }, 1000);
}

function stopCultivateTimer() {
  if (state.cultivateTimerId) {
    clearInterval(state.cultivateTimerId);
    state.cultivateTimerId = null;
  }
}

function updateCultivateTimer() {
  const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  cultivateTimer.textContent = '修炼时间 ' + min + ':' + (sec < 10 ? '0' : '') + sec;
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
  state.practiceList = [];
  state.pendingPractice = [];
  state.consecutiveCorrect = 0;
  state.pendingWrong = null;
  state.practicedChars = new Set();
  state.lastScreenHeight = window.innerHeight;
  state.lastFrameTime = 0;
  stopCultivateTimer();

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
  cultivateTimer.classList.add('hidden');
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
    startCultivateTimer();
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
  shuffledBank = [...activeCharBank].sort(() => Math.random() - 0.5);
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
  stopCultivateTimer();
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
  charsetName.textContent = activeCharSetName;
  modeLevel.textContent = LEVELS[state.level] ? LEVELS[state.level].name : '练气期';
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
  stopCultivateTimer();
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

  shuffledBank = [...activeCharBank].sort(() => Math.random() - 0.5);
  charBankIndex = 0;

  if (state.mode === 'cultivate') {
    state.practiceList = [];
    state.pendingPractice = [];
    state.consecutiveCorrect = 0;
    state.pendingWrong = null;
    state.practicedChars = new Set();
    stopCultivateTimer();
    startCultivateTimer();
  }

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
      showSpeedSelector();
    } else {
      startMode(mode);
    }
  });
});

// ===== 字集切换 =====
function getCharSetList() {
  return Object.keys(charSets);
}

function switchCharSet(name) {
  if (!charSets[name] || activeCharSetName === name) return;

  // 保存当前字集记录
  saveData();

  // 切换
  activeCharSetName = name;
  activeCharBank = charSets[name];

  // 加载新字集记录
  state.level = 0;
  state.trialHighScore = 0;
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw) {
      const records = JSON.parse(raw);
      const rec = records[activeCharSetName];
      if (rec) {
        state.level = rec.level || 0;
        state.trialHighScore = rec.trialHighScore || 0;
      }
    }
  } catch (e) { /* 忽略 */ }

  // 更新 UI
  charsetName.textContent = name;
  updateModeInfo();
  saveData();
}

function updateModeInfo() {
  modeLevel.textContent = LEVELS[state.level] ? LEVELS[state.level].name : '练气期';
  modeHighscore.textContent = state.trialHighScore;
}

charsetPrev.addEventListener('click', () => {
  const list = getCharSetList();
  const idx = list.indexOf(activeCharSetName);
  const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
  switchCharSet(prev);
});

charsetNext.addEventListener('click', () => {
  const list = getCharSetList();
  const idx = list.indexOf(activeCharSetName);
  const next = idx < list.length - 1 ? list[idx + 1] : list[0];
  switchCharSet(next);
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

// 字集记录的 localStorage key（独立存储）
const RECORDS_KEY = 'zijie-xiuxian-records';

function saveData() {
  // 保存全局设置
  try {
    const data = {
      currentCharSet: activeCharSetName,
      cultivateSpeed: state.cultivateSpeed,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 忽略 */ }

  // 保存当前字集记录
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const records = raw ? JSON.parse(raw) : {};
    records[activeCharSetName] = {
      level: state.level,
      trialHighScore: state.trialHighScore,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) { /* 忽略 */ }
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
  } catch (e) { /* 使用兜底 */ }

  // 加载字集清单，按清单逐个加载字集文件
  try {
    const manifestResp = await fetch('data/char-sets.json');
    const manifest = await manifestResp.json();
    for (const file of manifest) {
      try {
        const resp = await fetch('data/' + file);
        const csData = await resp.json();
        if (csData.words && csData.words.length > 0) {
          charSets[csData.title] = csData.words;
        }
      } catch (e) { /* 跳过加载失败的单个字集 */ }
    }
  } catch (e) { /* 清单加载失败则无字集可用 */ }

  // 无字集时的保护
  if (Object.keys(charSets).length === 0) {
    charsetName.textContent = '无字集可用';
    return;
  }

  // 加载存档
  let savedCharSet = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.cultivateSpeed === 'number') state.cultivateSpeed = data.cultivateSpeed;
      if (typeof data.currentCharSet === 'string') savedCharSet = data.currentCharSet;
    }
  } catch (e) { /* 忽略 */ }

  // 设置当前字集
  if (savedCharSet && charSets[savedCharSet]) {
    activeCharSetName = savedCharSet;
  } else {
    activeCharSetName = Object.keys(charSets)[0];
  }
  activeCharBank = charSets[activeCharSetName];

  // 加载字集独立记录
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw) {
      const records = JSON.parse(raw);
      const rec = records[activeCharSetName];
      if (rec) {
        state.level = rec.level || 0;
        state.trialHighScore = rec.trialHighScore || 0;
      }
    }
  } catch (e) { /* 忽略 */ }

  // 显示模式选择界面
  charsetName.textContent = activeCharSetName;
  modeLevel.textContent = LEVELS[state.level] ? LEVELS[state.level].name : '练气期';
  modeHighscore.textContent = state.trialHighScore;
}

// 启动！
init();
