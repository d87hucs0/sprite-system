/**
 * Sound Demo
 * サウンドシステムのテスト用デモ
 *
 * 操作:
 *   上下: 波形選択
 *   左右: 周波数変更
 *   A: 音を再生
 *   B: 音を停止
 *   C: デューティ比変更（矩形波のみ）
 *   D: チャンネル変更
 */

const ss = window.sprite_system;

// 波形リスト（プリセット波形番号）
// 0: 矩形波50%, 1: 矩形波25%, 2: 矩形波12.5%, 3: 三角波, 4: ノコギリ波, 256: ノイズ
const waveformNames = ['SQUARE', 'TRIANGLE', 'SAWTOOTH', 'NOISE'];
const waveformNumbers = [0, 3, 4, 256]; // 256はノイズ
const dutyWaveforms = [2, 1, 0]; // 12.5%, 25%, 50% に対応する波形番号

// 現在の設定
let currentWaveform = 0;
let currentDuty = 2;  // 50% (waveform 0)
let currentFrequency = 440;
let currentChannel = 0;

// 入力のエッジ検出用
const prevInput = {
  up: false, down: false, left: false, right: false,
  a: false, b: false, c: false, d: false
};

// フォントパターン
const FONT_PATTERNS = {
  'S': [0x3C, 0x66, 0x60, 0x3C, 0x06, 0x66, 0x3C, 0x00],
  'O': [0x3C, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00],
  'U': [0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x00],
  'N': [0x66, 0x76, 0x7E, 0x7E, 0x6E, 0x66, 0x66, 0x00],
  'D': [0x78, 0x6C, 0x66, 0x66, 0x66, 0x6C, 0x78, 0x00],
  'E': [0x7E, 0x60, 0x60, 0x7C, 0x60, 0x60, 0x7E, 0x00],
  'M': [0x63, 0x77, 0x7F, 0x6B, 0x63, 0x63, 0x63, 0x00],
  'Q': [0x3C, 0x66, 0x66, 0x66, 0x6E, 0x3C, 0x0E, 0x00],
  'A': [0x18, 0x3C, 0x66, 0x66, 0x7E, 0x66, 0x66, 0x00],
  'R': [0x7C, 0x66, 0x66, 0x7C, 0x6C, 0x66, 0x66, 0x00],
  'T': [0x7E, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],
  'I': [0x3C, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00],
  'G': [0x3C, 0x66, 0x60, 0x6E, 0x66, 0x66, 0x3C, 0x00],
  'L': [0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7E, 0x00],
  'W': [0x63, 0x63, 0x63, 0x6B, 0x7F, 0x77, 0x63, 0x00],
  'H': [0x66, 0x66, 0x66, 0x7E, 0x66, 0x66, 0x66, 0x00],
  'Z': [0x7E, 0x06, 0x0C, 0x18, 0x30, 0x60, 0x7E, 0x00],
  'F': [0x7E, 0x60, 0x60, 0x7C, 0x60, 0x60, 0x60, 0x00],
  'Y': [0x66, 0x66, 0x66, 0x3C, 0x18, 0x18, 0x18, 0x00],
  'C': [0x3C, 0x66, 0x60, 0x60, 0x60, 0x66, 0x3C, 0x00],
  'P': [0x7C, 0x66, 0x66, 0x7C, 0x60, 0x60, 0x60, 0x00],
  'B': [0x7C, 0x66, 0x66, 0x7C, 0x66, 0x66, 0x7C, 0x00],
  'V': [0x66, 0x66, 0x66, 0x66, 0x66, 0x3C, 0x18, 0x00],
  ':': [0x00, 0x18, 0x18, 0x00, 0x18, 0x18, 0x00, 0x00],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00],
  '%': [0x62, 0x64, 0x08, 0x10, 0x20, 0x4C, 0x8C, 0x00],
  '0': [0x3C, 0x66, 0x6E, 0x76, 0x66, 0x66, 0x3C, 0x00],
  '1': [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00],
  '2': [0x3C, 0x66, 0x06, 0x1C, 0x30, 0x60, 0x7E, 0x00],
  '3': [0x3C, 0x66, 0x06, 0x1C, 0x06, 0x66, 0x3C, 0x00],
  '4': [0x0C, 0x1C, 0x3C, 0x6C, 0x7E, 0x0C, 0x0C, 0x00],
  '5': [0x7E, 0x60, 0x7C, 0x06, 0x06, 0x66, 0x3C, 0x00],
  '6': [0x1C, 0x30, 0x60, 0x7C, 0x66, 0x66, 0x3C, 0x00],
  '7': [0x7E, 0x06, 0x0C, 0x18, 0x30, 0x30, 0x30, 0x00],
  '8': [0x3C, 0x66, 0x66, 0x3C, 0x66, 0x66, 0x3C, 0x00],
  '9': [0x3C, 0x66, 0x66, 0x3E, 0x06, 0x0C, 0x38, 0x00],
  '-': [0x00, 0x00, 0x00, 0x7E, 0x00, 0x00, 0x00, 0x00],
};

// 文字→パターン番号マッピング
const patternMap = {};
let patternIndex = 0;

// デューティ比表示用
const dutyLabels = ['12.5', '25', '50'];

ss.onReady = function() {
  // パレット設定
  ss.palette0.setColor(0, 1, 255, 255, 255);  // 白
  ss.palette0.setColor(0, 2, 255, 255, 0);    // 黄
  ss.palette0.setColor(0, 3, 0, 255, 255);    // シアン
  ss.palette0.setColor(0, 4, 255, 0, 255);    // マゼンタ
  ss.palette0.setColor(0, 5, 100, 100, 100);  // グレー

  // フォントパターン設定
  for (const [char, data] of Object.entries(FONT_PATTERNS)) {
    ss.pattern0.setFromBitmap(patternIndex, data, 1);
    patternMap[char] = patternIndex;
    patternIndex++;
  }

  // 選択カーソルパターン
  ss.pattern0.setFromBitmap(patternIndex, [0x80, 0xC0, 0xE0, 0xF0, 0xE0, 0xC0, 0x80, 0x00], 2);
  const cursorPattern = patternIndex;
  patternIndex++;

  // カーソルスプライト
  ss.sprite0.set(0, { x: 4, y: 20, pattern: cursorPattern, palette: 0, priority: 10 });

  drawUI();
};

function drawUI() {
  let spriteIdx = 10;

  // タイトル
  ss.text.draw('SOUND DEMO', 24, 4, spriteIdx, patternMap, { palette: 0 });
  spriteIdx += 10;

  // 波形選択
  for (let i = 0; i < waveformNames.length; i++) {
    const y = 20 + i * 12;
    // 色を変えるためにパレットを設定し直す
    ss.palette0.setColor(0, 1, i === currentWaveform ? 255 : 100, i === currentWaveform ? 255 : 100, i === currentWaveform ? 0 : 100);
    ss.text.draw(waveformNames[i], 16, y, spriteIdx, patternMap, { palette: 0 });
    spriteIdx += waveformNames[i].length;
  }

  // 色を戻す
  ss.palette0.setColor(0, 1, 255, 255, 255);

  // 周波数表示
  const freqStr = 'FREQ: ' + currentFrequency + 'HZ';
  ss.text.draw(freqStr, 16, 72, spriteIdx, patternMap, { palette: 0 });
  spriteIdx += freqStr.length;

  // デューティ比表示（矩形波のみ）
  if (currentWaveform === 0) {
    const dutyStr = 'DUTY: ' + dutyLabels[currentDuty] + '%';
    ss.text.draw(dutyStr, 16, 84, spriteIdx, patternMap, { palette: 0 });
    spriteIdx += dutyStr.length;
  } else {
    // 消去
    for (let i = 0; i < 12; i++) {
      ss.sprite0.disable(spriteIdx + i);
    }
    spriteIdx += 12;
  }

  // チャンネル表示
  const chStr = 'CH: ' + currentChannel;
  ss.text.draw(chStr, 16, 96, spriteIdx, patternMap, { palette: 0 });
  spriteIdx += chStr.length;

  // 操作説明
  ss.text.draw('A:PLAY B:STOP', 16, 104, spriteIdx, patternMap, { palette: 0 });
  spriteIdx += 13;
  ss.text.draw('C:DUTY D:CH', 16, 112, spriteIdx, patternMap, { palette: 0 });
  spriteIdx += 11;
}

function updateCursor() {
  ss.sprite0.set(0, { y: 20 + currentWaveform * 12 });
}

function playSound() {
  const envelope = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  };

  let waveformNum;
  if (currentWaveform === 0) {
    // 矩形波: デューティ比に応じた波形番号
    waveformNum = dutyWaveforms[currentDuty];
  } else {
    // 三角波/ノコギリ波/ノイズ
    waveformNum = waveformNumbers[currentWaveform];
  }

  ss.sound0.play(currentChannel, {
    frequency: currentFrequency,
    waveform: waveformNum,
    volume: 0.3,
    envelope: envelope
  });
}

function stopSound() {
  ss.sound0.stop(currentChannel);
}

ss.onUpdate = function(deltaTime) {
  const input = ss.input0.player1;

  // エッジ検出
  const pressed = {
    up: input.up && !prevInput.up,
    down: input.down && !prevInput.down,
    left: input.left && !prevInput.left,
    right: input.right && !prevInput.right,
    a: input.a && !prevInput.a,
    b: input.b && !prevInput.b,
    c: input.c && !prevInput.c,
    d: input.d && !prevInput.d
  };

  // 波形選択
  if (pressed.up) {
    currentWaveform = (currentWaveform - 1 + waveformNames.length) % waveformNames.length;
    updateCursor();
    drawUI();
  }
  if (pressed.down) {
    currentWaveform = (currentWaveform + 1) % waveformNames.length;
    updateCursor();
    drawUI();
  }

  // 周波数変更
  if (pressed.left) {
    currentFrequency = Math.max(100, currentFrequency - 50);
    drawUI();
  }
  if (pressed.right) {
    currentFrequency = Math.min(2000, currentFrequency + 50);
    drawUI();
  }

  // 再生
  if (pressed.a) {
    playSound();
    drawUI();
  }

  // 停止
  if (pressed.b) {
    stopSound();
  }

  // デューティ比変更
  if (pressed.c && currentWaveform === 0) {
    currentDuty = (currentDuty + 1) % dutyLabels.length;
    drawUI();
  }

  // チャンネル変更
  if (pressed.d) {
    currentChannel = (currentChannel + 1) % 4;
    drawUI();
  }

  // 入力状態保存
  prevInput.up = input.up;
  prevInput.down = input.down;
  prevInput.left = input.left;
  prevInput.right = input.right;
  prevInput.a = input.a;
  prevInput.b = input.b;
  prevInput.c = input.c;
  prevInput.d = input.d;
};

// 初期化
window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("screen");
  ss.init(canvas);
});
