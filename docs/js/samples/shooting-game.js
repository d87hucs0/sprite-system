/**
 * シューティングゲーム - サンプル
 */

const ss = window.sprite_system;

// ゲーム状態
const STATE_TITLE = 0;
const STATE_GAME = 1;
const STATE_GAMEOVER = 2;
let gameState = STATE_TITLE;

// ゲームオーバー
const GAMEOVER_DURATION = 5.0; // 秒
let gameOverTimer = 0;

// 自機
const player = {
  x: 60,
  y: 100,
  speed: 60 // ピクセル/秒
};

// 自機の弾
const MAX_PLAYER_BULLETS = 25;
const BULLET_SPEED = 200; // ピクセル/秒
const playerBullets = []; // { x, y, vx, vy, active }

// パワーアップ
const POWERUP_LEVEL_MAX = 4;
let powerUpLevel = 1;

const BULLET_ANGLES = {
  1: [0], // 正面のみ
  2: [-10, 10], // 2WAY
  3: [-10, 0, 10], // 3WAY
  4: [-30, -10, 0, 10, 30] // 5WAY
};

// 特別敵
const SPECIAL_ENEMY_HP = 5;
const SPECIAL_ENEMY_TIMES = [30, 60, 90, 120, 150];
const SPECIAL_ENEMY_INTERVAL_F = 60; // パターンF以降の間隔
let specialEnemySpawned = [false, false, false, false, false];
let lastSpecialEnemyTime = 150; // パターンF用

// パワーアップアイテム
const MAX_POWERUP_ITEMS = 4;
const POWERUP_STAY_DURATION = 5.0;
const POWERUP_FLOAT_SPEED = 30;
const powerUpItems = []; // { x, y, timer, floating, active }

// 敵
const MAX_ENEMIES = 10;
const ENEMY_SPEED = 40; // ピクセル/秒
const ENEMY_SPAWN_INTERVAL = 1.0; // 出現間隔（秒）
const ENEMY_SHOOT_INTERVAL = 2.0; // 敵の発射間隔（秒）
const enemies = []; // { x, y, vx, active, shootTimer, pattern, hasFiredAtPlayer, spawnTimer, hasInitialShot, bulletsFired, baseAngle, hp, isSpecial }
let enemySpawnTimer = 0;

// 敵パターン
const ENEMY_PATTERN_A = 0; // 下方向移動、出現0.75秒後に弾発射
const ENEMY_PATTERN_B = 1; // 下方向移動、X一致で弾発射＆横移動追加
const ENEMY_PATTERN_C = 2; // 下方向移動、出現0.75秒後に自機狙い弾 + X一致で4WAY弾＆横移動
const ENEMY_PATTERN_D = 3; // 下方向移動、X一致で16方向弾＆横移動追加
const ENEMY_PATTERN_E = 4; // 下方向移動、回転弾（自機狙い起点で16方向×2周）
const ENEMY_PATTERN_F = 5; // 下方向移動、回転弾（16方向×1周）+ 0.5秒後に自機狙い＆加速
const SPECIAL_ENEMY_PATTERNS = [ENEMY_PATTERN_A, ENEMY_PATTERN_B, ENEMY_PATTERN_C, ENEMY_PATTERN_D, ENEMY_PATTERN_E];

// ゲームフェーズ（経過時間ベース）
// 0-5: なし → 5-30: A → 30-35: なし → 35-60: B → 60-65: なし → 65-90: C → 90-95: なし → 95-120: D → 120-125: なし → 125-150: E → 150-155: なし → 155以降: F
const PHASE_BREAK_DURATION = 5.0; // 出現なしの期間
const PHASE_PATTERN_DURATION = 25.0; // 各パターンの期間
const ENEMY_X_MATCH_THRESHOLD = 4; // X座標一致判定の許容範囲（±4ピクセル）
let gameElapsedTime = 0; // ゲーム開始からの経過時間

// 敵の弾
const MAX_ENEMY_BULLETS = 64; // 16方向弾対応のため増加
const ENEMY_BULLET_SPEED = 80; // ピクセル/秒
const enemyBullets = []; // { x, y, vx, vy, active, timer, hasRedirected }

// スコアと残機
let score = 0;
let lives = 3;

// 爆発エフェクト
const MAX_DEBRIS = 20; // 5爆発 × 4破片
const DEBRIS_SPEED = 30; // ピクセル/秒
const DEBRIS_DURATION = 0.4; // 秒（範囲2/3、速度半分）
const debris = []; // { x, y, vx, vy, timer, active }

const MAX_PARTICLES = 10;
const PARTICLE_DURATION = 0.3; // 秒
const PARTICLE_BLINK_INTERVAL = 0.05; // 点滅間隔（秒）
const particles = []; // { x, y, timer, active, visible }

// 無敵状態
const INVINCIBLE_DURATION = 1.0; // 秒
const INVINCIBLE_BLINK_INTERVAL = 0.05; // 点滅間隔（秒）
const INVINCIBLE_SHAKE_AMOUNT = 2; // ブレ幅（ピクセル）
let invincibleTimer = 0; // 0より大きい間は無敵

// 8方向オフセット（無敵時のブレ用）
const SHAKE_DIRECTIONS = [
  { dx: 0, dy: -1 }, // 上
  { dx: 1, dy: -1 }, // 右上
  { dx: 1, dy: 0 }, // 右
  { dx: 1, dy: 1 }, // 右下
  { dx: 0, dy: 1 }, // 下
  { dx: -1, dy: 1 }, // 左下
  { dx: -1, dy: 0 }, // 左
  { dx: -1, dy: -1 } // 左上
];

// 効果音チャンネル割り当て（sound0: 4チャネル共通）
const SFX_CH_PLAYER_SHOT = 0;
const SFX_CH_ENEMY_SHOT = 1;
const SFX_CH_EXPLOSION = 2;
const SFX_CH_PLAYER_HIT = 3;

// プリセット波形番号
const WAVEFORM_SQUARE_50 = 0;
const WAVEFORM_SQUARE_25 = 1;
const WAVEFORM_SQUARE_12_5 = 2;
const WAVEFORM_TRIANGLE = 3;
const WAVEFORM_SAWTOOTH = 4;

/**
 * 効果音: 自機弾発射
 */
function playSfxPlayerShot() {
  ss.sound0.play(SFX_CH_PLAYER_SHOT, {
    frequency: 880,
    waveform: WAVEFORM_SQUARE_12_5,
    volume: 0.2,
    envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0 }
  });
}

/**
 * 効果音: 敵弾発射
 */
function playSfxEnemyShot() {
  ss.sound0.play(SFX_CH_ENEMY_SHOT, {
    frequency: 220,
    waveform: WAVEFORM_TRIANGLE,
    volume: 0.15,
    envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0 }
  });
}

/**
 * 効果音: 敵撃破
 */
function playSfxExplosion() {
  ss.sound0.play(SFX_CH_EXPLOSION, {
    waveform: 256,
    volume: 0.25,
    envelope: { attack: 0, decay: 0.15, sustain: 0, release: 0 }
  });
}

/**
 * 効果音: 自機被弾
 */
function playSfxPlayerHit() {
  ss.sound0.play(SFX_CH_PLAYER_HIT, {
    waveform: 256,
    volume: 0.3,
    envelope: { attack: 0, decay: 0.5, sustain: 0, release: 0 }
  });
}

/**
 * 効果音: パワーアップ取得
 */
function playSfxPowerUp() {
  ss.sound0.play(SFX_CH_PLAYER_SHOT, {
    frequency: 880,
    waveform: WAVEFORM_SQUARE_50,
    volume: 0.25,
    envelope: { attack: 0, decay: 0.15, sustain: 0, release: 0 }
  });
}

/**
 * 効果音: 得点ボーナス取得（最大レベル時）
 */
function playSfxBonus() {
  ss.sound0.play(SFX_CH_PLAYER_SHOT, {
    frequency: 1320,
    waveform: WAVEFORM_TRIANGLE,
    volume: 0.3,
    envelope: { attack: 0, decay: 0.2, sustain: 0, release: 0 }
  });
}

// 8x8 フォントデータ（必要な文字のみ）
// 1がピクセルあり、0がピクセルなし
const FONT = {
  // 数字 0-9
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
  // アルファベット
  S: [0b01111110, 0b11000000, 0b11000000, 0b01111100, 0b00000110, 0b00000110, 0b11111100, 0b00000000],
  H: [0b11000110, 0b11000110, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  O: [0b01111100, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  T: [0b11111110, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00000000],
  E: [0b11111110, 0b11000000, 0b11000000, 0b11111100, 0b11000000, 0b11000000, 0b11111110, 0b00000000],
  R: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11011000, 0b11001100, 0b11000110, 0b00000000],
  G: [0b01111100, 0b11000110, 0b11000000, 0b11001110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  A: [0b00111000, 0b01101100, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  M: [0b11000110, 0b11101110, 0b11111110, 0b11010110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  V: [0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01101100, 0b00111000, 0b00010000, 0b00000000],
  I: [0b00111100, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00111100, 0b00000000],
  N: [0b11000110, 0b11100110, 0b11110110, 0b11011110, 0b11001110, 0b11000110, 0b11000110, 0b00000000],
  " ": [0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]
};

// 自機パターン（三角形の戦闘機）
const PLAYER_PATTERN = [0b00010000, 0b00111000, 0b00111000, 0b01111100, 0b01111100, 0b11111110, 0b11101110, 0b01000100];

// 弾パターン（縦長の弾）
const BULLET_PATTERN = [0b00011000, 0b00111100, 0b00111100, 0b00111100, 0b00111100, 0b00111100, 0b00011000, 0b00000000];

// 敵パターン（逆三角形）
const ENEMY_PATTERN = [0b11111110, 0b11111110, 0b01111100, 0b01111100, 0b00111000, 0b00111000, 0b00010000, 0b00000000];

// 敵弾パターン（小さい円）
const ENEMY_BULLET_PATTERN = [0b00000000, 0b00000000, 0b00011000, 0b00111100, 0b00111100, 0b00011000, 0b00000000, 0b00000000];

// 破片パターン（敵を4分割、8x8の左上4x4に配置）
const DEBRIS_PATTERN_TL = [0b11110000, 0b11110000, 0b01110000, 0b01110000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]; // 左上
const DEBRIS_PATTERN_TR = [0b11100000, 0b11100000, 0b11000000, 0b11000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]; // 右上
const DEBRIS_PATTERN_BL = [0b00110000, 0b00110000, 0b00010000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]; // 左下
const DEBRIS_PATTERN_BR = [0b10000000, 0b10000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000]; // 右下

// 爆発パーティクルパターン（小さな光）
const PARTICLE_PATTERN = [0b00000000, 0b00100000, 0b01110000, 0b00100000, 0b00000000, 0b00000000, 0b00000000, 0b00000000];

// パワーアップアイテムパターン（上向き矢印）
const POWERUP_PATTERN = [0b00010000, 0b00111000, 0b01111100, 0b11111110, 0b00111000, 0b00111000, 0b00111000, 0b00000000];

// パターン番号の割り当て
const PATTERN_S = 0;
const PATTERN_H = 1;
const PATTERN_O = 2;
const PATTERN_T = 3;
const PATTERN_E = 4;
const PATTERN_R = 5;
const PATTERN_G = 6;
const PATTERN_A = 7;
const PATTERN_M = 8;
const PATTERN_V = 9;
const PATTERN_I = 30;
const PATTERN_N = 31;
const PATTERN_PLAYER = 10;
const PATTERN_BULLET = 11;
const PATTERN_ENEMY = 12;
const PATTERN_ENEMY_BULLET = 13;
const PATTERN_DEBRIS_TL = 14;
const PATTERN_DEBRIS_TR = 15;
const PATTERN_DEBRIS_BL = 16;
const PATTERN_DEBRIS_BR = 17;
const PATTERN_PARTICLE = 18;
const PATTERN_POWERUP = 19;
const PATTERN_DIGIT_0 = 20; // 20〜29: 数字0-9

// スプライト番号の割り当て
const SPRITE_PLAYER = 0;
const SPRITE_BULLET_START = 1; // 1〜25: 自機の弾（25個）
const SPRITE_POWERUP_START = 26; // 26〜29: パワーアップアイテム（4個）
const SPRITE_ENEMY_START = 30; // 30〜39: 敵（10個）
const SPRITE_ENEMY_BULLET_START = 40; // 40〜103: 敵の弾（64個）
const SPRITE_DEBRIS_START = 104; // 104〜123: 破片（最大20個）
const SPRITE_PARTICLE_START = 124; // 124〜133: パーティクル（最大10個）
const SPRITE_TITLE_START = 134; // タイトル文字用
const SPRITE_SCORE_START = 150; // 150〜157: スコア表示（8桁）
const SPRITE_LIVES_START = 160; // 160〜162: 残機表示（最大3）
const SPRITE_DEBUG_START = 170; // 170〜172: deltaTime表示（3桁）

// テキスト表示用パターンマップ
const TEXT_PATTERN_MAP = {
  S: PATTERN_S,
  H: PATTERN_H,
  O: PATTERN_O,
  T: PATTERN_T,
  E: PATTERN_E,
  R: PATTERN_R,
  G: PATTERN_G,
  A: PATTERN_A,
  M: PATTERN_M,
  V: PATTERN_V,
  I: PATTERN_I,
  N: PATTERN_N,
  " ": -1
};

/**
 * タイトル文字を非表示
 */
function hideTitle() {
  // SHOOTER(7文字) または GAME OVER(9文字) を非表示
  for (let i = 0; i < 9; i++) {
    ss.sprite0.disable(SPRITE_TITLE_START + i);
  }
}

/**
 * タイトル画面を表示
 */
function showTitle() {
  // タイトル「SHOOTING」を中央に表示
  // 8文字 × 8ピクセル = 64ピクセル
  // 中央: (128 - 64) / 2 = 32
  ss.text.draw("SHOOTING", 32, 60, SPRITE_TITLE_START, TEXT_PATTERN_MAP, { priority: 10 });

  // 自機を非表示
  ss.sprite0.disable(SPRITE_PLAYER);
}

/**
 * ゲームオーバー画面を表示
 */
function showGameOver() {
  // 「GAME OVER」を中央に表示
  // 9文字 × 8ピクセル = 72ピクセル
  // 中央: (128 - 72) / 2 = 28
  ss.text.draw("GAME OVER", 28, 60, SPRITE_TITLE_START, TEXT_PATTERN_MAP, { priority: 10 });

  // 自機を非表示
  ss.sprite0.disable(SPRITE_PLAYER);

  // タイマー開始
  gameOverTimer = GAMEOVER_DURATION;
}

/**
 * ゲーム画面を開始
 */
function startGame() {
  // タイトルを非表示
  hideTitle();

  // 自機を初期位置に配置
  player.x = 60;
  player.y = 100;

  // 自機スプライトを表示
  ss.sprite0.set(SPRITE_PLAYER, {
    priority: 100,
    x: player.x,
    y: player.y,
    palette: 0,
    pattern: PATTERN_PLAYER
  });

  // 弾を初期化
  playerBullets.length = 0;
  for (let i = 0; i < MAX_PLAYER_BULLETS; i++) {
    playerBullets.push({ x: 0, y: 0, vx: 0, vy: 0, active: false });
    ss.sprite0.disable(SPRITE_BULLET_START + i);
  }

  // 敵を初期化
  enemies.length = 0;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    enemies.push({
      x: 0,
      y: 0,
      vx: 0,
      active: false,
      shootTimer: 0,
      pattern: ENEMY_PATTERN_A,
      hasFiredAtPlayer: false,
      spawnTimer: 0,
      hasInitialShot: false,
      bulletsFired: 0,
      baseAngle: 0,
      hp: 1,
      isSpecial: false
    });
    ss.sprite0.disable(SPRITE_ENEMY_START + i);
  }
  enemySpawnTimer = 0;
  gameElapsedTime = 0;

  // 敵弾を初期化
  enemyBullets.length = 0;
  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    enemyBullets.push({ x: 0, y: 0, vx: 0, vy: 0, active: false, timer: 0, hasRedirected: false });
    ss.sprite0.disable(SPRITE_ENEMY_BULLET_START + i);
  }

  // スコアと残機を初期化
  score = 0;
  lives = 3;
  invincibleTimer = 0;

  // パワーアップレベルをリセット
  powerUpLevel = 1;

  // 特別敵出現フラグをリセット
  for (let i = 0; i < specialEnemySpawned.length; i++) {
    specialEnemySpawned[i] = false;
  }
  lastSpecialEnemyTime = 150;

  // 破片を初期化
  debris.length = 0;
  for (let i = 0; i < MAX_DEBRIS; i++) {
    debris.push({ x: 0, y: 0, vx: 0, vy: 0, timer: 0, active: false });
    ss.sprite0.disable(SPRITE_DEBRIS_START + i);
  }

  // パーティクルを初期化
  particles.length = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ x: 0, y: 0, timer: 0, active: false, visible: true });
    ss.sprite0.disable(SPRITE_PARTICLE_START + i);
  }

  // パワーアップアイテムを初期化
  powerUpItems.length = 0;
  for (let i = 0; i < MAX_POWERUP_ITEMS; i++) {
    powerUpItems.push({ x: 0, y: 0, timer: 0, floating: false, active: false });
    ss.sprite0.disable(SPRITE_POWERUP_START + i);
  }
}

// 弾発射のクールダウン
const SHOOT_COOLDOWN = 0.075; // 発射間隔（秒）
let shootTimer = 0;

/**
 * 自機を更新
 */
function updatePlayer(deltaTime) {
  // 入力方向を取得
  let dx = 0;
  let dy = 0;
  if (ss.input0.player1.left) dx -= 1;
  if (ss.input0.player1.right) dx += 1;
  if (ss.input0.player1.up) dy -= 1;
  if (ss.input0.player1.down) dy += 1;

  // 斜め移動時は補正して速度を抑える（0.8倍）
  if (dx !== 0 && dy !== 0) {
    dx *= 0.8;
    dy *= 0.8;
  }

  const move = player.speed * deltaTime;
  player.x += dx * move;
  player.y += dy * move;

  // 画面端でクランプ
  player.x = Math.max(0, Math.min(120, player.x));
  player.y = Math.max(0, Math.min(120, player.y));

  // 無敵タイマーを減らす
  if (invincibleTimer > 0) {
    invincibleTimer -= deltaTime;
  }

  // スプライト位置を更新（無敵時はブレ + 点滅）
  if (invincibleTimer > 0) {
    const blinkPhase = Math.floor(invincibleTimer / INVINCIBLE_BLINK_INTERVAL);
    if (blinkPhase % 2 === 0) {
      // 表示 + ランダムブレ
      const dir = SHAKE_DIRECTIONS[Math.floor(Math.random() * 8)];
      ss.sprite0.set(SPRITE_PLAYER, {
        x: Math.floor(player.x) + dir.dx * INVINCIBLE_SHAKE_AMOUNT,
        y: Math.floor(player.y) + dir.dy * INVINCIBLE_SHAKE_AMOUNT
      });
    } else {
      ss.sprite0.disable(SPRITE_PLAYER);
    }
  } else {
    ss.sprite0.set(SPRITE_PLAYER, {
      x: Math.floor(player.x),
      y: Math.floor(player.y)
    });
  }

  // 弾発射（Aボタン）
  if (shootTimer > 0) {
    shootTimer -= deltaTime;
  }
  if (ss.input0.player1.a && shootTimer <= 0) {
    shootBullet();
    shootTimer = SHOOT_COOLDOWN;
  }
}

/**
 * 弾を発射
 * 各方向ごとに5発ずつスロットを確保
 * 角度インデックス0用: スロット0,5,10,15,20
 * 角度インデックス1用: スロット1,6,11,16,21
 * ...
 */
function shootBullet() {
  playSfxPlayerShot();

  const angles = BULLET_ANGLES[powerUpLevel];
  const DEG_TO_RAD = Math.PI / 180;
  const BULLETS_PER_ANGLE = 5;

  for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
    const angleDeg = angles[angleIndex];

    // この角度用のスロットから空きを探す
    for (let j = 0; j < BULLETS_PER_ANGLE; j++) {
      const i = angleIndex + j * 5; // 0,5,10,15,20 / 1,6,11,16,21 / ...
      const bullet = playerBullets[i];
      if (!bullet.active) {
        // 自機の中央から発射
        bullet.x = player.x;
        bullet.y = player.y;
        bullet.active = true;

        // 角度計算（-90度=上方向をベースに）
        const angleRad = (-90 + angleDeg) * DEG_TO_RAD;
        bullet.vx = Math.cos(angleRad) * BULLET_SPEED;
        bullet.vy = Math.sin(angleRad) * BULLET_SPEED;

        ss.sprite0.set(SPRITE_BULLET_START + i, {
          priority: 50,
          x: Math.floor(bullet.x),
          y: Math.floor(bullet.y),
          palette: 0,
          pattern: PATTERN_BULLET
        });
        break;
      }
    }
  }
}

/**
 * 弾を更新
 */
function updateBullets(deltaTime) {
  for (let i = 0; i < MAX_PLAYER_BULLETS; i++) {
    const bullet = playerBullets[i];
    if (bullet.active) {
      bullet.x += bullet.vx * deltaTime;
      bullet.y += bullet.vy * deltaTime;

      // 画面外で消滅（全方向チェック）
      if (bullet.x < -8 || bullet.x > 128 || bullet.y < -8 || bullet.y > 128) {
        bullet.active = false;
        ss.sprite0.disable(SPRITE_BULLET_START + i);
      } else {
        ss.sprite0.set(SPRITE_BULLET_START + i, {
          x: Math.floor(bullet.x),
          y: Math.floor(bullet.y)
        });
      }
    }
  }
}

/**
 * 特別敵を出現させる
 */
function spawnSpecialEnemy(pattern) {
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const enemy = enemies[i];
    if (!enemy.active) {
      // 画面上部の中央付近に出現
      enemy.x = 60 + (Math.random() - 0.5) * 40;
      enemy.y = -8;
      enemy.vx = 0;
      enemy.active = true;
      enemy.shootTimer = Math.random() * ENEMY_SHOOT_INTERVAL;
      enemy.pattern = pattern;
      enemy.hasFiredAtPlayer = false;
      enemy.spawnTimer = 0;
      enemy.hasInitialShot = false;
      enemy.bulletsFired = 0;
      enemy.baseAngle = 0;
      enemy.hp = SPECIAL_ENEMY_HP; // 特別敵は5発で撃破
      enemy.isSpecial = true;

      ss.sprite0.set(SPRITE_ENEMY_START + i, {
        priority: 80,
        x: Math.floor(enemy.x),
        y: Math.floor(enemy.y),
        palette: 1, // 金色パレット
        pattern: PATTERN_ENEMY
      });
      break;
    }
  }
}

/**
 * 敵を出現させる
 */
function spawnEnemy() {
  // フェーズ判定とパターン決定
  // 0-5: なし → 5-30: A → 30-35: なし → 35-60: B → 60-65: なし → 65-90: C → 90-95: なし → 95-120: D → 120-125: なし → 125-150: E → 150-155: なし → 155以降: F
  const t = gameElapsedTime;
  const t1 = PHASE_BREAK_DURATION; // 5
  const t2 = t1 + PHASE_PATTERN_DURATION; // 30
  const t3 = t2 + PHASE_BREAK_DURATION; // 35
  const t4 = t3 + PHASE_PATTERN_DURATION; // 60
  const t5 = t4 + PHASE_BREAK_DURATION; // 65
  const t6 = t5 + PHASE_PATTERN_DURATION; // 90
  const t7 = t6 + PHASE_BREAK_DURATION; // 95
  const t8 = t7 + PHASE_PATTERN_DURATION; // 120
  const t9 = t8 + PHASE_BREAK_DURATION; // 125
  const t10 = t9 + PHASE_PATTERN_DURATION; // 150
  const t11 = t10 + PHASE_BREAK_DURATION; // 155

  let pattern;
  if (t < t1) {
    return; // 出現なし
  } else if (t < t2) {
    pattern = ENEMY_PATTERN_A;
  } else if (t < t3) {
    return; // 出現なし
  } else if (t < t4) {
    pattern = ENEMY_PATTERN_B;
  } else if (t < t5) {
    return; // 出現なし
  } else if (t < t6) {
    pattern = ENEMY_PATTERN_C;
  } else if (t < t7) {
    return; // 出現なし
  } else if (t < t8) {
    pattern = ENEMY_PATTERN_D;
  } else if (t < t9) {
    return; // 出現なし
  } else if (t < t10) {
    pattern = ENEMY_PATTERN_E;
  } else if (t < t11) {
    return; // 出現なし
  } else {
    pattern = ENEMY_PATTERN_F;
  }

  for (let i = 0; i < MAX_ENEMIES; i++) {
    const enemy = enemies[i];
    if (!enemy.active) {
      // 画面上部のランダムな位置に出現
      enemy.x = Math.random() * 120;
      enemy.y = -8;
      enemy.vx = 0; // 初期X速度は0
      enemy.active = true;
      enemy.shootTimer = Math.random() * ENEMY_SHOOT_INTERVAL; // 初期タイマーをランダム化
      enemy.pattern = pattern;
      enemy.hasFiredAtPlayer = false;
      enemy.spawnTimer = 0;
      enemy.hasInitialShot = false;
      enemy.bulletsFired = 0; // パターンE用: 発射した弾数
      enemy.baseAngle = 0; // パターンE用: 最初の弾の角度（自機狙い）
      enemy.hp = 1; // 通常敵は1発で撃破
      enemy.isSpecial = false;

      ss.sprite0.set(SPRITE_ENEMY_START + i, {
        priority: 80,
        x: Math.floor(enemy.x),
        y: Math.floor(enemy.y),
        palette: 0,
        pattern: PATTERN_ENEMY
      });
      break;
    }
  }
}

/**
 * 敵を更新
 */
function updateEnemies(deltaTime) {
  // ゲーム経過時間を更新
  gameElapsedTime += deltaTime;

  // 特別敵の出現判定
  // 各パターン終了時（30秒, 60秒, 90秒, 120秒, 150秒）
  for (let i = 0; i < SPECIAL_ENEMY_TIMES.length; i++) {
    if (!specialEnemySpawned[i] && gameElapsedTime >= SPECIAL_ENEMY_TIMES[i]) {
      spawnSpecialEnemy(SPECIAL_ENEMY_PATTERNS[i]);
      specialEnemySpawned[i] = true;
    }
  }

  // パターンF以降は60秒ごとに特別敵出現（210秒, 270秒...）
  if (gameElapsedTime >= 155 + SPECIAL_ENEMY_INTERVAL_F) {
    const nextSpecialTime = lastSpecialEnemyTime + SPECIAL_ENEMY_INTERVAL_F;
    if (gameElapsedTime >= nextSpecialTime) {
      spawnSpecialEnemy(ENEMY_PATTERN_F);
      lastSpecialEnemyTime = nextSpecialTime;
    }
  }

  // 出現タイマー
  enemySpawnTimer -= deltaTime;
  if (enemySpawnTimer <= 0) {
    spawnEnemy();
    enemySpawnTimer = ENEMY_SPAWN_INTERVAL;
  }

  // 移動
  const move = ENEMY_SPEED * deltaTime;

  for (let i = 0; i < MAX_ENEMIES; i++) {
    const enemy = enemies[i];
    if (enemy.active) {
      // Y移動（常に下へ）
      enemy.y += move;

      // X移動（パターンBで弾発射後）
      enemy.x += enemy.vx * deltaTime;

      // 画面外で消滅（Y方向またはX方向）
      if (enemy.y > 128 || enemy.x < -8 || enemy.x > 128) {
        enemy.active = false;
        ss.sprite0.disable(SPRITE_ENEMY_START + i);
      } else {
        ss.sprite0.set(SPRITE_ENEMY_START + i, {
          x: Math.floor(enemy.x),
          y: Math.floor(enemy.y)
        });

        // 出現タイマーを加算
        enemy.spawnTimer += deltaTime;

        // 発射処理（画面内にいる場合のみ）
        if (enemy.y > 0) {
          if (enemy.pattern === ENEMY_PATTERN_A) {
            // パターンA: 出現0.75秒後に弾発射（1回のみ）
            if (!enemy.hasInitialShot && enemy.spawnTimer >= 0.75) {
              shootEnemyBullet(enemy);
              enemy.hasInitialShot = true;
            }
          } else if (enemy.pattern === ENEMY_PATTERN_B) {
            // パターンB: 出現0.75秒後に弾発射 + X座標一致で弾発射＆横移動開始
            if (!enemy.hasInitialShot && enemy.spawnTimer >= 0.75) {
              shootEnemyBullet(enemy);
              enemy.hasInitialShot = true;
            }
            if (!enemy.hasFiredAtPlayer) {
              const dx = Math.abs(enemy.x - player.x);
              if (dx <= ENEMY_X_MATCH_THRESHOLD) {
                shootEnemyBullet(enemy);
                enemy.hasFiredAtPlayer = true;
                // 画面左右の遠い方へ移動
                enemy.vx = enemy.x < 64 ? ENEMY_SPEED : -ENEMY_SPEED;
              }
            }
          } else if (enemy.pattern === ENEMY_PATTERN_C) {
            // パターンC: 出現0.75秒後に自機狙い弾発射 + X座標一致で4WAY弾＆横移動開始
            if (!enemy.hasInitialShot && enemy.spawnTimer >= 0.75) {
              shootEnemyBullet(enemy);
              enemy.hasInitialShot = true;
            }
            if (!enemy.hasFiredAtPlayer) {
              const dx = Math.abs(enemy.x - player.x);
              if (dx <= ENEMY_X_MATCH_THRESHOLD) {
                shootEnemyBullet4Way(enemy);
                enemy.hasFiredAtPlayer = true;
                // 画面左右の遠い方へ移動
                enemy.vx = enemy.x < 64 ? ENEMY_SPEED : -ENEMY_SPEED;
              }
            }
          } else if (enemy.pattern === ENEMY_PATTERN_D) {
            // パターンD: 出現0.75秒後に16方向弾発射 + X座標一致で16方向弾＆横移動開始
            if (!enemy.hasInitialShot && enemy.spawnTimer >= 0.75) {
              shootEnemyBullet16Way(enemy);
              enemy.hasInitialShot = true;
            }
            if (!enemy.hasFiredAtPlayer) {
              const dx = Math.abs(enemy.x - player.x);
              if (dx <= ENEMY_X_MATCH_THRESHOLD) {
                shootEnemyBullet16Way(enemy);
                enemy.hasFiredAtPlayer = true;
                // 画面左右の遠い方へ移動
                enemy.vx = enemy.x < 64 ? ENEMY_SPEED : -ENEMY_SPEED;
              }
            }
          } else if (enemy.pattern === ENEMY_PATTERN_E) {
            // パターンE: 出現0.75秒後から30fpsで回転弾発射（自機狙い起点、16方向×2周=32発）
            const SHOT_INTERVAL = 1.0 / 30.0; // 30fps = 約33.3ms間隔
            const MAX_BULLETS = 32; // 16方向 × 2周
            if (enemy.spawnTimer >= 0.75 && enemy.bulletsFired < MAX_BULLETS) {
              // 発射タイミングチェック
              const timeSinceStart = enemy.spawnTimer - 0.75;
              const expectedShots = Math.floor(timeSinceStart / SHOT_INTERVAL) + 1;
              if (expectedShots > enemy.bulletsFired) {
                // 最初の弾は自機狙いの角度を計算
                if (enemy.bulletsFired === 0) {
                  const dx = player.x - enemy.x;
                  const dy = player.y - enemy.y;
                  enemy.baseAngle = Math.atan2(dy, dx);
                }
                // 回転弾発射
                shootEnemyBulletRotating(enemy);
                enemy.bulletsFired++;
              }
            }
          } else if (enemy.pattern === ENEMY_PATTERN_F) {
            // パターンF: 出現0.75秒後から30fpsで回転弾発射（自機狙い起点、16方向×1周=16発）+ 0.5秒後に自機狙い＆加速
            const SHOT_INTERVAL = 1.0 / 30.0; // 30fps = 約33.3ms間隔
            const MAX_BULLETS = 16; // 16方向 × 1周
            if (enemy.spawnTimer >= 0.75 && enemy.bulletsFired < MAX_BULLETS) {
              // 発射タイミングチェック
              const timeSinceStart = enemy.spawnTimer - 0.75;
              const expectedShots = Math.floor(timeSinceStart / SHOT_INTERVAL) + 1;
              if (expectedShots > enemy.bulletsFired) {
                // 最初の弾は自機狙いの角度を計算
                if (enemy.bulletsFired === 0) {
                  const dx = player.x - enemy.x;
                  const dy = player.y - enemy.y;
                  enemy.baseAngle = Math.atan2(dy, dx);
                }
                // 回転弾発射（軌道変更フラグ付き）
                shootEnemyBulletRotatingWithRedirect(enemy);
                enemy.bulletsFired++;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * 敵弾を発射（自機狙い）
 */
function shootEnemyBullet(enemy) {
  playSfxEnemyShot();

  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) {
      // 敵と重なる位置から発射
      bullet.x = enemy.x;
      bullet.y = enemy.y;

      // 自機への方向ベクトルを計算
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        bullet.vx = (dx / dist) * ENEMY_BULLET_SPEED;
        bullet.vy = (dy / dist) * ENEMY_BULLET_SPEED;
      } else {
        bullet.vx = 0;
        bullet.vy = ENEMY_BULLET_SPEED;
      }

      bullet.active = true;
      bullet.timer = 0;
      bullet.hasRedirected = true; // 軌道変更なし

      ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
        priority: 60,
        x: Math.floor(bullet.x),
        y: Math.floor(bullet.y),
        palette: 0,
        pattern: PATTERN_ENEMY_BULLET
      });
      break;
    }
  }
}

/**
 * 敵弾を発射（自機外し4WAY）
 * 自機狙いをベースに、-15度, -5度, 5度, 15度の4方向に発射
 */
function shootEnemyBullet4Way(enemy) {
  playSfxEnemyShot();

  // 敵と重なる位置から発射
  const startX = enemy.x;
  const startY = enemy.y;

  // 自機への方向角度を計算
  const dx = player.x - startX;
  const dy = player.y - startY;
  const baseAngle = Math.atan2(dy, dx);

  // 自機狙いから-15度, -5度, 5度, 15度ずらした4方向に発射
  const DEG_TO_RAD = Math.PI / 180;
  const offsets = [-15 * DEG_TO_RAD, -5 * DEG_TO_RAD, 5 * DEG_TO_RAD, 15 * DEG_TO_RAD];

  let fired = 0;
  for (let i = 0; i < MAX_ENEMY_BULLETS && fired < 4; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) {
      const angle = baseAngle + offsets[fired];
      bullet.x = startX;
      bullet.y = startY;
      bullet.vx = Math.cos(angle) * ENEMY_BULLET_SPEED;
      bullet.vy = Math.sin(angle) * ENEMY_BULLET_SPEED;
      bullet.active = true;
      bullet.timer = 0;
      bullet.hasRedirected = true; // 軌道変更なし

      ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
        priority: 60,
        x: Math.floor(bullet.x),
        y: Math.floor(bullet.y),
        palette: 0,
        pattern: PATTERN_ENEMY_BULLET
      });
      fired++;
    }
  }
}

/**
 * 敵弾を発射（16方向）
 * 全方位に均等に16発発射
 */
function shootEnemyBullet16Way(enemy) {
  playSfxEnemyShot();

  // 敵と重なる位置から発射
  const startX = enemy.x;
  const startY = enemy.y;

  let fired = 0;
  for (let i = 0; i < MAX_ENEMY_BULLETS && fired < 16; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) {
      const angle = (fired / 16) * 2 * Math.PI; // 0〜2πを16等分
      bullet.x = startX;
      bullet.y = startY;
      bullet.vx = Math.cos(angle) * ENEMY_BULLET_SPEED;
      bullet.vy = Math.sin(angle) * ENEMY_BULLET_SPEED;
      bullet.active = true;
      bullet.timer = 0;
      bullet.hasRedirected = true; // 軌道変更なし

      ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
        priority: 60,
        x: Math.floor(bullet.x),
        y: Math.floor(bullet.y),
        palette: 0,
        pattern: PATTERN_ENEMY_BULLET
      });
      fired++;
    }
  }
}

/**
 * 敵弾を発射（回転弾）
 * baseAngleを起点に16方向を順番に発射
 */
function shootEnemyBulletRotating(enemy) {
  playSfxEnemyShot();

  // 敵と重なる位置から発射
  const startX = enemy.x;
  const startY = enemy.y;

  // bulletsFiredに基づいて角度を決定（16方向を2周）
  const angleOffset = (enemy.bulletsFired / 16) * 2 * Math.PI;
  const angle = enemy.baseAngle + angleOffset;

  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) {
      bullet.x = startX;
      bullet.y = startY;
      bullet.vx = Math.cos(angle) * ENEMY_BULLET_SPEED;
      bullet.vy = Math.sin(angle) * ENEMY_BULLET_SPEED;
      bullet.active = true;
      bullet.timer = 0;
      bullet.hasRedirected = true; // 軌道変更なし

      ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
        priority: 60,
        x: Math.floor(bullet.x),
        y: Math.floor(bullet.y),
        palette: 0,
        pattern: PATTERN_ENEMY_BULLET
      });
      break;
    }
  }
}

/**
 * 敵弾を発射（回転弾＋軌道変更付き）
 * baseAngleを起点に16方向を順番に発射、0.5秒後に自機狙いへ軌道変更＋速度2倍
 */
function shootEnemyBulletRotatingWithRedirect(enemy) {
  playSfxEnemyShot();

  // 敵と重なる位置から発射
  const startX = enemy.x;
  const startY = enemy.y;

  // bulletsFiredに基づいて角度を決定（16方向を1周）
  const angleOffset = (enemy.bulletsFired / 16) * 2 * Math.PI;
  const angle = enemy.baseAngle + angleOffset;

  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) {
      bullet.x = startX;
      bullet.y = startY;
      bullet.vx = Math.cos(angle) * ENEMY_BULLET_SPEED;
      bullet.vy = Math.sin(angle) * ENEMY_BULLET_SPEED;
      bullet.active = true;
      bullet.timer = 0;
      bullet.hasRedirected = false; // 軌道変更予定

      ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
        priority: 60,
        x: Math.floor(bullet.x),
        y: Math.floor(bullet.y),
        palette: 0,
        pattern: PATTERN_ENEMY_BULLET
      });
      break;
    }
  }
}

/**
 * 敵弾を更新
 */
function updateEnemyBullets(deltaTime) {
  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    const bullet = enemyBullets[i];
    if (bullet.active) {
      // タイマー更新
      bullet.timer += deltaTime;

      // 軌道変更処理（0.6秒で停止、0.9秒後に自機狙い＆速度2倍）
      if (!bullet.hasRedirected) {
        if (bullet.timer >= 0.7) {
          // 停止期間終了、自機狙いで再開
          const dx = player.x - bullet.x;
          const dy = player.y - bullet.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            bullet.vx = (dx / dist) * ENEMY_BULLET_SPEED * 1.5;
            bullet.vy = (dy / dist) * ENEMY_BULLET_SPEED * 1.5;
          }
          bullet.hasRedirected = true;
        } else if (bullet.timer >= 0.5) {
          // 停止期間中
          bullet.vx = 0;
          bullet.vy = 0;
        }
      }

      bullet.x += bullet.vx * deltaTime;
      bullet.y += bullet.vy * deltaTime;

      // 画面外で消滅
      if (bullet.x < -8 || bullet.x > 128 || bullet.y < -8 || bullet.y > 128) {
        bullet.active = false;
        ss.sprite0.disable(SPRITE_ENEMY_BULLET_START + i);
      } else {
        ss.sprite0.set(SPRITE_ENEMY_BULLET_START + i, {
          x: Math.floor(bullet.x),
          y: Math.floor(bullet.y)
        });
      }
    }
  }
}

/**
 * パワーアップアイテムを生成
 */
function spawnPowerUpItem(x, y) {
  for (let i = 0; i < MAX_POWERUP_ITEMS; i++) {
    const item = powerUpItems[i];
    if (!item.active) {
      item.x = x;
      item.y = y;
      item.timer = POWERUP_STAY_DURATION;
      item.floating = false;
      item.active = true;

      ss.sprite0.set(SPRITE_POWERUP_START + i, {
        priority: 70,
        x: Math.floor(item.x),
        y: Math.floor(item.y),
        palette: 2, // 緑色パレット
        pattern: PATTERN_POWERUP
      });
      break;
    }
  }
}

/**
 * パワーアップアイテムを更新
 */
function updatePowerUpItems(deltaTime) {
  for (let i = 0; i < MAX_POWERUP_ITEMS; i++) {
    const item = powerUpItems[i];
    if (item.active) {
      item.timer -= deltaTime;

      // 5秒経過後は上方へ流れる
      if (item.timer <= 0 && !item.floating) {
        item.floating = true;
      }

      if (item.floating) {
        item.y -= POWERUP_FLOAT_SPEED * deltaTime;
      }

      // 画面外で消滅
      if (item.y < -8) {
        item.active = false;
        ss.sprite0.disable(SPRITE_POWERUP_START + i);
      } else {
        ss.sprite0.set(SPRITE_POWERUP_START + i, {
          x: Math.floor(item.x),
          y: Math.floor(item.y)
        });
      }
    }
  }
}

/**
 * パワーアップアイテムの取得判定
 */
function checkPowerUpItemCollision() {
  for (let i = 0; i < MAX_POWERUP_ITEMS; i++) {
    const item = powerUpItems[i];
    if (!item.active) continue;

    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= 64) {
      // 8px以内
      item.active = false;
      ss.sprite0.disable(SPRITE_POWERUP_START + i);

      // パワーアップレベル+1（最大4）
      if (powerUpLevel < POWERUP_LEVEL_MAX) {
        playSfxPowerUp();
        powerUpLevel++;
        // 取得ボーナス
        score += 200;
      } else {
        // 最大レベル時は特別ボーナス
        playSfxBonus();
        score += 10000;
      }
    }
  }
}

/**
 * 爆発エフェクトを生成
 */
function spawnExplosion(x, y) {
  // 4つの破片を生成（斜め4方向に飛散）
  const directions = [
    { vx: -1, vy: -1, pattern: PATTERN_DEBRIS_TL }, // 左上
    { vx: 1, vy: -1, pattern: PATTERN_DEBRIS_TR }, // 右上
    { vx: -1, vy: 1, pattern: PATTERN_DEBRIS_BL }, // 左下
    { vx: 1, vy: 1, pattern: PATTERN_DEBRIS_BR } // 右下
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

        ss.sprite0.set(SPRITE_DEBRIS_START + i, {
          priority: 90,
          x: Math.floor(piece.x),
          y: Math.floor(piece.y),
          palette: 0,
          pattern: directions[d].pattern
        });
        break;
      }
    }
  }

  // パーティクルを4個生成（ランダム位置）
  const particleCount = 4;
  for (let p = 0; p < particleCount; p++) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const particle = particles[i];
      if (!particle.active) {
        particle.x = x + (Math.random() - 0.5) * 16;
        particle.y = y + (Math.random() - 0.5) * 16;
        particle.timer = PARTICLE_DURATION;
        particle.active = true;
        particle.visible = true;

        ss.sprite0.set(SPRITE_PARTICLE_START + i, {
          priority: 95,
          x: Math.floor(particle.x),
          y: Math.floor(particle.y),
          palette: 0,
          pattern: PATTERN_PARTICLE
        });
        break;
      }
    }
  }
}

/**
 * 爆発エフェクトを更新
 */
function updateExplosions(deltaTime) {
  // 破片を更新
  for (let i = 0; i < MAX_DEBRIS; i++) {
    const piece = debris[i];
    if (piece.active) {
      piece.x += piece.vx * deltaTime;
      piece.y += piece.vy * deltaTime;
      piece.timer -= deltaTime;

      if (piece.timer <= 0) {
        piece.active = false;
        ss.sprite0.disable(SPRITE_DEBRIS_START + i);
      } else {
        ss.sprite0.set(SPRITE_DEBRIS_START + i, {
          x: Math.floor(piece.x),
          y: Math.floor(piece.y)
        });
      }
    }
  }

  // パーティクルを更新（点滅）
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const particle = particles[i];
    if (particle.active) {
      particle.timer -= deltaTime;

      if (particle.timer <= 0) {
        particle.active = false;
        ss.sprite0.disable(SPRITE_PARTICLE_START + i);
      } else {
        // 点滅処理
        const blinkPhase = Math.floor(particle.timer / PARTICLE_BLINK_INTERVAL);
        particle.visible = blinkPhase % 2 === 0;

        if (particle.visible) {
          ss.sprite0.set(SPRITE_PARTICLE_START + i, {
            priority: 95,
            x: Math.floor(particle.x),
            y: Math.floor(particle.y),
            palette: 0,
            pattern: PATTERN_PARTICLE
          });
        } else {
          ss.sprite0.disable(SPRITE_PARTICLE_START + i);
        }
      }
    }
  }
}

/**
 * 自弾と敵の衝突判定
 */
function checkBulletEnemyCollision() {
  for (let i = 0; i < MAX_PLAYER_BULLETS; i++) {
    const bullet = playerBullets[i];
    if (!bullet.active) continue;

    for (let j = 0; j < MAX_ENEMIES; j++) {
      const enemy = enemies[j];
      if (!enemy.active) continue;

      // 中心間の距離² を計算（sqrt を避ける）
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= 36) {
        // 衝突：弾を消す
        bullet.active = false;
        ss.sprite0.disable(SPRITE_BULLET_START + i);

        // HPを減らす
        enemy.hp--;

        if (enemy.hp <= 0) {
          // 撃破
          playSfxExplosion();
          enemy.active = false;
          ss.sprite0.disable(SPRITE_ENEMY_START + j);

          // 爆発エフェクトを生成
          spawnExplosion(enemy.x, enemy.y);

          // 特別敵はパワーアップアイテムをドロップ
          if (enemy.isSpecial) {
            spawnPowerUpItem(enemy.x, enemy.y);
            score += 500; // 特別敵ボーナス
          } else {
            score += 100;
          }
        }
        break;
      }
    }
  }
}

/**
 * 敵弾と自機の衝突判定
 */
function checkEnemyBulletPlayerCollision() {
  // 無敵中は判定しない
  if (invincibleTimer > 0) return;

  for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
    const bullet = enemyBullets[i];
    if (!bullet.active) continue;

    // 中心間の距離² を計算（sqrt を避ける）
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= 4) {
      // 2px以内
      // 衝突：弾を消す
      playSfxPlayerHit();
      bullet.active = false;
      ss.sprite0.disable(SPRITE_ENEMY_BULLET_START + i);

      // 残機を減らす
      lives--;
      displayLives();
      invincibleTimer = INVINCIBLE_DURATION;

      // パワーアップレベルを下げる
      if (powerUpLevel > 1) {
        powerUpLevel--;
      }

      // ゲームオーバー判定（残機0以下）
      if (lives <= 0) {
        spawnExplosion(player.x, player.y);
        gameState = STATE_GAMEOVER;
        showGameOver();
      }
      break;
    }
  }
}

/**
 * 敵と自機の衝突判定
 */
function checkEnemyPlayerCollision() {
  // 無敵中は判定しない
  if (invincibleTimer > 0) return;

  for (let i = 0; i < MAX_ENEMIES; i++) {
    const enemy = enemies[i];
    if (!enemy.active) continue;

    // 中心間の距離² を計算（sqrt を避ける）
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= 49) {
      // 7px以内
      // 衝突：敵を消す
      playSfxPlayerHit();
      playSfxExplosion();
      enemy.active = false;
      ss.sprite0.disable(SPRITE_ENEMY_START + i);

      // 爆発エフェクトを生成
      spawnExplosion(enemy.x, enemy.y);

      // 残機を減らす
      lives--;
      displayLives();
      invincibleTimer = INVINCIBLE_DURATION;

      // パワーアップレベルを下げる
      if (powerUpLevel > 1) {
        powerUpLevel--;
      }

      // ゲームオーバー判定（残機0以下）
      if (lives <= 0) {
        spawnExplosion(player.x, player.y);
        gameState = STATE_GAMEOVER;
        showGameOver();
      }
      break;
    }
  }
}

/**
 * スコアを画面左上に表示
 */
function displayScore() {
  const str = String(score).padStart(8, "0");

  for (let i = 0; i < 8; i++) {
    const digit = parseInt(str[i], 10);
    ss.sprite0.set(SPRITE_SCORE_START + i, {
      priority: 200,
      x: i * 8,
      y: 0,
      palette: 0,
      pattern: PATTERN_DIGIT_0 + digit
    });
  }
}

/**
 * 残機を画面右上に表示（自機アイコンで表示）
 */
function displayLives() {
  for (let i = 0; i < 3; i++) {
    if (i < lives) {
      ss.sprite0.set(SPRITE_LIVES_START + i, {
        priority: 200,
        x: 104 + i * 8,
        y: 0,
        palette: 0,
        pattern: PATTERN_PLAYER
      });
    } else {
      ss.sprite0.disable(SPRITE_LIVES_START + i);
    }
  }
}

/**
 * deltaTimeを画面右下に表示（デバッグ用）
 */
function displayDeltaTime(deltaTime) {
  // ミリ秒に変換して3桁表示
  const ms = Math.floor(deltaTime * 1000);
  const clamped = Math.min(999, Math.max(0, ms));
  const str = String(clamped).padStart(3, "0");

  for (let i = 0; i < 3; i++) {
    const digit = parseInt(str[i], 10);
    ss.sprite0.set(SPRITE_DEBUG_START + i, {
      priority: 200,
      x: 104 + i * 8,
      y: 120,
      palette: 0,
      pattern: PATTERN_DIGIT_0 + digit
    });
  }
}

/**
 * 初期化
 */
ss.onReady = function () {
  // パレット0設定
  // インデックス0は透明（デフォルト）
  // インデックス1に白を設定
  ss.palette0.setColor(0, 1, 255, 255, 255);
  // インデックス2に水色（自機用）
  ss.palette0.setColor(0, 2, 100, 200, 255);
  // インデックス3に赤（敵用）
  ss.palette0.setColor(0, 3, 255, 100, 100);
  // インデックス4に黄色（敵弾用）
  ss.palette0.setColor(0, 4, 255, 255, 100);

  // パレット1設定（特別敵用：金色）
  ss.palette0.setColor(1, 1, 255, 215, 0);
  ss.palette0.setColor(1, 2, 255, 180, 0);
  ss.palette0.setColor(1, 3, 255, 215, 0);

  // パレット2設定（パワーアップアイテム用：緑）
  ss.palette0.setColor(2, 1, 100, 255, 100);
  ss.palette0.setColor(2, 2, 50, 200, 50);

  // フォントパターンを登録
  ss.pattern0.setFromBitmap(PATTERN_S, FONT.S, 1);
  ss.pattern0.setFromBitmap(PATTERN_H, FONT.H, 1);
  ss.pattern0.setFromBitmap(PATTERN_O, FONT.O, 1);
  ss.pattern0.setFromBitmap(PATTERN_T, FONT.T, 1);
  ss.pattern0.setFromBitmap(PATTERN_E, FONT.E, 1);
  ss.pattern0.setFromBitmap(PATTERN_R, FONT.R, 1);
  ss.pattern0.setFromBitmap(PATTERN_G, FONT.G, 1);
  ss.pattern0.setFromBitmap(PATTERN_A, FONT.A, 1);
  ss.pattern0.setFromBitmap(PATTERN_M, FONT.M, 1);
  ss.pattern0.setFromBitmap(PATTERN_V, FONT.V, 1);
  ss.pattern0.setFromBitmap(PATTERN_I, FONT.I, 1);
  ss.pattern0.setFromBitmap(PATTERN_N, FONT.N, 1);

  // 自機パターンを登録
  ss.pattern0.setFromBitmap(PATTERN_PLAYER, PLAYER_PATTERN, 2);

  // 弾パターンを登録
  ss.pattern0.setFromBitmap(PATTERN_BULLET, BULLET_PATTERN, 1);

  // 敵パターンを登録
  ss.pattern0.setFromBitmap(PATTERN_ENEMY, ENEMY_PATTERN, 3);

  // 敵弾パターンを登録
  ss.pattern0.setFromBitmap(PATTERN_ENEMY_BULLET, ENEMY_BULLET_PATTERN, 4);

  // 破片パターンを登録（敵と同じ赤色）
  ss.pattern0.setFromBitmap(PATTERN_DEBRIS_TL, DEBRIS_PATTERN_TL, 3);
  ss.pattern0.setFromBitmap(PATTERN_DEBRIS_TR, DEBRIS_PATTERN_TR, 3);
  ss.pattern0.setFromBitmap(PATTERN_DEBRIS_BL, DEBRIS_PATTERN_BL, 3);
  ss.pattern0.setFromBitmap(PATTERN_DEBRIS_BR, DEBRIS_PATTERN_BR, 3);

  // パーティクルパターンを登録（白）
  ss.pattern0.setFromBitmap(PATTERN_PARTICLE, PARTICLE_PATTERN, 1);

  // パワーアップアイテムパターンを登録（緑）
  ss.pattern0.setFromBitmap(PATTERN_POWERUP, POWERUP_PATTERN, 1);

  // 数字パターンを登録（デバッグ用）
  for (let i = 0; i <= 9; i++) {
    ss.pattern0.setFromBitmap(PATTERN_DIGIT_0 + i, FONT[i], 1);
  }

  // タイトル画面を表示
  showTitle();
};

/**
 * 毎フレーム更新
 */
ss.onUpdate = function (deltaTime) {
  // deltaTimeを画面右下に表示（デバッグ用）
  displayDeltaTime(deltaTime);

  if (gameState === STATE_TITLE) {
    // Aボタンでゲーム開始
    if (ss.input0.player1.a) {
      gameState = STATE_GAME;
      startGame();
    }
  } else if (gameState === STATE_GAME) {
    updatePlayer(deltaTime);
    updateBullets(deltaTime);
    updateEnemies(deltaTime);
    updateEnemyBullets(deltaTime);
    updatePowerUpItems(deltaTime);
    checkBulletEnemyCollision();
    checkEnemyBulletPlayerCollision();
    checkEnemyPlayerCollision();
    checkPowerUpItemCollision();
    updateExplosions(deltaTime);

    // 生存時間に応じてスコア加算（ミリ秒単位）
    score += Math.floor(deltaTime * 1000);

    displayScore();
    displayLives();
  } else if (gameState === STATE_GAMEOVER) {
    // ゲームオーバー: 爆発エフェクトは継続
    updateExplosions(deltaTime);

    // タイマーが切れたらタイトルに戻る
    gameOverTimer -= deltaTime;
    if (gameOverTimer <= 0) {
      // 敵と弾を非表示
      for (let i = 0; i < MAX_ENEMIES; i++) {
        ss.sprite0.disable(SPRITE_ENEMY_START + i);
      }
      for (let i = 0; i < MAX_ENEMY_BULLETS; i++) {
        ss.sprite0.disable(SPRITE_ENEMY_BULLET_START + i);
      }
      for (let i = 0; i < MAX_PLAYER_BULLETS; i++) {
        ss.sprite0.disable(SPRITE_BULLET_START + i);
      }
      for (let i = 0; i < MAX_DEBRIS; i++) {
        ss.sprite0.disable(SPRITE_DEBRIS_START + i);
      }
      for (let i = 0; i < MAX_PARTICLES; i++) {
        ss.sprite0.disable(SPRITE_PARTICLE_START + i);
      }
      for (let i = 0; i < MAX_POWERUP_ITEMS; i++) {
        ss.sprite0.disable(SPRITE_POWERUP_START + i);
      }

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
