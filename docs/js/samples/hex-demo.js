const ss = window.sprite_system;

// スプライトの状態（位置と速度）
const sprites = [];

// タイルマップスクロール用の角度
let scrollAngle = 0;

// 星空スクロール用
let starScrollY = 0;

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
  ss.palette0.setFromString(0, `0000FF  00FFC0  15FFC0  2AFFC0  55FFD0  AAFFC0  B8FFD0  C6FFC0`);

  // パレット1: タイルマップ用（HHSSLL形式）
  // 1:赤 から 8:紫
  ss.palette0.setFromString(1, `00FF50 20FF50 40FF50 60FF50 80FF50 A0FF50 C0FF50 E0FF50`);

  // パレット2: 星用（HHSSLL形式）
  // 1:赤 から 8:紫
  ss.palette0.setFromString(2, `00FF80 20FF80 40FF80 60FF80 80FF80 A0FF80 C0FF80 E0FF80`);

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

  // 透明タイル（パターン18）- 全ピクセル0
  ss.pattern0.setFromString(
    18,
    `
    00000000
    00000000
    00000000
    00000000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // タイル用パターン（パターン16）
  // ※パレット1用
  ss.pattern0.setFromString(
    16,
    `
    02345670
    12345678
    12345678
    12345678
    12345678
    12345678
    12345678
    02345670
  `
  );

  // 星用パターン（パターン17-21）- 1ピクセルの星（各色）
  ss.pattern0.setFromString(
    17,
    `
    00000000
    00000000
    00000000
    00010000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン19: 色2の星
  ss.pattern0.setFromString(
    19,
    `
    00000000
    00000000
    00000000
    00020000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン20: 色3の星
  ss.pattern0.setFromString(
    20,
    `
    00000000
    00000000
    00000000
    00030000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン21: 色4の星
  ss.pattern0.setFromString(
    21,
    `
    00000000
    00000000
    00000000
    00040000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン22: 色5の星
  ss.pattern0.setFromString(
    22,
    `
    00000000
    00000000
    00000000
    00050000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン23: 色6の星
  ss.pattern0.setFromString(
    23,
    `
    00000000
    00000000
    00000000
    00060000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン24: 色7の星
  ss.pattern0.setFromString(
    24,
    `
    00000000
    00000000
    00000000
    00070000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // パターン25: 色8の星
  ss.pattern0.setFromString(
    25,
    `
    00000000
    00000000
    00000000
    00080000
    00000000
    00000000
    00000000
    00000000
  `
  );

  // タイルマップ1: 星空背景（最背面）
  ss.tilemap0.set(1, { priority: -10, offsetX: 0, offsetY: 0 });

  // まず透明タイル（パターン18）で埋める
  ss.tilemap0.fill(1, { palette: 2, pattern: 18 });

  // ランダムにカラフル星を配置（8色、16%の確率）
  const starPatterns = [17, 19, 20, 21, 22, 23, 24, 25]; // 色1-8
  for (let ty = 0; ty < 64; ty++) {
    for (let tx = 0; tx < 64; tx++) {
      if (Math.random() < 0.16) {
        const pattern = starPatterns[Math.floor(Math.random() * starPatterns.length)];
        ss.tilemap0.setTile(1, tx, ty, { palette: 2, pattern: pattern });
      }
    }
  }

  // タイルマップ0: カラフルタイル（中間層）
  ss.tilemap0.set(0, { priority: 0, offsetX: 0, offsetY: 0 });
  ss.tilemap0.fill(0, { palette: 1, pattern: 16 });

  // 市松模様で透明化
  for (let ty = 0; ty < 64; ty++) {
    for (let tx = 0; tx < 64; tx++) {
      if ((ty % 2 === 1 && tx % 2 === 1) || (ty % 2 === 0 && tx % 2 === 0)) {
        ss.tilemap0.setTile(0, tx, ty, { pattern: 18 });
      }
    }
  }

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
  // タイルマップ0: 円運動スクロール
  scrollAngle += deltaTime * 0.5; // 0.5 rad/秒
  const radius = 64;
  const offsetX = Math.cos(scrollAngle) * radius;
  const offsetY = Math.sin(scrollAngle) * radius;
  ss.tilemap0.set(0, { offsetX: offsetX, offsetY: offsetY });

  // タイルマップ1: 星空の縦スクロール（上から下へ）
  starScrollY += deltaTime * 30; // 30 px/秒
  ss.tilemap0.set(1, { offsetY: starScrollY });

  // スプライト更新
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
