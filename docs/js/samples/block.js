/**
 * ブロック崩し - サンプルゲーム
 */

const ss = window.sprite_system;

// ゲーム状態
const STATE_TITLE = 0;
const STATE_GAME = 1;
const STATE_CLEAR = 2;
const STATE_GAMEOVER = 3;
let gameState = STATE_TITLE;

// ステージ
const MAX_STAGES = 3;
let currentStage = 1;

// スコアと残機
let score = 0;
let lives = 3;

// パドル
const PADDLE_WIDTH = 24;
const PADDLE_HEIGHT = 4;
const PADDLE_Y = 116;
const PADDLE_SPEED = 80; // ピクセル/秒
const paddle = {
  x: 52, // 中央位置（(128 - 24) / 2）
  y: PADDLE_Y
};

// ボール
const BALL_SIZE = 4;
const BALL_BASE_SPEED = 60; // ピクセル/秒
let ballSpeed = BALL_BASE_SPEED;
const ball = {
  x: 62,
  y: 100,
  vx: 0,
  vy: 0,
  active: false
};

// ブロック
const BLOCK_WIDTH = 16;
const BLOCK_HEIGHT = 8;
const BLOCK_COLS = 8;
const BLOCK_ROWS = 8;
const BLOCK_START_Y = 8;
const blocks = []; // { x, y, active, palette }

// ゲームオーバー・クリア
const TRANSITION_DURATION = 3.0; // 秒
let transitionTimer = 0;

// 効果音チャンネル割り当て
const SFX_CH_PADDLE = 0;
const SFX_CH_BLOCK = 1;
const SFX_CH_MISS = 2;
const SFX_CH_CLEAR = 3;

// プリセット波形番号
const WAVEFORM_SQUARE_50 = 0;
const WAVEFORM_TRIANGLE = 3;

// 効果音関数
function playSfxPaddle() {
  ss.sound0.play(SFX_CH_PADDLE, {
    frequency: 440,
    waveform: WAVEFORM_SQUARE_50,
    volume: 0.2,
    envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0 }
  });
}
function playSfxBlock() {
  ss.sound0.play(SFX_CH_BLOCK, {
    frequency: 660,
    waveform: WAVEFORM_SQUARE_50,
    volume: 0.2,
    envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0 }
  });
}
function playSfxMiss() {
  ss.sound0.play(SFX_CH_MISS, {
    frequency: 220,
    waveform: WAVEFORM_TRIANGLE,
    volume: 0.25,
    envelope: { attack: 0, decay: 0.3, sustain: 0, release: 0 }
  });
}
function playSfxClear() {
  ss.sound0.play(SFX_CH_CLEAR, {
    frequency: 880,
    waveform: WAVEFORM_SQUARE_50,
    volume: 0.25,
    envelope: { attack: 0, decay: 0.2, sustain: 0, release: 0 }
  });
}

// 8x8 フォントデータ
const FONT = {
  B: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b00000000],
  R: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11011000, 0b11001100, 0b11000110, 0b00000000],
  E: [0b11111110, 0b11000000, 0b11000000, 0b11111100, 0b11000000, 0b11000000, 0b11111110, 0b00000000],
  A: [0b00111000, 0b01101100, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  K: [0b11000110, 0b11001100, 0b11011000, 0b11110000, 0b11011000, 0b11001100, 0b11000110, 0b00000000],
  O: [0b01111100, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  U: [0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  T: [0b11111110, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00110000, 0b00000000],
  G: [0b01111100, 0b11000110, 0b11000000, 0b11001110, 0b11000110, 0b11000110, 0b01111100, 0b00000000],
  M: [0b11000110, 0b11101110, 0b11111110, 0b11010110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  V: [0b11000110, 0b11000110, 0b11000110, 0b11000110, 0b01101100, 0b00111000, 0b00010000, 0b00000000],
  S: [0b01111110, 0b11000000, 0b11000000, 0b01111100, 0b00000110, 0b00000110, 0b11111100, 0b00000000],
  C: [0b01111100, 0b11000110, 0b11000000, 0b11000000, 0b11000000, 0b11000110, 0b01111100, 0b00000000],
  L: [0b11000000, 0b11000000, 0b11000000, 0b11000000, 0b11000000, 0b11000000, 0b11111110, 0b00000000],
  ' ': [0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000],
  0: [0b00111100, 0b01100110, 0b01101110, 0b01110110, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  1: [0b00011000, 0b00111000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b01111110, 0b00000000],
  2: [0b00111100, 0b01100110, 0b00000110, 0b00011100, 0b00110000, 0b01100000, 0b01111110, 0b00000000],
  3: [0b00111100, 0b01100110, 0b00000110, 0b00011100, 0b00000110, 0b01100110, 0b00111100, 0b00000000],
  4: [0b00001100, 0b00011100, 0b00101100, 0b01001100, 0b01111110, 0b00001100, 0b00001100, 0b00000000],
  5: [0b01111110, 0b01100000, 0b01111100, 0b00000110, 0b00000110, 0b01100110, 0b00111100, 0b00000000],
  6: [0b00111100, 0b01100110, 0b01100000, 0b01111100, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  7: [0b01111110, 0b00000110, 0b00001100, 0b00011000, 0b00110000, 0b00110000, 0b00110000, 0b00000000],
  8: [0b00111100, 0b01100110, 0b01100110, 0b00111100, 0b01100110, 0b01100110, 0b00111100, 0b00000000],
  9: [0b00111100, 0b01100110, 0b01100110, 0b00111110, 0b00000110, 0b01100110, 0b00111100, 0b00000000]
};

// パドルパターン（8x8、高さ4ピクセル使用）
const PADDLE_PATTERN_L = [0b00000000, 0b00000000, 0b01111111, 0b11111111, 0b11111111, 0b01111111, 0b00000000, 0b00000000];
const PADDLE_PATTERN_M = [0b00000000, 0b00000000, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b00000000, 0b00000000];
const PADDLE_PATTERN_R = [0b00000000, 0b00000000, 0b11111110, 0b11111111, 0b11111111, 0b11111110, 0b00000000, 0b00000000];

// ボールパターン（4x4、中央配置）
const BALL_PATTERN = [0b00000000, 0b00000000, 0b00111100, 0b01111110, 0b01111110, 0b00111100, 0b00000000, 0b00000000];

// ブロックパターン（8x8、高さ8ピクセル）
const BLOCK_PATTERN_L = [0b01111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b01111111];
const BLOCK_PATTERN_R = [0b11111110, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111110];

// パターン番号
const PATTERN_B = 0;
const PATTERN_R = 1;
const PATTERN_E = 2;
const PATTERN_A = 3;
const PATTERN_K = 4;
const PATTERN_O = 5;
const PATTERN_U = 6;
const PATTERN_T = 7;
const PATTERN_G = 8;
const PATTERN_M = 9;
const PATTERN_V = 10;
const PATTERN_S = 11;
const PATTERN_C = 12;
const PATTERN_L = 13;
const PATTERN_PADDLE_L = 14;
const PATTERN_PADDLE_M = 15;
const PATTERN_PADDLE_R = 16;
const PATTERN_BALL = 17;
const PATTERN_BLOCK_L = 18;
const PATTERN_BLOCK_R = 19;
const PATTERN_DIGIT_0 = 20; // 20〜29: 数字0-9

// テキスト用パターンマップ
const TEXT_PATTERN_MAP = {
  B: PATTERN_B, R: PATTERN_R, E: PATTERN_E, A: PATTERN_A, K: PATTERN_K,
  O: PATTERN_O, U: PATTERN_U, T: PATTERN_T, G: PATTERN_G, M: PATTERN_M,
  V: PATTERN_V, S: PATTERN_S, C: PATTERN_C, L: PATTERN_L, ' ': -1
};

// スプライト番号
const SPRITE_PADDLE_START = 0; // 0〜2: パドル（3個）
const SPRITE_BALL = 3;
const SPRITE_BLOCK_START = 10; // 10〜137: ブロック（128個）
const SPRITE_SCORE_START = 140; // 140〜147: スコア表示（8桁）
const SPRITE_LIVES_START = 150; // 150〜152: 残機表示（3個）
const SPRITE_TITLE_START = 160; // 160〜175: タイトル文字（16個）
const SPRITE_STAGE_START = 180; // 180〜189: ステージ表示（10個）

// ステージ配置パターン
const STAGE_PATTERNS = [
  // ステージ1: 全ブロック
  null, // nullは全ブロック配置
  // ステージ2: チェッカーパターン
  [
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1]
  ],
  // ステージ3: ピラミッド
  [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0]
  ]
];

// ========================================
// 初期化
// ========================================

ss.onReady = function() {
  setupPalettes();
  setupPatterns();
  initSprites();
  showTitle();
};

function setupPalettes() {
  // パレット0: 基本（白系）
  ss.palette0.setColor(0, 1, 255, 255, 255); // 白

  // パレット1: 赤系
  ss.palette0.setColor(1, 1, 255, 100, 100);
  ss.palette0.setColor(1, 2, 200, 50, 50);

  // パレット2: 緑系
  ss.palette0.setColor(2, 1, 100, 255, 100);
  ss.palette0.setColor(2, 2, 50, 200, 50);

  // パレット3: 青系
  ss.palette0.setColor(3, 1, 100, 100, 255);
  ss.palette0.setColor(3, 2, 50, 50, 200);
}

function setupPatterns() {
  // フォント
  ss.pattern0.setFromBitmap(PATTERN_B, FONT.B);
  ss.pattern0.setFromBitmap(PATTERN_R, FONT.R);
  ss.pattern0.setFromBitmap(PATTERN_E, FONT.E);
  ss.pattern0.setFromBitmap(PATTERN_A, FONT.A);
  ss.pattern0.setFromBitmap(PATTERN_K, FONT.K);
  ss.pattern0.setFromBitmap(PATTERN_O, FONT.O);
  ss.pattern0.setFromBitmap(PATTERN_U, FONT.U);
  ss.pattern0.setFromBitmap(PATTERN_T, FONT.T);
  ss.pattern0.setFromBitmap(PATTERN_G, FONT.G);
  ss.pattern0.setFromBitmap(PATTERN_M, FONT.M);
  ss.pattern0.setFromBitmap(PATTERN_V, FONT.V);
  ss.pattern0.setFromBitmap(PATTERN_S, FONT.S);
  ss.pattern0.setFromBitmap(PATTERN_C, FONT.C);
  ss.pattern0.setFromBitmap(PATTERN_L, FONT.L);

  // パドル
  ss.pattern0.setFromBitmap(PATTERN_PADDLE_L, PADDLE_PATTERN_L);
  ss.pattern0.setFromBitmap(PATTERN_PADDLE_M, PADDLE_PATTERN_M);
  ss.pattern0.setFromBitmap(PATTERN_PADDLE_R, PADDLE_PATTERN_R);

  // ボール
  ss.pattern0.setFromBitmap(PATTERN_BALL, BALL_PATTERN);

  // ブロック
  ss.pattern0.setFromBitmap(PATTERN_BLOCK_L, BLOCK_PATTERN_L);
  ss.pattern0.setFromBitmap(PATTERN_BLOCK_R, BLOCK_PATTERN_R);

  // 数字
  for (let i = 0; i <= 9; i++) {
    ss.pattern0.setFromBitmap(PATTERN_DIGIT_0 + i, FONT[i.toString()]);
  }
}

function initSprites() {
  // パドル
  for (let i = 0; i < 3; i++) {
    ss.sprite0.set(SPRITE_PADDLE_START + i, {
      priority: 10,
      x: 0,
      y: 0,
      palette: 0,
      pattern: PATTERN_PADDLE_L + i
    });
  }

  // ボール
  ss.sprite0.set(SPRITE_BALL, {
    priority: 10,
    x: 0,
    y: 0,
    palette: 0,
    pattern: PATTERN_BALL
  });

  // ブロック（128スプライト）
  for (let i = 0; i < BLOCK_COLS * BLOCK_ROWS * 2; i++) {
    ss.sprite0.set(SPRITE_BLOCK_START + i, {
      priority: 5,
      x: 0,
      y: 0,
      palette: 0,
      pattern: PATTERN_BLOCK_L
    });
    ss.sprite0.disable(SPRITE_BLOCK_START + i);
  }

  // スコア表示
  for (let i = 0; i < 8; i++) {
    ss.sprite0.set(SPRITE_SCORE_START + i, {
      priority: 20,
      x: i * 8,
      y: 0,
      palette: 0,
      pattern: PATTERN_DIGIT_0
    });
  }

  // 残機表示
  for (let i = 0; i < 3; i++) {
    ss.sprite0.set(SPRITE_LIVES_START + i, {
      priority: 20,
      x: 104 + i * 8,
      y: 0,
      palette: 0,
      pattern: PATTERN_PADDLE_M
    });
  }

  // タイトル文字
  for (let i = 0; i < 16; i++) {
    ss.sprite0.set(SPRITE_TITLE_START + i, {
      priority: 20,
      x: 0,
      y: 0,
      palette: 0,
      pattern: 0
    });
    ss.sprite0.disable(SPRITE_TITLE_START + i);
  }

  // ステージ表示
  for (let i = 0; i < 10; i++) {
    ss.sprite0.set(SPRITE_STAGE_START + i, {
      priority: 20,
      x: 0,
      y: 0,
      palette: 0,
      pattern: 0
    });
    ss.sprite0.disable(SPRITE_STAGE_START + i);
  }
}

// ========================================
// ゲームループ
// ========================================

ss.onUpdate = function(deltaTime) {
  switch (gameState) {
    case STATE_TITLE:
      updateTitle(deltaTime);
      break;
    case STATE_GAME:
      updateGame(deltaTime);
      break;
    case STATE_CLEAR:
      updateClear(deltaTime);
      break;
    case STATE_GAMEOVER:
      updateGameOver(deltaTime);
      break;
  }
};

// ========================================
// タイトル画面
// ========================================

function showTitle() {
  gameState = STATE_TITLE;

  // ゲーム要素を非表示
  hideGameElements();

  // タイトル「BLOCK」を表示
  ss.text.draw('BLOCK', 44, 50, SPRITE_TITLE_START, TEXT_PATTERN_MAP, { priority: 20 });
}

function updateTitle(deltaTime) {
  // Aボタンでゲーム開始
  if (ss.input0.player1.a) {
    startGame();
  }
}

function hideTitle() {
  for (let i = 0; i < 16; i++) {
    ss.sprite0.disable(SPRITE_TITLE_START + i);
  }
}

// ========================================
// ゲーム開始
// ========================================

function startGame() {
  hideTitle();

  score = 0;
  lives = 3;
  currentStage = 1;
  ballSpeed = BALL_BASE_SPEED;

  startStage();
}

function startStage() {
  gameState = STATE_GAME;

  // パドル初期位置
  paddle.x = 52;

  // ボール初期化
  resetBall();

  // ブロック初期化
  initBlocks();

  // 表示更新
  displayScore();
  displayLives();
  displayPaddle();
  displayBlocks();
}

function resetBall() {
  ball.x = paddle.x + PADDLE_WIDTH / 2 - BALL_SIZE / 2;
  ball.y = PADDLE_Y - BALL_SIZE - 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.active = false;
}

function launchBall() {
  // 斜め上に発射（ランダムに左右）
  const angle = Math.random() < 0.5 ? -60 : -120; // 度
  const rad = angle * Math.PI / 180;
  ball.vx = Math.cos(rad) * ballSpeed;
  ball.vy = Math.sin(rad) * ballSpeed;
  ball.active = true;
}

function initBlocks() {
  blocks.length = 0;

  const pattern = STAGE_PATTERNS[currentStage - 1];

  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      // ステージパターンで配置を決定
      let shouldPlace = true;
      if (pattern !== null) {
        shouldPlace = pattern[row][col] === 1;
      }

      if (shouldPlace) {
        const paletteIndex = (row % 4); // 行ごとに色を変える
        blocks.push({
          x: col * BLOCK_WIDTH,
          y: BLOCK_START_Y + row * BLOCK_HEIGHT,
          active: true,
          palette: paletteIndex,
          row: row,
          col: col
        });
      }
    }
  }
}

// ========================================
// ゲーム更新
// ========================================

function updateGame(deltaTime) {
  // ボール未発射時はAボタンで発射
  if (!ball.active) {
    if (ss.input0.player1.a) {
      launchBall();
    }
    // パドルに追従
    ball.x = paddle.x + PADDLE_WIDTH / 2 - BALL_SIZE / 2;
  }

  updatePaddle(deltaTime);
  updateBall(deltaTime);
  checkCollisions();
  checkClear();

  displayPaddle();
  displayBall();
}

function updatePaddle(deltaTime) {
  const move = PADDLE_SPEED * deltaTime;

  if (ss.input0.player1.left) {
    paddle.x -= move;
  }
  if (ss.input0.player1.right) {
    paddle.x += move;
  }

  // 画面端クランプ
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x > 128 - PADDLE_WIDTH) paddle.x = 128 - PADDLE_WIDTH;
}

function updateBall(deltaTime) {
  if (!ball.active) return;

  ball.x += ball.vx * deltaTime;
  ball.y += ball.vy * deltaTime;

  // 壁反射（左右）
  if (ball.x < 0) {
    ball.x = 0;
    ball.vx = -ball.vx;
  }
  if (ball.x > 128 - BALL_SIZE) {
    ball.x = 128 - BALL_SIZE;
    ball.vx = -ball.vx;
  }

  // 壁反射（上）
  if (ball.y < 0) {
    ball.y = 0;
    ball.vy = -ball.vy;
  }

  // 画面下落下
  if (ball.y > 128) {
    loseLife();
  }
}

function checkCollisions() {
  if (!ball.active) return;

  checkPaddleCollision();
  checkBlockCollision();
}

function checkPaddleCollision() {
  const bx = ball.x;
  const by = ball.y;

  // パドルとの衝突判定
  if (by + BALL_SIZE >= paddle.y && by < paddle.y + PADDLE_HEIGHT &&
      bx + BALL_SIZE >= paddle.x && bx < paddle.x + PADDLE_WIDTH) {

    // 上から当たった場合のみ反射
    if (ball.vy > 0) {
      ball.y = paddle.y - BALL_SIZE;
      playSfxPaddle();

      // 衝突位置で反射角度を決定（0.0〜1.0）
      const hitPos = (bx + BALL_SIZE / 2 - paddle.x) / PADDLE_WIDTH;

      // 反射角度: 左端で-60度、中央で-90度、右端で-120度
      const angle = -120 + hitPos * 60; // -120〜-60度
      const rad = angle * Math.PI / 180;
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

      ball.vx = Math.cos(rad) * speed;
      ball.vy = Math.sin(rad) * speed;
    }
  }
}

function checkBlockCollision() {
  const bx = ball.x;
  const by = ball.y;

  for (let block of blocks) {
    if (!block.active) continue;

    // 衝突判定
    if (bx + BALL_SIZE > block.x && bx < block.x + BLOCK_WIDTH &&
        by + BALL_SIZE > block.y && by < block.y + BLOCK_HEIGHT) {

      // ブロック消滅
      block.active = false;
      score += 10;
      displayScore();
      hideBlock(block);
      playSfxBlock();

      // 衝突辺を判定して反射
      const ballCenterX = bx + BALL_SIZE / 2;
      const ballCenterY = by + BALL_SIZE / 2;
      const blockCenterX = block.x + BLOCK_WIDTH / 2;
      const blockCenterY = block.y + BLOCK_HEIGHT / 2;

      const dx = ballCenterX - blockCenterX;
      const dy = ballCenterY - blockCenterY;

      // アスペクト比を考慮して判定
      if (Math.abs(dx) / BLOCK_WIDTH > Math.abs(dy) / BLOCK_HEIGHT) {
        // 左右から衝突
        ball.vx = -ball.vx;
      } else {
        // 上下から衝突
        ball.vy = -ball.vy;
      }

      break; // 1フレーム1ブロックのみ
    }
  }
}

function checkClear() {
  const remaining = blocks.filter(b => b.active).length;
  if (remaining === 0) {
    stageClear();
  }
}

function loseLife() {
  lives--;
  displayLives();
  playSfxMiss();

  if (lives <= 0) {
    gameOver();
  } else {
    resetBall();
  }
}

function stageClear() {
  playSfxClear();
  score += 1000; // クリアボーナス
  displayScore();

  if (currentStage >= MAX_STAGES) {
    // 全ステージクリア
    showClear();
  } else {
    // 次のステージ
    currentStage++;
    ballSpeed += 10; // 速度アップ
    startStage();
  }
}

function gameOver() {
  gameState = STATE_GAMEOVER;
  transitionTimer = TRANSITION_DURATION;

  // ゲーム要素を非表示
  hideGameElements();

  // 「GAME OVER」を表示
  showText('GAME OVER', 56);
}

function showClear() {
  gameState = STATE_CLEAR;
  transitionTimer = TRANSITION_DURATION;

  // ゲーム要素を非表示
  hideGameElements();

  // 「CLEAR」を表示
  showText('CLEAR', 56);
}

function showText(text, y) {
  const startX = (128 - text.length * 8) / 2;
  ss.text.draw(text, startX, y, SPRITE_TITLE_START, TEXT_PATTERN_MAP, { priority: 20 });
}

// ========================================
// クリア・ゲームオーバー画面
// ========================================

function updateClear(deltaTime) {
  transitionTimer -= deltaTime;
  if (transitionTimer <= 0) {
    hideTitle();
    showTitle();
  }
}

function updateGameOver(deltaTime) {
  transitionTimer -= deltaTime;
  if (transitionTimer <= 0) {
    hideTitle();
    showTitle();
  }
}

// ========================================
// 表示関数
// ========================================

function displayPaddle() {
  for (let i = 0; i < 3; i++) {
    ss.sprite0.set(SPRITE_PADDLE_START + i, {
      priority: 10,
      x: paddle.x + i * 8,
      y: paddle.y - 2, // パターンのオフセット調整
      palette: 0,
      pattern: PATTERN_PADDLE_L + i
    });
  }
}

function displayBall() {
  ss.sprite0.set(SPRITE_BALL, {
    priority: 10,
    x: ball.x - 2, // パターンのオフセット調整
    y: ball.y - 2,
    palette: 0,
    pattern: PATTERN_BALL
  });
}

function displayBlocks() {
  let spriteIndex = SPRITE_BLOCK_START;

  for (let block of blocks) {
    if (block.active) {
      // 左半分
      ss.sprite0.set(spriteIndex, {
        priority: 5,
        x: block.x,
        y: block.y,
        palette: block.palette,
        pattern: PATTERN_BLOCK_L
      });
      spriteIndex++;

      // 右半分
      ss.sprite0.set(spriteIndex, {
        priority: 5,
        x: block.x + 8,
        y: block.y,
        palette: block.palette,
        pattern: PATTERN_BLOCK_R
      });
      spriteIndex++;
    }
  }

  // 残りのスプライトを非表示
  while (spriteIndex < SPRITE_BLOCK_START + 128) {
    ss.sprite0.disable(spriteIndex);
    spriteIndex++;
  }
}

function hideBlock(block) {
  // ブロックのスプライトを探して非表示
  displayBlocks(); // 再描画で対応
}

function displayScore() {
  const scoreStr = score.toString().padStart(8, '0');
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(scoreStr[i]);
    ss.sprite0.set(SPRITE_SCORE_START + i, {
      priority: 20,
      x: i * 8,
      y: 0,
      palette: 0,
      pattern: PATTERN_DIGIT_0 + digit
    });
  }
}

function displayLives() {
  for (let i = 0; i < 3; i++) {
    if (i < lives) {
      ss.sprite0.set(SPRITE_LIVES_START + i, {
        priority: 20,
        x: 104 + i * 8,
        y: 0,
        palette: 0,
        pattern: PATTERN_PADDLE_M
      });
    } else {
      ss.sprite0.disable(SPRITE_LIVES_START + i);
    }
  }
}

function hideGameElements() {
  // パドル
  for (let i = 0; i < 3; i++) {
    ss.sprite0.disable(SPRITE_PADDLE_START + i);
  }

  // ボール
  ss.sprite0.disable(SPRITE_BALL);

  // ブロック
  for (let i = 0; i < 128; i++) {
    ss.sprite0.disable(SPRITE_BLOCK_START + i);
  }
}

// 初期化実行
window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("screen");
  ss.init(canvas);
});
