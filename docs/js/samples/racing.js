/**
 * レースゲーム - トップビューレース
 */

const ss = window.sprite_system;

// ゲーム状態
const STATE_TITLE = 0;
const STATE_GAME = 1;
const STATE_CRASH = 2;
const STATE_GAMEOVER = 3;
let gameState = STATE_TITLE;

// ゲームオーバー
const GAMEOVER_DURATION = 4.0;
let gameOverTimer = 0;

// クラッシュ
const CRASH_DURATION = 1.5;
let crashTimer = 0;

// 道路パラメータ
const ROAD_LEFT = 24; // 道路左端（ガードレール内側）
const ROAD_RIGHT = 104; // 道路右端（ガードレール内側）
const ROAD_CENTER = 64;
const LANE_1_X = 32; // 左車線中央
const LANE_2_X = 56; // 中央車線中央
const LANE_3_X = 80; // 右車線中央

// スクロール
const BASE_SCROLL_SPEED = 60; // 基本スクロール速度（ピクセル/秒）
const MAX_SCROLL_SPEED = 180;
const ACCEL_AMOUNT = 40; // アクセル加速量
const BRAKE_AMOUNT = 60; // ブレーキ減速量
const SPEED_INCREASE_RATE = 2; // 秒あたりのベース速度上昇
let scrollSpeed = BASE_SCROLL_SPEED;
let currentBaseSpeed = BASE_SCROLL_SPEED;
let scrollOffset = 0;

// 自車
const player = {
  x: ROAD_CENTER,
  y: 100,
  speed: 80 // 左右移動速度（ピクセル/秒）
};

// 敵車
const MAX_RIVALS = 8;
const RIVAL_SPAWN_INTERVAL_BASE = 1.2;
const RIVAL_SPAWN_INTERVAL_MIN = 0.35;
const rivals = [];
let rivalSpawnTimer = 0;
let gameElapsedTime = 0;

// 爆発エフェクト
const MAX_DEBRIS = 8;
const DEBRIS_SPEED = 40;
const DEBRIS_DURATION = 0.5;
const debris = [];

const MAX_PARTICLES = 8;
const PARTICLE_DURATION = 0.4;
const PARTICLE_BLINK_INTERVAL = 0.05;
const particles = [];

// スコアと残機
let score = 0;
let lives = 3;
let highScore = 0;

// 効果音チャンネル
const SFX_CH_ENGINE = 0;
const SFX_CH_CRASH = 1;

// 波形番号
const WAVEFORM_SQUARE_25 = 1;
const WAVEFORM_NOISE = 256;

// エンジン音管理
let engineSoundPlaying = false;
let lastEngineFreq = 0;

// パターン番号
const PAT_PLAYER = 0;
const PAT_RIVAL_1 = 1;
const PAT_RIVAL_2 = 2;
const PAT_RIVAL_3 = 3;
const PAT_DEBRIS_TL = 4;
const PAT_DEBRIS_TR = 5;
const PAT_DEBRIS_BL = 6;
const PAT_DEBRIS_BR = 7;
const PAT_PARTICLE = 8;
const PAT_DIGIT_0 = 10; // 10-19: 数字0-9
const PAT_ROAD = 30; // 道路面
const PAT_LANE_MARK = 31; // 車線マーク（白い点線）
const PAT_LANE_MARK_BLANK = 32; // 車線マーク（空白部分）
const PAT_GUARDRAIL = 33; // ガードレール
const PAT_SHOULDER = 34; // 路肩
const PAT_GRASS = 35; // 草地

// タイトル用文字パターン
const PAT_R = 40;
const PAT_A = 41;
const PAT_C = 42;
const PAT_I = 43;
const PAT_N = 44;
const PAT_G = 45;
const PAT_M = 46;
const PAT_O = 47;
const PAT_E = 48;
const PAT_P = 49;
const PAT_H = 50;
const PAT_S = 51;
const PAT_V = 52;

// スプライト番号
const SPR_PLAYER = 0;
const SPR_RIVAL_START = 1; // 1-8
const SPR_DEBRIS_START = 9; // 9-16
const SPR_PARTICLE_START = 17; // 17-24
const SPR_TITLE_START = 30; // 30-45
const SPR_SCORE_START = 50; // 50-57 (8桁)
const SPR_LIVES_START = 60; // 60-62
const SPR_HI_START = 70; // 70-77 (ハイスコア8桁)
const SPR_HI_LABEL_START = 80; // HI ラベル

// フォントデータ
const FONT = {
  0: [0b00111100, 0b01100110, 0b01101110, 0b01110110, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  1: [0b00011000, 0b00111000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b01111110, 0b00000000],
  2: [0b00111100, 0b01100110, 0b00000110, 0b00011100, 0b00110000, 0b01100000, 0b01111110, 0b00000000],
  3: [0b00111100, 0b01100110, 0b00000110, 0b00011100, 0b00000110, 0b01100110, 0b00111100, 0b00000000],
  4: [0b00001100, 0b00011100, 0b00101100, 0b01001100, 0b01111110, 0b00001100, 0b00001100, 0b00000000],
  5: [0b01111110, 0b01100000, 0b01111100, 0b00000110, 0b00000110, 0b01100110, 0b00111100, 0b00000000],
  6: [0b00111100, 0b01100110, 0b01100000, 0b01111100, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  7: [0b01111110, 0b00000110, 0b00001100, 0b00011000, 0b00110000, 0b00110000, 0b00110000, 0b00000000],
  8: [0b00111100, 0b01100110, 0b01100110, 0b00111100, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  9: [0b00111100, 0b01100110, 0b01100110, 0b00111110, 0b00000110, 0b01100110, 0b00111100, 0b00000000],
  R: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11011000, 0b11001100, 0b11000110, 0b00000000],
  A: [0b00111000, 0b01101100, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  C: [0b01111100, 0b11000110, 0b11000000, 0b11000000, 0b11000000, 0b11000110, 0b01111100, 0b00000000],
  I: [0b00111100, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00111100, 0b00000000],
  N: [0b11000110, 0b11100110, 0b11110110, 0b11011110, 0b11001110, 0b11000110, 0b11000110, 0b00000000],
  G: [0b01111100, 0b11000110, 0b11000000, 0b11001110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  M: [0b11000110, 0b11101110, 0b11111110, 0b11010110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  O: [0b01111100, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  E: [0b11111110, 0b11000000, 0b11000000, 0b11111100, 0b11000000, 0b11000000, 0b11111110, 0b00000000],
  P: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11000000, 0b11000000, 0b11000000, 0b00000000],
  H: [0b11000110, 0b11000110, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  S: [0b01111110, 0b11000000, 0b11000000, 0b01111100, 0b00000110, 0b00000110, 0b11111100, 0b00000000],
  V: [0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01101100, 0b00111000, 0b00010000, 0b00000000],
  " ": [0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]
};

// 自車パターン（上向きのレースカー）
const PLAYER_CAR = [0b00010000, 0b00111000, 0b00111000, 0b01111100, 0b11111110, 0b01111100, 0b01101100, 0b01000100];

// 敵車パターン1（上向き、丸っこい車）
const RIVAL_CAR_1 = [0b00010000, 0b00111000, 0b00111000, 0b01111100, 0b11111110, 0b01111100, 0b01101100, 0b01000100];

// 敵車パターン2（上向き、大きめの車）
const RIVAL_CAR_2 = [0b00010000, 0b00111000, 0b01111100, 0b11111110, 0b11111110, 0b01111100, 0b01101100, 0b01000100];

// 敵車パターン3（上向き、細い車）
const RIVAL_CAR_3 = [0b00011000, 0b00011000, 0b00111100, 0b01111110, 0b01111110, 0b00111100, 0b00111100, 0b00100100];

// 破片パターン
const DEBRIS_TL = [0b11100000, 0b11100000, 0b11000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];
const DEBRIS_TR = [0b00001110, 0b00001110, 0b00000110, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];
const DEBRIS_BL = [0b11000000, 0b11100000, 0b11100000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];
const DEBRIS_BR = [0b00000110, 0b00001110, 0b00001110, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];

// パーティクルパターン
const PARTICLE_PAT = [0b00000000, 0b00110000, 0b01111000, 0b00110000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];

// テキスト用パターンマップ
const TEXT_PATTERN_MAP = {
  R: PAT_R,
  A: PAT_A,
  C: PAT_C,
  I: PAT_I,
  N: PAT_N,
  G: PAT_G,
  M: PAT_M,
  O: PAT_O,
  E: PAT_E,
  P: PAT_P,
  H: PAT_H,
  S: PAT_S,
  V: PAT_V,
  " ": -1
};

/**
 * 効果音: エンジン
 */
function playEngineSound(freq) {
  if (Math.abs(freq - lastEngineFreq) < 5 && engineSoundPlaying) return;
  ss.sound0.play(SFX_CH_ENGINE, {
    frequency: freq,
    waveform: WAVEFORM_SQUARE_25,
    volume: 0.08,
    envelope: { attack: 0.05, decay: 0, sustain: 1, release: 0.05 }
  });
  engineSoundPlaying = true;
  lastEngineFreq = freq;
}

/**
 * 効果音: クラッシュ
 */
function playCrashSound() {
  ss.sound0.stop(SFX_CH_ENGINE);
  engineSoundPlaying = false;
  ss.sound0.play(SFX_CH_CRASH, {
    waveform: WAVEFORM_NOISE,
    volume: 0.3,
    envelope: { attack: 0, decay: 0.5, sustain: 0, release: 0 }
  });
}

/**
 * 道路タイルマップを構築
 */
function buildRoadTilemap() {
  // タイルマップレイヤー0を有効化
  ss.tilemap0.set(0, { priority: 0, offsetX: 0, offsetY: 0 });
  // 道路パターンを作成（灰色ベタ塗り）
  ss.pattern0.setFromString(
    PAT_ROAD,
    "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222"
  );
  // 車線マーク（白の縦線、点線の「ある」部分）
  ss.pattern0.setFromString(
    PAT_LANE_MARK,
    "22212222" + "22212222" + "22212222" + "22212222" + "22212222" + "22212222" + "22212222" + "22212222"
  );
  // 車線マーク（空白部分 = 道路のみ）
  ss.pattern0.setFromString(
    PAT_LANE_MARK_BLANK,
    "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222" + "22222222"
  );
  // ガードレール（白い縦線）
  ss.pattern0.setFromString(
    PAT_GUARDRAIL,
    "12222221" + "12222221" + "12222221" + "12222221" + "12222221" + "12222221" + "12222221" + "12222221"
  );
  // 路肩（薄い色）
  ss.pattern0.setFromString(
    PAT_SHOULDER,
    "33333333" + "33333333" + "33333333" + "33333333" + "33333333" + "33333333" + "33333333" + "33333333"
  );
  // 草地（緑）
  ss.pattern0.setFromString(
    PAT_GRASS,
    "44444444" + "44444444" + "44444444" + "44444444" + "44444444" + "44444444" + "44444444" + "44444444"
  );
  // 128px = 16タイル幅のレイアウト:
  // 0-1: 草地(2) | 2: 路肩(1) | 3: ガードレール(1) | 4-6: 道路(3) | 7: 車線マーク | 8-10: 道路(3) | 11: 車線マーク | 12-14: 道路(3) WAIT
  // 再計算: 128px = 16 tiles
  // col 0,1: 草地 | col 2: 路肩 | col 3: ガードレール | col 4,5: 道路 | col 6: 車線マーク | col 7,8: 道路 | col 9: 車線マーク | col 10,11: 道路 | col 12: ガードレール | col 13: 路肩 | col 14,15: 草地
  for (let ty = 0; ty < 64; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      let pat = PAT_ROAD;
      if (tx <= 1 || tx >= 14) {
        pat = PAT_GRASS;
      } else if (tx === 2 || tx === 13) {
        pat = PAT_SHOULDER;
      } else if (tx === 3 || tx === 12) {
        pat = PAT_GUARDRAIL;
      } else if (tx === 6 || tx === 9) {
        // 車線マーク: 点線（2タイルごとに交互）
        pat = ty % 2 === 0 ? PAT_LANE_MARK : PAT_LANE_MARK_BLANK;
      }
      ss.tilemap0.setTile(0, tx, ty, { palette: 0, pattern: pat });
    }
  }
}

/**
 * タイトル文字を非表示
 */
function hideTitle() {
  for (let i = 0; i < 16; i++) {
    ss.sprite0.disable(SPR_TITLE_START + i);
  }
}

/**
 * タイトル画面を表示
 */
function showTitle() {
  // 「RACING」6文字 = 48px → 中央 (128-48)/2 = 40
  ss.text.draw("RACING", 40, 40, SPR_TITLE_START, TEXT_PATTERN_MAP, { priority: 200 });
  // 「PRESS A」7文字 = 56px → 中央 (128-56)/2 = 36 (PUSH不使用)
  // Aボタン案内は省略（スペース節約）
  ss.sprite0.disable(SPR_PLAYER);
  // ハイスコア表示
  displayHighScore();
}

/**
 * ゲームオーバー画面を表示
 */
function showGameOver() {
  // 「GAME OVER」9文字 = 72px → 中央 (128-72)/2 = 28
  ss.text.draw("GAME OVER", 28, 50, SPR_TITLE_START, TEXT_PATTERN_MAP, { priority: 200 });
  ss.sprite0.disable(SPR_PLAYER);
  gameOverTimer = GAMEOVER_DURATION;
}

/**
 * ゲーム開始
 */
function startGame() {
  hideTitle();
  // 自車初期化
  player.x = ROAD_CENTER;
  player.y = 100;
  ss.sprite0.set(SPR_PLAYER, {
    priority: 100,
    x: Math.floor(player.x) - 4,
    y: Math.floor(player.y),
    palette: 0,
    pattern: PAT_PLAYER
  });
  // 敵車初期化
  rivals.length = 0;
  for (let i = 0; i < MAX_RIVALS; i++) {
    rivals.push({ x: 0, y: 0, speed: 0, pattern: 0, palette: 0, active: false });
    ss.sprite0.disable(SPR_RIVAL_START + i);
  }
  rivalSpawnTimer = 1.0;
  // 爆発初期化
  debris.length = 0;
  for (let i = 0; i < MAX_DEBRIS; i++) {
    debris.push({ x: 0, y: 0, vx: 0, vy: 0, timer: 0, active: false });
    ss.sprite0.disable(SPR_DEBRIS_START + i);
  }
  particles.length = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ x: 0, y: 0, timer: 0, active: false, visible: true });
    ss.sprite0.disable(SPR_PARTICLE_START + i);
  }
  // スコア・状態初期化
  score = 0;
  lives = 3;
  scrollSpeed = BASE_SCROLL_SPEED;
  currentBaseSpeed = BASE_SCROLL_SPEED;
  scrollOffset = 0;
  gameElapsedTime = 0;
  engineSoundPlaying = false;
  lastEngineFreq = 0;
  // HI表示を消す
  for (let i = 0; i < 8; i++) {
    ss.sprite0.disable(SPR_HI_START + i);
  }
  ss.sprite0.disable(SPR_HI_LABEL_START);
  ss.sprite0.disable(SPR_HI_LABEL_START + 1);
}

/**
 * 敵車を出現させる
 */
function spawnRival() {
  for (let i = 0; i < MAX_RIVALS; i++) {
    const rival = rivals[i];
    if (!rival.active) {
      // ランダムな車線に配置
      const lanes = [LANE_1_X, LANE_2_X, LANE_3_X];
      const laneIdx = Math.floor(Math.random() * 3);
      rival.x = lanes[laneIdx] + (Math.random() - 0.5) * 8;
      rival.y = -10;
      // 敵車の絶対速度（自車より遅い）
      rival.speed = 30 + Math.random() * 20;
      // ランダムなパターンとパレット
      const type = Math.floor(Math.random() * 3);
      rival.pattern = PAT_RIVAL_1 + type;
      rival.palette = 1 + type;
      rival.active = true;
      ss.sprite0.set(SPR_RIVAL_START + i, {
        priority: 80,
        x: Math.floor(rival.x) - 4,
        y: Math.floor(rival.y),
        palette: rival.palette,
        pattern: rival.pattern
      });
      break;
    }
  }
}

/**
 * 自車を更新
 */
function updatePlayer(deltaTime) {
  // 左右移動
  let dx = 0;
  if (ss.input0.player1.left) dx -= 1;
  if (ss.input0.player1.right) dx += 1;
  player.x += dx * player.speed * deltaTime;
  // アクセル(A)/ブレーキ(B)、同時押しはブレーキ優先
  if (ss.input0.player1.b) {
    scrollSpeed = Math.max(20, currentBaseSpeed - BRAKE_AMOUNT);
  } else if (ss.input0.player1.a) {
    scrollSpeed = Math.min(MAX_SCROLL_SPEED, currentBaseSpeed + ACCEL_AMOUNT);
  } else {
    scrollSpeed = currentBaseSpeed;
  }
  // エンジン音（速度に応じた周波数）
  const engineFreq = 80 + (scrollSpeed / MAX_SCROLL_SPEED) * 120;
  playEngineSound(engineFreq);
  // ガードレール衝突判定
  if (player.x - 3 < ROAD_LEFT || player.x + 3 > ROAD_RIGHT) {
    player.x = Math.max(ROAD_LEFT + 3, Math.min(ROAD_RIGHT - 3, player.x));
    // ガードレール接触でクラッシュ
    triggerCrash();
    return;
  }
  // スプライト更新
  ss.sprite0.set(SPR_PLAYER, {
    x: Math.floor(player.x) - 4,
    y: Math.floor(player.y)
  });
}

/**
 * 敵車を更新
 */
function updateRivals(deltaTime) {
  gameElapsedTime += deltaTime;
  // ベース速度を徐々に上げる
  currentBaseSpeed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + gameElapsedTime * SPEED_INCREASE_RATE);
  // 出現タイマー
  rivalSpawnTimer -= deltaTime;
  if (rivalSpawnTimer <= 0) {
    spawnRival();
    // 時間経過で出現間隔を短縮
    const interval = Math.max(RIVAL_SPAWN_INTERVAL_MIN, RIVAL_SPAWN_INTERVAL_BASE - gameElapsedTime * 0.008);
    rivalSpawnTimer = interval;
  }
  // 移動
  for (let i = 0; i < MAX_RIVALS; i++) {
    const rival = rivals[i];
    if (!rival.active) continue;
    // 敵車は自車との速度差で移動（自車が速いほど手前に迫る）
    rival.y += (scrollSpeed - rival.speed) * deltaTime;
    // 画面外で消滅（下方向 or ブレーキで上方向に離脱）
    if (rival.y > 136 || rival.y < -16) {
      rival.active = false;
      ss.sprite0.disable(SPR_RIVAL_START + i);
    } else {
      ss.sprite0.set(SPR_RIVAL_START + i, {
        x: Math.floor(rival.x) - 4,
        y: Math.floor(rival.y)
      });
    }
  }
}

/**
 * 敵車との衝突判定
 */
function checkRivalCollision() {
  for (let i = 0; i < MAX_RIVALS; i++) {
    const rival = rivals[i];
    if (!rival.active) continue;
    const dx = rival.x - player.x;
    const dy = rival.y - player.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 49) {
      // 衝突
      rival.active = false;
      ss.sprite0.disable(SPR_RIVAL_START + i);
      spawnExplosion(rival.x, rival.y);
      triggerCrash();
      return;
    }
  }
}

/**
 * クラッシュ処理
 */
function triggerCrash() {
  playCrashSound();
  spawnExplosion(player.x, player.y);
  lives--;
  if (lives <= 0) {
    gameState = STATE_GAMEOVER;
    if (score > highScore) highScore = score;
    showGameOver();
  } else {
    gameState = STATE_CRASH;
    crashTimer = CRASH_DURATION;
    ss.sprite0.disable(SPR_PLAYER);
  }
}

/**
 * クラッシュ後の復帰
 */
function updateCrash(deltaTime) {
  crashTimer -= deltaTime;
  updateExplosions(deltaTime);
  // 敵車を流し続ける（ただし新規出現は抑制）
  for (let i = 0; i < MAX_RIVALS; i++) {
    const rival = rivals[i];
    if (!rival.active) continue;
    rival.y += (BASE_SCROLL_SPEED * 0.3 - rival.speed) * deltaTime;
    if (rival.y > 136 || rival.y < -16) {
      rival.active = false;
      ss.sprite0.disable(SPR_RIVAL_START + i);
    } else {
      ss.sprite0.set(SPR_RIVAL_START + i, {
        x: Math.floor(rival.x) - 4,
        y: Math.floor(rival.y)
      });
    }
  }
  // スクロールは緩やかに続ける
  scrollOffset += BASE_SCROLL_SPEED * 0.3 * deltaTime;
  ss.tilemap0.set(0, { offsetY: Math.floor(scrollOffset) });
  if (crashTimer <= 0) {
    // 復帰
    gameState = STATE_GAME;
    player.x = ROAD_CENTER;
    player.y = 100;
    ss.sprite0.set(SPR_PLAYER, {
      priority: 100,
      x: Math.floor(player.x) - 4,
      y: Math.floor(player.y),
      palette: 0,
      pattern: PAT_PLAYER
    });
  }
}

/**
 * 爆発エフェクト生成
 */
function spawnExplosion(x, y) {
  const directions = [
    { vx: -1, vy: -1, pattern: PAT_DEBRIS_TL },
    { vx: 1, vy: -1, pattern: PAT_DEBRIS_TR },
    { vx: -1, vy: 1, pattern: PAT_DEBRIS_BL },
    { vx: 1, vy: 1, pattern: PAT_DEBRIS_BR }
  ];
  for (let d = 0; d < 4; d++) {
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const piece = debris[i];
      if (!piece.active) {
        piece.x = x;
        piece.y = y;
        piece.vx = directions[d].vx * DEBRIS_SPEED;
        piece.vy = directions[d].vy * DEBRIS_SPEED;
        piece.timer = DEBRIS_DURATION;
        piece.active = true;
        ss.sprite0.set(SPR_DEBRIS_START + i, {
          priority: 110,
          x: Math.floor(piece.x),
          y: Math.floor(piece.y),
          palette: 0,
          pattern: directions[d].pattern
        });
        break;
      }
    }
  }
  for (let p = 0; p < 4; p++) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const particle = particles[i];
      if (!particle.active) {
        particle.x = x + (Math.random() - 0.5) * 16;
        particle.y = y + (Math.random() - 0.5) * 16;
        particle.timer = PARTICLE_DURATION;
        particle.active = true;
        particle.visible = true;
        ss.sprite0.set(SPR_PARTICLE_START + i, {
          priority: 115,
          x: Math.floor(particle.x),
          y: Math.floor(particle.y),
          palette: 0,
          pattern: PAT_PARTICLE
        });
        break;
      }
    }
  }
}

/**
 * 爆発エフェクト更新
 */
function updateExplosions(deltaTime) {
  for (let i = 0; i < MAX_DEBRIS; i++) {
    const piece = debris[i];
    if (!piece.active) continue;
    piece.x += piece.vx * deltaTime;
    piece.y += piece.vy * deltaTime;
    piece.timer -= deltaTime;
    if (piece.timer <= 0) {
      piece.active = false;
      ss.sprite0.disable(SPR_DEBRIS_START + i);
    } else {
      ss.sprite0.set(SPR_DEBRIS_START + i, {
        x: Math.floor(piece.x),
        y: Math.floor(piece.y)
      });
    }
  }
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const particle = particles[i];
    if (!particle.active) continue;
    particle.timer -= deltaTime;
    if (particle.timer <= 0) {
      particle.active = false;
      ss.sprite0.disable(SPR_PARTICLE_START + i);
    } else {
      const blinkPhase = Math.floor(particle.timer / PARTICLE_BLINK_INTERVAL);
      particle.visible = blinkPhase % 2 === 0;
      if (particle.visible) {
        ss.sprite0.set(SPR_PARTICLE_START + i, {
          priority: 115,
          x: Math.floor(particle.x),
          y: Math.floor(particle.y),
          palette: 0,
          pattern: PAT_PARTICLE
        });
      } else {
        ss.sprite0.disable(SPR_PARTICLE_START + i);
      }
    }
  }
}

/**
 * スコア表示
 */
function displayScore() {
  const str = String(score).padStart(8, "0");
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(str[i], 10);
    ss.sprite0.set(SPR_SCORE_START + i, {
      priority: 200,
      x: i * 8,
      y: 0,
      palette: 0,
      pattern: PAT_DIGIT_0 + digit
    });
  }
}

/**
 * ハイスコア表示
 */
function displayHighScore() {
  if (highScore <= 0) return;
  const str = String(highScore).padStart(8, "0");
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(str[i], 10);
    ss.sprite0.set(SPR_HI_START + i, {
      priority: 200,
      x: 32 + i * 8,
      y: 60,
      palette: 0,
      pattern: PAT_DIGIT_0 + digit
    });
  }
}

/**
 * 残機表示
 */
function displayLives() {
  for (let i = 0; i < 3; i++) {
    if (i < lives) {
      ss.sprite0.set(SPR_LIVES_START + i, {
        priority: 200,
        x: 104 + i * 8,
        y: 0,
        palette: 0,
        pattern: PAT_PLAYER
      });
    } else {
      ss.sprite0.disable(SPR_LIVES_START + i);
    }
  }
}

/**
 * 全スプライトクリア（タイトル復帰時）
 */
function clearAllSprites() {
  for (let i = 0; i < MAX_RIVALS; i++) {
    ss.sprite0.disable(SPR_RIVAL_START + i);
  }
  for (let i = 0; i < MAX_DEBRIS; i++) {
    ss.sprite0.disable(SPR_DEBRIS_START + i);
  }
  for (let i = 0; i < MAX_PARTICLES; i++) {
    ss.sprite0.disable(SPR_PARTICLE_START + i);
  }
  for (let i = 0; i < 8; i++) {
    ss.sprite0.disable(SPR_SCORE_START + i);
  }
  for (let i = 0; i < 3; i++) {
    ss.sprite0.disable(SPR_LIVES_START + i);
  }
}

/**
 * 初期化
 */
ss.onReady = function () {
  // パレット0: 道路/自車/フォント
  ss.palette0.setColor(0, 1, 255, 255, 255); // 白（ガードレール、フォント）
  ss.palette0.setColor(0, 2, 80, 80, 90); // 灰色（道路面）
  ss.palette0.setColor(0, 3, 60, 70, 50); // 暗い緑灰（路肩）
  ss.palette0.setColor(0, 4, 30, 80, 30); // 緑（草地）
  ss.palette0.setColor(0, 5, 100, 180, 255); // 水色（自車）
  // パレット1: 敵車1（赤）
  ss.palette0.setColor(1, 1, 255, 80, 80);
  ss.palette0.setColor(1, 2, 200, 50, 50);
  // パレット2: 敵車2（黄）
  ss.palette0.setColor(2, 1, 255, 230, 60);
  ss.palette0.setColor(2, 2, 200, 180, 40);
  // パレット3: 敵車3（緑）
  ss.palette0.setColor(3, 1, 80, 255, 120);
  ss.palette0.setColor(3, 2, 50, 200, 80);
  // 自車パターン（水色: カラーインデックス5）
  ss.pattern0.setFromBitmap(PAT_PLAYER, PLAYER_CAR, 5);
  // 敵車パターン（カラーインデックス1を使用、パレットで色分け）
  ss.pattern0.setFromBitmap(PAT_RIVAL_1, RIVAL_CAR_1, 1);
  ss.pattern0.setFromBitmap(PAT_RIVAL_2, RIVAL_CAR_2, 1);
  ss.pattern0.setFromBitmap(PAT_RIVAL_3, RIVAL_CAR_3, 1);
  // 爆発パターン
  ss.pattern0.setFromBitmap(PAT_DEBRIS_TL, DEBRIS_TL, 1);
  ss.pattern0.setFromBitmap(PAT_DEBRIS_TR, DEBRIS_TR, 1);
  ss.pattern0.setFromBitmap(PAT_DEBRIS_BL, DEBRIS_BL, 1);
  ss.pattern0.setFromBitmap(PAT_DEBRIS_BR, DEBRIS_BR, 1);
  ss.pattern0.setFromBitmap(PAT_PARTICLE, PARTICLE_PAT, 1);
  // 数字パターン
  for (let i = 0; i <= 9; i++) {
    ss.pattern0.setFromBitmap(PAT_DIGIT_0 + i, FONT[i], 1);
  }
  // タイトル文字パターン
  ss.pattern0.setFromBitmap(PAT_R, FONT.R, 1);
  ss.pattern0.setFromBitmap(PAT_A, FONT.A, 1);
  ss.pattern0.setFromBitmap(PAT_C, FONT.C, 1);
  ss.pattern0.setFromBitmap(PAT_I, FONT.I, 1);
  ss.pattern0.setFromBitmap(PAT_N, FONT.N, 1);
  ss.pattern0.setFromBitmap(PAT_G, FONT.G, 1);
  ss.pattern0.setFromBitmap(PAT_M, FONT.M, 1);
  ss.pattern0.setFromBitmap(PAT_O, FONT.O, 1);
  ss.pattern0.setFromBitmap(PAT_E, FONT.E, 1);
  ss.pattern0.setFromBitmap(PAT_P, FONT.P, 1);
  ss.pattern0.setFromBitmap(PAT_H, FONT.H, 1);
  ss.pattern0.setFromBitmap(PAT_S, FONT.S, 1);
  ss.pattern0.setFromBitmap(PAT_V, FONT.V, 1);
  // 道路タイルマップを構築
  buildRoadTilemap();
  // タイトル画面
  showTitle();
};

/**
 * 毎フレーム更新
 */
ss.onUpdate = function (deltaTime) {
  if (gameState === STATE_TITLE) {
    // タイトル画面のスクロール演出
    scrollOffset += BASE_SCROLL_SPEED * 0.5 * deltaTime;
    ss.tilemap0.set(0, { offsetY: Math.floor(scrollOffset) });
    if (ss.input0.player1.a) {
      gameState = STATE_GAME;
      startGame();
    }
  } else if (gameState === STATE_GAME) {
    updatePlayer(deltaTime);
    updateRivals(deltaTime);
    checkRivalCollision();
    updateExplosions(deltaTime);
    // スクロール
    scrollOffset += scrollSpeed * deltaTime;
    ss.tilemap0.set(0, { offsetY: Math.floor(scrollOffset) });
    // スコア加算（走行距離ベース）
    score += Math.floor(scrollSpeed * deltaTime);
    displayScore();
    displayLives();
  } else if (gameState === STATE_CRASH) {
    updateCrash(deltaTime);
    displayScore();
    displayLives();
  } else if (gameState === STATE_GAMEOVER) {
    updateExplosions(deltaTime);
    // 緩やかにスクロール継続
    scrollOffset += BASE_SCROLL_SPEED * 0.2 * deltaTime;
    ss.tilemap0.set(0, { offsetY: Math.floor(scrollOffset) });
    gameOverTimer -= deltaTime;
    if (gameOverTimer <= 0) {
      clearAllSprites();
      hideTitle();
      gameState = STATE_TITLE;
      showTitle();
    }
  }
};

// 初期化実行
window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("screen");
  ss.init(canvas);
});
