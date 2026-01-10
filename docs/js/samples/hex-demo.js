const ss = window.sprite_system;

// スプライトの状態（位置と速度）
const sprites = [];

// タイルマップスクロール用の角度
let scrollAngle = 0;

// 16進数フォントパターン定義（0-F）
const HEX_FONTS = {
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
  A: [0b00111000, 0b01101100, 0b11000110, 0b11111110, 0b11000110, 0b11000110, 0b11000110, 0b00000000],
  B: [0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b11000110, 0b11000110, 0b11111100, 0b00000000],
  C: [0b00111100, 0b01100110, 0b11000000, 0b11000000, 0b11000000, 0b01100110, 0b00111100, 0b00000000],
  D: [0b11111000, 0b11001100, 0b11000110, 0b11000110, 0b11000110, 0b11001100, 0b11111000, 0b00000000],
  E: [0b11111110, 0b11000000, 0b11000000, 0b11111100, 0b11000000, 0b11000000, 0b11111110, 0b00000000],
  F: [0b11111110, 0b11000000, 0b11000000, 0b11111100, 0b11000000, 0b11000000, 0b11000000, 0b00000000]
};

const HEX_CHARS = "0123456789ABCDEF";

ss.onReady = function () {
  // パレット0: スプライト用（HHSSLL形式）
  // 1:白 2:赤 3:橙 4:黄 5:緑 6:青 7:藍 8:紫
  ss.palette0.setFromString(0, `0000FF  00FFD0  15FFD0  2AFFD0  55FFD0  AAFFD0  B8FFD0  C6FFD0`);

  // パレット1: タイルマップ用（HHSSLL形式）
  // 1:暗青（枠） 2:明青（内部） 3:赤 4:橙 5:黄 6:緑 7:青 8:藍 9:紫
  ss.palette0.setFromString(1, `88FF20 88FF30  00FF48 15FF48 2AFF48 55FF48 AAFF48 B8FF48 C6FF48`);

  // Y座標に応じた文字色（赤→橙→黄→緑→青→藍→紫）
  const colorByY = [2, 3, 4, 5, 6, 7, 8, 8]; // 8行目は紫のまま

  // パターン設定（文字=Y座標に応じた色、背景=透明）
  for (let i = 0; i < 16; i++) {
    const char = HEX_CHARS[i];
    ss.pattern0.setFromBitmap(i, HEX_FONTS[char], 1);
    // 文字部分をY座標に応じた色に置き換え
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (ss.pattern0.getPixel(i, x, y) === 1) {
          ss.pattern0.setPixel(i, x, y, colorByY[y]);
        }
      }
    }
  }

  // タイル用パターン（パターン16）
  // 1=枠（暗い青）、2=内部（少し明るい青）※パレット1用
  ss.pattern0.setFromString(
    16,
    `
    11111111
    11456781
    13456789
    13456789
    13456789
    13456789
    13456789
    11456781
  `
  );

  // タイルマップ設定（優先順位を低くしてスプライトの後ろに表示）
  // パレット1を使用
  ss.tilemap0.set(0, { priority: 0, offsetX: 0, offsetY: 0 });
  ss.tilemap0.fill(0, { palette: 1, pattern: 16 });

  // スプライト初期化（ランダム位置・速度）
  for (let i = 0; i < 256; i++) {
    sprites.push({
      x: Math.random() * 120,
      y: Math.random() * 120,
      vx: (Math.random() - 0.5) * 80, // -40〜+40 px/秒
      vy: (Math.random() - 0.5) * 80
    });

    ss.sprite0.set(i, {
      priority: 10,
      x: Math.floor(sprites[i].x),
      y: Math.floor(sprites[i].y),
      palette: 0,
      pattern: i % 16
    });
  }
};

ss.onUpdate = function (deltaTime) {
  // タイルマップスクロール（半径64の円運動）
  scrollAngle += deltaTime * 0.5; // 0.5 rad/秒
  const radius = 64;
  const offsetX = Math.cos(scrollAngle) * radius;
  const offsetY = Math.sin(scrollAngle) * radius;
  ss.tilemap0.set(0, { offsetX: offsetX, offsetY: offsetY });

  for (let i = 0; i < 256; i++) {
    const s = sprites[i];

    // 位置更新
    s.x += s.vx * deltaTime;
    s.y += s.vy * deltaTime;

    // 左右の壁で反射（0〜120の範囲、8x8スプライト）
    if (s.x < 0) {
      s.x = 0;
      s.vx = -s.vx;
    }
    if (s.x > 120) {
      s.x = 120;
      s.vx = -s.vx;
    }

    // 上下の壁で反射
    if (s.y < 0) {
      s.y = 0;
      s.vy = -s.vy;
    }
    if (s.y > 120) {
      s.y = 120;
      s.vy = -s.vy;
    }

    // スプライト更新
    ss.sprite0.set(i, {
      priority: 10,
      x: Math.floor(s.x),
      y: Math.floor(s.y),
      palette: 0,
      pattern: i % 16
    });
  }
};

// 初期化
window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("screen");
  ss.init(canvas);
});
