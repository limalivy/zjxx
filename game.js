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

// ===== DOM 引用 =====
const charArea = document.getElementById('char-area');
const charInput = document.getElementById('char-input');
const hpBarFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const scoreValue = document.getElementById('score-value');
const flashOverlay = document.getElementById('flash-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const finalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// ===== 游戏状态 =====
const state = {
  hp: 50,
  maxHp: 50,
  score: 0,
  isGameOver: false,
  activeChars: [],       // { char, x, y, speed, el }
  spawnTimerId: null,
  animFrameId: null,
  isComposing: false,
};

// ===== 字库索引（循环使用） =====
let charBankIndex = 0;
const shuffledBank = [...CHAR_BANK].sort(() => Math.random() - 0.5);

/** 获取下一个字（打乱后循环取用） */
function nextChar() {
  const ch = shuffledBank[charBankIndex];
  charBankIndex = (charBankIndex + 1) % shuffledBank.length;
  return ch;
}

/** 生成一个掉落字 */
function spawnChar() {
  if (state.isGameOver) return;
  if (state.activeChars.length >= 5) return;

  const char = nextChar();
  const x = 40 + Math.random() * Math.max(0, window.innerWidth - 120);
  const y = -(30 + Math.random() * 90);   // -30 ~ -120
  const speed = 0.5 + Math.random() * 0.7; // 0.5 ~ 1.2 px/frame

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
  if (state.animFrameId) return; // 防止重复启动
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
    gameOver();
  }
}

function updateHpBar() {
  const pct = (state.hp / state.maxHp) * 100;
  hpBarFill.style.width = pct + '%';
  // 血条渐变位置随血量变化（绿→红）
  hpBarFill.style.backgroundPosition = (100 - pct) + '% 50%';
  hpText.textContent = state.hp + ' / ' + state.maxHp;
}

// ===== 全屏闪烁 =====
function triggerFlash() {
  // 重置：移除 fading class，添加 active（立即红色）
  flashOverlay.classList.remove('fading');
  flashOverlay.classList.add('active');

  // 下一帧开始淡出
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
  // IME 组合完成，取最终输入
  const text = e.data || charInput.value;
  if (text) {
    processInput(text);
  }
  charInput.value = '';
});

charInput.addEventListener('input', () => {
  // 非 IME 输入时直接处理（如直接输入英文、数字）
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

  // 取最后一个有效字符（兼容输入法可能带的多余字符）
  const inputChar = text.slice(-1);
  if (!inputChar) return;

  // 在活跃字中查找匹配
  let matched = false;
  for (let i = state.activeChars.length - 1; i >= 0; i--) {
    if (state.activeChars[i].char === inputChar) {
      // 匹配成功！
      popChar(i);
      state.score += 10;
      scoreValue.textContent = state.score;
      spawnChar(); // 打掉即补
      matched = true;
      break;
    }
  }

  if (!matched) {
    // 匹配失败
    takeDamage(1);
  }
}

/** 消除字（带动画） */
function popChar(index) {
  const ch = state.activeChars[index];
  ch.el.classList.add('popping');

  // 动画结束后移除
  ch.el.addEventListener('animationend', function handler() {
    ch.el.removeEventListener('animationend', handler);
    ch.el.remove();
  }, { once: true });

  state.activeChars.splice(index, 1);
}

// ===== 游戏结束 =====
function gameOver() {
  state.isGameOver = true;
  stopLoop();
  stopSpawning();

  // 清除所有掉落字
  for (const ch of state.activeChars) {
    ch.el.remove();
  }
  state.activeChars = [];

  // 禁用输入
  charInput.disabled = true;

  // 显示结束界面
  finalScore.textContent = '最终得分: ' + state.score;
  gameoverOverlay.classList.remove('hidden');
}

// ===== 重新开始 =====
function restart() {
  // 重置状态
  state.hp = state.maxHp;
  state.score = 0;
  state.isGameOver = false;
  state.activeChars = [];
  state.isComposing = false;

  // 重置 UI
  updateHpBar();
  scoreValue.textContent = '0';
  charInput.disabled = false;
  charInput.value = '';
  gameoverOverlay.classList.add('hidden');

  // 清除残留 DOM
  charArea.innerHTML = '';

  // 重新打乱字库
  shuffledBank.sort(() => Math.random() - 0.5);
  charBankIndex = 0;

  // 启动游戏
  startSpawning();
  startLoop();
  charInput.focus();
}

restartBtn.addEventListener('click', restart);

// ===== 游戏初始化 =====
function init() {
  // 初始生成 3 个字，让游戏一开始就有东西
  spawnChar();
  spawnChar();
  spawnChar();

  // 启动定时刷新和游戏循环
  startSpawning();
  startLoop();

  // 聚焦输入框
  charInput.focus();

  // 保持输入框始终聚焦
  document.addEventListener('click', () => {
    if (!state.isGameOver) {
      charInput.focus();
    }
  });
}

// 启动！
init();

// 窗口大小变化时，确保字不会超出边界
window.addEventListener('resize', () => {
  const maxX = window.innerWidth - 100;
  for (const ch of state.activeChars) {
    if (ch.x > maxX) {
      ch.x = maxX;
      ch.el.style.left = maxX + 'px';
    }
  }
});
