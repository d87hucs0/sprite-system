/**
 * SPRITE SYSTEM
 *
 * Webブラウザで動作する仮想ゲーム機（WebGL2版）
 */

(function () {
  "use strict";

  // 定数
  const SCREEN_WIDTH = 128;
  const SCREEN_HEIGHT = 128;
  const PATTERN_SIZE = 8;
  const PATTERN_COUNT = 256;
  const PALETTE_COUNT = 4;
  const COLORS_PER_PALETTE = 16;
  const SPRITE_COUNT = 256;
  const TILEMAP_COUNT = 2;
  const TILEMAP_SIZE = 64; // 64x64 タイル
  const SOUND_CHANNEL_COUNT = 4;
  const WAVEFORM_COUNT = 256;
  const WAVEFORM_SAMPLES = 64;
  const NOISE_WAVEFORM = 256; // ノイズを指定する波形番号
  const SE_CHANNEL_COUNT = 8; // SEチャネル数

  // パレットデータ: palette[paletteIndex][colorIndex] = {r, g, b}
  const palettes = [];
  for (let p = 0; p < PALETTE_COUNT; p++) {
    palettes[p] = [];
    for (let c = 0; c < COLORS_PER_PALETTE; c++) {
      palettes[p][c] = { r: 0, g: 0, b: 0 };
    }
  }

  // パターンデータ: patterns[patternIndex][y][x] = colorIndex
  const patterns = [];
  for (let p = 0; p < PATTERN_COUNT; p++) {
    patterns[p] = [];
    for (let y = 0; y < PATTERN_SIZE; y++) {
      patterns[p][y] = new Uint8Array(PATTERN_SIZE);
    }
  }

  // スプライトデータ
  const sprites = [];
  for (let i = 0; i < SPRITE_COUNT; i++) {
    sprites[i] = {
      enabled: false,
      priority: 0,
      x: 0,
      y: 0,
      palette: 0,
      pattern: 0
    };
  }

  // タイルマップデータ
  const tilemaps = [];
  for (let m = 0; m < TILEMAP_COUNT; m++) {
    tilemaps[m] = {
      enabled: false,
      priority: 0,
      offsetX: 0,
      offsetY: 0,
      tiles: []
    };
    for (let y = 0; y < TILEMAP_SIZE; y++) {
      tilemaps[m].tiles[y] = [];
      for (let x = 0; x < TILEMAP_SIZE; x++) {
        tilemaps[m].tiles[y][x] = { palette: 0, pattern: 0 };
      }
    }
  }

  // サウンド関連（Web Audio API）
  let audioCtx = null;
  let noiseBuffer = null;

  // 波形メモリ: waveforms[index] = Uint8Array(64)
  const waveforms = [];
  for (let i = 0; i < WAVEFORM_COUNT; i++) {
    waveforms[i] = new Uint8Array(WAVEFORM_SAMPLES);
  }
  // 波形メモリから生成したPeriodicWaveのキャッシュ
  const waveformWaves = [];
  // 波形メモリの更新フラグ
  const waveformDirty = [];
  for (let i = 0; i < WAVEFORM_COUNT; i++) {
    waveformWaves[i] = null;
    waveformDirty[i] = true;
  }

  // サウンドチャネルの状態（波形メモリまたはノイズを再生）
  const soundChannels = [];
  for (let i = 0; i < SOUND_CHANNEL_COUNT; i++) {
    soundChannels[i] = {
      oscillator: null, // 波形メモリ用
      source: null, // ノイズ用
      gainNode: null,
      playing: false,
      envelope: null,
      volume: 0,
      isNoise: false // ノイズ再生中かどうか
    };
  }

  // --- PCMサウンド関連 ---
  // マスターミキサーノード
  let masterGain = null;
  let pcgMixGain = null;
  let bgmGain = null;
  let seMixGain = null;
  // PCMアセット管理: pcmAssets[name] = AudioBuffer
  const pcmAssets = {};
  // BGMチャネル状態
  const bgmChannel = {
    source: null,
    playing: false,
    assetName: null,
    volume: 1.0
  };
  // SEチャネル状態
  const seChannels = [];
  for (let i = 0; i < SE_CHANNEL_COUNT; i++) {
    seChannels[i] = {
      source: null,
      gainNode: null,
      panNode: null,
      playing: false,
      volume: 1.0,
      pan: 0
    };
  }

  // WebGL2関連
  let gl = null;
  let shaderProgram = null;
  let patternTexture = null;
  let paletteTexture = null;
  let spriteBuffer = null;
  let quadBuffer = null;

  // 更新フラグ
  let palettesDirty = true;
  let patternsDirty = true;

  // Uniform locations
  let uPatternTexLoc = null;
  let uPaletteTexLoc = null;
  let uScreenSizeLoc = null;

  // Attribute locations
  let aQuadPosLoc = null;
  let aSpriteDataLoc = null;

  // コールバック
  let onReadyCallback = null;
  let onUpdateCallback = null;

  // 時間管理
  let lastTime = 0;
  let running = false;

  // ゲームパッド割り当て（-1 = 自動、0-3 = 固定割り当て）
  const gamepadAssignment = [-1, -1]; // [player1, player2]

  // 入力状態（2プレイヤー分）
  const inputState = [
    { up: false, down: false, left: false, right: false, a: false, b: false, c: false, d: false },
    { up: false, down: false, left: false, right: false, a: false, b: false, c: false, d: false }
  ];

  // キーボード入力状態
  const keyboardState = {};

  // キーボードマッピング
  const KEY_MAP = {
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
    KeyH: "a",
    KeyJ: "b",
    KeyK: "c",
    KeyL: "d"
  };

  // ゲームパッド検出フラグ
  let gamepadConnected = false;

  // ブラウザ検出
  const isFirefox = navigator.userAgent.includes("Firefox");

  // 軸マッピング（ブラウザによって異なる）
  const AXIS_MAP = isFirefox
    ? { x: 1, y: 2 } // Firefox
    : { x: 0, y: 1 }; // 標準 (Chrome等)

  // シェーダーソース
  const VERTEX_SHADER_SOURCE = `#version 300 es
    // 四角形の頂点（0,0）（1,0）（0,1）（1,1）
    in vec2 aQuadPos;

    // スプライトデータ（インスタンス属性）
    // x, y, pattern, palette
    in vec4 aSpriteData;

    out vec2 vTexCoord;
    flat out int vPattern;
    flat out int vPalette;

    uniform vec2 uScreenSize;

    void main() {
      float x = aSpriteData.x;
      float y = aSpriteData.y;
      int pattern = int(aSpriteData.z);
      int palette = int(aSpriteData.w);

      // スプライトサイズは8x8
      vec2 pos = vec2(x, y) + aQuadPos * 8.0;

      // 画面座標をクリップ座標に変換（Y軸反転）
      vec2 clipPos = (pos / uScreenSize) * 2.0 - 1.0;
      clipPos.y = -clipPos.y;

      gl_Position = vec4(clipPos, 0.0, 1.0);

      vTexCoord = aQuadPos * 8.0;  // 0-8のテクセル座標
      vPattern = pattern;
      vPalette = palette;
    }
  `;

  const FRAGMENT_SHADER_SOURCE = `#version 300 es
    precision highp float;
    precision highp sampler2DArray;

    in vec2 vTexCoord;
    flat in int vPattern;
    flat in int vPalette;

    uniform sampler2DArray uPatternTex;
    uniform sampler2D uPaletteTex;

    out vec4 fragColor;

    void main() {
      // パターンテクスチャからカラーインデックスを取得
      ivec3 texCoord = ivec3(int(vTexCoord.x), int(vTexCoord.y), vPattern);
      float colorIndex = texelFetch(uPatternTex, texCoord, 0).r * 255.0;

      // インデックス0は透明
      if (colorIndex < 0.5) {
        discard;
      }

      // パレットテクスチャから実際の色を取得
      // パレットテクスチャは16x4（16色×4パレット）
      vec2 palCoord = vec2((colorIndex + 0.5) / 16.0, (float(vPalette) + 0.5) / 4.0);
      vec4 color = texture(uPaletteTex, palCoord);

      fragColor = color;
    }
  `;

  /**
   * シェーダーをコンパイル
   */
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * シェーダープログラムを作成
   */
  function createShaderProgram() {
    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  /**
   * パターンテクスチャを作成
   */
  function createPatternTexture() {
    patternTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, patternTexture);

    // 8x8x256 の R8 テクスチャ
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8, PATTERN_SIZE, PATTERN_SIZE, PATTERN_COUNT);

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * パターンテクスチャを更新
   */
  function updatePatternTexture() {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, patternTexture);

    // 全パターンをまとめて転送
    const data = new Uint8Array(PATTERN_SIZE * PATTERN_SIZE * PATTERN_COUNT);
    for (let p = 0; p < PATTERN_COUNT; p++) {
      for (let y = 0; y < PATTERN_SIZE; y++) {
        for (let x = 0; x < PATTERN_SIZE; x++) {
          const idx = p * PATTERN_SIZE * PATTERN_SIZE + y * PATTERN_SIZE + x;
          data[idx] = patterns[p][y][x];
        }
      }
    }

    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      0,
      0,
      0,
      PATTERN_SIZE,
      PATTERN_SIZE,
      PATTERN_COUNT,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );

    patternsDirty = false;
  }

  /**
   * パレットテクスチャを作成
   */
  function createPaletteTexture() {
    paletteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);

    // 16x4 の RGBA テクスチャ
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, COLORS_PER_PALETTE, PALETTE_COUNT);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * パレットテクスチャを更新
   */
  function updatePaletteTexture() {
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);

    // 16x4 の RGBA データ
    const data = new Uint8Array(COLORS_PER_PALETTE * PALETTE_COUNT * 4);
    for (let p = 0; p < PALETTE_COUNT; p++) {
      for (let c = 0; c < COLORS_PER_PALETTE; c++) {
        const idx = (p * COLORS_PER_PALETTE + c) * 4;
        const color = palettes[p][c];
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
      }
    }

    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLORS_PER_PALETTE, PALETTE_COUNT, gl.RGBA, gl.UNSIGNED_BYTE, data);

    palettesDirty = false;
  }

  /**
   * 四角形の頂点バッファを作成
   */
  function createQuadBuffer() {
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

    // TRIANGLE_STRIP用の4頂点
    const vertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  /**
   * スプライトバッファを作成
   */
  function createSpriteBuffer() {
    spriteBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);

    // 最大描画数: スプライト256 + タイルマップ(16x16タイル × 2マップ = 512) = 768
    // 余裕を持って1024に設定 × 4要素（x, y, pattern, palette）× 4バイト
    gl.bufferData(gl.ARRAY_BUFFER, 1024 * 4 * 4, gl.DYNAMIC_DRAW);
  }

  /**
   * palette0 API
   */
  const palette0 = {
    setColor: function (paletteIndex, colorIndex, r, g, b) {
      if (paletteIndex < 0 || paletteIndex >= PALETTE_COUNT) return;
      if (colorIndex < 0 || colorIndex >= COLORS_PER_PALETTE) return;
      palettes[paletteIndex][colorIndex] = { r, g, b };
      palettesDirty = true;
    },
    getColor: function (paletteIndex, colorIndex) {
      if (paletteIndex < 0 || paletteIndex >= PALETTE_COUNT) return null;
      if (colorIndex < 0 || colorIndex >= COLORS_PER_PALETTE) return null;
      return { ...palettes[paletteIndex][colorIndex] };
    },
    /**
     * HSLで色を設定する
     * @param {number} paletteIndex - パレット番号 (0-3)
     * @param {number} colorIndex - 色番号 (0-15)
     * @param {number} h - 色相 (0-360)
     * @param {number} s - 彩度 (0-1)
     * @param {number} l - 輝度 (0-1)
     */
    setColorHSL: function (paletteIndex, colorIndex, h, s, l) {
      // HSL → RGB 変換
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;

      let r1, g1, b1;
      if (h < 60) {
        r1 = c;
        g1 = x;
        b1 = 0;
      } else if (h < 120) {
        r1 = x;
        g1 = c;
        b1 = 0;
      } else if (h < 180) {
        r1 = 0;
        g1 = c;
        b1 = x;
      } else if (h < 240) {
        r1 = 0;
        g1 = x;
        b1 = c;
      } else if (h < 300) {
        r1 = x;
        g1 = 0;
        b1 = c;
      } else {
        r1 = c;
        g1 = 0;
        b1 = x;
      }

      const r = Math.round((r1 + m) * 255);
      const g = Math.round((g1 + m) * 255);
      const b = Math.round((b1 + m) * 255);

      this.setColor(paletteIndex, colorIndex, r, g, b);
    },
    /**
     * 文字列からパレットを設定する（インデックス1-15）
     * @param {number} paletteIndex - パレット番号 (0-3)
     * @param {string} str - HHSSLL形式の16進数文字列（15色分 = 90文字）
     */
    setFromString: function (paletteIndex, str) {
      if (paletteIndex < 0 || paletteIndex >= PALETTE_COUNT) return;

      // 16進数以外を除去
      const hexChars = str.replace(/[^0-9A-Fa-f]/g, "");

      // インデックス1-15の15色を設定
      for (let i = 0; i < 15; i++) {
        const colorIndex = i + 1;
        const offset = i * 6;

        let h = 0,
          s = 0,
          l = 0;
        if (offset + 6 <= hexChars.length) {
          const hh = parseInt(hexChars.substring(offset, offset + 2), 16);
          const ss = parseInt(hexChars.substring(offset + 2, offset + 4), 16);
          const ll = parseInt(hexChars.substring(offset + 4, offset + 6), 16);
          h = (hh / 255) * 360; // 0-255 → 0-360
          s = ss / 255; // 0-255 → 0-1
          l = ll / 255; // 0-255 → 0-1
        }

        this.setColorHSL(paletteIndex, colorIndex, h, s, l);
      }
    }
  };

  /**
   * pattern0 API
   */
  const pattern0 = {
    setPixel: function (patternIndex, x, y, colorIndex) {
      if (patternIndex < 0 || patternIndex >= PATTERN_COUNT) return;
      if (x < 0 || x >= PATTERN_SIZE || y < 0 || y >= PATTERN_SIZE) return;
      if (colorIndex < 0 || colorIndex >= COLORS_PER_PALETTE) return;
      patterns[patternIndex][y][x] = colorIndex;
      patternsDirty = true;
    },
    getPixel: function (patternIndex, x, y) {
      if (patternIndex < 0 || patternIndex >= PATTERN_COUNT) return 0;
      if (x < 0 || x >= PATTERN_SIZE || y < 0 || y >= PATTERN_SIZE) return 0;
      return patterns[patternIndex][y][x];
    },
    setFromBitmap: function (patternIndex, data, colorIndex) {
      if (colorIndex === undefined) colorIndex = 1;
      if (patternIndex < 0 || patternIndex >= PATTERN_COUNT) return;
      if (!data || data.length < PATTERN_SIZE) return;
      for (let y = 0; y < PATTERN_SIZE; y++) {
        const row = data[y];
        for (let x = 0; x < PATTERN_SIZE; x++) {
          const bit = (row >> (PATTERN_SIZE - 1 - x)) & 1;
          this.setPixel(patternIndex, x, y, bit ? colorIndex : 0);
        }
      }
    },
    /**
     * 文字列からパターンを設定する
     * @param {number} patternIndex - パターン番号 (0-255)
     * @param {string} str - パターン文字列（0-9, A-F/a-f、改行は無視）
     */
    setFromString: function (patternIndex, str) {
      if (patternIndex < 0 || patternIndex >= PATTERN_COUNT) return;

      // 改行・スペース・タブを除去
      const hexChars = str.replace(/[\r\n\s]/g, "");

      for (let i = 0; i < PATTERN_SIZE * PATTERN_SIZE; i++) {
        let colorIndex = 0;
        if (i < hexChars.length) {
          const c = hexChars[i].toUpperCase();
          if (c >= "0" && c <= "9") {
            colorIndex = c.charCodeAt(0) - "0".charCodeAt(0);
          } else if (c >= "A" && c <= "F") {
            colorIndex = c.charCodeAt(0) - "A".charCodeAt(0) + 10;
          }
        }
        const x = i % PATTERN_SIZE;
        const y = Math.floor(i / PATTERN_SIZE);
        patterns[patternIndex][y][x] = colorIndex;
      }
      patternsDirty = true;
    }
  };

  /**
   * sprite0 API
   */
  const sprite0 = {
    set: function (spriteIndex, props) {
      if (spriteIndex < 0 || spriteIndex >= SPRITE_COUNT) return;
      const sprite = sprites[spriteIndex];
      sprite.enabled = true;
      if (props.priority !== undefined) sprite.priority = props.priority;
      if (props.x !== undefined) sprite.x = props.x;
      if (props.y !== undefined) sprite.y = props.y;
      if (props.palette !== undefined) sprite.palette = props.palette;
      if (props.pattern !== undefined) sprite.pattern = props.pattern;
    },
    get: function (spriteIndex) {
      if (spriteIndex < 0 || spriteIndex >= SPRITE_COUNT) return null;
      return { ...sprites[spriteIndex] };
    },
    disable: function (spriteIndex) {
      if (spriteIndex < 0 || spriteIndex >= SPRITE_COUNT) return;
      sprites[spriteIndex].enabled = false;
    }
  };

  /**
   * tilemap0 API
   */
  const tilemap0 = {
    /**
     * タイルマップを設定する
     * @param {number} mapIndex - マップ番号 (0-1)
     * @param {object} props - { priority, offsetX, offsetY }
     */
    set: function (mapIndex, props) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return;
      const tm = tilemaps[mapIndex];
      tm.enabled = true;
      if (props.priority !== undefined) tm.priority = props.priority;
      if (props.offsetX !== undefined) tm.offsetX = props.offsetX;
      if (props.offsetY !== undefined) tm.offsetY = props.offsetY;
    },
    /**
     * タイルマップを取得する
     */
    get: function (mapIndex) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return null;
      const tm = tilemaps[mapIndex];
      return {
        enabled: tm.enabled,
        priority: tm.priority,
        offsetX: tm.offsetX,
        offsetY: tm.offsetY
      };
    },
    /**
     * タイルマップを無効化する
     */
    disable: function (mapIndex) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return;
      tilemaps[mapIndex].enabled = false;
    },
    /**
     * タイルを設定する
     * @param {number} mapIndex - マップ番号 (0-1)
     * @param {number} x - タイルX座標 (0-63)
     * @param {number} y - タイルY座標 (0-63)
     * @param {object} props - { palette, pattern }
     */
    setTile: function (mapIndex, x, y, props) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return;
      if (x < 0 || x >= TILEMAP_SIZE || y < 0 || y >= TILEMAP_SIZE) return;
      const tile = tilemaps[mapIndex].tiles[y][x];
      if (props.palette !== undefined) tile.palette = props.palette;
      if (props.pattern !== undefined) tile.pattern = props.pattern;
    },
    /**
     * タイルを取得する
     */
    getTile: function (mapIndex, x, y) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return null;
      if (x < 0 || x >= TILEMAP_SIZE || y < 0 || y >= TILEMAP_SIZE) return null;
      return { ...tilemaps[mapIndex].tiles[y][x] };
    },
    /**
     * 全タイルを一括設定する
     * @param {number} mapIndex - マップ番号 (0-1)
     * @param {object} props - { palette, pattern }
     */
    fill: function (mapIndex, props) {
      if (mapIndex < 0 || mapIndex >= TILEMAP_COUNT) return;
      for (let y = 0; y < TILEMAP_SIZE; y++) {
        for (let x = 0; x < TILEMAP_SIZE; x++) {
          const tile = tilemaps[mapIndex].tiles[y][x];
          if (props.palette !== undefined) tile.palette = props.palette;
          if (props.pattern !== undefined) tile.pattern = props.pattern;
        }
      }
    }
  };

  /**
   * screen0 API
   */
  const screen0 = {
    // 現在は特にAPIなし
  };

  /**
   * waveform0 API - 波形メモリ操作
   */
  const waveform0 = {
    /**
     * 波形メモリを設定
     * @param {number} index - 波形番号 (0-255)
     * @param {Array|Uint8Array} samples - 64サンプルの配列（値0-255）
     */
    set: function (index, samples) {
      if (index < 0 || index >= WAVEFORM_COUNT) return;
      if (!samples || samples.length !== WAVEFORM_SAMPLES) return;

      for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
        waveforms[index][i] = Math.max(0, Math.min(255, samples[i] | 0));
      }
      waveformDirty[index] = true;
    },

    /**
     * 波形メモリを取得
     * @param {number} index - 波形番号 (0-255)
     * @returns {Uint8Array} 64サンプルの配列
     */
    get: function (index) {
      if (index < 0 || index >= WAVEFORM_COUNT) return null;
      return new Uint8Array(waveforms[index]);
    }
  };

  /**
   * sound0 API - サウンドチャネル（波形メモリまたはノイズ）
   */
  const sound0 = {
    /**
     * 指定チャネルで音を再生
     * @param {number} channel - チャネル番号 (0-3)
     * @param {object} options - 再生オプション
     *   - frequency: 周波数 (Hz)
     *   - waveform: 波形番号 (0-255: 波形メモリ、256: ノイズ)
     *   - volume: 音量 (0-1)
     *   - envelope: { attack, decay, sustain, release }
     */
    play: function (channel, options) {
      if (channel < 0 || channel >= SOUND_CHANNEL_COUNT) return;
      if (!audioCtx) return;

      // 既存の音を停止
      this.stop(channel);

      const ch = soundChannels[channel];
      const frequency = options.frequency || 440;
      const waveformIndex = options.waveform !== undefined ? options.waveform : 0;
      const volume = options.volume !== undefined ? options.volume : 0.5;
      const envelope = options.envelope || { attack: 0, decay: 0, sustain: 1, release: 0 };

      // GainNodeを作成（PCGミックスバス経由で出力）
      ch.gainNode = audioCtx.createGain();
      ch.gainNode.connect(pcgMixGain);

      const startTime = audioCtx.currentTime;

      if (waveformIndex === NOISE_WAVEFORM) {
        // ノイズ再生
        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.connect(ch.gainNode);
        source.start(startTime);
        ch.source = source;
        ch.oscillator = null;
        ch.isNoise = true;
      } else {
        // 波形メモリ再生
        if (waveformIndex < 0 || waveformIndex >= WAVEFORM_COUNT) return;
        if (waveformDirty[waveformIndex] || !waveformWaves[waveformIndex]) {
          waveformWaves[waveformIndex] = createWaveformWave(waveformIndex);
          waveformDirty[waveformIndex] = false;
        }
        const wave = waveformWaves[waveformIndex];
        if (!wave) return;

        const osc = audioCtx.createOscillator();
        osc.setPeriodicWave(wave);
        osc.frequency.setValueAtTime(frequency, startTime);
        osc.connect(ch.gainNode);
        osc.start(startTime);
        ch.oscillator = osc;
        ch.source = null;
        ch.isNoise = false;
      }

      // エンベロープを適用
      applyEnvelope(ch.gainNode, volume, envelope, startTime);
      ch.playing = true;
      ch.envelope = envelope;
      ch.volume = volume;
    },

    /**
     * 指定チャネルを停止（リリース開始）
     * @param {number} channel - チャネル番号 (0-3)
     */
    stop: function (channel) {
      if (channel < 0 || channel >= SOUND_CHANNEL_COUNT) return;
      if (!audioCtx) return;

      const ch = soundChannels[channel];
      if (!ch.playing) return;

      const releaseTime = ch.envelope && ch.envelope.release ? ch.envelope.release : 0;
      const now = audioCtx.currentTime;

      // リリースを開始
      ch.gainNode.gain.cancelScheduledValues(now);
      ch.gainNode.gain.setValueAtTime(ch.gainNode.gain.value, now);
      ch.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

      // リリース後に停止（oscillatorまたはsource）
      if (ch.isNoise && ch.source) {
        ch.source.stop(now + releaseTime);
        ch.source = null;
      } else if (ch.oscillator) {
        ch.oscillator.stop(now + releaseTime);
        ch.oscillator = null;
      }

      ch.playing = false;
      ch.gainNode = null;
      ch.isNoise = false;
    },

    /**
     * 全チャネルを停止
     */
    stopAll: function () {
      for (let i = 0; i < SOUND_CHANNEL_COUNT; i++) {
        this.stop(i);
      }
    }
  };

  /**
   * pcm0 API - PCMアセット管理
   */
  const pcm0 = {
    /**
     * WAVファイルをアセットとして読み込む
     * @param {string} name - アセット名
     * @param {string} url - WAVファイルのURL
     * @returns {Promise<void>}
     */
    load: function (name, url) {
      return loadPcmAsset(name, url);
    },
    /**
     * 複数アセットを一括読み込み
     * @param {Array<{name: string, url: string}>} assets - アセット配列
     * @returns {Promise<void>}
     */
    loadAll: function (assets) {
      return Promise.all(
        assets.map(function (a) {
          return loadPcmAsset(a.name, a.url);
        })
      );
    },
    /**
     * アセットが読み込み済みかチェック
     * @param {string} name - アセット名
     * @returns {boolean}
     */
    isLoaded: function (name) {
      return !!pcmAssets[name];
    },
    /**
     * アセットを解放する（再生中なら停止してから解放）
     * @param {string} name - アセット名
     */
    unload: function (name) {
      if (bgmChannel.assetName === name && bgmChannel.playing) {
        stopBgm();
      }
      for (let i = 0; i < SE_CHANNEL_COUNT; i++) {
        if (seChannels[i].playing && seChannels[i].source && seChannels[i].source.buffer === pcmAssets[name]) {
          stopSe(i);
        }
      }
      delete pcmAssets[name];
    }
  };

  /**
   * bgm0 API - BGM再生
   */
  const bgm0 = {
    /**
     * BGMを再生する
     * @param {string} name - アセット名
     * @param {object} [options] - { volume, loop, loopStart, loopEnd }
     */
    play: function (name, options) {
      playBgm(name, options);
    },
    /**
     * BGMを停止する
     */
    stop: function () {
      stopBgm();
    },
    /**
     * BGMの音量を設定する
     * @param {number} volume - 音量 (0-1)
     */
    setVolume: function (volume) {
      setBgmVolume(volume);
    },
    /**
     * BGMが再生中かどうか
     * @returns {boolean}
     */
    get playing() {
      return bgmChannel.playing;
    }
  };

  /**
   * se0 API - SE再生
   */
  const se0 = {
    /**
     * SEを再生する
     * @param {number} channel - チャネル番号 (0-7)
     * @param {string} name - アセット名
     * @param {object} [options] - { volume, pan, pitch }
     */
    play: function (channel, name, options) {
      playSe(channel, name, options);
    },
    /**
     * SEを停止する
     * @param {number} channel - チャネル番号 (0-7)
     */
    stop: function (channel) {
      stopSe(channel);
    },
    /**
     * 全SEチャネルを停止する
     */
    stopAll: function () {
      stopAllSe();
    },
    /**
     * SEの音量を設定する
     * @param {number} channel - チャネル番号 (0-7)
     * @param {number} volume - 音量 (0-1)
     */
    setVolume: function (channel, volume) {
      setSeVolume(channel, volume);
    },
    /**
     * SEのパンを設定する
     * @param {number} channel - チャネル番号 (0-7)
     * @param {number} pan - パン (-1左〜0中央〜1右)
     */
    setPan: function (channel, pan) {
      setSePan(channel, pan);
    },
    /**
     * 指定チャネルが再生中かどうか
     * @param {number} channel - チャネル番号 (0-7)
     * @returns {boolean}
     */
    isPlaying: function (channel) {
      if (channel < 0 || channel >= SE_CHANNEL_COUNT) return false;
      return seChannels[channel].playing;
    }
  };

  /**
   * input0 API（入力）
   */
  const input0 = {
    /** プレイヤー1（キーボードフォールバックあり） */
    player1: {
      get up() {
        return inputState[0].up;
      },
      get down() {
        return inputState[0].down;
      },
      get left() {
        return inputState[0].left;
      },
      get right() {
        return inputState[0].right;
      },
      get a() {
        return inputState[0].a;
      },
      get b() {
        return inputState[0].b;
      },
      get c() {
        return inputState[0].c;
      },
      get d() {
        return inputState[0].d;
      }
    },
    /** プレイヤー2（ゲームパッドのみ） */
    player2: {
      get up() {
        return inputState[1].up;
      },
      get down() {
        return inputState[1].down;
      },
      get left() {
        return inputState[1].left;
      },
      get right() {
        return inputState[1].right;
      },
      get a() {
        return inputState[1].a;
      },
      get b() {
        return inputState[1].b;
      },
      get c() {
        return inputState[1].c;
      },
      get d() {
        return inputState[1].d;
      }
    }
  };

  /**
   * キーボードイベントハンドラ
   */
  function setupKeyboardInput() {
    window.addEventListener("keydown", function (e) {
      // ブラウザの自動再生規制対策: ユーザー操作時にAudioContextを再開
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      // ゲームパッド割り当てキー処理（1-4キー）
      if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3" || e.code === "Digit4") {
        const gpIndex = parseInt(e.code.charAt(5)) - 1; // 0-3
        const playerIndex = e.shiftKey ? 1 : 0;
        const otherPlayer = 1 - playerIndex;

        // 同じゲームパッドが他プレイヤーに割り当てられていたら解除
        if (gamepadAssignment[otherPlayer] === gpIndex) {
          gamepadAssignment[otherPlayer] = -1;
        }
        gamepadAssignment[playerIndex] = gpIndex;
        return;
      }
      keyboardState[e.code] = true;
    });
    window.addEventListener("keyup", function (e) {
      keyboardState[e.code] = false;
    });
  }

  /**
   * ゲームパッドイベントハンドラ
   */
  function setupGamepadInput() {
    window.addEventListener("gamepadconnected", function (e) {
      gamepadConnected = true;
    });
    window.addEventListener("gamepaddisconnected", function (e) {
      const gamepads = navigator.getGamepads();
      gamepadConnected = gamepads.some((gp) => gp !== null);
    });
  }

  /**
   * プレイヤーの入力状態をゲームパッドから更新
   */
  function updatePlayerInputFromGamepad(playerIdx, gamepad) {
    const state = inputState[playerIdx];
    const threshold = 0.5;
    const axisX = gamepad.axes[AXIS_MAP.x] || 0;
    const axisY = gamepad.axes[AXIS_MAP.y] || 0;

    state.left = axisX < -threshold;
    state.right = axisX > threshold;
    state.up = axisY < -threshold;
    state.down = axisY > threshold;

    // 16ボタン以上のゲームパッドでは12-15を方向キーとして認識
    if (gamepad.buttons.length >= 16) {
      if (gamepad.buttons[12].pressed) state.up = true;
      if (gamepad.buttons[13].pressed) state.down = true;
      if (gamepad.buttons[14].pressed) state.left = true;
      if (gamepad.buttons[15].pressed) state.right = true;
    }

    state.a = gamepad.buttons[0]?.pressed || false;
    state.b = gamepad.buttons[1]?.pressed || false;
    state.c = gamepad.buttons[2]?.pressed || false;
    state.d = gamepad.buttons[3]?.pressed || false;
  }

  /**
   * プレイヤーの入力状態をキーボードから更新
   */
  function updatePlayerInputFromKeyboard(playerIdx) {
    const state = inputState[playerIdx];
    for (const [keyCode, inputName] of Object.entries(KEY_MAP)) {
      state[inputName] = !!keyboardState[keyCode];
    }
  }

  /**
   * プレイヤーの入力状態をリセット
   */
  function resetPlayerInput(playerIdx) {
    const state = inputState[playerIdx];
    state.up = state.down = state.left = state.right = false;
    state.a = state.b = state.c = state.d = false;
  }

  /**
   * 入力状態を更新（2プレイヤー対応）
   */
  function updateInput() {
    const gamepads = navigator.getGamepads();
    const usedGamepads = new Set();

    // 各プレイヤーの入力を更新
    for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
      let gamepad = null;

      if (gamepadAssignment[playerIdx] >= 0) {
        // 固定割り当て
        gamepad = gamepads[gamepadAssignment[playerIdx]] || null;
        if (gamepad) usedGamepads.add(gamepadAssignment[playerIdx]);
      } else {
        // 自動割り当て: 未使用のゲームパッドを順に探す
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i] && !usedGamepads.has(i)) {
            gamepad = gamepads[i];
            usedGamepads.add(i);
            break;
          }
        }
      }

      // ゲームパッドから入力状態を更新
      if (gamepad) {
        updatePlayerInputFromGamepad(playerIdx, gamepad);
      } else if (playerIdx === 0) {
        // プレイヤー1のみキーボードフォールバック
        updatePlayerInputFromKeyboard(playerIdx);
      } else {
        // プレイヤー2はゲームパッドなしなら入力なし
        resetPlayerInput(playerIdx);
      }
    }

    // 後方互換性: 少なくとも1つのゲームパッドが接続されていればtrue
    gamepadConnected = usedGamepads.size > 0;
  }

  /**
   * 描画
   */
  function render() {
    // テクスチャ更新
    if (palettesDirty) updatePaletteTexture();
    if (patternsDirty) updatePatternTexture();

    // クリア
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 描画リストを作成（スプライト + タイルマップのタイル）
    const drawList = [];

    // 有効なスプライトを追加
    for (const s of sprites) {
      if (s.enabled) {
        drawList.push({
          priority: s.priority,
          x: s.x,
          y: s.y,
          pattern: s.pattern,
          palette: s.palette
        });
      }
    }

    // 有効なタイルマップのタイルを追加（ラップアラウンド対応）
    const TILEMAP_PIXEL_SIZE = TILEMAP_SIZE * PATTERN_SIZE; // 512
    for (const tm of tilemaps) {
      if (!tm.enabled) continue;

      // オフセットをラップ（0〜511の範囲に正規化）
      let wrappedOffsetX = tm.offsetX % TILEMAP_PIXEL_SIZE;
      let wrappedOffsetY = tm.offsetY % TILEMAP_PIXEL_SIZE;
      if (wrappedOffsetX > 0) wrappedOffsetX -= TILEMAP_PIXEL_SIZE;
      if (wrappedOffsetY > 0) wrappedOffsetY -= TILEMAP_PIXEL_SIZE;

      // 画面を覆うタイル数（+1は端をカバー）
      const tilesX = Math.ceil(SCREEN_WIDTH / PATTERN_SIZE) + 1;
      const tilesY = Math.ceil(SCREEN_HEIGHT / PATTERN_SIZE) + 1;

      // 開始タイルインデックス
      const startTileX = Math.floor(-wrappedOffsetX / PATTERN_SIZE);
      const startTileY = Math.floor(-wrappedOffsetY / PATTERN_SIZE);

      for (let dy = 0; dy < tilesY; dy++) {
        for (let dx = 0; dx < tilesX; dx++) {
          // タイルインデックスをラップ
          const tx = (((startTileX + dx) % TILEMAP_SIZE) + TILEMAP_SIZE) % TILEMAP_SIZE;
          const ty = (((startTileY + dy) % TILEMAP_SIZE) + TILEMAP_SIZE) % TILEMAP_SIZE;
          const tile = tm.tiles[ty][tx];

          // 描画位置
          const drawX = (startTileX + dx) * PATTERN_SIZE + wrappedOffsetX;
          const drawY = (startTileY + dy) * PATTERN_SIZE + wrappedOffsetY;

          // 画面外はスキップ
          if (drawX >= SCREEN_WIDTH || drawY >= SCREEN_HEIGHT || drawX + PATTERN_SIZE <= 0 || drawY + PATTERN_SIZE <= 0)
            continue;

          drawList.push({
            priority: tm.priority,
            x: drawX,
            y: drawY,
            pattern: tile.pattern,
            palette: tile.palette
          });
        }
      }
    }

    // 優先順位でソート
    drawList.sort((a, b) => a.priority - b.priority);

    if (drawList.length === 0) return;

    // 描画データをバッファに転送
    const spriteData = new Float32Array(drawList.length * 4);
    for (let i = 0; i < drawList.length; i++) {
      const s = drawList[i];
      spriteData[i * 4] = s.x;
      spriteData[i * 4 + 1] = s.y;
      spriteData[i * 4 + 2] = s.pattern;
      spriteData[i * 4 + 3] = s.palette;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, spriteData);

    // シェーダーを使用
    gl.useProgram(shaderProgram);

    // テクスチャをバインド
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, patternTexture);
    gl.uniform1i(uPatternTexLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
    gl.uniform1i(uPaletteTexLoc, 1);

    // 画面サイズ
    gl.uniform2f(uScreenSizeLoc, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 頂点属性：四角形
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(aQuadPosLoc);
    gl.vertexAttribPointer(aQuadPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aQuadPosLoc, 0);

    // 頂点属性：スプライトデータ（インスタンス）
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
    gl.enableVertexAttribArray(aSpriteDataLoc);
    gl.vertexAttribPointer(aSpriteDataLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSpriteDataLoc, 1);

    // 描画
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, drawList.length);
  }

  /**
   * ゲームループ
   */
  function gameLoop(timestamp) {
    if (!running) return;

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // 入力状態を更新
    updateInput();

    // ユーザーのupdate処理
    if (onUpdateCallback) {
      onUpdateCallback(deltaTime);
    }

    // 描画
    render();

    requestAnimationFrame(gameLoop);
  }

  /**
   * サウンドシステムを初期化
   */
  function initSound() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // マスターミキサーの構築
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);
    pcgMixGain = audioCtx.createGain();
    pcgMixGain.gain.value = 1.0;
    pcgMixGain.connect(masterGain);
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 1.0;
    bgmGain.connect(masterGain);
    seMixGain = audioCtx.createGain();
    seMixGain.gain.value = 1.0;
    seMixGain.connect(masterGain);
    // SE常設ノードの初期化
    const hasPanner = typeof audioCtx.createStereoPanner === "function";
    for (let i = 0; i < SE_CHANNEL_COUNT; i++) {
      const ch = seChannels[i];
      ch.gainNode = audioCtx.createGain();
      ch.gainNode.gain.value = 1.0;
      if (hasPanner) {
        ch.panNode = audioCtx.createStereoPanner();
        ch.panNode.pan.value = 0;
        ch.gainNode.connect(ch.panNode);
        ch.panNode.connect(seMixGain);
      } else {
        ch.panNode = null;
        ch.gainNode.connect(seMixGain);
      }
    }
    // ノイズバッファを作成（2秒分のホワイトノイズ）
    const bufferSize = audioCtx.sampleRate * 2;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    // プリセット波形を初期化
    initPresetWaveforms();
  }

  /**
   * プリセット波形を初期化
   */
  function initPresetWaveforms() {
    // 0: 矩形波 50%
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      waveforms[0][i] = i < WAVEFORM_SAMPLES / 2 ? 255 : 0;
    }

    // 1: 矩形波 25%
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      waveforms[1][i] = i < WAVEFORM_SAMPLES / 4 ? 255 : 0;
    }

    // 2: 矩形波 12.5%
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      waveforms[2][i] = i < WAVEFORM_SAMPLES / 8 ? 255 : 0;
    }

    // 3: 三角波
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      if (i < WAVEFORM_SAMPLES / 2) {
        waveforms[3][i] = Math.floor((i / (WAVEFORM_SAMPLES / 2)) * 255);
      } else {
        waveforms[3][i] = Math.floor((1 - (i - WAVEFORM_SAMPLES / 2) / (WAVEFORM_SAMPLES / 2)) * 255);
      }
    }

    // 4: ノコギリ波
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      waveforms[4][i] = Math.floor((i / WAVEFORM_SAMPLES) * 255);
    }

    // プリセット波形のdirtyフラグを設定
    for (let i = 0; i < 5; i++) {
      waveformDirty[i] = true;
    }
  }

  /**
   * 波形メモリからPeriodicWaveを作成
   * @param {number} index - 波形メモリ番号 (0-255)
   * @returns {PeriodicWave} PeriodicWaveオブジェクト
   */
  function createWaveformWave(index) {
    if (!audioCtx) return null;

    const samples = waveforms[index];

    // フーリエ変換で波形からPeriodicWaveを作成
    // 64サンプルの波形を32次高調波まで近似
    const harmonics = 32;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);

    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n <= harmonics; n++) {
      let realSum = 0;
      let imagSum = 0;

      for (let k = 0; k < WAVEFORM_SAMPLES; k++) {
        // 0-255を-1〜1に正規化
        const value = samples[k] / 127.5 - 1;
        const angle = (2 * Math.PI * n * k) / WAVEFORM_SAMPLES;
        realSum += value * Math.cos(angle);
        imagSum += value * Math.sin(angle);
      }

      real[n] = (2 * realSum) / WAVEFORM_SAMPLES;
      imag[n] = (2 * imagSum) / WAVEFORM_SAMPLES;
    }

    return audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  /**
   * ADSRエンベロープを適用
   * @param {GainNode} gainNode
   * @param {number} volume - 最大音量 (0-1)
   * @param {object} envelope - { attack, decay, sustain, release }
   * @param {number} startTime - 開始時刻
   */
  function applyEnvelope(gainNode, volume, envelope, startTime) {
    const a = envelope.attack || 0;
    const d = envelope.decay || 0;
    const s = envelope.sustain !== undefined ? envelope.sustain : 1;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + a);
    gainNode.gain.linearRampToValueAtTime(volume * s, startTime + a + d);
  }

  // --- PCM内部関数 ---

  /**
   * PCMアセットをURLから読み込んでAudioBufferとして登録する
   * @param {string} name - アセット名
   * @param {string} url - WAVファイルのURL
   * @returns {Promise<void>}
   */
  async function loadPcmAsset(name, url) {
    if (!audioCtx) {
      console.error("pcm0.load: AudioContext not initialized");
      return;
    }
    if (!url.toLowerCase().endsWith(".wav")) {
      console.warn("pcm0.load: only .wav files are supported:", url);
      return;
    }
    const response = await fetch(url);
    if (!response.ok) {
      console.error("pcm0.load: failed to fetch:", name, url, response.status);
      throw new Error("pcm0.load: fetch failed for " + name + " (" + response.status + ")");
    }
    const arrayBuffer = await response.arrayBuffer();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      pcmAssets[name] = audioBuffer;
    } catch (e) {
      console.error("pcm0.load: decode failed:", name, url, e);
      throw new Error("pcm0.load: decode failed for " + name + ": " + e.message);
    }
  }

  /** 停止時のクリックノイズ防止用フェード時間（秒） */
  const PCM_FADE_TIME = 0.01;

  /**
   * BGMを再生する
   * @param {string} name - アセット名
   * @param {object} [options] - { volume, loop, loopStart, loopEnd }
   */
  function playBgm(name, options) {
    if (!audioCtx) return;
    const buffer = pcmAssets[name];
    if (!buffer) {
      console.warn("bgm0.play: asset not found:", name);
      return;
    }
    stopBgm();
    const opts = options || {};
    const volume = opts.volume !== undefined ? opts.volume : 1.0;
    const loop = !!opts.loop;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    if (loop) {
      const sampleRate = buffer.sampleRate;
      const duration = buffer.duration;
      const loopStartSec = Math.max(0, Math.min((opts.loopStart || 0) / sampleRate, duration));
      let loopEndSec = duration;
      if (opts.loopEnd !== undefined) {
        loopEndSec = Math.max(loopStartSec, Math.min(opts.loopEnd / sampleRate, duration));
      }
      if (loopEndSec > loopStartSec) {
        source.loop = true;
        source.loopStart = loopStartSec;
        source.loopEnd = loopEndSec;
      } else {
        source.loop = false;
      }
    } else {
      source.loop = false;
    }
    source.connect(bgmGain);
    bgmGain.gain.value = Math.max(0, Math.min(1, volume));
    source.start(0);
    source.onended = function () {
      if (bgmChannel.source === source) {
        bgmChannel.playing = false;
        bgmChannel.source = null;
        bgmChannel.assetName = null;
      }
    };
    bgmChannel.source = source;
    bgmChannel.playing = true;
    bgmChannel.assetName = name;
    bgmChannel.volume = volume;
  }

  /**
   * BGMを停止する
   */
  function stopBgm() {
    if (!audioCtx) return;
    if (!bgmChannel.playing || !bgmChannel.source) return;
    const now = audioCtx.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.linearRampToValueAtTime(0, now + PCM_FADE_TIME);
    try {
      bgmChannel.source.stop(now + PCM_FADE_TIME);
    } catch (e) {
      // 既に停止済み
    }
    bgmChannel.source = null;
    bgmChannel.playing = false;
    bgmChannel.assetName = null;
  }

  /**
   * BGMの音量を変更する（再生中でも反映）
   * @param {number} volume - 音量 (0-1)
   */
  function setBgmVolume(volume) {
    if (!audioCtx || !bgmGain) return;
    bgmGain.gain.value = Math.max(0, Math.min(1, volume));
    bgmChannel.volume = bgmGain.gain.value;
  }

  /**
   * SEを再生する
   * @param {number} channel - チャネル番号 (0-7)
   * @param {string} name - アセット名
   * @param {object} [options] - { volume, pan, pitch }
   */
  function playSe(channel, name, options) {
    if (channel < 0 || channel >= SE_CHANNEL_COUNT) return;
    if (!audioCtx) return;
    const buffer = pcmAssets[name];
    if (!buffer) {
      console.warn("se0.play: asset not found:", name);
      return;
    }
    stopSe(channel);
    const ch = seChannels[channel];
    const opts = options || {};
    const volume = opts.volume !== undefined ? opts.volume : 1.0;
    const pan = opts.pan !== undefined ? opts.pan : 0;
    const pitch = opts.pitch !== undefined ? opts.pitch : 1.0;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.playbackRate.value = pitch;
    ch.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    if (ch.panNode) {
      ch.panNode.pan.value = Math.max(-1, Math.min(1, pan));
    }
    source.connect(ch.gainNode);
    source.start(0);
    source.onended = function () {
      if (ch.source === source) {
        ch.playing = false;
        ch.source = null;
      }
    };
    ch.source = source;
    ch.playing = true;
    ch.volume = volume;
    ch.pan = pan;
  }

  /**
   * SEを停止する
   * @param {number} channel - チャネル番号 (0-7)
   */
  function stopSe(channel) {
    if (channel < 0 || channel >= SE_CHANNEL_COUNT) return;
    if (!audioCtx) return;
    const ch = seChannels[channel];
    if (!ch.playing || !ch.source) return;
    const now = audioCtx.currentTime;
    ch.gainNode.gain.cancelScheduledValues(now);
    ch.gainNode.gain.setValueAtTime(ch.gainNode.gain.value, now);
    ch.gainNode.gain.linearRampToValueAtTime(0, now + PCM_FADE_TIME);
    try {
      ch.source.stop(now + PCM_FADE_TIME);
    } catch (e) {
      // 既に停止済み
    }
    ch.source = null;
    ch.playing = false;
  }

  /**
   * 全SEチャネルを停止する
   */
  function stopAllSe() {
    for (let i = 0; i < SE_CHANNEL_COUNT; i++) {
      stopSe(i);
    }
  }

  /**
   * SEチャネルの音量を変更する（再生中でも反映）
   * @param {number} channel - チャネル番号 (0-7)
   * @param {number} volume - 音量 (0-1)
   */
  function setSeVolume(channel, volume) {
    if (channel < 0 || channel >= SE_CHANNEL_COUNT) return;
    if (!audioCtx) return;
    const ch = seChannels[channel];
    ch.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    ch.volume = ch.gainNode.gain.value;
  }

  /**
   * SEチャネルのパンを変更する（再生中でも反映）
   * @param {number} channel - チャネル番号 (0-7)
   * @param {number} pan - パン (-1左〜0中央〜1右)
   */
  function setSePan(channel, pan) {
    if (channel < 0 || channel >= SE_CHANNEL_COUNT) return;
    if (!audioCtx) return;
    const ch = seChannels[channel];
    if (ch.panNode) {
      ch.panNode.pan.value = Math.max(-1, Math.min(1, pan));
      ch.pan = ch.panNode.pan.value;
    }
  }

  /**
   * WebGL2非対応時のエラー表示
   */
  function showWebGL2Error(canvas) {
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.fillStyle = "#f00";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WebGL2", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10);
    ctx.fillText("not supported", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 5);
  }

  /**
   * 初期化
   */
  function init(canvas) {
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;

    // WebGL2コンテキスト取得
    gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      showWebGL2Error(canvas);
      return;
    }

    // 入力セットアップ
    setupKeyboardInput();
    setupGamepadInput();

    // サウンド初期化
    initSound();

    // シェーダープログラム作成
    shaderProgram = createShaderProgram();
    if (!shaderProgram) {
      console.error("Failed to create shader program");
      return;
    }

    // Uniform/Attribute locations取得
    uPatternTexLoc = gl.getUniformLocation(shaderProgram, "uPatternTex");
    uPaletteTexLoc = gl.getUniformLocation(shaderProgram, "uPaletteTex");
    uScreenSizeLoc = gl.getUniformLocation(shaderProgram, "uScreenSize");
    aQuadPosLoc = gl.getAttribLocation(shaderProgram, "aQuadPos");
    aSpriteDataLoc = gl.getAttribLocation(shaderProgram, "aSpriteData");

    // テクスチャ作成
    createPatternTexture();
    createPaletteTexture();

    // バッファ作成
    createQuadBuffer();
    createSpriteBuffer();

    // ブレンド有効化（透明処理用）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ready コールバック
    if (onReadyCallback) {
      onReadyCallback();
    }

    // ゲームループ開始
    running = true;
    lastTime = 0;
    requestAnimationFrame(gameLoop);
  }

  /**
   * collision API
   */
  const collision = {
    rect: function (x1, y1, w1, h1, x2, y2, w2, h2) {
      return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
  };

  /**
   * text API
   */
  const text = {
    draw: function (str, x, y, startSpriteIndex, patternMap, options) {
      const palette = options && options.palette !== undefined ? options.palette : 0;
      const priority = options && options.priority !== undefined ? options.priority : 30;
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const pattern = patternMap[char];
        if (pattern === undefined || pattern === -1) {
          sprite0.disable(startSpriteIndex + i);
        } else {
          sprite0.set(startSpriteIndex + i, {
            priority: priority,
            x: x + i * 8,
            y: y,
            palette: palette,
            pattern: pattern
          });
        }
      }
    }
  };

  /**
   * SPRITE SYSTEM オブジェクト
   */
  const ss = {
    palette0,
    pattern0,
    sprite0,
    tilemap0,
    screen0,
    waveform0,
    sound0,
    pcm0,
    bgm0,
    se0,
    input0,
    collision,
    text,

    init,

    set onReady(callback) {
      onReadyCallback = callback;
    },
    set onUpdate(callback) {
      onUpdateCallback = callback;
    }
  };

  // グローバルに公開
  window.sprite_system = ss;
})();
