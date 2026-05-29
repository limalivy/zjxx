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
  const x = 40 + Math.random() * (window.innerWidth - 120);
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
