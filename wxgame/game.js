(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/game/config.ts
  var CELL = 60;
  var COLS = 9;
  var ROWS = 16;
  var W = COLS * CELL;
  var H = ROWS * CELL;
  var SELL_RATE = 0.7;
  function buildLevelMap(paths) {
    const pathInfos = paths.map((points) => {
      const pixels = points.map(([c, r]) => [(c + 0.5) * CELL, (r + 0.5) * CELL]);
      let length = 0;
      const segs = [];
      for (let i = 0; i < pixels.length - 1; i++) {
        const [x1, y1] = pixels[i];
        const [x2, y2] = pixels[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        segs.push({ x1, y1, x2, y2, len, acc: length });
        length += len;
      }
      return { pixels, length, segs };
    });
    function posAt(pathIdx, dist) {
      const { segs, length } = pathInfos[pathIdx] ?? pathInfos[0];
      const d = Math.max(0, Math.min(dist, length));
      for (const s of segs) {
        if (d <= s.acc + s.len) {
          const t = s.len === 0 ? 0 : (d - s.acc) / s.len;
          return { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
        }
      }
      const last2 = segs[segs.length - 1];
      return { x: last2.x2, y: last2.y2 };
    }
    const pathCells = /* @__PURE__ */ new Set();
    for (const points of paths) {
      for (let i = 0; i < points.length - 1; i++) {
        let [c, r] = points[i];
        const [ec, er] = points[i + 1];
        const dc = Math.sign(ec - c);
        const dr = Math.sign(er - r);
        while (c !== ec || r !== er) {
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(`${c},${r}`);
          c += dc;
          r += dr;
        }
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(`${c},${r}`);
      }
    }
    const exitOfPath = [];
    const exitMap = /* @__PURE__ */ new Map();
    for (const points of paths) {
      let lastC = 0;
      let lastR = 0;
      for (let i = 0; i < points.length - 1; i++) {
        let [c, r] = points[i];
        const [ec, er] = points[i + 1];
        const dc = Math.sign(ec - c);
        const dr = Math.sign(er - r);
        for (; ; ) {
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
            lastC = c;
            lastR = r;
          }
          if (c === ec && r === er) break;
          c += dc;
          r += dr;
        }
      }
      const key = `${lastC},${lastR}`;
      let exit = exitMap.get(key);
      if (!exit) {
        const cells = [lastC - 1, lastC, lastC + 1].filter((c) => c >= 0 && c < COLS).map((c) => `${c},${lastR}`);
        exit = { centerX: (lastC + 0.5) * CELL, centerY: (lastR + 0.5) * CELL, cells };
        exitMap.set(key, exit);
      }
      exitOfPath.push(exit);
    }
    const exits = [...exitMap.values()];
    const base = /* @__PURE__ */ new Set();
    for (const ex of exits) for (const k of ex.cells) base.add(k);
    function isBuildable(col, row) {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
      const k = `${col},${row}`;
      return !pathCells.has(k) && !base.has(k);
    }
    return { paths: pathInfos, pathCells, baseCells: base, exits, exitOfPath, posAt, isBuildable };
  }
  var TOWERS = {
    laser: {
      type: "laser",
      name: "\u6FC0\u5149\u5854",
      nameEn: "LASER",
      tag: "\u7CBE\u51C6",
      color: "#22E0FF",
      role: "\u7CBE\u51C6\u70B9\u6740\u7684\u54E8\u6212\u4E4B\u77B3",
      strong: "\u722C\u884C\u8005 / \u8FC5\u6377\u517D",
      weak: "\u7532\u58F3\u517D\uFF08\u88C5\u7532\u6297\u6FC0\u5149\uFF09",
      levels: [
        { damage: 12, range: 2.5, rate: 2, cost: 100 },
        { damage: 22, range: 2.7, rate: 2.2, cost: 120 },
        { damage: 40, range: 3, rate: 2.5, cost: 200 }
      ]
    },
    missile: {
      type: "missile",
      name: "\u5BFC\u5F39\u5854",
      nameEn: "MISSILE",
      tag: "\u6E85\u5C04",
      color: "#FF9F43",
      role: "\u8303\u56F4\u8F70\u70B8\u7684\u706B\u529B\u5821\u5792",
      strong: "\u6210\u7FA4\u654C\u4EBA / \u7532\u58F3\u517D",
      weak: "\u8FC5\u6377\u517D\uFF08\u6613\u8131\u9776\uFF09",
      levels: [
        { damage: 30, range: 3.5, rate: 0.5, cost: 150 },
        { damage: 55, range: 3.7, rate: 0.55, cost: 180 },
        { damage: 95, range: 4, rate: 0.6, cost: 300 }
      ],
      splash: [1, 1.2, 1.5],
      stun: [0, 0, 0.5]
    },
    frost: {
      type: "frost",
      name: "\u51CF\u901F\u5854",
      nameEn: "FROST",
      tag: "\u51CF\u901F",
      color: "#3DF08C",
      role: "\u8FDF\u6EDE\u866B\u7FA4\u7684\u51B0\u6676\u529B\u573A",
      strong: "\u8FC5\u6377\u517D / BOSS \u8F85\u52A9",
      weak: "\u5355\u72EC\u8F93\u51FA\u6781\u4F4E",
      levels: [
        { damage: 4, range: 2.2, rate: 1, cost: 80 },
        { damage: 8, range: 2.4, rate: 1, cost: 100 },
        { damage: 15, range: 2.6, rate: 1.2, cost: 160 }
      ],
      slowPct: [0.35, 0.45, 0.55],
      slowDur: [1.5, 2, 2.5]
    },
    railgun: {
      type: "railgun",
      name: "\u7535\u78C1\u70AE",
      nameEn: "RAILGUN",
      tag: "\u8D2F\u7A7F",
      color: "#8B5CF6",
      role: "\u8D2F\u7A7F\u76F4\u7EBF\u7684\u91CD\u578B\u88C1\u51B3\u8005",
      strong: "\u7532\u58F3\u517D / \u9690\u533F\u8005 / BOSS",
      weak: "\u5C04\u901F\u6162\uFF0C\u6015\u6563\u5175",
      levels: [
        { damage: 90, range: 4.5, rate: 0.25, cost: 260 },
        { damage: 170, range: 4.7, rate: 0.28, cost: 320 },
        { damage: 320, range: 5, rate: 0.3, cost: 480 }
      ],
      charge: 1.2,
      pierceDecay: 0.85
    },
    tesla: {
      type: "tesla",
      name: "\u7279\u65AF\u62C9\u5854",
      nameEn: "TESLA",
      tag: "\u8FDE\u9501",
      color: "#FFE93D",
      role: "\u8FDE\u9501\u95EA\u7535\u7684\u7FA4\u653B\u98CE\u66B4",
      strong: "\u6210\u7FA4\u8F7B\u7532\u654C\u4EBA",
      weak: "\u5355\u4F53\u9AD8\u8840\u76EE\u6807 / \u9690\u533F\u8005",
      levels: [
        { damage: 18, range: 2.8, rate: 1.2, cost: 140 },
        { damage: 32, range: 3, rate: 1.3, cost: 170 },
        { damage: 55, range: 3.2, rate: 1.5, cost: 280 }
      ],
      chain: [2, 3, 4],
      chainDecay: 0.7
    },
    plasma: {
      type: "plasma",
      name: "\u7B49\u79BB\u5B50\u70AE",
      nameEn: "PLASMA",
      tag: "\u707C\u70E7",
      color: "#FF6B3D",
      role: "\u7194\u6D46\u5F39\u5E55\u7684\u533A\u57DF\u5C01\u9501\u8005",
      strong: "\u6210\u7FA4\u6162\u901F\u654C\u4EBA / \u9635\u5730\u5C01\u9501",
      weak: "\u8FC5\u6377\u517D\uFF08\u6613\u8131\u79BB\u707C\u70E7\u533A\uFF09",
      levels: [
        { damage: 20, range: 3.2, rate: 0.4, cost: 180 },
        { damage: 35, range: 3.4, rate: 0.45, cost: 220 },
        { damage: 60, range: 3.6, rate: 0.5, cost: 340 }
      ],
      splash: [0.8, 0.9, 1],
      dot: [10, 18, 32],
      zoneR: [1, 1.2, 1.5],
      zoneDur: 2.5
    }
  };
  var TOWER_LIST = [
    TOWERS.laser,
    TOWERS.missile,
    TOWERS.frost,
    TOWERS.railgun,
    TOWERS.tesla,
    TOWERS.plasma
  ];
  var ENEMIES = {
    crawler: {
      type: "crawler",
      name: "\u722C\u884C\u8005",
      nameEn: "CRAWLER",
      category: "normal",
      hp: 60,
      speed: 1,
      reward: 8,
      leak: 1,
      threat: 1,
      color: "#7A4FD0",
      size: 16,
      desc: "\u6700\u57FA\u7840\u7684\u866B\u7FA4\u5355\u4F4D\uFF0C\u6210\u7FA4\u7ED3\u961F\u6D8C\u5411\u57FA\u5730\u3002",
      weakness: "\u4EFB\u610F\u706B\u529B"
    },
    speeder: {
      type: "speeder",
      name: "\u8FC5\u6377\u517D",
      nameEn: "SPEEDER",
      category: "fast",
      hp: 40,
      speed: 1.9,
      reward: 10,
      leak: 1,
      threat: 2,
      color: "#4FD0C8",
      size: 13,
      desc: "\u4F53\u578B\u5C0F\u3001\u79FB\u52A8\u6781\u5FEB\uFF0C\u53D7\u5230\u7684\u51CF\u901F\u6548\u679C \xD71.2\u3002",
      weakness: "\u51CF\u901F\u5854 + \u6E85\u5C04"
    },
    tanker: {
      type: "tanker",
      name: "\u7532\u58F3\u517D",
      nameEn: "TANKER",
      category: "tank",
      hp: 320,
      speed: 0.55,
      reward: 25,
      leak: 3,
      threat: 3,
      color: "#5B3FA8",
      size: 21,
      desc: "\u539A\u91CD\u7532\u58F3\u63D0\u4F9B\u88C5\u7532\uFF1A\u53D7\u5230\u7684\u6FC0\u5149\u4F24\u5BB3 \u221225%\u3002",
      weakness: "\u5BFC\u5F39\u6E85\u5C04 / \u7535\u78C1\u70AE\u7834\u7532"
    },
    splitter: {
      type: "splitter",
      name: "\u5206\u88C2\u4F53",
      nameEn: "SPLITTER",
      category: "special",
      hp: 150,
      speed: 0.9,
      reward: 18,
      leak: 2,
      threat: 3,
      color: "#9D6FE8",
      size: 18,
      desc: "\u6B7B\u4EA1\u65F6\u5206\u88C2\u4E3A 2 \u4E2A\u722C\u884C\u8005\uFF08HP \u4E3A\u5F53\u524D\u6CE2\u722C\u884C\u8005\u7684 60%\uFF09\u3002",
      weakness: "\u5728\u8FDC\u79BB\u57FA\u5730\u5904\u51FB\u6740"
    },
    lurker: {
      type: "lurker",
      name: "\u9690\u533F\u8005",
      nameEn: "LURKER",
      category: "special",
      hp: 110,
      speed: 1.2,
      reward: 15,
      leak: 2,
      threat: 4,
      color: "#B8FF3D",
      size: 15,
      desc: "\u6BCF 3s \u9690\u8EAB 1s\uFF0C\u9690\u8EAB\u65F6\u4E0D\u53EF\u88AB\u9501\u5B9A\uFF08\u7535\u78C1\u70AE\u8D2F\u7A7F\u4ECD\u53EF\u547D\u4E2D\uFF09\u3002",
      weakness: "\u7535\u78C1\u70AE\u8D2F\u7A7F\u5149\u675F"
    },
    boss: {
      type: "boss",
      name: "\u6E6E\u706D\u5DE8\u517D",
      nameEn: "ANNIHILATOR",
      category: "boss",
      hp: 4e3,
      speed: 0.45,
      reward: 300,
      leak: 10,
      threat: 5,
      color: "#FF3D81",
      size: 34,
      desc: "\u514D\u75AB\u7729\u6655\uFF0C\u51CF\u901F\u6548\u679C\u51CF\u534A\u3002\u8840\u91CF 50% \u4EE5\u4E0B\u72C2\u66B4\uFF1A\u901F\u5EA6 +40%\uFF0C\u5916\u58F3\u53D8\u4E3A\u54C1\u7EA2\u3002",
      weakness: "\u6EE1\u7EA7\u7535\u78C1\u70AE + \u51CF\u901F\u7275\u5236"
    }
  };
  var ENEMY_LIST = [
    ENEMIES.crawler,
    ENEMIES.speeder,
    ENEMIES.tanker,
    ENEMIES.splitter,
    ENEMIES.lurker,
    ENEMIES.boss
  ];
  var DIFFICULTIES = {
    easy: { id: "easy", name: "\u7B80\u5355", gold: 500, lives: 25, hpMul: 0.85, speedMul: 1, label: "\u65B0\u5175\u8BAD\u7EC3" },
    normal: { id: "normal", name: "\u666E\u901A", gold: 350, lives: 16, hpMul: 1.12, speedMul: 1.03, label: "\u6807\u51C6\u6218\u5F79" },
    hard: { id: "hard", name: "\u56F0\u96BE", gold: 280, lives: 12, hpMul: 1.3, speedMul: 1.08, label: "\u8001\u5175\u8BD5\u70BC" }
  };
  var PREP_TIME = 3;
  var TECHS = {
    dmg: {
      id: "dmg",
      name: "\u706B\u529B\u6821\u51C6",
      nameEn: "FIRE CALIB",
      color: "#FF6B3D",
      glyph: "\u653B",
      desc: "\u5168\u4F53\u9632\u5FA1\u5854\u4F24\u5BB3 +15%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    rate: {
      id: "rate",
      name: "\u8D85\u9891\u534F\u8BAE",
      nameEn: "OVERCLOCK",
      color: "#FFC94D",
      glyph: "\u901F",
      desc: "\u5168\u4F53\u9632\u5FA1\u5854\u653B\u901F +12%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    range: {
      id: "range",
      name: "\u5E7F\u57DF\u540C\u6B65",
      nameEn: "WIDE SYNC",
      color: "#22E0FF",
      glyph: "\u57DF",
      desc: "\u5168\u4F53\u9632\u5FA1\u5854\u5C04\u7A0B +10%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    gold: {
      id: "gold",
      name: "\u6218\u5229\u54C1\u534F\u8BAE",
      nameEn: "WAR LOOT",
      color: "#FFC94D",
      glyph: "\u8D22",
      desc: "\u51FB\u6740\u91D1\u5E01\u6536\u76CA +25%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    crit: {
      id: "crit",
      name: "\u4E34\u754C\u7A7F\u900F\u5F39",
      nameEn: "CRIT ROUNDS",
      color: "#FF3D81",
      glyph: "\u7206",
      desc: "\u6240\u6709\u4F24\u5BB3 10% \u6982\u7387\u9020\u6210\u53CC\u500D\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    splash: {
      id: "splash",
      name: "\u6269\u88C5\u5F39\u5934",
      nameEn: "HEAVY WARHEAD",
      color: "#FF9F43",
      glyph: "\u6E85",
      desc: "\u5BFC\u5F39/\u7B49\u79BB\u5B50\u6E85\u5C04\u534A\u5F84 +20%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    slow: {
      id: "slow",
      name: "\u5F3A\u5316\u529B\u573A",
      nameEn: "AMP FIELD",
      color: "#3DF08C",
      glyph: "\u7F13",
      desc: "\u51CF\u901F\u5854\u7684\u51CF\u901F\u5E45\u5EA6 +6%\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    pierce: {
      id: "pierce",
      name: "\u7A7F\u7532\u5F39\u836F",
      nameEn: "AP AMMO",
      color: "#8B5CF6",
      glyph: "\u7A7F",
      desc: "\u5BF9\u7532\u58F3\u517D\u4E0E BOSS \u4F24\u5BB3 +25%\uFF0C\u6FC0\u5149\u4E0D\u518D\u88AB\u88C5\u7532\u51CF\u514D\uFF08\u53EF\u53E0\u52A0\uFF09"
    },
    supply: {
      id: "supply",
      name: "\u540E\u52E4\u7A7A\u6295",
      nameEn: "AIRDROP",
      color: "#FFC94D",
      glyph: "\u8865",
      desc: "\u7ACB\u5373\u83B7\u5F97 200 \u91D1\u5E01"
    },
    repair: {
      id: "repair",
      name: "\u7EB3\u7C73\u7EF4\u4FEE",
      nameEn: "NANO REPAIR",
      color: "#3DF08C",
      glyph: "\u4FEE",
      desc: "\u7ACB\u5373\u4FEE\u590D 3 \u70B9\u57FA\u5730\u751F\u547D\u503C"
    }
  };
  var TECH_LIST = Object.values(TECHS);

  // src/game/levels.ts
  var LEVELS = [
    {
      id: 1,
      name: "\u661F\u73AF\u5916\u6CBF",
      sub: "\u5916\u56F4\u9632\u5FA1\u5E26 \xB7 \u7B2C\u4E00\u9053\u9632\u7EBF",
      briefing: [
        "2242 \u5E74\uFF0C\u661F\u73AF\u6B96\u6C11\u5730\u5386\u7B2C 41 \u4E2A\u8F68\u9053\u5468\u671F\u3002\u6E6E\u706D\u866B\u7FA4\u6495\u5F00\u4E86\u67EF\u4F0A\u4F2F\u5916\u73AF\u7684\u9884\u8B66\u7F51\uFF0C\u5148\u950B\u751F\u7269\u7FA4\u6B63\u76F4\u6251\u6B96\u6C11\u5730\u5916\u6CBF\u9632\u5FA1\u5E26\u3002",
        "\u4F60\u662F\u5916\u6CBF\u9632\u7EBF\u7684\u6307\u6325\u5B98\u3002\u5DE5\u7A0B\u90E8\u5DF2\u5728\u8DEF\u5F84\u4E24\u4FA7\u6E05\u7A7A\u5EFA\u9020\u4F4D\uFF0C\u56DB\u5EA7\u70AE\u5854\u7CFB\u7EDF\u5168\u90E8\u89E3\u9501\uFF0C\u5F39\u836F\u4E0E\u80FD\u6E90\u65E0\u9650\u2014\u2014\u4EE3\u4EF7\u662F\uFF0C\u6211\u4EEC\u6CA1\u6709\u9000\u8DEF\u3002",
        "\u6321\u4F4F\u5168\u90E8\u8FDB\u653B\uFF0C\u5916\u6CBF\u62A4\u76FE\u5C31\u80FD\u5B8C\u6210\u91CD\u542F\u3002\u6307\u6325\u5B98\uFF0C\u6B96\u6C11\u5730\u5728\u4F60\u8EAB\u540E\u3002"
      ],
      epilogue: "\u5916\u6CBF\u9632\u5FA1\u5E26\u5B88\u4F4F\u4E86\u3002\u866B\u7FA4\u6B8B\u90E8\u9000\u5165\u788E\u77F3\u5E26\uFF0C\u4F46\u6DF1\u7A7A\u96F7\u8FBE\u663E\u793A\uFF0C\u5B83\u4EEC\u7684\u4E3B\u529B\u6B63\u7ED5\u9053\u7194\u5CA9\u56DE\u5ECA\u2014\u2014\u90A3\u91CC\u7684\u5730\u70ED\u4E95\u662F\u6B96\u6C11\u5730\u7684\u4F9B\u8840\u7EBF\u3002\u4F11\u6574\u7ED3\u675F\uFF0C\u6307\u6325\u5B98\uFF0C\u6211\u4EEC\u56DE\u5ECA\u89C1\u3002",
      paths: [
        [[-1, 2], [6, 2], [6, 6], [2, 6], [2, 10], [7, 10], [7, 13], [4, 13], [4, 15], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 8, interval: 1.2 }],
          bonus: 40,
          isBoss: false,
          comm: "\u6307\u6325\u5B98\uFF0C\u866B\u7FA4\u5148\u950B\u5DF2\u8FDB\u5165\u5916\u6CBF\u8F68\u9053\u3002\u90E8\u7F72\u9632\u5FA1\u5854\uFF0C\u6321\u4F4F\u5B83\u4EEC\uFF01"
        },
        { wave: 2, groups: [{ type: "crawler", count: 12, interval: 1 }], bonus: 50, isBoss: false },
        {
          wave: 3,
          groups: [
            { type: "crawler", count: 8, interval: 1 },
            { type: "speeder", count: 4, interval: 0.7 }
          ],
          bonus: 60,
          isBoss: false,
          comm: "\u4FA6\u6D4B\u5230\u9AD8\u901F\u5355\u4F4D\u6DF7\u7F16\u2014\u2014\u8FC5\u6377\u517D\u60E7\u6015\u51CF\u901F\u529B\u573A\u3002"
        },
        { wave: 4, groups: [{ type: "speeder", count: 12, interval: 0.6 }], bonus: 70, isBoss: false },
        {
          wave: 5,
          groups: [
            { type: "crawler", count: 10, interval: 0.9 },
            { type: "tanker", count: 2, interval: 1 }
          ],
          bonus: 90,
          isBoss: false,
          comm: "\u91CD\u578B\u7532\u58F3\u5355\u4F4D\u63A5\u8FD1\uFF0C\u6FC0\u5149\u5BF9\u5176\u6548\u679C\u6709\u9650\uFF0C\u5EFA\u8BAE\u5BFC\u5F39\u4E0E\u7535\u78C1\u70AE\u3002"
        },
        {
          wave: 6,
          groups: [
            { type: "splitter", count: 6, interval: 0.8 },
            { type: "speeder", count: 6, interval: 0.8 }
          ],
          bonus: 100,
          isBoss: false
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 5, interval: 0.8 },
            { type: "crawler", count: 8, interval: 0.8 }
          ],
          bonus: 110,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "lurker", count: 8, interval: 0.7 },
            { type: "speeder", count: 6, interval: 0.7 }
          ],
          bonus: 120,
          isBoss: false,
          comm: "\u6CE8\u610F\uFF1A\u9690\u533F\u8005\u4FE1\u53F7\u65F6\u9690\u65F6\u73B0\uFF0C\u7535\u78C1\u70AE\u7684\u8D2F\u7A7F\u5149\u675F\u53EF\u65E0\u89C6\u9690\u8EAB\u3002"
        },
        {
          wave: 9,
          groups: [
            { type: "splitter", count: 8, interval: 0.7 },
            { type: "tanker", count: 4, interval: 0.7 }
          ],
          bonus: 140,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "boss", count: 1, interval: 1.5, hpOverride: 4e3, rewardOverride: 300 },
            { type: "crawler", count: 6, interval: 1.5 }
          ],
          bonus: 200,
          isBoss: true,
          comm: "\u8B66\u544A\uFF1A\u6E6E\u706D\u5DE8\u517D\u63A5\u8FD1\u661F\u73AF\u5916\u6CBF\uFF01\u5168\u4F53\u706B\u529B\u81EA\u7531\u5C04\u51FB\uFF01"
        },
        {
          wave: 11,
          groups: [
            { type: "lurker", count: 10, interval: 0.6 },
            { type: "splitter", count: 6, interval: 0.6 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "tanker", count: 8, interval: 0.6 },
            { type: "speeder", count: 10, interval: 0.6 }
          ],
          bonus: 180,
          isBoss: false,
          comm: "\u866B\u7FA4\u6B63\u5728\u5B64\u6CE8\u4E00\u63B7\u3002\u6307\u6325\u5B98\uFF0C\u7A33\u4F4F\u9635\u7EBF\u3002"
        },
        {
          wave: 13,
          groups: [
            { type: "crawler", count: 6, interval: 0.5 },
            { type: "speeder", count: 6, interval: 0.5 },
            { type: "tanker", count: 4, interval: 0.5 },
            { type: "splitter", count: 3, interval: 0.5 },
            { type: "lurker", count: 3, interval: 0.5 }
          ],
          bonus: 200,
          isBoss: false
        },
        {
          wave: 14,
          groups: [
            { type: "tanker", count: 6, interval: 0.5 },
            { type: "lurker", count: 8, interval: 0.5 },
            { type: "splitter", count: 8, interval: 0.5 }
          ],
          bonus: 240,
          isBoss: false
        },
        {
          wave: 15,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 12e3, rewardOverride: 1e3 },
            { type: "speeder", count: 10, interval: 0.8 }
          ],
          bonus: 500,
          isBoss: true,
          comm: "\u6700\u7EC8\u8B66\u544A\uFF1A\u5DE8\u517D\u6BCD\u4F53\u4EB2\u81EA\u538B\u9635\u3002\u4E3A\u4E86\u6B96\u6C11\u5730\uFF0C\u5F00\u706B\uFF01"
        }
      ]
    },
    {
      id: 2,
      name: "\u7194\u5CA9\u56DE\u5ECA",
      sub: "\u5730\u70ED\u4E95\u533A \xB7 \u7B2C\u4E8C\u9053\u9632\u7EBF",
      briefing: [
        "\u866B\u7FA4\u4E3B\u529B\u7ED5\u8FC7\u4E86\u5916\u6CBF\uFF0C\u94BB\u8FDB\u6B96\u6C11\u5730\u7684\u5730\u70ED\u91C7\u6398\u56DE\u5ECA\u3002\u4FA6\u5BDF\u786E\u8BA4\uFF1A\u866B\u7FA4\u5175\u5206\u4E24\u8DEF\uFF0C\u6CBF\u4E0A\u4E0B\u4E24\u6761\u5CA9\u810A\u540C\u65F6\u6E17\u5165\uFF0C\u5C06\u5728\u56DE\u5ECA\u4E2D\u6BB5\u6C47\u5408\uFF0C\u76F4\u6251\u5730\u70ED\u4E95\u3002",
        "\u8FD9\u91CC\u7684\u866B\u7FA4\u66F4\u52A0\u72E1\u733E\uFF1A\u5206\u88C2\u4F53\u4E0E\u9690\u533F\u8005\u7684\u6BD4\u4F8B\u663E\u8457\u4E0A\u5347\u3002\u60C5\u62A5\u90E8\u63D0\u9192\uFF1A\u628A\u706B\u529B\u538B\u5728\u5408\u6D41\u70B9\u4E4B\u524D\uFF0C\u52A1\u5FC5\u5728\u56DE\u5ECA\u6DF1\u5904\u89E3\u51B3\u5206\u88C2\u4F53\uFF0C\u5426\u5219\u5E7C\u4F53\u5C06\u76F4\u63A5\u843D\u5728\u57FA\u5730\u95E8\u524D\u3002",
        "\u5B88\u4F4F\u5730\u70ED\u4E95\u533A\u3002\u6B96\u6C11\u5730\u7684\u80FD\u6E90\u547D\u8109\uFF0C\u5C31\u5728\u4F60\u70AE\u706B\u7684\u5C3D\u5934\u3002"
      ],
      epilogue: "\u5730\u70ED\u4E95\u533A\u7684\u6218\u6597\u7ED3\u675F\u4E86\u3002\u56DE\u5ECA\u4E4B\u4E3B\u5012\u5728\u7194\u5CA9\u6CB3\u7554\uFF0C\u866B\u7FA4\u6B8B\u5175\u9000\u5411\u661F\u73AF\u6838\u5FC3\u3002\u6240\u6709\u7EBF\u7D22\u90FD\u6307\u5411\u540C\u4E00\u4E2A\u5750\u6807\u2014\u2014\u6838\u5FC3\u4E4B\u95E8\u3002\u5168\u4F53\u767B\u8230\uFF0C\u51B3\u6218\u7684\u65F6\u523B\u5230\u4E86\u3002",
      // Y 形合流：北路（A）与南路（B）在 (4,8) 汇合，共享后缀直抵底部出口
      paths: [
        [[-1, 2], [6, 2], [6, 5], [4, 5], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
        [[-1, 13], [2, 13], [2, 8], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1.1, path: 0 }],
          bonus: 40,
          isBoss: false,
          comm: "\u4FA6\u6D4B\u5230\u4E24\u8DEF\u866B\u7FA4\u4FE1\u53F7\u2014\u2014\u5317\u8DEF\u5CA9\u810A\u5148\u63A5\u654C\u3002\u6307\u6325\u5B98\uFF0C\u53CC\u7EBF\u5E03\u9632\u5F00\u59CB\u4E86\u3002"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 6, interval: 1, path: 1 },
            { type: "speeder", count: 4, interval: 0.9, path: 1 }
          ],
          bonus: 55,
          isBoss: false,
          comm: "\u5357\u8DEF\u5CA9\u810A\u9047\u88AD\uFF01\u522B\u8BA9\u5B83\u653E\u7A7A\u3002"
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 4, interval: 0.8 },
            { type: "crawler", count: 6, interval: 0.9 }
          ],
          bonus: 60,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "lurker", count: 5, interval: 0.7 },
            { type: "speeder", count: 6, interval: 0.7 }
          ],
          bonus: 70,
          isBoss: false,
          comm: "\u56DE\u5ECA\u70ED\u96FE\u5E72\u6270\u96F7\u8FBE\uFF0C\u9690\u533F\u8005\u6B63\u5728\u6E17\u900F\u3002\u7535\u78C1\u70AE\u5C31\u4F4D\u3002"
        },
        {
          wave: 5,
          groups: [
            { type: "splitter", count: 7, interval: 0.7 },
            { type: "tanker", count: 2, interval: 0.9 }
          ],
          bonus: 100,
          isBoss: false,
          comm: "\u5206\u88C2\u4F53\u96C6\u7FA4\u903C\u8FD1\u2014\u2014\u52A1\u5FC5\u5728\u5408\u6D41\u70B9\u4E4B\u524D\u5C06\u5176\u51FB\u6740\u3002"
        },
        {
          wave: 6,
          groups: [
            { type: "lurker", count: 7, interval: 0.6, path: 1 },
            { type: "splitter", count: 4, interval: 0.7, path: 0 }
          ],
          bonus: 110,
          isBoss: false
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 5, interval: 0.7 },
            { type: "lurker", count: 5, interval: 0.6 }
          ],
          bonus: 120,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "boss", count: 1, interval: 1.2, hpOverride: 3800, rewardOverride: 400, path: 0 },
            { type: "splitter", count: 5, interval: 1.2, path: 1 }
          ],
          bonus: 240,
          isBoss: true,
          comm: "\u8B66\u544A\uFF1A\u7194\u5CA9\u6DF1\u5904\u6709\u5DE8\u517D\u82CF\u9192\uFF0C\u6B63\u6CBF\u5317\u8DEF\u63A8\u8FDB\u2014\u2014\u5357\u8DEF\u540C\u65F6\u51FA\u73B0\u5206\u88C2\u4F53\u7FA4\uFF01"
        },
        {
          wave: 9,
          groups: [
            { type: "splitter", count: 9, interval: 0.6 },
            { type: "speeder", count: 7, interval: 0.6 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "lurker", count: 10, interval: 0.5 },
            { type: "tanker", count: 4, interval: 0.7 }
          ],
          bonus: 190,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 7, interval: 0.5 },
            { type: "lurker", count: 7, interval: 0.5 },
            { type: "speeder", count: 5, interval: 0.5 }
          ],
          bonus: 230,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 1e4, rewardOverride: 1e3, path: 1 },
            { type: "lurker", count: 7, interval: 0.8, path: 0 }
          ],
          bonus: 550,
          isBoss: true,
          comm: "\u56DE\u5ECA\u4E4B\u4E3B\u73B0\u8EAB\u5357\u8DEF\u3002\u8FD9\u662F\u56DE\u5ECA\u6700\u540E\u4E00\u6218\u2014\u2014\u503E\u5C3D\u6240\u6709\u706B\u529B\uFF01"
        }
      ]
    },
    {
      id: 3,
      name: "\u6838\u5FC3\u4E4B\u95E8",
      sub: "\u80FD\u6E90\u4E2D\u67A2 \xB7 \u6700\u7EC8\u9632\u7EBF",
      briefing: [
        "\u6838\u5FC3\u4E4B\u95E8\u2014\u2014\u661F\u73AF\u6B96\u6C11\u5730\u7684\u80FD\u6E90\u4E2D\u67A2\uFF0C\u6E6E\u706D\u866B\u7FA4\u6700\u540E\u7684\u76EE\u6807\u3002\u866B\u7FA4\u6B63\u6CBF\u4E1C\u897F\u4E24\u6761\u7EF4\u4FEE\u6808\u9053\u540C\u65F6\u8FDB\u653B\uFF0C\u5404\u81EA\u76F4\u53D6\u4E00\u5EA7\u80FD\u91CF\u95E8\u2014\u2014\u4E24\u5EA7\u95E8\u540E\u90FD\u662F\u6838\u5FC3\u3002",
        "\u60C5\u62A5\u786E\u8BA4\uFF1A\u6E6E\u706D\u6BCD\u4F53\u5C06\u4EB2\u4E34\u6218\u573A\u3002\u5B83\u7684\u751F\u7269\u88C5\u7532\u539A\u5EA6\u8FDC\u8D85\u6B64\u524D\u4EFB\u4F55\u4E2A\u4F53\uFF0C\u552F\u6709\u6EE1\u7EA7\u7535\u78C1\u70AE\u7684\u8D2F\u7A7F\u5149\u675F\u53EF\u4EE5\u6495\u5F00\u7F3A\u53E3\u3002",
        "\u5B88\u4F4F\u8FD9\u6700\u540E\u7684\u6CE2\u6B21\uFF0C2242 \u5E74\u7684\u6218\u4E89\u5C31\u5C06\u7EC8\u7ED3\u3002\u6307\u6325\u5B98\uFF0C\u5168\u6B96\u6C11\u5730\u90FD\u5728\u770B\u7740\u4F60\u3002\u5F00\u706B\u8BB8\u53EF\uFF1A\u65E0\u9650\u5236\u3002"
      ],
      epilogue: "\u6E6E\u706D\u6BCD\u4F53\u5728\u6838\u5FC3\u4E4B\u95E8\u524D\u8F70\u7136\u89E3\u4F53\uFF0C\u866B\u7FA4\u4FE1\u53F7\u4ECE\u6DF1\u7A7A\u96F7\u8FBE\u4E0A\u9010\u4E00\u7184\u706D\u3002\u6B96\u6C11\u5730\u5728\u6B22\u547C\u63D0\u4EA4\u4E86\u7EC8\u6218\u62A5\u544A\u2014\u2014\u4F46\u5F53\u665A\uFF0C\u6DF1\u7A7A\u96F7\u8FBE\u5728\u67EF\u4F0A\u4F2F\u5E26\u4E4B\u5916\u6355\u6349\u5230\u4E86\u4E00\u7247\u6B64\u524D\u4E0D\u5B58\u5728\u7684\u5DE8\u5927\u5F15\u529B\u6E90\uFF1A\u4E00\u9897\u76F4\u5F84\u8D85\u8FC7\u6B96\u6C11\u5730\u7684\u79FB\u52A8\u5929\u4F53\uFF0C\u6B63\u62D6\u7740\u6574\u7247\u866B\u7FA4\u4E91\u5411\u661F\u73AF\u56DE\u6D41\u3002\u6218\u4E89\u6CA1\u6709\u7ED3\u675F\u3002\u8FD9\u53EA\u662F\u5F00\u59CB\u3002",
      // 分流：西路（A，左进左出）与东路（B，右进右出）互不接触，各守一座能量门
      paths: [
        [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 9], [3, 9], [3, 12], [1, 12], [1, 14], [2, 14], [2, 16]],
        [[9, 2], [5, 2], [5, 4], [7, 4], [7, 7], [5, 7], [5, 10], [7, 10], [7, 13], [6, 13], [6, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1.1, path: 0 }],
          bonus: 40,
          isBoss: false,
          comm: "\u4E24\u5EA7\u80FD\u91CF\u95E8\u540C\u65F6\u544A\u6025\u2014\u2014\u897F\u4FA7\u6808\u9053\u5148\u63A5\u654C\u3002\u53CC\u7EBF\u5E03\u9632\uFF0C\u6307\u6325\u5B98\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 9, interval: 1, path: 1 },
            { type: "speeder", count: 4, interval: 0.7, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        { wave: 3, groups: [{ type: "speeder", count: 11, interval: 0.6 }], bonus: 65, isBoss: false },
        {
          wave: 4,
          groups: [
            { type: "crawler", count: 9, interval: 0.9 },
            { type: "tanker", count: 3, interval: 1 }
          ],
          bonus: 80,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "splitter", count: 5, interval: 0.8 },
            { type: "speeder", count: 5, interval: 0.7 }
          ],
          bonus: 100,
          isBoss: false,
          comm: "\u654C\u7F16\u961F\u5BC6\u5EA6\u6301\u7EED\u4E0A\u5347\uFF0C\u5EFA\u8BAE\u8865\u9F50\u51CF\u901F\u4E0E\u6E85\u5C04\u706B\u529B\u3002"
        },
        {
          wave: 6,
          groups: [
            { type: "tanker", count: 4, interval: 0.8, path: 0 },
            { type: "crawler", count: 6, interval: 0.8, path: 1 }
          ],
          bonus: 110,
          isBoss: false
        },
        {
          wave: 7,
          groups: [
            { type: "lurker", count: 7, interval: 0.7 },
            { type: "speeder", count: 5, interval: 0.7 }
          ],
          bonus: 120,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "splitter", count: 7, interval: 0.7 },
            { type: "tanker", count: 3, interval: 0.7 }
          ],
          bonus: 135,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "lurker", count: 8, interval: 0.6 },
            { type: "splitter", count: 5, interval: 0.6 }
          ],
          bonus: 155,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "boss", count: 1, interval: 1.2, hpOverride: 3200, rewardOverride: 400, path: 0 },
            { type: "tanker", count: 4, interval: 1.2, path: 1 }
          ],
          bonus: 260,
          isBoss: true,
          comm: "\u8B66\u544A\uFF1A\u95E8\u536B\u5DE8\u517D\u7A81\u7834\u897F\u4FA7\u6808\u9053\uFF01\u4E1C\u4FA7\u540C\u65F6\u544A\u6025\uFF0C\u7EDD\u4E0D\u80FD\u8BA9\u5B83\u63A5\u8FD1\u80FD\u91CF\u95E8\uFF01"
        },
        {
          wave: 11,
          groups: [
            { type: "tanker", count: 6, interval: 0.6 },
            { type: "speeder", count: 7, interval: 0.6 }
          ],
          bonus: 190,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "lurker", count: 9, interval: 0.5 },
            { type: "splitter", count: 6, interval: 0.5 }
          ],
          bonus: 210,
          isBoss: false
        },
        {
          wave: 13,
          groups: [
            { type: "crawler", count: 6, interval: 0.5 },
            { type: "speeder", count: 6, interval: 0.5 },
            { type: "tanker", count: 4, interval: 0.5 },
            { type: "splitter", count: 3, interval: 0.5 },
            { type: "lurker", count: 3, interval: 0.5 }
          ],
          bonus: 230,
          isBoss: false,
          comm: "\u6838\u5FC3\u62A4\u76FE\u5269\u4F59\u80FD\u91CF\u4E0D\u8DB3 30%\u3002\u6307\u6325\u5B98\uFF0C\u65F6\u95F4\u4E0D\u591A\u4E86\u3002"
        },
        {
          wave: 14,
          groups: [
            { type: "tanker", count: 5, interval: 0.5 },
            { type: "lurker", count: 7, interval: 0.5 },
            { type: "splitter", count: 7, interval: 0.5 }
          ],
          bonus: 270,
          isBoss: false
        },
        {
          wave: 15,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 9500, rewardOverride: 1200, path: 1 },
            { type: "speeder", count: 8, interval: 0.7, path: 0 },
            { type: "lurker", count: 5, interval: 0.8, path: 1 }
          ],
          bonus: 650,
          isBoss: true,
          comm: "\u6E6E\u706D\u6BCD\u4F53\u4ECE\u4E1C\u4FA7\u6808\u9053\u4EB2\u4E34\u6218\u573A\u3002\u5168\u4F53\u6CE8\u610F\u2014\u2014\u8FD9\u662F 2242 \u5E74\u7684\u6700\u540E\u4E00\u6218\uFF0C\u5F00\u706B\uFF01"
        }
      ]
    }
  ];
  LEVELS.push(
    {
      id: 4,
      name: "\u9668\u77F3\u575F\u573A",
      sub: "\u788E\u77F3\u5E26\u524D\u54E8 \xB7 \u65B0\u5A01\u80C1\u5760\u6D3C\u70B9",
      briefing: [
        "\u6DF1\u7A7A\u96F7\u8FBE\u786E\u8BA4\uFF1A\u67EF\u4F0A\u4F2F\u5E26\u5916\u7684\u5F15\u529B\u6E90\u662F\u4E00\u9897\u5C1A\u672A\u7F16\u53F7\u7684\u5DE8\u578B\u751F\u7269\u5929\u4F53\u2014\u2014\u5DE5\u7A0B\u90E8\u4E34\u65F6\u7F16\u53F7\u300C\u866B\u5DE2\u300D\u3002\u800C\u5B83\u7684\u5148\u950B\uFF0C\u6B63\u501F\u7740\u9668\u77F3\u6D41\u7684\u63A9\u62A4\u5760\u5165\u788E\u77F3\u5E26\u3002",
        "\u9668\u77F3\u575F\u573A\u662F\u788E\u77F3\u5E26\u552F\u4E00\u53EF\u4EE5\u67B6\u8BBE\u70AE\u4F4D\u7684\u6D3C\u5730\u3002\u6307\u6325\u5B98\uFF0C\u5DE5\u7A0B\u90E8\u5DF2\u7ECF\u8FDE\u591C\u6E05\u51FA\u5EFA\u9020\u4F4D\u2014\u2014\u866B\u7FA4\u5148\u950B\u843D\u5730\u7684\u5730\u65B9\uFF0C\u5C31\u662F\u7B2C\u4E00\u6218\u573A\u3002",
        "\u672C\u6B21\u4F5C\u6218\u5C06\u542F\u7528\u65B0\u5217\u88C5\u7684\u300C\u6218\u672F\u6A21\u5757\u300D\u7CFB\u7EDF\uFF1A\u6BCF\u5B88\u4F4F\u4E00\u6CE2\uFF0C\u519B\u68B0\u90E8\u90FD\u4F1A\u968F\u673A\u9001\u6765\u4E09\u4EFD\u79D1\u6280\u65B9\u6848\uFF0C\u7531\u4F60\u51B3\u5B9A\u9632\u7EBF\u7684\u8FDB\u5316\u65B9\u5411\u3002"
      ],
      epilogue: "\u9668\u77F3\u575F\u573A\u7684\u5760\u843D\u70B9\u88AB\u6E05\u7A7A\u4E86\u3002\u866B\u7FA4\u5148\u950B\u7684\u6B8B\u9AB8\u8BC1\u660E\u4E86\u6211\u4EEC\u7684\u62C5\u5FC3\uFF1A\u5B83\u4EEC\u4E0D\u518D\u662F\u65E0\u5E8F\u517D\u6F6E\uFF0C\u800C\u662F\u6709\u7EC4\u7EC7\u5730\u5728\u300C\u866B\u5DE2\u300D\u5468\u56F4\u96C6\u7ED3\u3002\u626B\u63CF\u51FA\u4E0B\u4E00\u5904\u96C6\u7ED3\u5730\u9707\u611F\u2014\u2014\u9759\u9ED8\u6D77\u5CAD\u3002",
      paths: [
        [[-1, 1], [3, 1], [3, 4], [6, 4], [6, 8], [3, 8], [3, 11], [5, 11], [5, 15], [4, 15], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 8, interval: 1.1 }],
          bonus: 45,
          isBoss: false,
          comm: "\u6218\u672F\u6A21\u5757\u7CFB\u7EDF\u4E0A\u7EBF\u3002\u5B88\u4F4F\u8FD9\u4E00\u6CE2\uFF0C\u519B\u68B0\u90E8\u5C31\u9001\u6765\u7B2C\u4E00\u4EFD\u79D1\u6280\u65B9\u6848\u3002"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 8, interval: 1 },
            { type: "speeder", count: 4, interval: 0.8 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 5, interval: 0.9 },
            { type: "crawler", count: 6, interval: 0.9 }
          ],
          bonus: 65,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "speeder", count: 10, interval: 0.6 },
            { type: "tanker", count: 2, interval: 1.1 }
          ],
          bonus: 75,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "splitter", count: 8, interval: 0.7 },
            { type: "lurker", count: 5, interval: 0.7 }
          ],
          bonus: 95,
          isBoss: false,
          comm: "\u70ED\u96FE\u91CC\u5168\u662F\u9690\u533F\u8005\u4FE1\u53F7\u3002\u7535\u78C1\u70AE\u52A1\u5FC5\u5C31\u4F4D\u3002"
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1.2, hpOverride: 5e3, rewardOverride: 500 },
            { type: "crawler", count: 10, interval: 1 }
          ],
          bonus: 260,
          isBoss: true,
          comm: "\u8B66\u544A\uFF1A\u9668\u77F3\u6D41\u91CC\u5939\u7740\u4E00\u53EA\u5DE8\u517D\u2014\u2014\u5148\u950B\u5DE8\u517D\u76F4\u6251\u575F\u573A\u6D3C\u5730\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 6, interval: 0.7 },
            { type: "speeder", count: 10, interval: 0.6 }
          ],
          bonus: 120,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "splitter", count: 10, interval: 0.6 },
            { type: "lurker", count: 8, interval: 0.6 }
          ],
          bonus: 140,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "crawler", count: 14, interval: 0.5 },
            { type: "speeder", count: 10, interval: 0.5 },
            { type: "tanker", count: 5, interval: 0.8 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "lurker", count: 12, interval: 0.5 },
            { type: "splitter", count: 8, interval: 0.5 }
          ],
          bonus: 180,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "tanker", count: 9, interval: 0.55 },
            { type: "splitter", count: 8, interval: 0.5 },
            { type: "speeder", count: 8, interval: 0.45 }
          ],
          bonus: 220,
          isBoss: false,
          comm: "\u575F\u573A\u9632\u7EBF\u7684\u6700\u540E\u65F6\u523B\u3002\u6307\u6325\u5B98\uFF0C\u5F39\u836F\u968F\u4FBF\u6253!"
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 14e3, rewardOverride: 1100 },
            { type: "crawler", count: 12, interval: 0.7 },
            { type: "speeder", count: 8, interval: 0.6 }
          ],
          bonus: 520,
          isBoss: true,
          comm: "\u5893\u7891\u5DE8\u517D\u538B\u9635\u800C\u6765\u2014\u2014\u4E3A\u4E86\u4E0B\u4E00\u9053\u9632\u7EBF\uFF0C\u5168\u706B\u529B\u5F00\u52A8\uFF01"
        }
      ]
    },
    {
      id: 5,
      name: "\u9759\u9ED8\u6D77\u5CAD",
      sub: "\u51B0\u5CA9\u9AD8\u5730 \xB7 \u53CC\u810A\u5939\u7F1D",
      briefing: [
        "\u9759\u9ED8\u6D77\u5CAD\u662F\u6761\u88AB\u51B0\u5CA9\u8986\u76D6\u7684\u88C2\u8C37\uFF0C\u866B\u7FA4\u6CBF\u7740\u5357\u3001\u5317\u4E24\u810A\u540C\u65F6\u6E17\u5165\uFF0C\u5728\u8C37\u8170\u6C47\u5408\u540E\u76F4\u63D2\u6B96\u6C11\u5730\u4E2D\u7EE7\u7AD9\u3002",
        "\u8F68\u9053\u626B\u63CF\u663E\u793A\uFF1A\u866B\u7FA4\u8FD9\u56DE\u5B66\u4E56\u4E86\u2014\u2014\u9690\u533F\u8005\u7684\u6E17\u900F\u6BD4\u4F8B\u7FFB\u500D\uFF0C\u4E14\u4E24\u810A\u4E4B\u95F4\u6709\u300C\u56DE\u58F0\u5ECA\u9053\u300D\u8054\u901A\uFF0C\u6F0F\u6389\u4E00\u810A\u5C31\u4F1A\u8179\u80CC\u53D7\u654C\u3002",
        "\u4E2D\u7EE7\u7AD9\u662F\u6574\u6761\u788E\u77F3\u5E26\u9632\u7EBF\u7684\u901A\u8BAF\u547D\u8109\u3002\u5B88\u4F4F\u5B83\uFF0C\u6211\u4EEC\u624D\u6709\u8D44\u683C\u8C08\u8FDB\u653B\u3002"
      ],
      epilogue: "\u53CC\u810A\u9635\u5730\u5B88\u4F4F\u4E86\u3002\u4E2D\u7EE7\u7AD9\u6062\u590D\u901A\u8BAF\u540E\u4F20\u6765\u7684\u7B2C\u4E00\u6761\u6D88\u606F\u662F\uFF1A\u788E\u77F3\u5E26\u67A2\u7EBD\u7684\u866B\u7FA4\u6B63\u5728\u66B4\u52A8\uFF0C\u89C4\u6A21\u8FDC\u8D85\u5148\u950B\u2014\u2014\u5B83\u4EEC\u5728\u4E3A\u300C\u866B\u5DE2\u300D\u7684\u62B5\u8FBE\u94FA\u8DEF\u3002",
      paths: [
        [[-1, 3], [5, 3], [5, 6], [2, 6], [2, 10], [5, 10], [5, 13], [3, 13], [3, 16]],
        [[9, 5], [4, 5], [4, 8], [2, 8], [2, 10], [5, 10], [5, 13], [3, 13], [3, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 8, interval: 1.1, path: 0 }],
          bonus: 45,
          isBoss: false,
          comm: "\u5317\u810A\u5148\u63A5\u654C\u3002\u5357\u810A\u968F\u65F6\u53EF\u80FD\u51FA\u4E8B\u2014\u2014\u53CC\u7EBF\u5E03\u9632\uFF0C\u6307\u6325\u5B98\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 6, interval: 1, path: 1 },
            { type: "speeder", count: 4, interval: 0.8, path: 1 }
          ],
          bonus: 55,
          isBoss: false,
          comm: "\u5357\u810A\u544A\u6025\uFF01\u522B\u628A\u706B\u529B\u5168\u538B\u5728\u5317\u9762\u3002"
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 5, interval: 0.9 },
            { type: "lurker", count: 3, interval: 0.8 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 4, interval: 0.9, path: 0 },
            { type: "crawler", count: 8, interval: 0.8, path: 1 }
          ],
          bonus: 80,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "lurker", count: 8, interval: 0.55 },
            { type: "speeder", count: 10, interval: 0.55 }
          ],
          bonus: 100,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 6500, rewardOverride: 600, path: 1 },
            { type: "splitter", count: 6, interval: 0.9, path: 0 }
          ],
          bonus: 280,
          isBoss: true,
          comm: "\u5357\u810A\u88C2\u8C37\u91CC\u722C\u51FA\u4E00\u53EA\u5DE8\u517D\u2014\u2014\u56DE\u58F0\u5ECA\u9053\u4E5F\u5728\u6E17\u6C34\uFF0C\u7A33\u4F4F\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "splitter", count: 9, interval: 0.6 },
            { type: "tanker", count: 4, interval: 0.8 }
          ],
          bonus: 130,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "lurker", count: 10, interval: 0.5, path: 0 },
            { type: "speeder", count: 12, interval: 0.5, path: 1 }
          ],
          bonus: 150,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "tanker", count: 7, interval: 0.6 },
            { type: "lurker", count: 8, interval: 0.5 }
          ],
          bonus: 170,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "splitter", count: 10, interval: 0.5 },
            { type: "speeder", count: 10, interval: 0.45 },
            { type: "crawler", count: 12, interval: 0.45 }
          ],
          bonus: 200,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "lurker", count: 12, interval: 0.45 },
            { type: "tanker", count: 5, interval: 0.7 },
            { type: "splitter", count: 7, interval: 0.5 }
          ],
          bonus: 240,
          isBoss: false,
          comm: "\u6D77\u5CAD\u6700\u540E\u9632\u7EBF\u3002-module \u79D1\u6280\u7684\u542B\u91D1\u91CF\uFF0C\u5C31\u770B\u8FD9\u51E0\u6CE2\u4E86\u3002"
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 16e3, rewardOverride: 1200, path: 0 },
            { type: "lurker", count: 8, interval: 0.6, path: 1 },
            { type: "speeder", count: 10, interval: 0.55, path: 1 }
          ],
          bonus: 560,
          isBoss: true,
          comm: "\u300C\u56DE\u58F0\u4E4B\u4E3B\u300D\u4ECE\u5317\u810A\u73B0\u8EAB\u3002\u96C6\u706B\uFF01\u522B\u8BA9\u5B83\u8FC7\u53BB\uFF01"
        }
      ]
    },
    {
      id: 6,
      name: "\u788E\u77F3\u5E26\u67A2\u7EBD",
      sub: "\u8865\u7ED9\u4E2D\u67A2 \xB7 \u4E09\u7EBF\u4EA4\u6218",
      briefing: [
        "\u866B\u7FA4\u5BF9\u788E\u77F3\u5E26\u67A2\u7EBD\u53D1\u52A8\u603B\u653B\u3002\u4E09\u6761\u5F15\u529B\u6ED1\u9053\u540C\u65F6\u5411\u67A2\u7EBD\u503E\u6CFB\u5175\u529B\uFF1A\u4E1C\u3001\u897F\u4E24\u659C bylo \u4E3B\u653B\uFF0C\u5317\u76F4\u9053\u4E3A\u7B56\u5E94\u3002",
        "\u60C5\u62A5\u90E8\u5224\u65AD\uFF1A\u8FD9\u662F\u866B\u5DE2\u62B5\u8FBE\u524D\u6700\u5927\u89C4\u6A21\u7684\u4E00\u6B21\u300C\u6E05\u573A\u4F5C\u6218\u300D\u3002\u5B88\u4F4F\u67A2\u7EBD\uFF0C\u866B\u5DE2\u5C31\u88AB\u8FEB\u5728\u6CA1\u6709\u8865\u7ED9\u533A\u7684\u60C5\u51B5\u4E0B\u786C\u95EF\u9632\u7EBF\u3002",
        "\u4E09\u6761\u6ED1\u9053\uFF0C\u4E00\u4E2A\u67A2\u7EBD\u3002\u6307\u6325\u5B98\uFF0C\u5206\u914D\u597D\u4F60\u7684\u6BCF\u4E00\u5EA7\u70AE\u5854."
      ],
      epilogue: "\u67A2\u7EBD\u5B88\u4F4F\u4E86\uFF0C\u4E09\u6761\u6ED1\u9053\u7684\u866B\u7FA4\u51E0\u4E4E\u5168\u706D\u3002\u4F46\u65E0\u4EBA\u673A\u5728\u5317\u76F4\u9053\u5C3D\u5934\u62CD\u5230\u4E86\u4E0D\u5F97\u4E86\u7684\u4E1C\u897F\uFF1A\u4E00\u6761\u6CDB\u7740\u5E7D\u5149\u7684\u300C\u88C2\u7F1D\u300D\uFF0C\u6B63\u628A\u866B\u7FA4\u6E90\u6E90\u4E0D\u65AD\u5730\u5410\u8FDB\u788E\u77F3\u5E26\u2014\u2014\u90A3\u4E0D\u662F\u81EA\u7136\u5929\u4F53\uFF0C\u90A3\u662F\u866B\u5DE2\u7684\u5927\u95E8\u3002",
      paths: [
        [[9, 1], [5, 1], [5, 5], [7, 5], [7, 10], [5, 10], [5, 14], [4, 14], [4, 16]],
        [[-1, 2], [3, 2], [3, 6], [1, 6], [1, 11], [3, 11], [3, 14], [4, 14], [4, 16]],
        [[4, -1], [4, 4], [2, 4], [2, 9], [4, 9], [4, 12], [5, 12], [5, 14], [4, 14], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 8, interval: 1.1, path: 2 }],
          bonus: 45,
          isBoss: false,
          comm: "\u4E09\u7EBF\u5E03\u9632\u5F00\u59CB\u3002\u5317\u76F4\u9053\u7684\u6ED1\u9053\u6700\u77ED\u2014\u2014\u5148\u7ED9\u90A3\u8FB9\u538B\u4E0A\u4E00\u5EA7\u5854\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 6, interval: 1, path: 0 },
            { type: "speeder", count: 4, interval: 0.8, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "speeder", count: 8, interval: 0.7 },
            { type: "splitter", count: 3, interval: 0.9, path: 2 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 3, interval: 1.1, path: 0 },
            { type: "crawler", count: 8, interval: 0.8, path: 1 },
            { type: "lurker", count: 3, interval: 0.8, path: 2 }
          ],
          bonus: 85,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "splitter", count: 8, interval: 0.6 },
            { type: "lurker", count: 6, interval: 0.55 }
          ],
          bonus: 105,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 8e3, rewardOverride: 700, path: 1 },
            { type: "speeder", count: 8, interval: 0.7, path: 0 }
          ],
          bonus: 300,
          isBoss: true,
          comm: "\u897F\u659C\u5761\u51FA\u73B0\u5DE8\u517D\uFF01\u5B83\u5C31\u662F\u6765\u300C\u6E05\u573A\u300D\u7684\u2014\u2014\u522B\u8BA9\u67A2\u7EBD\u6CA6\u9677\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 7, interval: 0.6 },
            { type: "lurker", count: 6, interval: 0.55, path: 2 }
          ],
          bonus: 140,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "splitter", count: 10, interval: 0.5 },
            { type: "speeder", count: 12, interval: 0.5 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "tanker", count: 6, interval: 0.6, path: 0 },
            { type: "tanker", count: 4, interval: 0.7, path: 1 },
            { type: "lurker", count: 8, interval: 0.5, path: 2 }
          ],
          bonus: 190,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "crawler", count: 18, interval: 0.35 },
            { type: "speeder", count: 14, interval: 0.35 }
          ],
          bonus: 220,
          isBoss: false,
          comm: "\u517D\u6F6E\u603B\u653B\uFF01\u5168\u6ED1\u9053\u6EE1\u8D1F\u8377\u8FD0\u8F6C!"
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 12, interval: 0.45 },
            { type: "lurker", count: 10, interval: 0.45 },
            { type: "tanker", count: 6, interval: 0.6 }
          ],
          bonus: 260,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 17e3, rewardOverride: 1300, path: 2 },
            { type: "splitter", count: 8, interval: 0.55, path: 0 },
            { type: "lurker", count: 8, interval: 0.55, path: 1 }
          ],
          bonus: 600,
          isBoss: true,
          comm: "\u67A2\u7EBD\u7EDE\u8089\u673A\u6700\u540E\u7684\u543C\u58F0\u2014\u2014\u5DE8\u517D\u8D70\u4E86\u6700\u77ED\u7684\u5317\u76F4\u9053\uFF01\u96C6\u706B\uFF01\u96C6\u706B\uFF01"
        }
      ]
    },
    {
      id: 7,
      name: "\u6DF1\u6E0A\u88C2\u7F1D",
      sub: "\u88C2\u8C37\u8B66\u6212\u7EBF \xB7 \u7B2C\u4E00\u9053\u866B\u6D1E",
      briefing: [
        "\u788E\u77F3\u5E26\u5C3D\u5934\u7684\u88C2\u7F1D\u88AB\u8BC1\u5B9E\u662F\u4E00\u6761\u7A33\u5B9A\u866B\u6D1E\u2014\u2014\u866B\u7FA4\u4ECE\u6DF1\u6E0A\u65B9\u5411\u6E90\u6E90\u6D8C\u51FA\u3002\u88C2\u7F1D\u4E24\u4FA7\u7684\u5CA9\u67B6\u662F\u6211\u4EEC\u6700\u540E\u7684\u8B66\u6212\u7EBF\u3002",
        "\u88C2\u7F1D\u55B7\u53D1\u7684\u6CE2\u6BB5\u6709\u89C4\u5F8B\uFF1A\u6BCF\u6B21\u90FD\u5728\u4E2D\u8DEF\u4E0E\u4FA7\u7FFC\u95F4\u6447\u6446\u3002\u8F68\u9053\u626B\u63CF\u663E\u793A\u88C2\u7F1D\u6DF1\u5904\u6709\u300C\u5927\u578B\u4E2A\u4F53\u300D\u6B63\u5728\u81A8\u5316\u6210\u5F62\u3002",
        "\u7B2C\u4E03\u9632\u7EBF\uFF0C\u8B66\u6212\u5B8C\u6210\u3002\u6307\u6325\u5B98\uFF0C\u6B22\u8FCE\u6765\u5230\u866B\u6D1E\u7684\u95E8\u53E3\u3002"
      ],
      epilogue: "\u8B66\u6212\u7EBF\u7684\u4EFB\u52A1\u5B8C\u6210\u4E86\u3002\u88C2\u7F1D\u88AB\u4E34\u65F6\u5DE5\u5175\u70B8\u584C\uFF0C\u6DF1\u5904\u7684\u300C\u81A8\u5316\u4E2A\u4F53\u300D\u6CA1\u80FD\u94BB\u51FA\u6765\u2014\u2014\u4F46\u96F7\u8FBE\u663E\u793A\u53E6\u4E00\u6761\u88C2\u7F1D\u5DF2\u7ECF\u5728\u6781\u5730\u51B0\u76D6\u4E0B\u5F20\u5F00\u3002\u5B83\u4EEC\u4E0D\u518D\u9700\u8981\u4E00\u4E2A\u866B\u5DE2\u624D\u80FD\u884C\u519B\u4E86\u3002",
      paths: [
        [[-1, 2], [6, 2], [6, 6], [3, 6], [3, 10], [6, 10], [6, 13], [4, 13], [4, 16]],
        [[9, 12], [7, 12], [7, 8], [3, 8], [3, 10], [6, 10], [6, 13], [4, 13], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 0 }],
          bonus: 45,
          isBoss: false,
          comm: "\u88C2\u7F1D\u5F00\u59CB\u55B7\u53D1\uFF01\u4E2D\u8DEF\u5148\u9876\u4F4F\uFF0C\u5DE5\u5175\u5728\u4FA7\u7FFC\u5E03\u7F6E\u7B2C\u4E8C\u9053\u5C01\u9501\u3002"
        },
        {
          wave: 2,
          groups: [
            { type: "speeder", count: 8, interval: 0.7, path: 1 },
            { type: "crawler", count: 8, interval: 0.9, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 6, interval: 0.8 },
            { type: "tanker", count: 3, interval: 1 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "lurker", count: 6, interval: 0.6, path: 0 },
            { type: "speeder", count: 8, interval: 0.6, path: 1 }
          ],
          bonus: 85,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "crawler", count: 16, interval: 0.45 },
            { type: "speeder", count: 8, interval: 0.5 },
            { type: "tanker", count: 4, interval: 0.7 }
          ],
          bonus: 110,
          isBoss: false
        },
        {
          wave: 6,
          groups: [{ type: "boss", count: 1, interval: 1, hpOverride: 9500, rewardOverride: 800 }],
          bonus: 300,
          isBoss: true,
          comm: "\u6DF1\u5904\u7684\u300C\u81A8\u5316\u4E2A\u4F53\u300D\u6210\u5F62\u4E86\u2014\u2014\u6DF1\u6E0A\u6050\u8D2A\u8005\uFF01\u522B\u8BA9\u5B83\u9760\u8FD1\u5CA9\u67B6\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "splitter", count: 11, interval: 0.5 },
            { type: "lurker", count: 8, interval: 0.5, path: 1 }
          ],
          bonus: 150,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "tanker", count: 7, interval: 0.55 },
            { type: "speeder", count: 14, interval: 0.45 }
          ],
          bonus: 180,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "lurker", count: 10, interval: 0.45 },
            { type: "splitter", count: 10, interval: 0.45 },
            { type: "crawler", count: 14, interval: 0.4 }
          ],
          bonus: 210,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "tanker", count: 9, interval: 0.5 },
            { type: "splitter", count: 8, interval: 0.45, path: 1 }
          ],
          bonus: 240,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "lurker", count: 12, interval: 0.4 },
            { type: "speeder", count: 14, interval: 0.4 },
            { type: "tanker", count: 6, interval: 0.55 }
          ],
          bonus: 270,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 19e3, rewardOverride: 1400, path: 0 },
            { type: "crawler", count: 14, interval: 0.55, path: 1 },
            { type: "lurker", count: 8, interval: 0.5, path: 1 }
          ],
          bonus: 620,
          isBoss: true,
          comm: "\u88C2\u7F1D\u4E3B\u517D\u300C\u566C\u5CA9\u8005\u300D\u94BB\u51FA\u4E86\u55B7\u53E3\uFF01\u5168\u7EBF\u96C6\u706B\uFF0C\u522B\u8BA9\u5B83\u7FFB\u8FC7\u5CA9\u67B6\uFF01"
        }
      ]
    },
    {
      id: 8,
      name: "\u6781\u591C\u54E8\u7AD9",
      sub: "\u51B0\u76D6\u9A7B\u70B9 \xB7 \u6781\u5730\u88C2\u7F1D\u9632\u7EBF",
      briefing: [
        "\u51B0\u76D6\u4E0B\u7684\u7B2C\u4E8C\u6761\u88C2\u7F1D\u6BD4\u9884\u60F3\u7684\u66F4\u6210\u719F\uFF1A\u55B7\u53D1\u6CE2\u5DF2\u7ECF\u7A33\u5B9A\uFF0C\u866B\u7FA4\u4EE5\u6781\u591C\u4E3A\u63A9\u62A4\uFF0C\u4E00\u6CE2\u63A5\u4E00\u6CE2\u5730\u6D8C\u5411\u54E8\u7AD9\u3002",
        "\u54E8\u7AD9\u7684\u4E0B\u65B9\u5C31\u662F\u6B96\u6C11\u5730\u7684\u6C34\u6E90\u51B0\u82AF\u2014\u2014\u866B\u7FA4\u7684\u751F\u7269\u9178\u6DB2\u4E00\u65E6\u6E17\u900F\u51B0\u5C42\uFF0C\u6574\u4E2A\u6B96\u6C11\u5730\u7684\u6C34\u5FAA\u73AF\u5C06\u5728 72 \u5C0F\u65F6\u5185\u5D29\u574F\u3002",
        "\u6CA1\u6709\u9000\u8DEF\uFF0C\u6CA1\u6709\u589E\u63F4\uFF0C\u53EA\u6709\u6EE1\u5730\u51B0\u6676\u4E0E\u4F60\u7684\u70AE\u5854\u3002\u5B88\u4F4F\u6781\u591C\u3002"
      ],
      epilogue: "\u51B0\u82AF\u4FDD\u4F4F\u4E86\u3002\u88C2\u7F1D\u88AB\u5BC6\u5EA6\u70B8\u5F39\u5C01\u5835\uFF0C\u4F46\u4EE3\u4EF7\u662F\u6574\u4E2A\u54E8\u7AD9\u51BB\u571F\u7FFB\u6405\u3001\u6025\u9700\u64A4\u9000\u3002\u4E0B\u4E00\u7AD9\uFF1A\u866B\u5DE2\u5916\u56F4\u2014\u2014\u5DE5\u5175\u8BF4\uFF0C\u90A3\u5730\u65B9\u7684\u7A7A\u6C14\u90FD\u5E26\u7740\u8165\u5473\u3002",
      paths: [
        [[-1, 1], [2, 1], [2, 5], [5, 5], [5, 9], [2, 9], [2, 12], [4, 12], [4, 16]],
        [[9, 2], [7, 2], [7, 7], [5, 7], [5, 9], [2, 9], [2, 12], [4, 12], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 0 }],
          bonus: 45,
          isBoss: false
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 8, interval: 0.9, path: 1 },
            { type: "speeder", count: 6, interval: 0.7, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 7, interval: 0.75 },
            { type: "speeder", count: 8, interval: 0.6 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 4, interval: 0.9, path: 0 },
            { type: "lurker", count: 6, interval: 0.6, path: 1 }
          ],
          bonus: 90,
          isBoss: false,
          comm: "\u51B0\u9762\u5F00\u59CB\u6E17\u9178\u2014\u2014\u866B\u7FA4\u7684\u751F\u7269\u9178\u5F39\u5148\u4E8E\u4E3B\u529B\u62B5\u8FBE\u3002"
        },
        {
          wave: 5,
          groups: [
            { type: "lurker", count: 9, interval: 0.5 },
            { type: "splitter", count: 8, interval: 0.5, path: 1 }
          ],
          bonus: 110,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 11e3, rewardOverride: 900, path: 0 },
            { type: "speeder", count: 10, interval: 0.5, path: 1 }
          ],
          bonus: 300,
          isBoss: true,
          comm: "\u300C\u6781\u591C\u66B4\u541B\u300D\u8E0F\u788E\u4E86\u524D\u53F0\u51B0\u67B6\uFF01\u5B88\u4F4F\u51B0\u82AF\uFF0C\u5B83\u4E0D\u80FD\u8FC7\u6765\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 8, interval: 0.5 },
            { type: "crawler", count: 16, interval: 0.4 }
          ],
          bonus: 150,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "splitter", count: 12, interval: 0.45 },
            { type: "lurker", count: 10, interval: 0.45, path: 1 }
          ],
          bonus: 180,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "speeder", count: 16, interval: 0.35 },
            { type: "tanker", count: 5, interval: 0.6 },
            { type: "splitter", count: 8, interval: 0.5 }
          ],
          bonus: 210,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "lurker", count: 12, interval: 0.4 },
            { type: "tanker", count: 7, interval: 0.5 }
          ],
          bonus: 240,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 14, interval: 0.4 },
            { type: "lurker", count: 12, interval: 0.4 },
            { type: "speeder", count: 14, interval: 0.35 }
          ],
          bonus: 280,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 21e3, rewardOverride: 1500, path: 1 },
            { type: "tanker", count: 6, interval: 0.6, path: 0 },
            { type: "lurker", count: 10, interval: 0.45, path: 0 }
          ],
          bonus: 640,
          isBoss: true,
          comm: "\u51B0\u76D6\u4E0B\u7684\u866B\u6D1E\u5F20\u529B\u5DF2\u7ECF\u62C9\u6EE1\u2014\u2014\u300C\u878D\u51B0\u517D\u300D\u4EB2\u81EA\u4E0B\u573A\uFF01"
        },
        {
          wave: 13,
          groups: [
            { type: "crawler", count: 20, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.3 },
            { type: "tanker", count: 8, interval: 0.5 },
            { type: "splitter", count: 10, interval: 0.4 },
            { type: "lurker", count: 8, interval: 0.4 }
          ],
          bonus: 320,
          isBoss: false,
          comm: "\u64A4\u9000\u524D\u6700\u540E\u4E00\u6CE2\u517D\u6F6E\uFF01\u6307\u6325\u5B98\uFF0C\u628A\u51B0\u6676\u9635\u5730\u53D8\u6210\u5B83\u4EEC\u7684\u575F\u573A\uFF01"
        }
      ]
    },
    {
      id: 9,
      name: "\u866B\u6D1E\u524D\u54E8",
      sub: "\u6DF1\u7A7A\u8F68\u9053 \xB7 \u53CD\u653B\u6865\u5934\u5821",
      briefing: [
        "\u6211\u4EEC\u7EC8\u4E8E\u6253\u8FDB\u4E86\u866B\u6D1E\u8FD9\u4E00\u4FA7\u3002\u54E8\u70B9\u662F\u866B\u5DE2\u5916\u56F4\u552F\u4E00\u6CA1\u88AB\u751F\u7269 \u7EC4\u7EC7\u6C61\u67D3\u7684\u5CA9\u77F3\u5E73\u53F0\uFF0C\u4E5F\u662F\u53CD\u653B\u552F\u4E00\u7684\u8DF3\u677F\u3002",
        "\u9884\u8B66\uFF1A\u866B\u6D1E\u4FA7\u7684\u866B\u7FA4\u5BC6\u5EA6\u8FBE\u5230\u5CF0\u503C\uFF0C\u55B7\u53D1\u95F4\u9694\u9AA4\u51CF\u3002\u6DF1\u5904\u7684\u7275\u5F15\u6CE2\u8D8A\u6765\u8D8A\u6025\u2014\u2014\u866B\u5DE2\u6B63\u5728\u52A0\u901F\u5411\u661F\u73AF\u56DE\u6D41\u3002",
        "\u6865\u5934\u5821\u7684\u4EF7\u503C\uFF1A\u5B88\u4F4F\u5B83\uFF0C\u6B96\u6C11\u5730\u7684\u8FDC\u5F81\u8230\u961F\u5C31\u80FD\u5728\u866B\u6D1E\u4FA7\u67B6\u8BBE\u5149\u77DB\u9635\u5217\u3002\u4E22\u6389\u5B83\uFF0C\u6211\u4EEC\u5C31\u53EA\u80FD\u6700\u540E\u4E00\u640F\u4E86\u3002"
      ],
      epilogue: "\u6865\u5934\u5821\u7ACB\u4F4F\u4E86\u3002\u5149\u77DB\u9635\u5217\u7684\u7B2C\u4E00\u9053\u5149\u67F1\u523A\u7A7F\u4E86\u866B\u4E91\uFF0C\u7ED9\u866B\u5DE2\u5212\u5F00\u4E86\u4E00\u9053\u53E3\u5B50\u3002\u8230\u957F\u5E7F\u64AD\u8BF4\uFF1A\u866B\u5DE2\u5916\u56F4\u7684\u300C\u76AE\u300D\u5DF2\u7ECF\u5F00\u59CB\u8F6F\u4E86\u3002\u53CD\u653B\uFF0C\u6B63\u5F0F\u5F00\u59CB\u3002",
      paths: [
        [[-1, 3], [4, 3], [4, 7], [7, 7], [7, 11], [4, 11], [4, 14], [5, 14], [5, 16]],
        [[9, 7], [6, 7], [6, 10], [4, 10], [4, 14], [5, 14], [5, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 0 }],
          bonus: 45,
          isBoss: false,
          comm: "\u866B\u6D1E\u4FA7\u7684\u9AD8\u9891\u55B7\u53D1\u5F00\u59CB\u4E86\u3002\u6865\u5934\u5821\uFF0C\u67B6\u597D\u7B2C\u4E00\u6392\u70AE\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 8, interval: 0.8, path: 1 },
            { type: "speeder", count: 8, interval: 0.6, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 7, interval: 0.7 },
            { type: "tanker", count: 3, interval: 0.9 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "lurker", count: 7, interval: 0.55, path: 1 },
            { type: "speeder", count: 10, interval: 0.5, path: 0 }
          ],
          bonus: 90,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "crawler", count: 18, interval: 0.4 },
            { type: "splitter", count: 8, interval: 0.5 }
          ],
          bonus: 115,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 12500, rewardOverride: 900, path: 1 },
            { type: "lurker", count: 8, interval: 0.5, path: 0 }
          ],
          bonus: 300,
          isBoss: true
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 8, interval: 0.5 },
            { type: "splitter", count: 10, interval: 0.45 }
          ],
          bonus: 150,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "lurker", count: 11, interval: 0.45 },
            { type: "speeder", count: 14, interval: 0.4 }
          ],
          bonus: 180,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "tanker", count: 9, interval: 0.45 },
            { type: "splitter", count: 10, interval: 0.4, path: 1 },
            { type: "crawler", count: 16, interval: 0.35 }
          ],
          bonus: 220,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 14500, rewardOverride: 1e3, path: 0 },
            { type: "lurker", count: 10, interval: 0.4, path: 1 }
          ],
          bonus: 340,
          isBoss: true,
          comm: "\u53CC\u517D\u6CE2\uFF01\u300C\u88C2\u53E3\u9886\u4E3B\u300D\u6CBF\u4E3B\u9053\u538B\u8FDB\u2014\u2014\u6865\u5934\u5821\u5C31\u662F\u4E3A\u5B83\u51C6\u5907\u7684\uFF01"
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 14, interval: 0.4 },
            { type: "lurker", count: 12, interval: 0.4 },
            { type: "speeder", count: 16, interval: 0.3 }
          ],
          bonus: 260,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "tanker", count: 12, interval: 0.4 },
            { type: "splitter", count: 10, interval: 0.4 },
            { type: "lurker", count: 10, interval: 0.35, path: 1 }
          ],
          bonus: 300,
          isBoss: false
        },
        {
          wave: 13,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 24e3, rewardOverride: 1600, path: 0 },
            { type: "boss", count: 1, interval: 1.2, hpOverride: 12e3, rewardOverride: 800, path: 1 }
          ],
          bonus: 700,
          isBoss: true,
          comm: "\u53CC\u5DE8\u517D\u540C\u65F6\u8FC7\u6865\uFF01\u5149\u77DB\u9635\u5217\u7531\u4F60\u63A9\u62A4\u2014\u2014\u8FD9\u662F\u6700\u540E\u7684\u6865\u5934\u5821\u6218\u5F79\uFF01"
        }
      ]
    },
    {
      id: 10,
      name: "\u866B\u5DE2\u5916\u819C",
      sub: "\u866B\u5DE2\u8868\u5C42 \xB7 \u767B\u9646\u573A\u5F00\u8F9F",
      briefing: [
        "\u8FDC\u5F81\u8230\u961F\u5728\u866B\u5DE2\u5916\u819C\u4E0A\u70B8\u5F00\u4E86\u4E00\u9053\u767B\u9646\u53E3\u2014\u2014\u73B0\u5728\u8F6E\u5230\u5730\u9762\u90E8\u961F\u4E86\u3002\u767B\u9646\u573A\u53EA\u6709\u4E00\u6761\u53EF\u4EE5\u884C\u519B\u7684\u300C\u9AA8\u6865\u300D\uFF0C\u4F46\u5B83\u4F1A\u5206\u5C94\u3001\u7ED5\u884C\u3001\u6B6A\u4E03\u626D\u516B\uFF0C\u6709\u81EA\u5DF1\u7684\u610F\u5FD7\u3002",
        "\u751F\u7269\u7EC4\u7EC7\u5728\u70AE\u706B\u4E0B\u4F1A\u518D\u751F\u3002\u519B\u68B0\u90E8\u7684\u7ED3\u8BBA\u5F88\u76F4\u767D\uFF1A\u522B\u6307\u671B\u5730\u5F62\uFF0C\u6307\u671B\u706B\u529B\u5BC6\u5EA6\u4E0E\u4F60\u624B\u91CC\u7684\u79D1\u6280\u6A21\u5757\u3002",
        "\u767B\u9646\u5F00\u59CB\u3002\u6307\u6325\u5B98\uFF0C\u8BA9\u6211\u4EEC\u5728\u8FD9\u5F20\u6D3B\u7740\u7684\u5730\u56FE\u4E0A\u51FF\u4E00\u5757\u9635\u5730\u3002"
      ],
      epilogue: "\u767B\u9646\u573A\u7A33\u4F4F\u4E86\uFF0C\u9AA8\u6865\u8FB9\u7684\u518D\u751F\u7EC4\u7EC7\u88AB\u7B49\u79BB\u5B50\u707C\u70E7\u533A\u70E7\u6210\u4E86\u6C38\u4E45\u75A4\u75D5\u3002\u5DE5\u5175\u5728\u75A4\u75D5\u4E0A\u6269\u5EFA\u4E86\u524D\u6CBF\u5175\u8425\u2014\u2014\u4E0B\u4E00\u6B65\uFF0C\u6DF1\u5165\u866B\u5DE2\u4F53\u8154\u3002",
      paths: [
        [[-1, 2], [6, 2], [6, 5], [2, 5], [2, 9], [6, 9], [6, 12], [3, 12], [3, 15], [4, 15], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1 }],
          bonus: 45,
          isBoss: false,
          comm: "\u9AA8\u6865\u5728\u300C\u547C\u5438\u300D\uFF0C\u8DEF\u5F84\u968F\u751F\u7269\u7EC4\u7EC7\u8815\u52A8\u3002\u767B\u9646\u5F00\u59CB\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "speeder", count: 10, interval: 0.5 },
            { type: "crawler", count: 8, interval: 0.75 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 8, interval: 0.6 },
            { type: "lurker", count: 5, interval: 0.6 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 5, interval: 0.8 },
            { type: "speeder", count: 10, interval: 0.45 },
            { type: "crawler", count: 10, interval: 0.45 }
          ],
          bonus: 95,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "lurker", count: 10, interval: 0.45 },
            { type: "splitter", count: 10, interval: 0.45 }
          ],
          bonus: 120,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 0.9, hpOverride: 14e3, rewardOverride: 1e3 },
            { type: "splitter", count: 8, interval: 0.6 }
          ],
          bonus: 320,
          isBoss: true,
          comm: "\u5916\u819C\u300C\u514D\u75AB\u53CD\u5E94\u300D\u6765\u4E86\u2014\u2014\u5DE2\u4F53\u5DE8\u517D\u987A\u7740\u6211\u4EEC\u7684\u5F39\u5751\u722C\u51FA\uFF01"
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 9, interval: 0.45 },
            { type: "lurker", count: 10, interval: 0.4 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "splitter", count: 13, interval: 0.4 },
            { type: "speeder", count: 16, interval: 0.35 }
          ],
          bonus: 190,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "crawler", count: 20, interval: 0.3 },
            { type: "tanker", count: 6, interval: 0.5 },
            { type: "lurker", count: 10, interval: 0.4 }
          ],
          bonus: 220,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "splitter", count: 14, interval: 0.35 },
            { type: "tanker", count: 8, interval: 0.45 },
            { type: "speeder", count: 14, interval: 0.35 }
          ],
          bonus: 260,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "lurker", count: 14, interval: 0.35 },
            { type: "splitter", count: 12, interval: 0.35 },
            { type: "tanker", count: 8, interval: 0.45 }
          ],
          bonus: 300,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 26e3, rewardOverride: 1700 },
            { type: "crawler", count: 16, interval: 0.5 },
            { type: "speeder", count: 12, interval: 0.4 }
          ],
          bonus: 660,
          isBoss: true,
          comm: "\u5916\u819C\u9632\u5FA1\u4E2D\u67A2\u73B0\u8EAB\uFF01\u5B83\u7684\u7532\u58F3\u8584\u5C42\u4E0B\u5168\u662F\u518D\u751F\u7EC4\u7EC7\u2014\u2014\u6301\u7EED\u8F93\u51FA\uFF01"
        },
        {
          wave: 13,
          groups: [
            { type: "tanker", count: 10, interval: 0.4 },
            { type: "lurker", count: 12, interval: 0.3 },
            { type: "splitter", count: 12, interval: 0.3 }
          ],
          bonus: 340,
          isBoss: false
        },
        {
          wave: 14,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 3e4, rewardOverride: 2e3 },
            { type: "lurker", count: 10, interval: 0.4 },
            { type: "splitter", count: 10, interval: 0.4 }
          ],
          bonus: 750,
          isBoss: true,
          comm: "\u514D\u75AB\u4E2D\u67A2\u7684\u6BCD\u4F53\u300C\u819C\u738B\u300D\u538B\u5883\uFF01\u767B\u9646\u573A\u7684\u5B58\u4EA1\uFF0C\u5C31\u770B\u8FD9\u4E00\u6CE2\uFF01"
        }
      ]
    },
    {
      id: 11,
      name: "\u8840\u8089\u957F\u5ECA",
      sub: "\u4F53\u8154\u901A\u9053 \xB7 \u6DF1\u5165\u5DE2\u4F53",
      briefing: [
        "\u90E8\u961F\u5DF2\u7ECF\u51FF\u8FDB\u866B\u5DE2\u4F53\u8154\u3002\u8FD9\u91CC\u7684\u300C\u8D70\u5ECA\u300D\u662F\u6D3B\u4F53\u7EC4\u7EC7\u6784\u6210\u7684\uFF0C\u4E24\u4FA7\u7684\u8840\u7BA1\u58C1\u4F1A\u5468\u671F\u6027\u55B7\u51FA\u62A4\u822A\u866B\u7FA4\u2014\u2014\u6211\u4EEC\u662F\u5728\u5B83\u7684\u80A0\u9053\u91CC\u4F5C\u6218\u3002",
        "\u533B\u5B66\u90E8\u7684\u8B66\u544A\uFF1A\u8D70\u5ECA\u6DF1\u5904\u7684\u866B\u7FA4\u300C\u5237\u65B0\u7387\u300D\u8868\u793A\u866B\u5DE2\u5DF2\u7ECF\u5BDF\u89C9\u5230\u6211\u4EEC\u3002\u5B83\u6B63\u5728\u628A\u4F53\u5185\u7684\u514D\u75AB\u5175\u529B\u5168\u90E8\u8C03\u5F80\u8FD9\u6761\u901A\u9053\u3002",
        "\u7A7F\u8FC7\u8840\u8089\u957F\u5ECA\uFF0C\u524D\u9762\u5C31\u662F\u866B\u5DE2\u7684\u6838\u5FC3\u6CF5\u7AD9\u3002\u70B8\u6389\u5B83\uFF0C\u866B\u5DE2\u5C31\u6B7B\u4E86\u3002"
      ],
      epilogue: "\u957F\u5ECA\u6253\u901A\uFF0C\u514D\u75AB\u5175\u56E2\u5728\u5C0F\u5F84\u91CC\u88AB\u9010\u6CE2\u7EDE\u6740\u3002\u524D\u6CBF\u7206\u7834\u7EC4\u5DF2\u7ECF\u5728\u6838\u5FC3\u6CF5\u7AD9\u8D34\u4E0A\u4E86\u805A\u53D8\u70B8\u836F\u2014\u2014\u65F6\u95F4\u5DEE\u4E0D\u591A\u4E86\uFF0C\u6307\u6325\u5B98\uFF0C\u51C6\u5907\u7EC8\u6218\u3002",
      paths: [
        [[-1, 3], [3, 3], [3, 7], [6, 7], [6, 10], [3, 10], [3, 13], [5, 13], [5, 15], [4, 15], [4, 16]],
        [[9, 4], [6, 4], [6, 7], [3, 7], [3, 10], [6, 10], [6, 13], [5, 13], [5, 15], [4, 15], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 0 }],
          bonus: 45,
          isBoss: false,
          comm: "\u4F53\u58C1\u4E24\u4FA7\u90FD\u662F\u8840\u7BA1\u53E3\u2014\u2014\u866B\u7FA4\u4ECE\u58C1\u4E0A\u76F4\u63A5\u300C\u751F\u300D\u51FA\u6765\u3002"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 8, interval: 0.7, path: 1 },
            { type: "speeder", count: 9, interval: 0.45, path: 1 }
          ],
          bonus: 55,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 8, interval: 0.5 },
            { type: "lurker", count: 6, interval: 0.5 }
          ],
          bonus: 70,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 4, interval: 0.8, path: 0 },
            { type: "speeder", count: 10, interval: 0.4, path: 1 }
          ],
          bonus: 95,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "lurker", count: 11, interval: 0.4 },
            { type: "splitter", count: 10, interval: 0.4, path: 1 }
          ],
          bonus: 120,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 0.9, hpOverride: 15e3, rewardOverride: 1100, path: 1 },
            { type: "crawler", count: 14, interval: 0.5, path: 0 }
          ],
          bonus: 320,
          isBoss: true
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 9, interval: 0.45 },
            { type: "splitter", count: 11, interval: 0.4 }
          ],
          bonus: 160,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "lurker", count: 13, interval: 0.35 },
            { type: "speeder", count: 16, interval: 0.3, path: 0 }
          ],
          bonus: 190,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "tanker", count: 10, interval: 0.4 },
            { type: "splitter", count: 12, interval: 0.35 },
            { type: "crawler", count: 16, interval: 0.3 }
          ],
          bonus: 230,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 17e3, rewardOverride: 1100, path: 0 },
            { type: "lurker", count: 10, interval: 0.4, path: 1 },
            { type: "splitter", count: 8, interval: 0.45, path: 1 }
          ],
          bonus: 360,
          isBoss: true
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 15, interval: 0.3 },
            { type: "lurker", count: 13, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.3 }
          ],
          bonus: 270,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "tanker", count: 12, interval: 0.35 },
            { type: "lurker", count: 12, interval: 0.3 },
            { type: "splitter", count: 12, interval: 0.3 }
          ],
          bonus: 310,
          isBoss: false
        },
        {
          wave: 13,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 32e3, rewardOverride: 2100, path: 1 },
            { type: "tanker", count: 6, interval: 0.55, path: 0 },
            { type: "lurker", count: 10, interval: 0.35, path: 0 }
          ],
          bonus: 750,
          isBoss: true,
          comm: "\u300C\u8840\u5FC3\u5B88\u536B\u300D\u6CF5\u51FA\u6765\u4E86\uFF01\u5B83\u6321\u7740\u53BB\u8DEF\u2014\u2014\u4E0A\u7A7F\u7532\u5F39\u836F\uFF01"
        },
        {
          wave: 14,
          groups: [
            { type: "crawler", count: 24, interval: 0.25 },
            { type: "speeder", count: 18, interval: 0.25 },
            { type: "tanker", count: 8, interval: 0.4 },
            { type: "splitter", count: 10, interval: 0.3 }
          ],
          bonus: 380,
          isBoss: false,
          comm: "\u866B\u5DE2\u7684\u514D\u75AB\u519B\u56E2\u5168\u7EBF\u51FA\u51FB\u3002\u5B88\u4F4F\u6CF5\u7AD9\u524D\u7684\u6700\u540E\u4E00\u6BB5\u8D70\u5ECA\uFF01"
        }
      ]
    },
    {
      id: 12,
      name: "\u6838\u5FC3\u6CF5\u7AD9",
      sub: "\u5DE2\u4F53\u5FC3\u810F \xB7 \u7EC8\u5C40\u5F15\u7206",
      briefing: [
        "\u6838\u5FC3\u6CF5\u7AD9\u2014\u2014\u866B\u5DE2\u7684\u5FC3\u810F\uFF0C\u6BCF\u640F\u52A8\u4E00\u6B21\uFF0C\u5C31\u6709\u4E0A\u5343\u53EA\u866B\u6D8C\u5411\u661F\u73AF\u3002\u7206\u7834\u7EC4\u5DF2\u7ECF\u5C31\u4F4D\uFF0C\u4F46\u6CF5\u7AD9\u5468\u56F4\u7684\u300C\u5FC3\u5BA4\u536B\u961F\u300D\u662F\u866B\u5DE2\u6700\u5F3A\u7684\u4E00\u6279\u4E2A\u4F53\u3002",
        "\u8230\u961F\u7684\u6700\u540E\u901A\u7252\uFF1A\u6218\u7EBF\u53EA\u80FD\u518D\u62D6 16 \u6CE2\u3002\u8D85\u8FC7\u65F6\u9650\uFF0C\u866B\u5DE2\u5C31\u4F1A\u52A0\u901F\u56DE\u6D41\uFF0C\u6211\u4EEC\u5931\u53BB\u7684\u5C31\u4E0D\u53EA\u662F\u6B96\u6C11\u5730\u4E86\u3002",
        "\u5F15\u7206\u5012\u8BA1\u65F6\u5F00\u59CB\u3002\u6307\u6325\u5B98\uFF0C\u5B88\u4F4F\u5F15\u7206\u70B9\uFF0C\u5C31\u662F\u5B88\u4F4F\u4E00\u5207\u3002"
      ],
      epilogue: "\u805A\u53D8\u70B8\u836F\u5728\u6CF5\u7AD9\u6DF1\u5904\u70B8\u5F00\uFF0C\u6574\u9897\u866B\u5DE2\u50CF\u7184\u706D\u7684\u706F\u4E00\u6837\u8737\u7F29\u3001\u584C\u9677\u3001\u5316\u4E3A\u6B7B\u5BC2\u7684\u7070\u70EC\u3002\u7206\u7834\u7EC4\u4E3E\u8D77\u62F3\u5934\uFF0C\u8230\u961F\u7206\u53D1\u51FA cheer\u3002\u4F46\u96F7\u8FBE\u6700\u540E\u626B\u5230\u7684\u4E00\u4E2A\u4FE1\u53F7\uFF0C\u8BA9\u6B22\u547C\u58F0\u5728\u534A\u7A7A\u51DD\u56FA\u2014\u2014\u866B\u5DE2\u5FC3\u810F\u7684\u6700\u6DF1\u5904\uFF0C\u8FD8\u6709\u4E00\u9897\u300C\u5FC3\u300D\uFF0C\u8FD8\u5728\u8DF3\u3002",
      paths: [
        [[9, 1], [5, 1], [5, 6], [7, 6], [7, 11], [5, 11], [5, 14], [4, 14], [4, 16]],
        [[-1, 2], [3, 2], [3, 7], [1, 7], [1, 12], [3, 12], [3, 14], [4, 14], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 0 }],
          bonus: 45,
          isBoss: false,
          comm: "\u5FC3\u5BA4\u536B\u961F\u7684\u7B2C\u4E00\u68AF\u961F\u3002\u5F15\u7206\u7EC4\u8D34\u597D\u4E86\u7B2C\u4E00\u6279\u70B8\u836F\u2014\u2014\u9700\u8981 75 \u79D2\u63A9\u62A4\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "speeder", count: 10, interval: 0.5, path: 1 },
            { type: "crawler", count: 8, interval: 0.7, path: 1 }
          ],
          bonus: 60,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 8, interval: 0.5 },
            { type: "lurker", count: 6, interval: 0.5 }
          ],
          bonus: 75,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 5, interval: 0.75, path: 0 },
            { type: "speeder", count: 10, interval: 0.45, path: 1 },
            { type: "lurker", count: 5, interval: 0.55, path: 0 }
          ],
          bonus: 95,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 17e3, rewardOverride: 1200, path: 0 },
            { type: "splitter", count: 10, interval: 0.4, path: 1 }
          ],
          bonus: 340,
          isBoss: true
        },
        {
          wave: 6,
          groups: [
            { type: "tanker", count: 9, interval: 0.45 },
            { type: "splitter", count: 12, interval: 0.35 }
          ],
          bonus: 170,
          isBoss: false
        },
        {
          wave: 7,
          groups: [
            { type: "lurker", count: 13, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.3 }
          ],
          bonus: 200,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "tanker", count: 10, interval: 0.4 },
            { type: "crawler", count: 18, interval: 0.25 },
            { type: "lurker", count: 10, interval: 0.35 }
          ],
          bonus: 240,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 19e3, rewardOverride: 1300, path: 1 },
            { type: "lurker", count: 11, interval: 0.35, path: 0 }
          ],
          bonus: 380,
          isBoss: true
        },
        {
          wave: 10,
          groups: [
            { type: "splitter", count: 16, interval: 0.3 },
            { type: "lurker", count: 14, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.25 }
          ],
          bonus: 280,
          isBoss: false
        },
        {
          wave: 11,
          groups: [
            { type: "tanker", count: 13, interval: 0.35 },
            { type: "splitter", count: 14, interval: 0.3 },
            { type: "lurker", count: 12, interval: 0.3 }
          ],
          bonus: 330,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "boss", count: 2, interval: 1.4, hpOverride: 14e3, rewardOverride: 1e3 },
            { type: "speeder", count: 14, interval: 0.35 }
          ],
          bonus: 700,
          isBoss: true,
          comm: "\u53CC\u517D\u5FC3\u5BA4\u5DE1\u903B\u6CE2\uFF01\u5F15\u7206\u5012\u8BA1\u65F6\u5DF2\u7ECF\u8FC7\u534A\u2014\u2014\u9876\u4F4F\uFF01"
        },
        {
          wave: 13,
          groups: [
            { type: "tanker", count: 14, interval: 0.3 },
            { type: "lurker", count: 14, interval: 0.25 },
            { type: "splitter", count: 12, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.25 }
          ],
          bonus: 400,
          isBoss: false,
          comm: "\u5F15\u7206\u5B8C\u6BD5\uFF0C\u8FDB\u5165\u64A4\u79BB\u7A97\u53E3\u3002\u866B\u5DE2\u7684\u54C0\u568E\u91CC\uFF0C\u4E00\u5207\u90FD\u5728\u5411\u5916\u6D8C\u2014\u2014\u6700\u540E\u4E00\u6BB5\u64A4\u9000\u7EBF\uFF01"
        },
        {
          wave: 14,
          groups: [
            { type: "boss", count: 1, interval: 0.8, hpOverride: 34e3, rewardOverride: 2200, path: 0 },
            { type: "lurker", count: 12, interval: 0.3, path: 1 },
            { type: "tanker", count: 6, interval: 0.5, path: 1 }
          ],
          bonus: 800,
          isBoss: true,
          comm: "\u6CF5\u7AD9\u5D29\u584C\u524D\u6700\u540E\u4E00\u6218\u2014\u2014\u300C\u5FC3\u5BA4\u603B\u7BA1\u300D\u4EB2\u81EA\u5835\u95E8\uFF01\u6321\u4F4F\u5B83\uFF0C\u6211\u4EEC\u56DE\u5BB6\uFF01"
        }
      ]
    },
    {
      id: 13,
      name: "\u6E6E\u706D\u4E4B\u5FC3",
      sub: "\u866B\u5DE2\u6838\u5FC3 \xB7 \u52D2\u73ED\u9640\u51B3\u6218",
      briefing: [
        "\u6CF5\u7AD9\u70B8\u788E\u540E\uFF0C\u866B\u5DE2\u7684\u6B8B\u8EAF\u4ECD\u5728\u52A0\u901F\u56DE\u6D41\u3002\u96F7\u8FBE\u9501\u5B9A\u4E86\u4E00\u9897\u8FD8\u5728\u8DF3\u52A8\u7684\u300C\u73AF\u8282\u5FC3\u810F\u300D\u2014\u2014\u6E6E\u706D\u4E4B\u5FC3\uFF0C\u866B\u7FA4\u6700\u540E\u3001\u4E5F\u662F\u552F\u4E00\u7684\u6307\u6325\u4E2D\u67A2\u3002",
        "\u5DE5\u7A0B\u90E8\u628A\u8230\u961F\u62C6\u4E86\uFF0C\u628A\u6240\u6709\u5149\u77DB\u6D53\u7F29\u6210\u4E86\u4E09\u95E8\u300C\u5E15\u7279\u519C\u7EA7\u300D\u8F68\u9053\u7535\u78C1\u70AE\u2014\u2014\u5168\u6B96\u6C11\u5730\u6700\u540E\u4E00\u53E3\u94A2\u6C34\uFF0C\u6D47\u6210\u4E86\u8FD9\u4E00\u95E8\u70AE\u3002",
        "\u4E09\u6761\u901A\u8DEF\uFF0C\u4E00\u9897\u5FC3\u810F\u30022242 \u5E74\u6700\u540E\u7684\u6218\u5F79\u6B63\u5F0F\u6253\u54CD\u2014\u2014\u6307\u6325\u5B98\uFF0C\u5168\u4EBA\u7C7B\u90FD\u5728\u4F60\u7684\u51C6\u661F\u80CC\u540E\u3002\u5F00\u706B\u3002"
      ],
      epilogue: "\u6E6E\u706D\u4E4B\u5FC3\u505C\u8DF3\u7684\u90A3\u4E00\u523B\uFF0C\u6574\u4E2A\u661F\u73AF\u90FD\u542C\u89C1\u4E86\u5BC2\u9759\u3002\u866B\u7FA4\u9000\u6F6E\u822C\u4ECE\u6DF1\u7A7A\u6563\u53BB\uFF0C\u50CF\u4E00\u573A\u6301\u7EED\u4E86\u4E09\u767E\u4E2A\u8F68\u9053\u5468\u671F\u7684\u66B4\u96E8\u7EC8\u4E8E\u653E\u4E86\u6674\u3002\u5B69\u5B50\u4EEC\u5728\u7A79\u9876\u4E0B\u770B\u5230\u7B2C\u4E00\u4E2A\u6CA1\u6709\u8B66\u62A5\u7684\u9ECE\u660E\u2014\u2014\u800C\u4F60\u7684\u540D\u5B57\uFF0C\u88AB\u523B\u5728\u4E86\u6B96\u6C11\u5730\u7684\u6700\u9AD8\u5904\u3002\u6218\u4E89\uFF0C\u7ED3\u675F\u4E86\u3002\u8FD9\u4E00\u6B21\u662F\u771F\u7684\u3002",
      paths: [
        [[-1, 2], [6, 2], [6, 6], [2, 6], [2, 11], [5, 11], [5, 14], [4, 14], [4, 16]],
        [[9, 3], [4, 3], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
        [[4, -1], [4, 4], [1, 4], [1, 9], [3, 9], [3, 13], [4, 13], [4, 16]]
      ],
      waves: [
        {
          wave: 1,
          groups: [{ type: "crawler", count: 9, interval: 1, path: 2 }],
          bonus: 50,
          isBoss: false,
          comm: "\u4E09\u7EBF\u4F1A\u6218\u5F00\u5E55\u3002\u4E2D\u8DEF\u6700\u8FD1\uFF0C\u522B\u8BA9\u5B83\u5148\u7834\u7EBF\uFF01"
        },
        {
          wave: 2,
          groups: [
            { type: "crawler", count: 8, interval: 0.8, path: 0 },
            { type: "speeder", count: 8, interval: 0.5, path: 1 }
          ],
          bonus: 60,
          isBoss: false
        },
        {
          wave: 3,
          groups: [
            { type: "splitter", count: 8, interval: 0.5 },
            { type: "lurker", count: 6, interval: 0.5, path: 2 }
          ],
          bonus: 80,
          isBoss: false
        },
        {
          wave: 4,
          groups: [
            { type: "tanker", count: 5, interval: 0.75, path: 0 },
            { type: "speeder", count: 10, interval: 0.45, path: 2 },
            { type: "lurker", count: 6, interval: 0.55, path: 1 }
          ],
          bonus: 100,
          isBoss: false
        },
        {
          wave: 5,
          groups: [
            { type: "lurker", count: 11, interval: 0.4 },
            { type: "splitter", count: 11, interval: 0.4, path: 1 }
          ],
          bonus: 130,
          isBoss: false
        },
        {
          wave: 6,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 2e4, rewardOverride: 1400, path: 2 },
            { type: "crawler", count: 14, interval: 0.5, path: 0 }
          ],
          bonus: 380,
          isBoss: true
        },
        {
          wave: 7,
          groups: [
            { type: "tanker", count: 10, interval: 0.4 },
            { type: "splitter", count: 12, interval: 0.35 }
          ],
          bonus: 180,
          isBoss: false
        },
        {
          wave: 8,
          groups: [
            { type: "lurker", count: 14, interval: 0.3 },
            { type: "speeder", count: 16, interval: 0.3, path: 1 }
          ],
          bonus: 210,
          isBoss: false
        },
        {
          wave: 9,
          groups: [
            { type: "tanker", count: 11, interval: 0.4 },
            { type: "splitter", count: 13, interval: 0.3 },
            { type: "crawler", count: 16, interval: 0.3 }
          ],
          bonus: 240,
          isBoss: false
        },
        {
          wave: 10,
          groups: [
            { type: "boss", count: 1, interval: 1, hpOverride: 22e3, rewardOverride: 1500, path: 0 },
            { type: "lurker", count: 11, interval: 0.35, path: 1 },
            { type: "splitter", count: 9, interval: 0.4, path: 2 }
          ],
          bonus: 420,
          isBoss: true
        },
        {
          wave: 11,
          groups: [
            { type: "splitter", count: 16, interval: 0.3 },
            { type: "lurker", count: 14, interval: 0.3 },
            { type: "speeder", count: 18, interval: 0.25 }
          ],
          bonus: 300,
          isBoss: false
        },
        {
          wave: 12,
          groups: [
            { type: "tanker", count: 13, interval: 0.35 },
            { type: "lurker", count: 13, interval: 0.3 },
            { type: "splitter", count: 13, interval: 0.3 }
          ],
          bonus: 340,
          isBoss: false
        },
        {
          wave: 13,
          groups: [
            { type: "boss", count: 2, interval: 1.4, hpOverride: 15e3, rewardOverride: 1100 },
            { type: "speeder", count: 14, interval: 0.35 }
          ],
          bonus: 760,
          isBoss: true,
          comm: "\u5FC3\u5BA4\u536B\u961F\u603B\u65D7\u8230\u300C\u53CC\u5195\u8005\u300D\u903C\u8FD1\uFF01\u5E15\u7279\u519C\u9635\u5217\u5145\u80FD\u4E2D\u2014\u2014\u63A9\u62A4\u5B83\u4EEC\uFF01"
        },
        {
          wave: 14,
          groups: [
            { type: "tanker", count: 14, interval: 0.3 },
            { type: "lurker", count: 13, interval: 0.25 },
            { type: "splitter", count: 13, interval: 0.25 },
            { type: "speeder", count: 16, interval: 0.25 }
          ],
          bonus: 440,
          isBoss: false,
          comm: "\u866B\u7FA4\u7684\u6700\u540E\u4E00\u640F\u3002\u6240\u6709\u70AE\u5854\u2014\u2014\u81EA\u7531\u5C04\u51FB\uFF01"
        },
        {
          wave: 15,
          groups: [
            { type: "boss", count: 1, interval: 0.6, hpOverride: 55e3, rewardOverride: 5e3, path: 2 },
            { type: "lurker", count: 12, interval: 0.3, path: 0 },
            { type: "tanker", count: 8, interval: 0.45, path: 1 },
            { type: "speeder", count: 14, interval: 0.3, path: 2 }
          ],
          bonus: 1500,
          isBoss: true,
          comm: "\u6E6E\u706D\u4E4B\u5FC3\u672C\u4F53\u538B\u4E0A\u4E2D\u901A\u8DEF\u2014\u2014\u5E15\u7279\u519C\u4E3B\u70AE\u5DF2\u5145\u80FD\u5B8C\u6BD5\uFF01\u6307\u6325\u5B98\uFF0C\u4E3A\u4E86\u8BA9\u9ECE\u660E\u51C6\u65F6\u5230\u6765\u2014\u2014\u5F00\u706B\uFF01"
        }
      ]
    }
  );
  function getLevel(id) {
    if (id === COOP_LEVEL.id) return COOP_LEVEL;
    return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
  }
  var COOP_LEVEL = {
    id: 0,
    name: "\u53CC\u5B50\u661F\u95E8",
    sub: "\u534F\u540C\u4F5C\u6218 \xB7 \u53CC\u8DEF\u8054\u673A\u9632\u7EBF",
    briefing: [
      "\u53CC\u5B50\u661F\u95E8\u2014\u2014\u6B96\u6C11\u5730\u8DC3\u8FC1\u7F51\u7EDC\u7684\u4E1C\u897F\u53CC\u95E8\u67A2\u7EBD\u3002\u866B\u7FA4\u4E3B\u529B\u5175\u5206\u4E24\u8DEF\uFF0C\u6CBF\u4E24\u6761\u7EF4\u4FEE\u6808\u9053\u540C\u65F6\u538B\u5411\u53CC\u95E8\u3002",
      "\u6307\u6325\u90E8\u547D\u4EE4\uFF1A\u4E24\u540D\u6307\u6325\u5B98\u5404\u9886\u4E00\u8DEF\uFF0C\u72EC\u7ACB\u519B\u8D39\u3001\u5404\u81EA\u4E3A\u6218\u2014\u2014\u4F46\u661F\u95E8\u7684\u62A4\u76FE\u6838\u5FC3\u53EA\u6709\u4E00\u5EA7\uFF0C\u6F0F\u6389\u7684\u6BCF\u4E00\u53EA\u866B\u5B50\u90FD\u5728\u70E7\u5171\u540C\u7684\u751F\u547D\u3002",
      "\u5B88\u4F4F\u5168\u90E8\u6CE2\u6B21\u3002\u534F\u540C\u52A0\u6210\u5DF2\u8BA1\u5165\u6218\u540E\u519B\u529F\uFF0C\u6307\u6325\u5B98\uFF0C\u5E76\u80A9\u4F5C\u6218\u3002"
    ],
    epilogue: "\u53CC\u5B50\u661F\u95E8\u5728\u53CC\u91CD\u706B\u529B\u7F51\u4E2D\u5C79\u7ACB\u4E0D\u5012\u3002\u866B\u7FA4\u6B8B\u90E8\u9000\u56DE\u6DF1\u7A7A\u2014\u2014\u8FD9\u4E00\u6218\uFF0C\u662F\u4E24\u53CC\u773C\u775B\u4E00\u8D77\u8D62\u4E0B\u7684\u3002",
    // 左路（path 0）左进左出，右路（path 1）右进右出，互不接触
    paths: [
      [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 9], [3, 9], [3, 12], [1, 12], [1, 14], [2, 14], [2, 16]],
      [[9, 2], [5, 2], [5, 4], [7, 4], [7, 7], [5, 7], [5, 10], [7, 10], [7, 13], [6, 13], [6, 16]]
    ],
    waves: [
      {
        wave: 1,
        groups: [{ type: "crawler", count: 8, interval: 1.1, path: 0 }],
        bonus: 40,
        isBoss: false,
        comm: "\u53CC\u95E8\u67A2\u7EBD\u63A5\u654C\u2014\u2014\u5DE6\u8DEF\u6808\u9053\u5148\u51FA\u73B0\u866B\u7FA4\u3002\u5404\u5B88\u4E00\u8DEF\uFF0C\u6307\u6325\u5B98\uFF01"
      },
      {
        wave: 2,
        groups: [
          { type: "crawler", count: 6, interval: 1, path: 1 },
          { type: "speeder", count: 4, interval: 0.8, path: 1 }
        ],
        bonus: 55,
        isBoss: false,
        comm: "\u53F3\u8DEF\u9047\u88AD\uFF01\u522B\u8BA9\u4EFB\u4F55\u4E00\u8DEF\u653E\u7A7A\u3002"
      },
      {
        wave: 3,
        groups: [
          { type: "splitter", count: 5, interval: 0.9, path: 0 },
          { type: "lurker", count: 3, interval: 0.9, path: 1 }
        ],
        bonus: 65,
        isBoss: false
      },
      {
        wave: 4,
        groups: [
          { type: "tanker", count: 4, interval: 0.9, path: 0 },
          { type: "crawler", count: 8, interval: 0.8, path: 1 }
        ],
        bonus: 80,
        isBoss: false
      },
      {
        wave: 5,
        groups: [
          { type: "lurker", count: 8, interval: 0.6, path: 1 },
          { type: "speeder", count: 10, interval: 0.6, path: 0 }
        ],
        bonus: 100,
        isBoss: false,
        comm: "\u9690\u533F\u8005\u5F00\u59CB\u6E17\u900F\u53F3\u8DEF\u2014\u2014\u7535\u78C1\u70AE\u53EF\u65E0\u89C6\u9690\u8EAB\u3002"
      },
      {
        wave: 6,
        groups: [
          { type: "splitter", count: 9, interval: 0.65, path: 0 },
          { type: "tanker", count: 4, interval: 0.8, path: 1 }
        ],
        bonus: 130,
        isBoss: false
      },
      {
        wave: 7,
        groups: [
          { type: "lurker", count: 10, interval: 0.55, path: 0 },
          { type: "speeder", count: 12, interval: 0.5, path: 1 }
        ],
        bonus: 150,
        isBoss: false
      },
      {
        wave: 8,
        groups: [
          { type: "boss", count: 1, interval: 1, hpOverride: 4e3, rewardOverride: 400, path: 0 },
          { type: "boss", count: 1, interval: 1, hpOverride: 4e3, rewardOverride: 400, path: 1 }
        ],
        bonus: 280,
        isBoss: true,
        comm: "\u8B66\u544A\uFF1A\u53CC\u8DEF\u5404\u6709\u4E00\u53EA\u5DE8\u517D\u538B\u9635\uFF01\u5404\u81EA\u96C6\u706B\uFF0C\u522B\u8BA9\u5B83\u78B0\u5230\u661F\u95E8\uFF01"
      },
      {
        wave: 9,
        groups: [
          { type: "tanker", count: 7, interval: 0.6, path: 1 },
          { type: "lurker", count: 8, interval: 0.55, path: 0 }
        ],
        bonus: 170,
        isBoss: false
      },
      {
        wave: 10,
        groups: [
          { type: "splitter", count: 10, interval: 0.55, path: 0 },
          { type: "speeder", count: 10, interval: 0.5, path: 1 },
          { type: "crawler", count: 12, interval: 0.5, path: 0 }
        ],
        bonus: 200,
        isBoss: false,
        comm: "\u517D\u6F6E\u5BC6\u5EA6\u8FD8\u5728\u4E0A\u5347\u3002\u519B\u8D39\u72EC\u7ACB\u2014\u2014\u7167\u770B\u597D\u4F60\u81EA\u5DF1\u7684\u90A3\u4E00\u8DEF\u3002"
      },
      {
        wave: 11,
        groups: [
          { type: "lurker", count: 12, interval: 0.5, path: 1 },
          { type: "tanker", count: 5, interval: 0.7, path: 0 },
          { type: "splitter", count: 7, interval: 0.55, path: 1 }
        ],
        bonus: 240,
        isBoss: false
      },
      {
        wave: 12,
        groups: [
          { type: "crawler", count: 14, interval: 0.4, path: 0 },
          { type: "speeder", count: 12, interval: 0.4, path: 1 },
          { type: "tanker", count: 6, interval: 0.6, path: 0 }
        ],
        bonus: 280,
        isBoss: false
      },
      {
        wave: 13,
        groups: [
          { type: "splitter", count: 10, interval: 0.45, path: 1 },
          { type: "lurker", count: 10, interval: 0.45, path: 0 },
          { type: "speeder", count: 12, interval: 0.4, path: 1 }
        ],
        bonus: 320,
        isBoss: false
      },
      {
        wave: 14,
        groups: [
          { type: "tanker", count: 8, interval: 0.5, path: 0 },
          { type: "lurker", count: 10, interval: 0.4, path: 1 },
          { type: "splitter", count: 8, interval: 0.45, path: 0 }
        ],
        bonus: 380,
        isBoss: false,
        comm: "\u661F\u95E8\u62A4\u76FE\u80FD\u91CF\u89C1\u5E95\u3002\u6700\u540E\u4E00\u6CE2\u603B\u653B\u8981\u6765\u4E86\u2014\u2014\u628A\u519B\u8D39\u5168\u90E8\u82B1\u6389\uFF01"
      },
      {
        wave: 15,
        groups: [
          { type: "boss", count: 1, interval: 0.8, hpOverride: 9600, rewardOverride: 900, path: 0 },
          { type: "boss", count: 1, interval: 0.8, hpOverride: 9600, rewardOverride: 900, path: 1 },
          { type: "speeder", count: 8, interval: 0.7, path: 0 },
          { type: "lurker", count: 6, interval: 0.8, path: 1 }
        ],
        bonus: 650,
        isBoss: true,
        comm: "\u6700\u7EC8\u8B66\u544A\uFF1A\u53CC\u8DEF\u5404\u73B0\u8EAB\u4E00\u53EA\u6E6E\u706D\u5DE8\u517D\uFF01\u8FD9\u662F\u53CC\u5B50\u661F\u95E8\u7684\u6700\u540E\u4E00\u6218\u2014\u2014\u5F00\u706B\uFF01"
      }
    ]
  };

  // src/game/engine.ts
  var uid = 1;
  function createEngine(difficulty, levelId = 1, opts) {
    const diff = DIFFICULTIES[difficulty];
    const level = getLevel(levelId);
    const map = buildLevelMap(level.paths);
    const lowSpec = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
    const particleScale = lowSpec ? 0.5 : 1;
    const coop = !!opts?.coop;
    const startGolds = coop ? [
      opts?.startGold?.[0] ?? DIFFICULTIES.normal.gold,
      opts?.startGold?.[1] ?? DIFFICULTIES.normal.gold
    ] : null;
    const state = {
      phase: "prep",
      clock: 0,
      timeSec: 0,
      gold: startGolds ? startGolds[0] : diff.gold,
      lives: diff.lives,
      maxLives: diff.lives,
      coop,
      golds: startGolds,
      killsBy: coop ? [0, 0] : null,
      wave: 1,
      totalWaves: level.waves.length,
      prepT: PREP_TIME,
      paused: false,
      speed: 1,
      enemies: [],
      towers: [],
      projectiles: [],
      beams: [],
      particles: [],
      rings: [],
      floaters: [],
      zones: [],
      spawnQueue: [],
      spawnT: 0,
      kills: 0,
      leaked: 0,
      goldEarned: 0,
      shake: 0,
      towerTypesBuilt: [],
      usedFrost: false,
      maxTowerLevel: 1,
      boss1Killed: false,
      techs: [],
      techChoices: null,
      events: []
    };
    const techCount = (id) => state.techs.reduce((n, t) => n + (t === id ? 1 : 0), 0);
    const dmgMul = () => 1 + 0.15 * techCount("dmg");
    const rateMul = () => 1 + 0.12 * techCount("rate");
    const rangeMul = () => 1 + 0.1 * techCount("range");
    const goldMul = () => 1 + 0.25 * techCount("gold");
    const splashMul = () => 1 + 0.2 * techCount("splash");
    function critMul() {
      return Math.random() < 0.1 * techCount("crit") ? 2 : 1;
    }
    function rollTechChoices() {
      const pool = TECH_LIST.map((t) => t.id);
      const late = state.wave > 6;
      const candidates = pool.filter((id) => !(late && (id === "supply" || id === "repair")));
      const picks = [];
      while (picks.length < 3 && candidates.length > 0) {
        const i = Math.floor(Math.random() * candidates.length);
        picks.push(candidates[i]);
        candidates.splice(i, 1);
      }
      return picks;
    }
    const listeners = /* @__PURE__ */ new Set();
    const notify = () => listeners.forEach((f) => f());
    const pushEvent = (e) => state.events.push(e);
    function goldOf(player) {
      return state.golds ? state.golds[player] : state.gold;
    }
    function setGold(player, value) {
      if (state.golds) {
        state.golds[player] = value;
        state.gold = state.golds[0];
      } else {
        state.gold = value;
      }
    }
    function addGold(player, delta) {
      setGold(player, goldOf(player) + delta);
    }
    function addFloater(x, y, text, color) {
      state.floaters.push({ id: uid++, x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
    }
    function addExplosion(x, y, color, count, power = 120) {
      const n = Math.max(4, Math.round(count * particleScale));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = power * (0.4 + Math.random() * 0.8);
        const ttl = 0.4 + Math.random() * 0.3;
        state.particles.push({
          id: uid++,
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          ttl,
          maxTtl: ttl,
          color,
          size: 2 + Math.random() * 3
        });
      }
    }
    function addBeam(x1, y1, x2, y2, color, width, ttl = 0.1) {
      state.beams.push({ id: uid++, x1, y1, x2, y2, color, width, ttl, maxTtl: ttl });
    }
    function addRing(x, y, color, r0, r1, ttl = 0.5) {
      state.rings.push({ id: uid++, x, y, color, r0, r1, ttl, maxTtl: ttl });
    }
    function isInvisible(e) {
      return e.type === "lurker" && e.stealthT % 4 >= 3;
    }
    function scaledHp(type, wave, override) {
      if (override !== void 0) return Math.round(override * diff.hpMul);
      return Math.round(ENEMIES[type].hp * (1 + 0.12 * (wave - 1)) * diff.hpMul);
    }
    function spawnEnemy(item, dist = 0) {
      const def = ENEMIES[item.type];
      const e = {
        id: uid++,
        type: item.type,
        hp: 0,
        maxHp: 0,
        dist,
        path: item.path ?? 0,
        speed: def.speed * diff.speedMul,
        reward: item.rewardOverride ?? def.reward,
        leak: def.leak,
        slowUntil: 0,
        slowPct: 0,
        stunUntil: 0,
        vulnUntil: 0,
        lastHitAt: -999,
        stealthT: Math.random() * 2,
        isBoss: item.type === "boss",
        enraged: false,
        bornAt: state.clock
      };
      e.maxHp = scaledHp(item.type, state.wave, item.hpOverride);
      e.hp = e.maxHp;
      state.enemies.push(e);
      if (e.isBoss) {
        state.shake = 1;
        pushEvent({ type: "waveStart", wave: state.wave });
      }
    }
    function buildSpawnQueue(wave) {
      const def = level.waves[wave - 1];
      const pathCount = map.paths.length;
      let rr2 = 0;
      const pools = def.groups.map((g) => {
        const base = rr2;
        if (g.path === void 0) rr2 += g.count;
        return Array.from({ length: g.count }, (_, i) => ({
          type: g.type,
          interval: g.interval,
          path: g.path ?? (base + i) % pathCount,
          hpOverride: g.hpOverride,
          rewardOverride: g.rewardOverride
        }));
      });
      pools.sort((a, b) => (b[0]?.type === "boss" ? 1 : 0) - (a[0]?.type === "boss" ? 1 : 0));
      const queue2 = [];
      let added = true;
      while (added) {
        added = false;
        for (const pool of pools) {
          const item = pool.shift();
          if (item) {
            queue2.push(item);
            added = true;
          }
        }
      }
      return queue2;
    }
    function applyDamage(e, raw, source, tower) {
      if (e.hp <= 0) return;
      let dmg = raw * dmgMul() * critMul();
      const armored = e.type === "tanker" || e.isBoss;
      if (armored) dmg *= 1 + 0.25 * techCount("pierce");
      if (source === "laser" && e.type === "tanker" && techCount("pierce") === 0) dmg *= 0.75;
      if (state.clock < e.vulnUntil) dmg *= 1.15;
      e.hp -= dmg;
      e.lastHitAt = state.clock;
      if (e.isBoss && !e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true;
        e.speed *= 1.4;
      }
      if (e.hp <= 0) killEnemy(e, tower);
    }
    function killEnemy(e, tower) {
      e.hp = 0;
      state.kills += 1;
      const earned = Math.max(1, Math.round(e.reward * goldMul()));
      if (state.golds) {
        const owner = tower?.owner ?? 0;
        state.golds[owner] += earned;
        state.gold = state.golds[0];
        if (tower) state.killsBy[owner] += 1;
      } else {
        state.gold += earned;
      }
      state.goldEarned += earned;
      if (tower) tower.kills += 1;
      const p = map.posAt(e.path, e.dist);
      const color = e.isBoss ? "#FF3D81" : "#FFC94D";
      addExplosion(p.x, p.y, e.isBoss ? "#FF3D81" : "#B8FF3D", e.isBoss ? 26 : 12, e.isBoss ? 200 : 120);
      addFloater(p.x, p.y - 10, `+${earned}`, color);
      addRing(p.x, p.y, color, 6, e.isBoss ? 90 : 34, e.isBoss ? 0.8 : 0.45);
      if (e.isBoss) {
        state.shake = 1.5;
        addExplosion(p.x, p.y, "#FFC94D", Math.round(20 / particleScale), 260);
        addRing(p.x, p.y, "#FFFFFF", 10, 60, 0.55);
        addRing(p.x, p.y, "#FF3D81", 4, 130, 1);
        state.boss1Killed = true;
        pushEvent({ type: "bossDown", wave: state.wave });
      }
      if (e.type === "splitter") {
        for (let i = 0; i < 2; i++) {
          spawnEnemy(
            { type: "crawler", interval: 0, path: e.path, hpOverride: Math.round(scaledHp("crawler", state.wave) * 0.6 / diff.hpMul) },
            Math.max(0, e.dist - i * 14)
          );
        }
      }
    }
    function towerCenter(t) {
      return { x: (t.col + 0.5) * CELL, y: (t.row + 0.5) * CELL };
    }
    function inRange(t, e) {
      const def = TOWERS[t.type].levels[t.level];
      const c = towerCenter(t);
      const p = map.posAt(e.path, e.dist);
      return e.hp > 0 && Math.hypot(p.x - c.x, p.y - c.y) <= def.range * CELL * rangeMul();
    }
    function pickTarget(t, ignoreStealth) {
      let best = null;
      for (const e of state.enemies) {
        if (!ignoreStealth && isInvisible(e)) continue;
        if (!inRange(t, e)) continue;
        if (!best || e.dist > best.dist) best = e;
      }
      return best;
    }
    function fireLaser(t, target) {
      const lv = TOWERS.laser.levels[t.level];
      t.lastFireAt = state.clock;
      const c = towerCenter(t);
      const p = map.posAt(target.path, target.dist);
      addBeam(c.x, c.y, p.x, p.y, "#22E0FF", 2);
      applyDamage(target, lv.damage, "laser", t);
      if (t.level === 2) {
        let second = null;
        for (const e of state.enemies) {
          if (e === target || e.hp <= 0 || isInvisible(e) || !inRange(t, e)) continue;
          if (!second || e.dist > second.dist) second = e;
        }
        if (second) {
          const p2 = map.posAt(second.path, second.dist);
          addBeam(p.x, p.y, p2.x, p2.y, "#22E0FF88", 1.5);
          applyDamage(second, lv.damage * 0.5, "laser", t);
        }
      }
    }
    function fireMissile(t, target) {
      const def = TOWERS.missile;
      const lv = def.levels[t.level];
      t.lastFireAt = state.clock;
      const c = towerCenter(t);
      const p = map.posAt(target.path, target.dist);
      state.projectiles.push({
        id: uid++,
        kind: "missile",
        fromX: c.x,
        fromY: c.y,
        x: c.x,
        y: c.y,
        tx: p.x,
        ty: p.y,
        t: 0,
        dur: 0.35,
        damage: lv.damage,
        splash: def.splash[t.level] * splashMul(),
        stun: def.stun[t.level],
        towerId: t.id
      });
      pushEvent({ type: "sfx", name: "missile" });
    }
    function addLightning(x1, y1, x2, y2) {
      const mids = Math.random() < 0.5 ? 1 : 2;
      const pts = [[x1, y1]];
      for (let i = 1; i <= mids; i++) {
        const f = i / (mids + 1);
        pts.push([
          x1 + (x2 - x1) * f + (Math.random() - 0.5) * 26,
          y1 + (y2 - y1) * f + (Math.random() - 0.5) * 26
        ]);
      }
      pts.push([x2, y2]);
      for (let i = 0; i < pts.length - 1; i++) {
        addBeam(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "#FFE93D", 2, 0.14);
      }
    }
    function fireTesla(t, target) {
      const def = TOWERS.tesla;
      t.lastFireAt = state.clock;
      const lv = def.levels[t.level];
      const c = towerCenter(t);
      const jumps = def.chain[t.level];
      const decay = def.chainDecay;
      const hit2 = /* @__PURE__ */ new Set();
      let px = c.x;
      let py = c.y;
      let dmg = lv.damage;
      let cur = target;
      while (cur) {
        const p = map.posAt(cur.path, cur.dist);
        addLightning(px, py, p.x, p.y);
        applyDamage(cur, dmg, "tesla", t);
        hit2.add(cur.id);
        px = p.x;
        py = p.y;
        dmg *= decay;
        if (hit2.size > jumps) break;
        let next = null;
        let best = Infinity;
        for (const e of state.enemies) {
          if (e.hp <= 0 || hit2.has(e.id) || isInvisible(e)) continue;
          const ep = map.posAt(e.path, e.dist);
          const d = Math.hypot(ep.x - px, ep.y - py);
          if (d <= 2.5 * CELL && d < best) {
            best = d;
            next = e;
          }
        }
        cur = next;
      }
      addExplosion(px, py, "#FFE93D", 6, 80);
    }
    function firePlasma(t, target) {
      const def = TOWERS.plasma;
      t.lastFireAt = state.clock;
      const lv = def.levels[t.level];
      const c = towerCenter(t);
      const p = map.posAt(target.path, target.dist);
      state.projectiles.push({
        id: uid++,
        kind: "plasma",
        fromX: c.x,
        fromY: c.y,
        x: c.x,
        y: c.y,
        tx: p.x,
        ty: p.y,
        t: 0,
        dur: 0.45,
        damage: lv.damage,
        splash: def.splash[t.level] * splashMul(),
        stun: 0,
        towerId: t.id,
        dps: def.dot[t.level],
        zoneR: def.zoneR[t.level]
      });
      pushEvent({ type: "sfx", name: "plasma" });
    }
    function fireFrost(t, target) {
      const def = TOWERS.frost;
      t.lastFireAt = state.clock;
      const lv = def.levels[t.level];
      const c = towerCenter(t);
      const p = map.posAt(target.path, target.dist);
      addBeam(c.x, c.y, p.x, p.y, "#3DF08C66", 1.5, 0.15);
      const pct = def.slowPct[t.level];
      const dur = def.slowDur[t.level];
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const ep = map.posAt(e.path, e.dist);
        if (Math.hypot(ep.x - p.x, ep.y - p.y) > CELL) continue;
        let factor = pct + 0.06 * techCount("slow");
        if (factor > 0.8) factor = 0.8;
        if (e.isBoss) factor *= 0.5;
        if (e.type === "speeder") factor = Math.min(0.8, factor * 1.2);
        e.slowPct = Math.max(e.slowPct, factor);
        e.slowUntil = state.clock + dur;
        applyDamage(e, lv.damage, "frost", t);
      }
      addExplosion(p.x, p.y, "#3DF08C", 8, 70);
    }
    function updateRailgun(t, dt) {
      const def = TOWERS.railgun;
      const lv = def.levels[t.level];
      const c = towerCenter(t);
      if (t.charging) {
        const target2 = pickTarget(t, true);
        if (target2) {
          const p2 = map.posAt(target2.path, target2.dist);
          t.aimX = p2.x;
          t.aimY = p2.y;
        }
        t.chargeT -= dt;
        if (t.chargeT <= 0) {
          t.charging = false;
          t.cooldown = 1 / lv.rate / rateMul();
          t.lastFireAt = state.clock;
          const dx = t.aimX - c.x;
          const dy = t.aimY - c.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const reach = lv.range * CELL * rangeMul();
          const ex = c.x + ux * reach;
          const ey = c.y + uy * reach;
          addBeam(c.x, c.y, ex, ey, "#8B5CF6", 6, 0.18);
          state.shake = Math.max(state.shake, 0.4);
          pushEvent({ type: "sfx", name: "railgun" });
          const hits = state.enemies.filter((e) => {
            if (e.hp <= 0) return false;
            const p2 = map.posAt(e.path, e.dist);
            const proj = (p2.x - c.x) * ux + (p2.y - c.y) * uy;
            if (proj < 0 || proj > reach) return false;
            const perp = Math.abs((p2.x - c.x) * uy - (p2.y - c.y) * ux);
            return perp <= CELL * 0.5;
          }).sort((a, b) => a.dist - b.dist);
          hits.forEach((e, i) => {
            const decay = t.level === 2 ? 1 : Math.pow(def.pierceDecay, i);
            applyDamage(e, lv.damage * decay, "railgun", t);
            if (t.level === 2 && e.hp > 0) e.vulnUntil = state.clock + 3;
          });
        }
        return;
      }
      if (t.cooldown > 0) return;
      const target = pickTarget(t, true);
      if (!target) return;
      const p = map.posAt(target.path, target.dist);
      t.aimX = p.x;
      t.aimY = p.y;
      t.charging = true;
      t.chargeT = def.charge;
    }
    function updateTower(t, dt) {
      if (t.type === "railgun") {
        updateRailgun(t, dt);
        return;
      }
      t.cooldown -= dt;
      if (t.cooldown > 0) return;
      const target = pickTarget(t, false);
      if (!target) return;
      const lv = TOWERS[t.type].levels[t.level];
      t.cooldown = 1 / lv.rate / rateMul();
      const p = map.posAt(target.path, target.dist);
      t.aimX = p.x;
      t.aimY = p.y;
      if (t.type === "laser") fireLaser(t, target);
      else if (t.type === "missile") fireMissile(t, target);
      else if (t.type === "tesla") fireTesla(t, target);
      else if (t.type === "plasma") firePlasma(t, target);
      else fireFrost(t, target);
    }
    function startWave() {
      state.phase = "combat";
      state.spawnQueue = buildSpawnQueue(state.wave);
      state.spawnT = 0;
      pushEvent({ type: "waveStart", wave: state.wave });
      const def = level.waves[state.wave - 1];
      if (def?.comm) pushEvent({ type: "comm", wave: state.wave, text: def.comm });
    }
    function clearWave() {
      const def = level.waves[state.wave - 1];
      if (state.golds) {
        const half = Math.round(def.bonus / 2);
        state.golds[0] += half;
        state.golds[1] += def.bonus - half;
        state.gold = state.golds[0];
      } else {
        state.gold += def.bonus;
      }
      state.goldEarned += def.bonus;
      addFloater(270, 120, `\u6CE2\u6B21\u5956\u52B1 +${def.bonus}`, "#FFC94D");
      pushEvent({ type: "waveClear", wave: state.wave, bonus: def.bonus });
      if (state.wave >= state.totalWaves) {
        state.phase = "won";
        state.techChoices = null;
        pushEvent({ type: "gameOver", won: true });
      } else {
        state.wave += 1;
        state.phase = "tech";
        state.techChoices = rollTechChoices();
      }
    }
    function tick(dtReal) {
      if (state.paused || state.phase === "tech" || state.phase === "won" || state.phase === "lost") {
        notify();
        return;
      }
      const dt = dtReal * state.speed;
      state.clock += dt;
      state.timeSec += dt;
      state.shake = Math.max(0, state.shake - dtReal * 2.2);
      if (state.phase === "prep") {
        state.prepT -= dt;
        if (state.prepT <= 0) startWave();
      }
      if (state.phase === "combat") {
        if (state.spawnQueue.length > 0) {
          state.spawnT -= dt;
          while (state.spawnT <= 0 && state.spawnQueue.length > 0) {
            const item = state.spawnQueue.shift();
            spawnEnemy(item);
            state.spawnT += item.interval;
          }
        }
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          if (e.type === "lurker") e.stealthT += dt;
          if (state.clock < e.stunUntil) continue;
          const slowed = state.clock < e.slowUntil;
          const factor = slowed ? 1 - e.slowPct : 1;
          e.dist += e.speed * factor * CELL * dt;
          if (e.dist >= map.paths[e.path].length) {
            e.hp = 0;
            state.lives -= e.leak;
            state.leaked += 1;
            state.shake = Math.max(state.shake, 0.5);
            const exit = map.exitOfPath[e.path];
            addFloater(exit.centerX, exit.centerY - 50, `-${e.leak} \u751F\u547D`, "#FF5A5A");
            addRing(exit.centerX, exit.centerY, "#FF5A5A", 8, 70, 0.6);
            pushEvent({ type: "leak", lives: state.lives });
          }
        }
        state.enemies = state.enemies.filter((e) => e.hp > 0);
        if (state.lives <= 0) {
          state.lives = 0;
          state.phase = "lost";
          addExplosion(270, 930, "#FF5A5A", 30, 260);
          pushEvent({ type: "gameOver", won: false });
        }
        for (const t of state.towers) updateTower(t, dt);
        state.enemies = state.enemies.filter((e) => e.hp > 0);
        for (const pr of state.projectiles) {
          pr.t += dt / pr.dur;
          if (pr.t >= 1) {
            pr.x = pr.tx;
            pr.y = pr.ty;
            const tower = state.towers.find((tw) => tw.id === pr.towerId);
            if (pr.kind === "plasma") {
              addExplosion(pr.tx, pr.ty, "#FF6B3D", 14, 130);
              addRing(pr.tx, pr.ty, "#FF6B3D", 8, Math.max(30, pr.splash * CELL * 0.9), 0.5);
              for (const e of state.enemies) {
                if (e.hp <= 0) continue;
                const p = map.posAt(e.path, e.dist);
                if (Math.hypot(p.x - pr.tx, p.y - pr.ty) <= pr.splash * CELL) {
                  applyDamage(e, pr.damage, "plasma", tower);
                }
              }
              state.zones.push({
                id: uid++,
                x: pr.tx,
                y: pr.ty,
                r: (pr.zoneR ?? 1) * CELL,
                dps: pr.dps ?? 0,
                ttl: TOWERS.plasma.zoneDur ?? 2.5,
                maxTtl: TOWERS.plasma.zoneDur ?? 2.5,
                towerId: pr.towerId
              });
            } else {
              addExplosion(pr.tx, pr.ty, "#FF9F43", 16, 150);
              addRing(pr.tx, pr.ty, "#FF9F43", 6, Math.max(26, pr.splash * CELL * 0.9), 0.45);
              for (const e of state.enemies) {
                if (e.hp <= 0) continue;
                const p = map.posAt(e.path, e.dist);
                if (Math.hypot(p.x - pr.tx, p.y - pr.ty) <= pr.splash * CELL) {
                  if (pr.stun > 0 && !e.isBoss) e.stunUntil = state.clock + pr.stun;
                  applyDamage(e, pr.damage, "missile", tower);
                }
              }
            }
          } else {
            const arcH = pr.kind === "plasma" ? 52 : 40;
            pr.x = pr.fromX + (pr.tx - pr.fromX) * pr.t;
            pr.y = pr.fromY + (pr.ty - pr.fromY) * pr.t - Math.sin(pr.t * Math.PI) * arcH;
            const trailN = pr.kind === "plasma" ? 2 : 1;
            for (let i = 0; i < trailN; i++) {
              if (Math.random() > particleScale) continue;
              const ttl = 0.22 + Math.random() * 0.14;
              state.particles.push({
                id: uid++,
                x: pr.x + (Math.random() - 0.5) * 4,
                y: pr.y + (Math.random() - 0.5) * 4,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.5) * 16,
                ttl,
                maxTtl: ttl,
                color: pr.kind === "plasma" ? "#FF6B3D" : "#FF9F43",
                size: 1.5 + Math.random() * 1.5
              });
            }
          }
        }
        state.projectiles = state.projectiles.filter((pr) => pr.t < 1);
        for (const z of state.zones) {
          const tower = state.towers.find((tw) => tw.id === z.towerId);
          for (const e of state.enemies) {
            if (e.hp <= 0) continue;
            const p = map.posAt(e.path, e.dist);
            if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) {
              applyDamage(e, z.dps * dt, "plasma", tower);
            }
          }
        }
        state.enemies = state.enemies.filter((e) => e.hp > 0);
        if (state.phase === "combat" && state.spawnQueue.length === 0 && state.enemies.length === 0) {
          clearWave();
        }
      }
      for (const z of state.zones) z.ttl -= dt;
      state.zones = state.zones.filter((z) => z.ttl > 0);
      for (const b of state.beams) b.ttl -= dt;
      state.beams = state.beams.filter((b) => b.ttl > 0);
      for (const r of state.rings) r.ttl -= dt;
      state.rings = state.rings.filter((r) => r.ttl > 0);
      for (const pt of state.particles) {
        pt.ttl -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
      }
      state.particles = state.particles.filter((pt) => pt.ttl > 0);
      for (const f of state.floaters) {
        f.ttl -= dt;
        f.y -= 44 * dt;
      }
      state.floaters = state.floaters.filter((f) => f.ttl > 0);
      notify();
    }
    function dispatchAs(player, cmd) {
      if (state.phase === "tech") {
        if (cmd.type !== "PICK_TECH") return false;
        if (state.coop && player !== 0) return false;
        if (!state.techChoices?.includes(cmd.id)) return false;
        state.techs.push(cmd.id);
        state.techChoices = null;
        if (cmd.id === "supply") {
          addGold(0, 200);
          state.goldEarned += 200;
          addFloater(270, 120, "\u540E\u52E4\u7A7A\u6295 +200", "#FFC94D");
        }
        if (cmd.id === "repair") {
          state.lives = Math.min(state.maxLives, state.lives + 3);
          addFloater(270, 120, "\u57FA\u5730\u4FEE\u590D +3", "#3DF08C");
        }
        state.phase = "prep";
        state.prepT = PREP_TIME;
        notify();
        return true;
      }
      if (cmd.type === "TOGGLE_PAUSE") {
        if (state.phase === "won" || state.phase === "lost") return false;
        state.paused = !state.paused;
        notify();
        return true;
      }
      if (cmd.type === "SET_SPEED") {
        state.speed = cmd.speed;
        notify();
        return true;
      }
      if (cmd.type === "SKIP_PREP") {
        if (state.phase !== "prep") return false;
        state.prepT = 0;
        notify();
        return true;
      }
      if (state.phase === "won" || state.phase === "lost") return false;
      if (cmd.type === "BUILD") {
        const def = TOWERS[cmd.tower];
        const cost = def.levels[0].cost;
        if (!map.isBuildable(cmd.col, cmd.row)) return false;
        if (state.towers.some((t) => t.col === cmd.col && t.row === cmd.row)) return false;
        if (goldOf(player) < cost) return false;
        setGold(player, goldOf(player) - cost);
        const c = { x: (cmd.col + 0.5) * CELL, y: (cmd.row + 0.5) * CELL };
        state.towers.push({
          id: uid++,
          type: cmd.tower,
          level: 0,
          col: cmd.col,
          row: cmd.row,
          cooldown: 0,
          charging: false,
          chargeT: 0,
          aimX: c.x,
          aimY: c.y - 60,
          lastFireAt: -999,
          kills: 0,
          invested: cost,
          owner: player
        });
        if (!state.towerTypesBuilt.includes(cmd.tower)) state.towerTypesBuilt.push(cmd.tower);
        if (cmd.tower === "frost") state.usedFrost = true;
        addExplosion(c.x, c.y, def.color, 10, 90);
        notify();
        return true;
      }
      if (cmd.type === "UPGRADE") {
        const t = state.towers.find((tw) => tw.id === cmd.id);
        if (!t || t.level >= 2) return false;
        if (state.coop && t.owner !== player) return false;
        const cost = TOWERS[t.type].levels[t.level + 1].cost;
        if (goldOf(player) < cost) return false;
        setGold(player, goldOf(player) - cost);
        t.level += 1;
        t.invested += cost;
        state.maxTowerLevel = Math.max(state.maxTowerLevel, t.level + 1);
        const c = towerCenter(t);
        addExplosion(c.x, c.y, TOWERS[t.type].color, 14, 110);
        addFloater(c.x, c.y - 30, "LEVEL UP", "#3DF08C");
        notify();
        return true;
      }
      if (cmd.type === "SELL") {
        const i = state.towers.findIndex((tw) => tw.id === cmd.id);
        if (i < 0) return false;
        const t = state.towers[i];
        if (state.coop && t.owner !== player) return false;
        const refund = Math.floor(t.invested * SELL_RATE);
        addGold(player, refund);
        const c = towerCenter(t);
        addFloater(c.x, c.y - 20, `+${refund}`, "#FFC94D");
        addExplosion(c.x, c.y, "#7C8DB0", 8, 80);
        state.towers.splice(i, 1);
        notify();
        return true;
      }
      return false;
    }
    function dispatch(cmd) {
      return dispatchAs(0, cmd);
    }
    function serializeNet() {
      const { particles, beams, rings, floaters, ...rest } = state;
      return rest;
    }
    return {
      state,
      difficulty,
      map,
      level,
      tick,
      dispatch,
      dispatchAs,
      serializeNet,
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      drainEvents() {
        const ev = state.events.slice();
        state.events.length = 0;
        return ev;
      }
    };
  }

  // src/game/render.ts
  function hexPath(ctx2, r) {
    ctx2.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx2.moveTo(x, y);
      else ctx2.lineTo(x, y);
    }
    ctx2.closePath();
  }
  function mixColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (sh) => {
      const va = pa >> sh & 255;
      return Math.round(va + ((pb >> sh & 255) - va) * t);
    };
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  var tint = (hex, f) => mixColor(hex, "#EAF6FF", f);
  var tone = (hex, f) => mixColor(hex, "#05070F", f);
  var INK = "#04060D";
  function drawTower(ctx2, type, level, size, aimAngle, charge2, time, opts = {}) {
    const def = TOWERS[type];
    const r = size / 2;
    const lite = tint(def.color, 0.45);
    ctx2.save();
    ctx2.globalAlpha = 0.32;
    ctx2.fillStyle = "#000000";
    ctx2.beginPath();
    ctx2.ellipse(0, r * 0.5, r * 0.76, r * 0.4, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
    if (opts.ticks !== false) {
      ctx2.save();
      ctx2.rotate(time * 0.4);
      ctx2.strokeStyle = def.color;
      ctx2.globalAlpha = 0.3;
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = Math.PI * 2 * i / 24;
        const inner = r * 0.9 - (i % 6 === 0 ? 4 : 2);
        ctx2.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx2.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      }
      ctx2.stroke();
      ctx2.restore();
    }
    if (level >= 2) {
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.87, 0, Math.PI * 2);
      ctx2.strokeStyle = "rgba(255,201,77,0.45)";
      ctx2.lineWidth = 1.5;
      ctx2.setLineDash([10, 8]);
      ctx2.lineDashOffset = -time * 14;
      ctx2.stroke();
      ctx2.setLineDash([]);
    }
    const baseG = ctx2.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.85);
    baseG.addColorStop(0, "#2E3D63");
    baseG.addColorStop(0.65, "#16203A");
    baseG.addColorStop(1, "#0A0F20");
    hexPath(ctx2, r * 0.82);
    ctx2.fillStyle = baseG;
    ctx2.fill();
    ctx2.strokeStyle = def.color;
    ctx2.globalAlpha = 0.9;
    ctx2.lineWidth = 1.5;
    ctx2.stroke();
    ctx2.globalAlpha = 1;
    ctx2.save();
    hexPath(ctx2, r * 0.82);
    ctx2.clip();
    const sheen = ctx2.createLinearGradient(0, -r * 0.82, 0, r * 0.35);
    sheen.addColorStop(0, "rgba(255,255,255,0.13)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx2.fillStyle = sheen;
    ctx2.fillRect(-r, -r, r * 2, r * 2);
    ctx2.restore();
    hexPath(ctx2, r * 0.66);
    ctx2.strokeStyle = "rgba(124,141,176,0.35)";
    ctx2.lineWidth = 1;
    ctx2.stroke();
    if (level >= 1) {
      ctx2.fillStyle = "#22304F";
      ctx2.strokeStyle = "rgba(124,141,176,0.55)";
      ctx2.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx2.save();
        ctx2.rotate(Math.PI * 2 * i / 3 + Math.PI / 6);
        ctx2.beginPath();
        ctx2.moveTo(-r * 0.16, -r * 0.64);
        ctx2.lineTo(r * 0.16, -r * 0.64);
        ctx2.lineTo(r * 0.2, -r * 0.5);
        ctx2.lineTo(-r * 0.2, -r * 0.5);
        ctx2.closePath();
        ctx2.fill();
        ctx2.stroke();
        ctx2.restore();
      }
    }
    if (type === "frost") {
      for (const [dir, rr2, alpha] of [[1, 0.55, 0.6], [-1, 0.42, 0.45]]) {
        ctx2.save();
        ctx2.rotate(dir * time * 0.9);
        ctx2.strokeStyle = def.color;
        ctx2.globalAlpha = alpha;
        ctx2.lineWidth = 1.5;
        ctx2.setLineDash([r * 0.22, r * 0.14]);
        ctx2.beginPath();
        ctx2.arc(0, 0, r * rr2, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.restore();
      }
      ctx2.save();
      ctx2.rotate(time * 0.3);
      ctx2.strokeStyle = "#BDF3FF";
      ctx2.lineWidth = 1.4;
      ctx2.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * i / 3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        ctx2.moveTo(0, 0);
        ctx2.lineTo(ca * r * 0.5, sa * r * 0.5);
        ctx2.moveTo(ca * r * 0.3, sa * r * 0.3);
        ctx2.lineTo(ca * r * 0.3 + Math.cos(a + 0.6) * r * 0.13, sa * r * 0.3 + Math.sin(a + 0.6) * r * 0.13);
        ctx2.moveTo(ca * r * 0.3, sa * r * 0.3);
        ctx2.lineTo(ca * r * 0.3 + Math.cos(a - 0.6) * r * 0.13, sa * r * 0.3 + Math.sin(a - 0.6) * r * 0.13);
      }
      ctx2.stroke();
      ctx2.restore();
      const bob = Math.sin(time * 2.5) * r * 0.06;
      const ig = ctx2.createRadialGradient(-r * 0.08, -r * 0.23 + bob, r * 0.02, 0, -r * 0.15 + bob, r * 0.3);
      ig.addColorStop(0, "#FFFFFF");
      ig.addColorStop(0.45, "#BDF3FF");
      ig.addColorStop(1, "#4FB8D8");
      ctx2.beginPath();
      ctx2.arc(0, -r * 0.15 + bob, r * 0.28, 0, Math.PI * 2);
      ctx2.fillStyle = ig;
      ctx2.fill();
    } else if (type === "tesla") {
      ctx2.fillStyle = "#22304F";
      ctx2.fillRect(-r * 0.08, -r * 0.48, r * 0.16, r * 0.6);
      for (let i = 0; i < 3; i++) {
        ctx2.beginPath();
        ctx2.ellipse(0, -r * 0.4 + i * r * 0.16, r * 0.16, r * 0.05, 0, 0, Math.PI * 2);
        ctx2.strokeStyle = "rgba(255,233,61,0.75)";
        ctx2.lineWidth = 1.6;
        ctx2.stroke();
      }
      const tg = ctx2.createRadialGradient(-r * 0.05, -r * 0.58, r * 0.02, 0, -r * 0.52, r * 0.2);
      tg.addColorStop(0, "#FFFFFF");
      tg.addColorStop(0.5, "#FFE93D");
      tg.addColorStop(1, "#B8860B");
      ctx2.beginPath();
      ctx2.arc(0, -r * 0.52, r * 0.17 + Math.sin(time * 3) * r * 0.012, 0, Math.PI * 2);
      ctx2.fillStyle = tg;
      ctx2.fill();
      const arcCount = 1 + level;
      for (let i = 0; i < arcCount; i++) {
        const ph = time * (2.2 + level * 0.9) + i * 2.39;
        if (Math.sin(ph) <= 0.55) continue;
        const dirA = i * 2.1 + Math.sin(ph * 0.7) * 0.9;
        const ex = Math.cos(dirA) * r * 0.56;
        const ey = -r * 0.52 + Math.sin(dirA) * r * 0.42;
        ctx2.beginPath();
        ctx2.moveTo(0, -r * 0.52);
        for (let k = 1; k <= 2; k++) {
          const f = k / 3;
          ctx2.lineTo(
            ex * f + Math.sin(ph * 9 + k * 4.3) * r * 0.08,
            -r * 0.52 + (ey + r * 0.52) * f + Math.cos(ph * 7 + k * 3.1) * r * 0.08
          );
        }
        ctx2.lineTo(ex, ey);
        ctx2.strokeStyle = "#FFF7AE";
        ctx2.globalAlpha = 0.85;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.globalAlpha = 1;
      }
    } else {
      ctx2.save();
      ctx2.rotate(aimAngle);
      if (type === "laser") {
        const armG = ctx2.createLinearGradient(-r * 0.08, 0, r * 0.08, 0);
        armG.addColorStop(0, "#16203A");
        armG.addColorStop(0.5, "#2E3D63");
        armG.addColorStop(1, "#10182E");
        ctx2.fillStyle = armG;
        ctx2.fillRect(-r * 0.07, -r * 0.5, r * 0.14, r * 0.6);
        const py = -r * 0.58 + Math.sin(time * 2.2) * r * 0.04;
        ctx2.save();
        ctx2.translate(0, py);
        ctx2.save();
        ctx2.rotate(time * 1.8);
        ctx2.strokeStyle = def.color;
        ctx2.globalAlpha = 0.75;
        ctx2.lineWidth = 1.2;
        ctx2.setLineDash([3, 4]);
        ctx2.beginPath();
        ctx2.arc(0, 0, r * 0.27, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.restore();
        const prisms = level >= 2 ? 3 : 1;
        for (let i = 0; i < prisms; i++) {
          const a = prisms === 1 ? 0 : Math.PI * 2 * i / 3 + time * 0.9;
          const ox = prisms === 1 ? 0 : Math.cos(a) * r * 0.13;
          const oy = prisms === 1 ? 0 : Math.sin(a) * r * 0.13;
          const s = prisms === 1 ? r * 0.19 : r * 0.12;
          const pg = ctx2.createLinearGradient(ox, oy - s, ox, oy + s);
          pg.addColorStop(0, "#FFFFFF");
          pg.addColorStop(0.45, lite);
          pg.addColorStop(1, tone(def.color, 0.45));
          ctx2.beginPath();
          ctx2.moveTo(ox, oy - s);
          ctx2.lineTo(ox + s * 0.7, oy);
          ctx2.lineTo(ox, oy + s);
          ctx2.lineTo(ox - s * 0.7, oy);
          ctx2.closePath();
          ctx2.fillStyle = pg;
          ctx2.fill();
          ctx2.strokeStyle = "rgba(255,255,255,0.55)";
          ctx2.lineWidth = 0.8;
          ctx2.beginPath();
          ctx2.moveTo(ox, oy - s);
          ctx2.lineTo(ox, oy + s);
          ctx2.moveTo(ox - s * 0.7, oy);
          ctx2.lineTo(ox + s * 0.7, oy);
          ctx2.stroke();
        }
        ctx2.restore();
      } else if (type === "missile") {
        const pods = level >= 2 ? [[-r * 0.26, -r * 0.28], [r * 0.26, -r * 0.28], [-r * 0.26, r * 0.14], [r * 0.26, r * 0.14]] : [[-r * 0.26, -r * 0.08], [r * 0.26, -r * 0.08]];
        for (const [ox, oy] of pods) {
          ctx2.fillStyle = "#22304F";
          ctx2.fillRect(ox - r * 0.13, oy - r * 0.24, r * 0.26, r * 0.42);
          ctx2.strokeStyle = "rgba(124,141,176,0.6)";
          ctx2.lineWidth = 1;
          ctx2.strokeRect(ox - r * 0.13, oy - r * 0.24, r * 0.26, r * 0.42);
          ctx2.fillStyle = "#C7D2E8";
          ctx2.beginPath();
          ctx2.moveTo(ox - r * 0.08, oy - r * 0.12);
          ctx2.lineTo(ox, oy - r * 0.22);
          ctx2.lineTo(ox + r * 0.08, oy - r * 0.12);
          ctx2.closePath();
          ctx2.fill();
          ctx2.save();
          ctx2.translate(ox - r * 0.13, oy - r * 0.24);
          ctx2.rotate(-0.7 - 0.08 * Math.sin(time * 1.5));
          ctx2.fillStyle = "#2E3D63";
          ctx2.fillRect(0, -r * 0.02, r * 0.26, r * 0.04);
          ctx2.restore();
          const blink = Math.sin(time * 6 + ox * 7 + oy * 3) > 0 ? 1 : 0.25;
          ctx2.globalAlpha = blink;
          ctx2.fillStyle = "#FF5A5A";
          ctx2.beginPath();
          ctx2.arc(ox, oy + r * 0.1, r * 0.035, 0, Math.PI * 2);
          ctx2.fill();
          ctx2.globalAlpha = 1;
        }
      } else if (type === "plasma") {
        const pulse = 0.85 + 0.15 * Math.sin(time * 3.2);
        const pg = ctx2.createRadialGradient(0, 0, r * 0.04, 0, 0, r * 0.34);
        pg.addColorStop(0, "#FFF3D6");
        pg.addColorStop(0.35, "#FF6B3D");
        pg.addColorStop(1, "#7A1F0F");
        ctx2.beginPath();
        ctx2.arc(0, 0, r * 0.3 * pulse, 0, Math.PI * 2);
        ctx2.fillStyle = pg;
        ctx2.fill();
        ctx2.beginPath();
        ctx2.arc(0, 0, r * 0.36, 0, Math.PI * 2);
        ctx2.strokeStyle = "#2E3D63";
        ctx2.lineWidth = 2.5;
        ctx2.stroke();
        ctx2.fillStyle = "rgba(255,243,214,0.7)";
        for (let i = 0; i < 3; i++) {
          const a = time * 1.4 + i * 2.1;
          ctx2.beginPath();
          ctx2.arc(Math.cos(a) * r * 0.13, Math.sin(a * 1.3) * r * 0.13, r * 0.045, 0, Math.PI * 2);
          ctx2.fill();
        }
        ctx2.fillStyle = "#22304F";
        ctx2.fillRect(-r * 0.16, -r * 0.74, r * 0.32, r * 0.36);
        ctx2.strokeStyle = "rgba(124,141,176,0.6)";
        ctx2.lineWidth = 1;
        ctx2.strokeRect(-r * 0.16, -r * 0.74, r * 0.32, r * 0.36);
        ctx2.fillStyle = def.color;
        ctx2.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4);
        ctx2.fillRect(-r * 0.1, -r * 0.76, r * 0.2, r * 0.06);
        ctx2.globalAlpha = 1;
      } else {
        ctx2.fillStyle = "#22304F";
        ctx2.fillRect(-r * 0.24, -r * 0.78, r * 0.14, r * 1.05);
        ctx2.fillRect(r * 0.1, -r * 0.78, r * 0.14, r * 1.05);
        ctx2.fillStyle = "rgba(139,92,246,0.25)";
        ctx2.fillRect(-r * 0.17, -r * 0.78, r * 0.07, r * 1.05);
        ctx2.fillRect(r * 0.1, -r * 0.78, r * 0.07, r * 1.05);
        const coils = 5;
        for (let i = 0; i < coils; i++) {
          const cy = r * 0.12 - i * r * 0.17;
          const lit = charge2 >= (i + 1) / coils - 1e-3;
          ctx2.beginPath();
          ctx2.ellipse(0, cy, r * 0.27, r * 0.06, 0, 0, Math.PI * 2);
          ctx2.strokeStyle = lit ? "#C4B0FF" : "rgba(139,92,246,0.5)";
          ctx2.lineWidth = 2;
          ctx2.stroke();
        }
        if (charge2 > 0.25) {
          const arcs = charge2 > 0.7 ? 2 : 1;
          for (let i = 0; i < arcs; i++) {
            const seed = time * 31 + i * 17;
            const y0 = -r * (0.15 + 0.5 * ((Math.sin(seed) + 1) / 2));
            ctx2.beginPath();
            ctx2.moveTo(-r * 0.17, y0);
            for (let k = 1; k <= 3; k++) {
              ctx2.lineTo(-r * 0.17 + r * 0.34 * k / 3, y0 + Math.sin(seed + k * 5.7) * r * 0.08);
            }
            ctx2.strokeStyle = "#D8CCFF";
            ctx2.globalAlpha = 0.5 + charge2 * 0.5;
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
          }
        }
        const glow = charge2 > 0 ? 0.5 + 0.5 * Math.sin(time * 20) : 0.6;
        ctx2.fillStyle = def.color;
        ctx2.globalAlpha = glow;
        ctx2.fillRect(-r * 0.22, -r * 0.8, r * 0.35, r * 0.1);
        ctx2.globalAlpha = 1;
      }
      ctx2.restore();
    }
    if (type !== "tesla" && type !== "plasma") {
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.13, 0, Math.PI * 2);
      ctx2.fillStyle = def.color;
      ctx2.fill();
    }
    for (let i = 0; i <= level; i++) {
      ctx2.beginPath();
      ctx2.arc(-r * 0.4 + i * r * 0.4, r * 0.62, 2.5, 0, Math.PI * 2);
      ctx2.fillStyle = level >= 2 ? "#FFC94D" : def.color;
      ctx2.fill();
    }
  }
  function drawEnemy(ctx2, type, size, time, opts = {}) {
    const def = ENEMIES[type];
    const r = size;
    const alpha = opts.alpha ?? 1;
    ctx2.save();
    ctx2.globalAlpha = alpha;
    const body = opts.enraged ? "#FF3D81" : def.color;
    const dark = tone(body, 0.55);
    const deep = tone(body, 0.78);
    const lite = tint(body, 0.5);
    const glow = opts.enraged ? "#FF9F43" : "#B8FF3D";
    if (type === "crawler") {
      const ph = time * 9;
      ctx2.strokeStyle = deep;
      ctx2.lineCap = "round";
      ctx2.lineWidth = Math.max(1.4, r * 0.13);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const hx = r * (0.42 - i * 0.4);
          const sw = Math.sin(ph + i * 1.9 + (side > 0 ? Math.PI : 0)) * r * 0.18;
          ctx2.beginPath();
          ctx2.moveTo(hx, side * r * 0.3);
          ctx2.lineTo(hx + sw * 0.35, side * r * 0.78);
          ctx2.lineTo(hx - r * 0.12 + sw, side * r * 1.06);
          ctx2.stroke();
        }
      }
      const ag = ctx2.createRadialGradient(-r * 0.45, -r * 0.3, r * 0.08, -r * 0.28, 0, r * 0.9);
      ag.addColorStop(0, lite);
      ag.addColorStop(0.45, body);
      ag.addColorStop(1, deep);
      ctx2.beginPath();
      ctx2.ellipse(-r * 0.28, 0, r * 0.72, r * 0.56, 0, 0, Math.PI * 2);
      ctx2.fillStyle = ag;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.3;
      ctx2.stroke();
      ctx2.strokeStyle = dark;
      ctx2.lineWidth = 1.1;
      for (let i = 0; i < 3; i++) {
        const sx = -r * (0.18 + i * 0.27);
        const half = r * (0.48 - i * 0.05);
        ctx2.beginPath();
        ctx2.moveTo(sx, -half);
        ctx2.quadraticCurveTo(sx - r * 0.14, 0, sx, half);
        ctx2.stroke();
      }
      const hg = ctx2.createRadialGradient(r * 0.45, -r * 0.18, r * 0.04, r * 0.55, 0, r * 0.44);
      hg.addColorStop(0, lite);
      hg.addColorStop(1, dark);
      ctx2.beginPath();
      ctx2.ellipse(r * 0.55, 0, r * 0.4, r * 0.33, 0, 0, Math.PI * 2);
      ctx2.fillStyle = hg;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.3;
      ctx2.stroke();
      const mand = (0.5 + 0.5 * Math.sin(ph * 1.4)) * r * 0.14;
      ctx2.strokeStyle = deep;
      ctx2.lineWidth = Math.max(1.4, r * 0.09);
      for (const side of [-1, 1]) {
        ctx2.beginPath();
        ctx2.moveTo(r * 0.82, side * r * 0.14);
        ctx2.quadraticCurveTo(r * 1.12, side * (r * 0.3 + mand), r * 1.18, side * (r * 0.08 + mand * 0.5));
        ctx2.stroke();
      }
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.arc(r * 0.62, -r * 0.15, r * 0.09, 0, Math.PI * 2);
      ctx2.arc(r * 0.62, r * 0.15, r * 0.09, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.globalAlpha = alpha * 0.75;
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.ellipse(-r * 0.28, 0, r * 0.42, r * 0.07, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.globalAlpha = alpha;
    } else if (type === "speeder") {
      const ph = time * 13;
      const bob = Math.abs(Math.sin(ph)) * -r * 0.05;
      ctx2.strokeStyle = body;
      ctx2.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const yy = (-0.28 + i * 0.56) * r;
        ctx2.globalAlpha = alpha * (0.18 - i * 0.06);
        ctx2.lineWidth = r * 0.09;
        ctx2.beginPath();
        ctx2.moveTo(-r * 0.85, yy);
        ctx2.lineTo(-r * (1.5 + i * 0.35), yy);
        ctx2.stroke();
      }
      ctx2.globalAlpha = alpha;
      ctx2.strokeStyle = deep;
      ctx2.lineWidth = Math.max(1.3, r * 0.12);
      const legs = [
        [0.42, -1, 0],
        [0.42, 1, 0.6],
        [-0.38, -1, Math.PI],
        [-0.38, 1, Math.PI + 0.6]
      ];
      for (const [hx, side, off] of legs) {
        const sw = Math.sin(ph + off) * r * 0.4;
        const lift = Math.max(0, Math.cos(ph + off)) * r * 0.22;
        const hipX = hx * r;
        const hipY = side * r * 0.14 + bob;
        ctx2.beginPath();
        ctx2.moveTo(hipX, hipY);
        ctx2.lineTo(hipX + sw * 0.3, side * r * 0.42 + bob);
        ctx2.lineTo(hipX + sw, side * r * 0.64 - lift);
        ctx2.stroke();
      }
      const tailTipY = bob + Math.sin(ph * 0.9 - 0.8) * r * 0.38;
      ctx2.strokeStyle = dark;
      ctx2.lineWidth = r * 0.1;
      ctx2.beginPath();
      ctx2.moveTo(-r * 0.85, bob);
      ctx2.quadraticCurveTo(-r * 1.25, bob + Math.sin(ph * 0.9) * r * 0.28, -r * 1.5, tailTipY);
      ctx2.stroke();
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.arc(-r * 1.5, tailTipY, r * 0.07, 0, Math.PI * 2);
      ctx2.fill();
      const bg = ctx2.createLinearGradient(0, bob - r * 0.3, 0, bob + r * 0.3);
      bg.addColorStop(0, lite);
      bg.addColorStop(0.5, body);
      bg.addColorStop(1, deep);
      ctx2.beginPath();
      ctx2.ellipse(-r * 0.05, bob, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
      ctx2.fillStyle = bg;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.fillStyle = dark;
      for (let i = 0; i < 3; i++) {
        const bx = r * (0.32 - i * 0.36);
        ctx2.beginPath();
        ctx2.moveTo(bx - r * 0.1, bob - r * 0.24);
        ctx2.lineTo(bx + r * 0.05, bob - r * (0.52 - i * 0.09));
        ctx2.lineTo(bx + r * 0.18, bob - r * 0.2);
        ctx2.closePath();
        ctx2.fill();
      }
      const hg = ctx2.createRadialGradient(r * 0.78, bob - r * 0.08, r * 0.03, r * 0.85, bob, r * 0.32);
      hg.addColorStop(0, lite);
      hg.addColorStop(1, dark);
      ctx2.beginPath();
      ctx2.ellipse(r * 0.85, bob, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
      ctx2.fillStyle = hg;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.1;
      ctx2.stroke();
      ctx2.fillStyle = dark;
      ctx2.beginPath();
      ctx2.moveTo(r * 1.02, bob - r * 0.1);
      ctx2.lineTo(r * 1.32, bob);
      ctx2.lineTo(r * 1.02, bob + r * 0.1);
      ctx2.closePath();
      ctx2.fill();
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.arc(r * 0.9, bob - r * 0.06, r * 0.08, 0, Math.PI * 2);
      ctx2.fill();
    } else if (type === "tanker") {
      const ag = ctx2.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.15, 0, 0, r);
      ag.addColorStop(0, tint(body, 0.35));
      ag.addColorStop(0.55, dark);
      ag.addColorStop(1, deep);
      hexPath(ctx2, r * 0.95);
      ctx2.fillStyle = ag;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 3;
      ctx2.stroke();
      hexPath(ctx2, r * 0.9);
      ctx2.strokeStyle = body;
      ctx2.globalAlpha = alpha * 0.75;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.globalAlpha = alpha;
      hexPath(ctx2, r * 0.58);
      ctx2.strokeStyle = tone(body, 0.2);
      ctx2.lineWidth = 2;
      ctx2.stroke();
      ctx2.fillStyle = tint(body, 0.4);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 2 + Math.PI / 6;
        ctx2.beginPath();
        ctx2.arc(Math.cos(a) * r * 0.73, Math.sin(a) * r * 0.73, r * 0.06, 0, Math.PI * 2);
        ctx2.fill();
      }
      const hornG = ctx2.createLinearGradient(r * 0.5, 0, r * 1.28, 0);
      hornG.addColorStop(0, dark);
      hornG.addColorStop(1, lite);
      ctx2.beginPath();
      ctx2.moveTo(r * 0.55, -r * 0.27);
      ctx2.lineTo(r * 1.26, 0);
      ctx2.lineTo(r * 0.55, r * 0.27);
      ctx2.closePath();
      ctx2.fillStyle = hornG;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.ellipse(r * 0.3, -r * 0.36, r * 0.12, r * 0.05, 0.5, 0, Math.PI * 2);
      ctx2.ellipse(r * 0.3, r * 0.36, r * 0.12, r * 0.05, -0.5, 0, Math.PI * 2);
      ctx2.fill();
    } else if (type === "splitter") {
      const wig = time * 4;
      ctx2.beginPath();
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI * 2 * i / N;
        const rr2 = r * (0.86 + 0.11 * Math.sin(wig + i * 2.3) + 0.04 * Math.sin(wig * 1.7 + i * 4.1));
        const x = Math.cos(a) * rr2;
        const y = Math.sin(a) * rr2;
        if (i === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      }
      ctx2.closePath();
      const mg = ctx2.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.08, 0, 0, r);
      mg.addColorStop(0, tint(body, 0.55));
      mg.addColorStop(0.55, body);
      mg.addColorStop(1, dark);
      ctx2.fillStyle = mg;
      ctx2.fill();
      ctx2.strokeStyle = tint(body, 0.7);
      ctx2.globalAlpha = alpha * 0.8;
      ctx2.lineWidth = 1.4;
      ctx2.stroke();
      ctx2.globalAlpha = alpha;
      for (let k = 0; k < 2; k++) {
        const a = time * 1.6 + k * Math.PI;
        const nx = Math.cos(a) * r * 0.28;
        const ny = Math.sin(a * 1.3) * r * 0.26;
        const ng = ctx2.createRadialGradient(nx, ny, 0, nx, ny, r * 0.22);
        ng.addColorStop(0, "#FFFFFF");
        ng.addColorStop(0.4, tint(body, 0.4));
        ng.addColorStop(1, dark);
        ctx2.beginPath();
        ctx2.arc(nx, ny, r * 0.2, 0, Math.PI * 2);
        ctx2.fillStyle = ng;
        ctx2.fill();
      }
    } else if (type === "lurker") {
      const flap = Math.sin(time * 5) * 0.1;
      const wg = ctx2.createLinearGradient(0, -r, 0, r);
      wg.addColorStop(0, tint(body, 0.35));
      wg.addColorStop(0.5, body);
      wg.addColorStop(1, dark);
      ctx2.beginPath();
      ctx2.moveTo(r * 1.05, 0);
      ctx2.quadraticCurveTo(r * 0.4, -r * 0.3, -r * 0.1, -r * (0.8 + flap));
      ctx2.quadraticCurveTo(-r * 0.45, -r * 0.28, -r * 0.68, 0);
      ctx2.quadraticCurveTo(-r * 0.45, r * 0.28, -r * 0.1, r * (0.8 + flap));
      ctx2.quadraticCurveTo(r * 0.4, r * 0.3, r * 1.05, 0);
      ctx2.closePath();
      ctx2.fillStyle = wg;
      ctx2.fill();
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.strokeStyle = dark;
      ctx2.lineWidth = 2;
      ctx2.lineCap = "round";
      ctx2.beginPath();
      ctx2.moveTo(-r * 0.64, 0);
      ctx2.quadraticCurveTo(-r * 1.05, Math.sin(time * 3) * r * 0.16, -r * 1.24, 0);
      ctx2.stroke();
      ctx2.fillStyle = glow;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const f = 0.32 + i * 0.24;
          const bx = r * (1 - f * 1.1);
          const by = side * r * f * (0.72 + flap);
          ctx2.globalAlpha = alpha * (0.35 + 0.65 * Math.abs(Math.sin(time * 3 + i * 2 + side)));
          ctx2.beginPath();
          ctx2.arc(bx, by, r * 0.05, 0, Math.PI * 2);
          ctx2.fill();
        }
      }
      ctx2.globalAlpha = alpha;
      ctx2.fillStyle = "#F2FFDB";
      ctx2.beginPath();
      ctx2.ellipse(r * 0.42, 0, r * 0.14, r * 0.06, 0, 0, Math.PI * 2);
      ctx2.fill();
    } else {
      const pulse = 0.7 + 0.3 * Math.sin(time * 4);
      ctx2.fillStyle = deep;
      ctx2.strokeStyle = INK;
      ctx2.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 2 * i / 8 + Math.PI / 8;
        const len = r * (1.2 + 0.1 * Math.sin(time * 3 + i * 1.7));
        ctx2.beginPath();
        ctx2.moveTo(Math.cos(a - 0.15) * r * 0.78, Math.sin(a - 0.15) * r * 0.78);
        ctx2.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx2.lineTo(Math.cos(a + 0.15) * r * 0.78, Math.sin(a + 0.15) * r * 0.78);
        ctx2.closePath();
        ctx2.fill();
        ctx2.stroke();
      }
      const sg = ctx2.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
      sg.addColorStop(0, tint(body, 0.3));
      sg.addColorStop(0.55, dark);
      sg.addColorStop(1, deep);
      hexPath(ctx2, r * 0.92);
      ctx2.fillStyle = sg;
      ctx2.fill();
      ctx2.strokeStyle = body;
      ctx2.lineWidth = 3.5;
      ctx2.stroke();
      hexPath(ctx2, r * 0.62);
      ctx2.strokeStyle = tone(body, 0.2);
      ctx2.lineWidth = 2;
      ctx2.stroke();
      ctx2.save();
      ctx2.rotate(time * 1.1);
      ctx2.strokeStyle = glow;
      ctx2.globalAlpha = alpha * 0.65;
      ctx2.lineWidth = 2;
      ctx2.setLineDash([r * 0.28, r * 0.2]);
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.44, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.restore();
      ctx2.globalAlpha = alpha;
      const cg = ctx2.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
      cg.addColorStop(0, "#FFFFFF");
      cg.addColorStop(0.5, glow);
      cg.addColorStop(1, tone(glow, 0.6));
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.28 * pulse, 0, Math.PI * 2);
      ctx2.fillStyle = cg;
      ctx2.fill();
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.arc(r * 0.6, 0, r * 0.07, 0, Math.PI * 2);
      ctx2.arc(r * 0.45, -r * 0.3, r * 0.055, 0, Math.PI * 2);
      ctx2.arc(r * 0.45, r * 0.3, r * 0.055, 0, Math.PI * 2);
      ctx2.fill();
    }
    if (opts.burning) {
      ctx2.globalAlpha = alpha * 0.4;
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx2.strokeStyle = "#FF6B3D";
      ctx2.lineWidth = 2;
      ctx2.stroke();
    }
    if (opts.slowed) {
      ctx2.globalAlpha = alpha * 0.35;
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx2.strokeStyle = "#3DF08C";
      ctx2.lineWidth = 2;
      ctx2.stroke();
    }
    ctx2.restore();
  }
  function drawMapBackground(ctx2, w, h, nebula = null) {
    if (nebula) {
      ctx2.drawImage(nebula, 0, 0, w, h);
      const g = ctx2.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(11,18,38,0.72)");
      g.addColorStop(0.5, "rgba(10,15,34,0.78)");
      g.addColorStop(1, "rgba(12,17,40,0.72)");
      ctx2.fillStyle = g;
      ctx2.fillRect(0, 0, w, h);
    } else {
      const g = ctx2.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0B1226");
      g.addColorStop(0.5, "#0A0F22");
      g.addColorStop(1, "#0C1128");
      ctx2.fillStyle = g;
      ctx2.fillRect(0, 0, w, h);
    }
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const seed = (row * 31 + col * 17) % 97;
        if (seed % 13 === 0) {
          ctx2.beginPath();
          ctx2.arc(col * CELL + 20 + seed % 3 * 8, row * CELL + 24 + seed % 5 * 5, 6 + seed % 4 * 2, 0, Math.PI * 2);
          ctx2.fillStyle = "rgba(0,0,0,0.25)";
          ctx2.fill();
        } else if (seed % 17 === 0) {
          ctx2.fillStyle = "rgba(34,224,255,0.04)";
          ctx2.fillRect(col * CELL + 8, row * CELL + 8, CELL - 16, CELL - 16);
        }
      }
    }
    ctx2.strokeStyle = "rgba(34,224,255,0.06)";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let c = 0; c <= COLS; c++) {
      ctx2.moveTo(c * CELL, 0);
      ctx2.lineTo(c * CELL, h);
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx2.moveTo(0, r * CELL);
      ctx2.lineTo(w, r * CELL);
    }
    ctx2.stroke();
  }
  function drawPath(ctx2, paths, time) {
    ctx2.lineCap = "round";
    ctx2.lineJoin = "round";
    let segs = null;
    if (paths.length > 1) {
      const seen = /* @__PURE__ */ new Set();
      segs = [];
      for (const path of paths) {
        for (let i = 0; i < path.length - 1; i++) {
          const [x1, y1] = path[i];
          const [x2, y2] = path[i + 1];
          const key = x1 < x2 || x1 === x2 && y1 < y2 ? `${x1},${y1}|${x2},${y2}` : `${x2},${y2}|${x1},${y1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          segs.push([x1, y1, x2, y2]);
        }
      }
    }
    const trace = () => {
      ctx2.beginPath();
      if (segs === null) {
        paths[0].forEach(([x, y], i) => i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y));
        return;
      }
      for (const [x1, y1, x2, y2] of segs) {
        ctx2.moveTo(x1, y1);
        ctx2.lineTo(x2, y2);
      }
    };
    trace();
    ctx2.strokeStyle = "#141B32";
    ctx2.lineWidth = CELL * 0.72;
    ctx2.stroke();
    ctx2.strokeStyle = "rgba(34,224,255,0.18)";
    ctx2.lineWidth = CELL * 0.72;
    ctx2.setLineDash([2, CELL * 0.72 - 2]);
    ctx2.stroke();
    ctx2.setLineDash([]);
    trace();
    ctx2.strokeStyle = "rgba(34,224,255,0.55)";
    ctx2.lineWidth = 2;
    ctx2.setLineDash([10, 18]);
    ctx2.lineDashOffset = -time * 60;
    ctx2.shadowColor = "#22E0FF";
    ctx2.shadowBlur = 6;
    ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.shadowBlur = 0;
  }
  function drawBase(ctx2, time, livesRatio, baseX, baseY) {
    const x = baseX;
    const y = baseY;
    const breathe = 1 + Math.sin(time * 2) * 0.05;
    ctx2.beginPath();
    ctx2.arc(x, y, 52 * breathe, Math.PI, 0);
    ctx2.strokeStyle = livesRatio > 0.3 ? "rgba(34,224,255,0.7)" : "rgba(255,90,90,0.8)";
    ctx2.lineWidth = 3;
    ctx2.shadowColor = livesRatio > 0.3 ? "#22E0FF" : "#FF5A5A";
    ctx2.shadowBlur = 16;
    ctx2.stroke();
    ctx2.shadowBlur = 0;
    ctx2.beginPath();
    ctx2.arc(x, y, 34, 0, Math.PI * 2);
    ctx2.fillStyle = "#162040";
    ctx2.fill();
    ctx2.strokeStyle = "#22E0FF";
    ctx2.lineWidth = 2;
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.arc(x, y, 20, Math.PI, 0);
    ctx2.fillStyle = "rgba(34,224,255,0.35)";
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x, y, 7, 0, Math.PI * 2);
    ctx2.fillStyle = "#BDF3FF";
    ctx2.shadowColor = "#22E0FF";
    ctx2.shadowBlur = 12;
    ctx2.fill();
    ctx2.shadowBlur = 0;
  }

  // src/game/fx.ts
  var import_meta = {};
  var BLOOM_SCALE = 0.25;
  var BLOOM_INTENSITY = 0.42;
  var BLOOM_BLUR_PASSES = 2;
  var BLOOM_MIN_CORES = 5;
  var STAR_FAR_COUNT = 46;
  var STAR_FAR_SPEED = 3;
  var STAR_NEAR_COUNT = 22;
  var STAR_NEAR_SPEED = 9;
  var VIGNETTE_ALPHA = 0.52;
  var BASE_GLOW_R = 130;
  var BASE_GLOW_ALPHA = 0.1;
  var SCORCH_TTL = 3;
  var SCORCH_MAX = 24;
  var KILL_FLASH_TTL = 0.1;
  var KILL_FLASH_MAX = 16;
  var BOSS_FLASH_TTL = 0.15;
  var TRAIL_LEN = 10;
  var DEBRIS_MAX = 90;
  var DEBRIS_GRAVITY = 320;
  var DEBRIS_DRAG = 2.4;
  var SPARK_MAX = 70;
  var SPARKS_PER_HIT = 4;
  var FX_RING_MAX = 12;
  var LEAK_MARGIN = 10;
  var hash01 = (n) => {
    const v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  var browserPlatform = {
    createCanvas: () => document.createElement("canvas"),
    createImage: () => typeof Image === "undefined" ? null : new Image(),
    readQualityHigh: () => {
      try {
        const raw = localStorage.getItem("srd.settings");
        if (raw) return (JSON.parse(raw).quality ?? "high") === "high";
      } catch {
      }
      return true;
    },
    hardwareConcurrency: () => navigator.hardwareConcurrency ?? 8,
    nebulaUrl: () => {
      try {
        const base = import_meta.env?.BASE_URL ?? "/";
        return `${base}nebula-texture.png`;
      } catch {
        return "nebula-texture.png";
      }
    }
  };
  var platform = browserPlatform;
  function setFxPlatform(p) {
    platform = p;
  }
  var NebulaBg = class {
    constructor(url) {
      __publicField(this, "img", null);
      const im = platform.createImage();
      if (!im) return;
      im.onload = () => {
        this.img = im;
      };
      im.src = url ?? platform.nebulaUrl();
    }
  };
  function drawStarfield(ctx2, w, h, time) {
    ctx2.save();
    ctx2.fillStyle = "#8FA8E8";
    for (let i = 0; i < STAR_FAR_COUNT; i++) {
      const sx = (hash01(i * 7 + 11) * w + time * STAR_FAR_SPEED) % w;
      const sy = (hash01(i * 13 + 5) * h + time * STAR_FAR_SPEED * 0.4) % h;
      ctx2.globalAlpha = 0.1 + 0.14 * (0.5 + 0.5 * Math.sin(time * 0.5 + i * 1.9));
      ctx2.fillRect(sx, sy, 1, 1);
    }
    for (let i = 0; i < STAR_NEAR_COUNT; i++) {
      const sx = (hash01(i * 17 + 31) * w + time * STAR_NEAR_SPEED) % w;
      const sy = (hash01(i * 23 + 47) * h + Math.sin(time * 0.1 + i) * 8 + time * STAR_NEAR_SPEED * 0.25 + h) % h;
      const r = 0.8 + hash01(i * 29 + 3) * 1.1;
      ctx2.fillStyle = i % 5 === 0 ? "#BDF3FF" : "#D8E4FF";
      ctx2.globalAlpha = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(time * 0.8 + i * 2.7));
      ctx2.beginPath();
      ctx2.arc(sx, sy, r, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
    ctx2.globalAlpha = 1;
  }
  function drawVignette(ctx2, w, h) {
    const g = ctx2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, "rgba(3,5,12,0)");
    g.addColorStop(1, `rgba(3,5,12,${VIGNETTE_ALPHA})`);
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, w, h);
  }
  function drawBaseGlow(ctx2, x, y, time) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 1.6);
    const g = ctx2.createRadialGradient(x, y, 0, x, y, BASE_GLOW_R);
    g.addColorStop(0, `rgba(34,224,255,${BASE_GLOW_ALPHA * pulse})`);
    g.addColorStop(1, "rgba(34,224,255,0)");
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(x, y, BASE_GLOW_R, 0, Math.PI * 2);
    ctx2.fill();
  }
  var BloomLayer = class {
    constructor(w, h) {
      __publicField(this, "glow");
      __publicField(this, "tiny");
      __publicField(this, "gctx");
      __publicField(this, "tctx");
      /** 硬件允许（核数足够或平台无法探测）；画质开关由调用方另行控制 */
      __publicField(this, "hwOk");
      this.glow = platform.createCanvas();
      this.glow.width = Math.max(1, Math.round(w * BLOOM_SCALE));
      this.glow.height = Math.max(1, Math.round(h * BLOOM_SCALE));
      this.tiny = platform.createCanvas();
      this.tiny.width = Math.max(1, this.glow.width >> 1);
      this.tiny.height = Math.max(1, this.glow.height >> 1);
      this.gctx = this.glow.getContext("2d");
      this.tctx = this.tiny.getContext("2d");
      const cores = platform.hardwareConcurrency();
      this.hwOk = cores === null || cores >= BLOOM_MIN_CORES;
    }
    /** 清层并套用与主画布一致的坐标系（含震屏偏移），返回绘制上下文 */
    begin(shakeX, shakeY) {
      const g = this.gctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.glow.width, this.glow.height);
      g.setTransform(BLOOM_SCALE, 0, 0, BLOOM_SCALE, shakeX * BLOOM_SCALE, shakeY * BLOOM_SCALE);
      return g;
    }
    /** 降采样-升采样近似高斯模糊，然后以 lighter 拉伸叠回主画布（调用后主画布变换被重置为单位矩阵）。
     *  默认铺满 w*dpr × h*dpr；竖屏端可用 dx/dy/dw/dh 指定设备像素下的目标区域（地图偏移/缩放） */
    composite(dst, w, h, dpr, dx = 0, dy = 0, dw = w * dpr, dh = h * dpr) {
      const g = this.gctx;
      for (let i = 0; i < BLOOM_BLUR_PASSES; i++) {
        this.tctx.setTransform(1, 0, 0, 1, 0, 0);
        this.tctx.clearRect(0, 0, this.tiny.width, this.tiny.height);
        this.tctx.drawImage(this.glow, 0, 0, this.tiny.width, this.tiny.height);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(this.tiny, 0, 0, this.glow.width, this.glow.height);
      }
      dst.setTransform(1, 0, 0, 1, 0, 0);
      dst.globalCompositeOperation = "lighter";
      dst.globalAlpha = BLOOM_INTENSITY;
      dst.drawImage(this.glow, dx, dy, dw, dh);
      dst.globalAlpha = 1;
      dst.globalCompositeOperation = "source-over";
    }
  };
  var FxLayer = class {
    constructor() {
      /** BOSS 死亡全屏白闪剩余时间（秒），由 GameCanvas 读取绘制 */
      __publicField(this, "bossFlash", 0);
      __publicField(this, "prevEnemies", /* @__PURE__ */ new Map());
      __publicField(this, "seenIds", /* @__PURE__ */ new Set());
      __publicField(this, "lastClock", -1);
      __publicField(this, "scorches", []);
      __publicField(this, "flashes", []);
      __publicField(this, "debris", []);
      __publicField(this, "sparks", []);
      __publicField(this, "rings", []);
      __publicField(this, "trails", /* @__PURE__ */ new Map());
      for (let i = 0; i < SCORCH_MAX; i++) this.scorches.push({ x: 0, y: 0, r: 1, rot: 0, ttl: 0 });
      for (let i = 0; i < KILL_FLASH_MAX; i++) this.flashes.push({ x: 0, y: 0, r: 1, ttl: 0 });
      for (let i = 0; i < DEBRIS_MAX; i++) this.debris.push({ x: 0, y: 0, vx: 0, vy: 0, size: 1, color: "#FFF", ttl: 0, maxTtl: 1 });
      for (let i = 0; i < SPARK_MAX; i++) this.sparks.push({ x: 0, y: 0, vx: 0, vy: 0, size: 1, color: "#FFF", ttl: 0, maxTtl: 1 });
      for (let i = 0; i < FX_RING_MAX; i++) this.rings.push({ x: 0, y: 0, color: "#FFF", r0: 0, r1: 1, ttl: 0, maxTtl: 1 });
    }
    /** 每帧调用：同步敌人/弹丸列表做死亡 diff，并按引擎时钟衰减所有短寿命特效 */
    update(s, map) {
      const dt = this.lastClock < 0 ? 0 : Math.min(0.1, Math.max(0, s.clock - this.lastClock));
      this.lastClock = s.clock;
      const seen = this.seenIds;
      seen.clear();
      for (const e of s.enemies) {
        seen.add(e.id);
        const pos = map.posAt(e.path, e.dist);
        const prev = this.prevEnemies.get(e.id);
        if (prev) {
          prev.x = pos.x;
          prev.y = pos.y;
          prev.dist = e.dist;
        } else {
          this.prevEnemies.set(e.id, {
            x: pos.x,
            y: pos.y,
            dist: e.dist,
            path: e.path,
            isBoss: e.isBoss,
            size: ENEMIES[e.type].size,
            color: ENEMIES[e.type].color
          });
        }
      }
      for (const [id, p] of this.prevEnemies) {
        if (seen.has(id)) continue;
        this.prevEnemies.delete(id);
        if (p.dist >= map.paths[p.path].length - LEAK_MARGIN) continue;
        this.onEnemyDeath(p);
      }
      seen.clear();
      for (const pr of s.projectiles) {
        seen.add(pr.id);
        let tr = this.trails.get(pr.id);
        if (!tr) {
          tr = { kind: pr.kind, pts: [] };
          this.trails.set(pr.id, tr);
        }
        const last2 = tr.pts[tr.pts.length - 1];
        if (!last2 || last2.x !== pr.x || last2.y !== pr.y) {
          tr.pts.push({ x: pr.x, y: pr.y });
          if (tr.pts.length > TRAIL_LEN) tr.pts.shift();
        }
      }
      for (const [id, tr] of this.trails) {
        if (seen.has(id)) continue;
        this.trails.delete(id);
        if (tr.kind === "missile" && tr.pts.length > 0) {
          const end = tr.pts[tr.pts.length - 1];
          this.burst(end.x, end.y, "#FFC978", 9, 220, 0.45);
        }
      }
      if (dt > 0) {
        for (const sc of this.scorches) if (sc.ttl > 0) sc.ttl -= dt;
        for (const f of this.flashes) if (f.ttl > 0) f.ttl -= dt;
        for (const r of this.rings) if (r.ttl > 0) r.ttl -= dt;
        if (this.bossFlash > 0) this.bossFlash -= dt;
        const dragK = 1 / (1 + DEBRIS_DRAG * dt);
        for (const d of this.debris) {
          if (d.ttl <= 0) continue;
          d.ttl -= dt;
          d.vy += DEBRIS_GRAVITY * dt;
          d.vx *= dragK;
          d.vy *= dragK;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
        }
        for (const sp of this.sparks) {
          if (sp.ttl <= 0) continue;
          sp.ttl -= dt;
          sp.vy += 200 * dt;
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
        }
      }
    }
    onEnemyDeath(p) {
      this.spawnScorch(p.x, p.y, p.size * 1.7);
      this.spawnFlash(p.x, p.y, p.size * 2.4);
      const n = p.isBoss ? 16 : 7;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (p.isBoss ? 130 : 70) * (0.5 + Math.random());
        this.spawnMote(this.debris, p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 50, 1.5 + Math.random() * 2.5, p.color, 0.5 + Math.random() * 0.4);
      }
      if (p.isBoss) {
        this.bossFlash = BOSS_FLASH_TTL;
        this.spawnRing(p.x, p.y, "#FFFFFF", 12, 170, 0.5);
        this.spawnRing(p.x, p.y, "#FF3D81", 8, 250, 0.9);
        this.spawnRing(p.x, p.y, "#FFC94D", 4, 330, 1.3);
      }
    }
    /** 激光命中点火花溅射 */
    spawnSparks(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 90;
        this.spawnMote(this.sparks, x, y, Math.cos(a) * v, Math.sin(a) * v - 30, 1 + Math.random() * 1.2, color, 0.16 + Math.random() * 0.14);
      }
    }
    /** 亮火花喷发（导弹爆炸补花） */
    burst(x, y, color, count, speed, ttl) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        this.spawnMote(this.sparks, x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 1.2 + Math.random() * 1.6, i % 3 === 0 ? "#FFFFFF" : color, ttl * (0.7 + Math.random() * 0.6));
      }
    }
    spawnMote(pool, x, y, vx, vy, size, color, ttl) {
      let slot = null;
      for (const m of pool) {
        if (m.ttl <= 0) {
          slot = m;
          break;
        }
      }
      if (!slot) return;
      slot.x = x;
      slot.y = y;
      slot.vx = vx;
      slot.vy = vy;
      slot.size = size;
      slot.color = color;
      slot.ttl = ttl;
      slot.maxTtl = ttl;
    }
    spawnScorch(x, y, r) {
      let slot = null;
      for (const s of this.scorches) {
        if (s.ttl <= 0) {
          slot = s;
          break;
        }
      }
      if (!slot) {
        slot = this.scorches[0];
        for (const s of this.scorches) if (s.ttl < slot.ttl) slot = s;
      }
      slot.x = x;
      slot.y = y;
      slot.r = r;
      slot.rot = Math.random() * Math.PI;
      slot.ttl = SCORCH_TTL;
    }
    spawnFlash(x, y, r) {
      for (const f of this.flashes) {
        if (f.ttl > 0) continue;
        f.x = x;
        f.y = y;
        f.r = r;
        f.ttl = KILL_FLASH_TTL;
        return;
      }
    }
    spawnRing(x, y, color, r0, r1, ttl) {
      for (const r of this.rings) {
        if (r.ttl > 0) continue;
        r.x = x;
        r.y = y;
        r.color = color;
        r.r0 = r0;
        r.r1 = r1;
        r.ttl = ttl;
        r.maxTtl = ttl;
        return;
      }
    }
    /** 地面灼痕：暗色椭圆焦痕贴地，3s 淡出（画在路径之上、塔之下） */
    drawScorches(ctx2) {
      for (const s of this.scorches) {
        if (s.ttl <= 0) continue;
        const a = s.ttl / SCORCH_TTL;
        ctx2.save();
        ctx2.translate(s.x, s.y);
        ctx2.rotate(s.rot);
        ctx2.scale(1, 0.55);
        const g = ctx2.createRadialGradient(0, 0, 0, 0, 0, s.r);
        g.addColorStop(0, `rgba(8,6,12,${0.6 * a})`);
        g.addColorStop(0.6, `rgba(24,12,8,${0.35 * a})`);
        g.addColorStop(1, "rgba(20,10,6,0)");
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.arc(0, 0, s.r, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.restore();
      }
    }
    /** 导弹烟雾拖尾：历史位置渐隐圆点链（越旧越大越淡） */
    drawTrails(ctx2) {
      for (const tr of this.trails.values()) {
        if (tr.kind !== "missile") continue;
        const n = tr.pts.length;
        for (let i = 0; i < n; i++) {
          const f = (i + 1) / n;
          const pt = tr.pts[i];
          ctx2.globalAlpha = 0.04 + 0.15 * f;
          ctx2.fillStyle = "#C9CEDA";
          ctx2.beginPath();
          ctx2.arc(pt.x, pt.y, 1.6 + (1 - f) * 3.2, 0, Math.PI * 2);
          ctx2.fill();
        }
      }
      ctx2.globalAlpha = 1;
    }
    /** 死亡碎片（方块，与引擎粒子同风格，带重力） */
    drawDebris(ctx2) {
      for (const d of this.debris) {
        if (d.ttl <= 0) continue;
        ctx2.globalAlpha = Math.max(0, d.ttl / d.maxTtl);
        ctx2.fillStyle = d.color;
        ctx2.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
      }
      ctx2.globalAlpha = 1;
    }
    /** 火花（激光命中 / 导弹爆炸，加色混合更亮） */
    drawSparks(ctx2) {
      ctx2.save();
      ctx2.globalCompositeOperation = "lighter";
      for (const sp of this.sparks) {
        if (sp.ttl <= 0) continue;
        ctx2.globalAlpha = Math.max(0, sp.ttl / sp.maxTtl);
        ctx2.fillStyle = sp.color;
        ctx2.beginPath();
        ctx2.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
      ctx2.globalAlpha = 1;
    }
    /** 击杀瞬间白闪（径向渐变，0.1s） */
    drawFlashes(ctx2) {
      ctx2.save();
      ctx2.globalCompositeOperation = "lighter";
      for (const f of this.flashes) {
        if (f.ttl <= 0) continue;
        const a = f.ttl / KILL_FLASH_TTL;
        const r = f.r * (1 + (1 - a) * 0.6);
        const g = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
        g.addColorStop(0.5, `rgba(255,240,210,${0.4 * a})`);
        g.addColorStop(1, "rgba(255,240,210,0)");
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
    }
    /** 渲染层补充冲击波环（BOSS 多层环），风格同引擎 rings */
    drawRings(ctx2) {
      for (const r of this.rings) {
        if (r.ttl <= 0) continue;
        const life = Math.max(0, r.ttl / r.maxTtl);
        const k = 1 - life;
        const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
        ctx2.beginPath();
        ctx2.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx2.globalAlpha = life * 0.8;
        ctx2.strokeStyle = r.color;
        ctx2.lineWidth = Math.max(1, 7 * life);
        ctx2.shadowColor = r.color;
        ctx2.shadowBlur = 14;
        ctx2.stroke();
        ctx2.shadowBlur = 0;
      }
      ctx2.globalAlpha = 1;
    }
    /** BOSS 全屏白闪（在 Bloom 合成之后绘制，保持纯白） */
    drawBossFlash(ctx2, w, h) {
      if (this.bossFlash <= 0) return;
      const a = Math.max(0, this.bossFlash / BOSS_FLASH_TTL);
      ctx2.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx2.fillRect(-24, -24, w + 48, h + 48);
    }
    /** 辉光层绘制：发光元素的简化加色形状（低分辨率，主画布已有清晰版） */
    drawGlow(g, s, paths, exits) {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(34,224,255,0.15)";
      g.lineWidth = 2.5;
      for (const px of paths) {
        g.beginPath();
        px.forEach(([x, y], i) => i === 0 ? g.moveTo(x, y) : g.lineTo(x, y));
        g.stroke();
      }
      for (const z of s.zones) {
        g.globalAlpha = 0.5 * Math.max(0, z.ttl / z.maxTtl);
        g.fillStyle = "#FF6B3D";
        g.beginPath();
        g.arc(z.x, z.y, z.r * 0.8, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (const ex of exits) {
        g.globalAlpha = 0.28;
        g.fillStyle = "#22E0FF";
        g.beginPath();
        g.arc(ex.centerX, ex.centerY, 26, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (const pr of s.projectiles) {
        if (pr.kind === "plasma") {
          g.globalAlpha = 0.8;
          g.fillStyle = "#FF6B3D";
          g.beginPath();
          g.arc(pr.x, pr.y, 7, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#FFF3D6";
          g.beginPath();
          g.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
          g.fill();
        } else {
          g.globalAlpha = 0.7;
          g.fillStyle = "#FF9F43";
          g.beginPath();
          g.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      for (const b of s.beams) {
        const a = b.ttl / b.maxTtl;
        if (b.color === "#8B5CF6") {
          g.globalAlpha = a * 0.6;
          g.strokeStyle = b.color;
          g.lineWidth = b.width * 2.4;
          g.beginPath();
          g.moveTo(b.x1, b.y1);
          g.lineTo(b.x2, b.y2);
          g.stroke();
        }
        g.globalAlpha = a;
        g.strokeStyle = b.color;
        g.lineWidth = b.width;
        g.beginPath();
        g.moveTo(b.x1, b.y1);
        g.lineTo(b.x2, b.y2);
        g.stroke();
      }
      g.globalAlpha = 1;
      for (const pt of s.particles) {
        g.globalAlpha = pt.ttl / pt.maxTtl * 0.8;
        g.fillStyle = pt.color;
        g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      g.globalAlpha = 1;
      for (const r of s.rings) {
        g.globalAlpha = Math.max(0, r.ttl / r.maxTtl) * 0.7;
        g.strokeStyle = r.color;
        g.lineWidth = 3;
        const k = 1 - Math.max(0, r.ttl / r.maxTtl);
        const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
        g.beginPath();
        g.arc(r.x, r.y, rad, 0, Math.PI * 2);
        g.stroke();
      }
      for (const r of this.rings) {
        if (r.ttl <= 0) continue;
        g.globalAlpha = Math.max(0, r.ttl / r.maxTtl) * 0.7;
        g.strokeStyle = r.color;
        g.lineWidth = 4;
        const k = 1 - Math.max(0, r.ttl / r.maxTtl);
        const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
        g.beginPath();
        g.arc(r.x, r.y, rad, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      for (const f of this.flashes) {
        if (f.ttl <= 0) continue;
        g.globalAlpha = f.ttl / KILL_FLASH_TTL * 0.9;
        g.fillStyle = "#FFF6E0";
        g.beginPath();
        g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        g.fill();
      }
      for (const sp of this.sparks) {
        if (sp.ttl <= 0) continue;
        g.globalAlpha = Math.max(0, sp.ttl / sp.maxTtl) * 0.8;
        g.fillStyle = sp.color;
        g.beginPath();
        g.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        g.fill();
      }
      for (const d of this.debris) {
        if (d.ttl <= 0) continue;
        g.globalAlpha = Math.max(0, d.ttl / d.maxTtl) * 0.5;
        g.fillStyle = d.color;
        g.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
      }
      g.globalAlpha = 1;
    }
  };

  // src/audio.ts
  var SFX_VOL = {
    laser: 0.14,
    frost: 0.12,
    tesla: 0.1,
    plasma: 0.2
  };
  var sfxVol = (sfx2) => SFX_VOL[sfx2] ?? 0.2;
  var MUTE_KEY = "srd.sfxMuted";
  var SfxEngine = class {
    constructor() {
      __publicField(this, "ctx", null);
      __publicField(this, "master", null);
      __publicField(this, "lastPlayed", /* @__PURE__ */ new Map());
      __publicField(this, "muted", false);
      try {
        this.muted = wx.getStorageSync(MUTE_KEY) === "1";
      } catch {
      }
    }
    /** 首次用户手势时初始化（自动播放限制） */
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume?.();
        return;
      }
      try {
        this.ctx = wx.createWebAudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
      }
    }
    setMuted(muted) {
      this.muted = muted;
      try {
        wx.setStorageSync(MUTE_KEY, muted ? "1" : "0");
      } catch {
      }
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
      }
    }
    play(sfx2) {
      const ctx2 = this.ctx;
      if (!ctx2 || this.muted || !this.master) return;
      const now = ctx2.currentTime;
      const minGap = sfx2 === "laser" || sfx2 === "frost" || sfx2 === "tesla" || sfx2 === "plasma" ? 0.09 : 0.03;
      if (now - (this.lastPlayed.get(sfx2) ?? -9) < minGap) return;
      this.lastPlayed.set(sfx2, now);
      const t = now;
      const master = this.master;
      const env2 = (g, peak, dur) => {
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 8e-3);
        g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
        g.connect(master);
      };
      const osc = (type, f0, f1, dur) => {
        const o = ctx2.createOscillator();
        const g = ctx2.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        env2(g, sfxVol(sfx2), dur);
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 0.02);
      };
      const noise = (dur, lp, peak) => {
        const len = Math.ceil(ctx2.sampleRate * dur);
        const buf = ctx2.createBuffer(1, len, ctx2.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx2.createBufferSource();
        src.buffer = buf;
        const f = ctx2.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = lp;
        const g = ctx2.createGain();
        env2(g, peak, dur);
        src.connect(f);
        f.connect(g);
        src.start(t);
      };
      try {
        switch (sfx2) {
          case "laser":
            osc("sawtooth", 880, 220, 0.08);
            break;
          case "missile":
            osc("triangle", 180, 60, 0.25);
            noise(0.28, 900, 0.34);
            break;
          case "frost":
            osc("sine", 1400, 500, 0.12);
            break;
          case "railgun":
            osc("square", 150, 40, 0.35);
            noise(0.3, 1600, 0.3);
            break;
          case "tesla":
            osc("square", 2200, 900, 0.06);
            noise(0.05, 4e3, 0.08);
            break;
          case "plasma":
            osc("sine", 320, 90, 0.3);
            noise(0.24, 700, 0.16);
            break;
          case "build":
            osc("triangle", 240, 480, 0.12);
            noise(0.06, 2e3, 0.06);
            break;
          case "upgrade":
            osc("triangle", 520, 1040, 0.14);
            osc("sine", 780, 1560, 0.16);
            break;
          case "sell":
            osc("sine", 700, 200, 0.16);
            break;
          case "kill":
            osc("square", 200, 50, 0.1);
            noise(0.1, 1200, 0.14);
            break;
          case "boss":
            osc("sawtooth", 70, 36, 1.1);
            noise(0.9, 400, 0.3);
            break;
          case "leak":
            osc("square", 660, 160, 0.3);
            setTimeout(() => this.playSafe("leak2"), 180);
            break;
          case "waveStart":
            osc("triangle", 330, 660, 0.2);
            break;
          case "waveClear":
            osc("sine", 660, 660, 0.12);
            setTimeout(() => this.playSafe("waveClear2"), 130);
            setTimeout(() => this.playSafe("waveClear3"), 260);
            break;
          case "tech":
            osc("triangle", 520, 780, 0.1);
            setTimeout(() => this.playSafe("tech2"), 90);
            break;
          case "select":
            osc("sine", 900, 1200, 0.05);
            break;
          case "click":
            osc("sine", 500, 700, 0.04);
            break;
          case "victory":
            [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.playChord(f), i * 160));
            break;
          case "defeat":
            [392, 311, 233, 155].forEach((f, i) => setTimeout(() => this.playChord(f), i * 220));
            break;
        }
      } catch {
      }
    }
    playSafe(sfx2) {
      try {
        const ctx2 = this.ctx;
        if (!ctx2 || this.muted || !this.master) return;
        const t = ctx2.currentTime;
        const notes = {
          leak2: [520, 140],
          waveClear2: [880, 880],
          waveClear3: [1320, 1320],
          tech2: [1040, 1560]
        };
        const [f0, f1] = notes[sfx2];
        const o = ctx2.createOscillator();
        const g = ctx2.createGain();
        o.type = sfx2 === "leak2" ? "square" : "sine";
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
        g.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
        g.connect(this.master);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.2);
      } catch {
      }
    }
    playChord(f) {
      try {
        const ctx2 = this.ctx;
        if (!ctx2 || this.muted || !this.master) return;
        const t = ctx2.currentTime;
        const o = ctx2.createOscillator();
        const g = ctx2.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(1e-4, t + 0.5);
        g.connect(this.master);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.55);
      } catch {
      }
    }
  };
  var sfx = new SfxEngine();

  // src/analytics.ts
  var cfg = null;
  var queue = [];
  var timer = null;
  function configureAnalytics(c) {
    try {
      if (!c || !c.endpoint) return;
      cfg = c;
      if (timer === null) timer = setInterval(flush, 3e4);
    } catch {
    }
  }
  function flush() {
    if (!cfg || queue.length === 0) return;
    const w = globalThis.wx;
    if (typeof w?.request !== "function") {
      queue = [];
      return;
    }
    const batch = queue.slice(0, 200);
    queue = queue.slice(batch.length);
    try {
      w.request({
        url: `${cfg.endpoint}/api/collect`,
        method: "POST",
        data: { events: batch },
        fail: () => {
        }
      });
    } catch {
    }
  }
  function track(eventId, data = {}) {
    try {
      const w = globalThis.wx;
      if (typeof w?.reportEvent === "function") w.reportEvent(eventId, data);
      else if (typeof w?.reportAnalytics === "function") w.reportAnalytics(eventId, data);
    } catch {
    }
    try {
      if (cfg) {
        queue.push({
          event_id: eventId,
          openid: cfg.getOpenid?.() || void 0,
          build_id: cfg.getBuildId?.() || void 0,
          data,
          ts: Date.now()
        });
        if (queue.length >= 20) flush();
      }
    } catch {
    }
  }

  // src/net.ts
  function wsUrlFromApiBase(base) {
    const b = base.trim().replace(/\/+$/, "");
    if (b.startsWith("https://")) return `wss://${b.slice("https://".length)}/ws`;
    if (b.startsWith("http://")) return `ws://${b.slice("http://".length)}/ws`;
    return "";
  }
  var MAX_RECONNECT = 3;
  var PING_MS = 25e3;
  function connectCoop(wxImpl, opts, cb) {
    try {
      let stopPing = function() {
        if (pingTimer !== null) clearInterval(pingTimer);
        pingTimer = null;
      }, sendRaw = function(msg) {
        if (!task || !opened || closed) return false;
        try {
          task.send({ data: JSON.stringify(msg) });
          return true;
        } catch {
          return false;
        }
      }, scheduleRetry = function() {
        if (closed) return;
        attempts += 1;
        if (attempts > MAX_RECONNECT) {
          closed = true;
          cb.onClose?.();
          return;
        }
        cb.onReconnecting?.(attempts);
        retryTimer = setTimeout(connect, 1e3 * 2 ** (attempts - 1));
      }, onDead = function() {
        opened = false;
        stopPing();
        scheduleRetry();
      }, connect = function() {
        if (closed) return;
        try {
          task = wxImpl.connectSocket({ url: opts.url });
        } catch {
          scheduleRetry();
          return;
        }
        if (!task) {
          scheduleRetry();
          return;
        }
        opened = false;
        task.onOpen(() => {
          if (closed) return;
          opened = true;
          const wasRetry = attempts > 0 || everOpened;
          attempts = 0;
          everOpened = true;
          if (rejoin) sendRaw({ t: "join", roomId: rejoin.roomId, nick: opts.nick, rejoin: true });
          stopPing();
          pingTimer = setInterval(() => sendRaw({ t: "ping" }), PING_MS);
          cb.onOpen?.(wasRetry);
        });
        task.onMessage((r) => {
          if (closed) return;
          try {
            const msg = typeof r.data === "string" ? JSON.parse(r.data) : null;
            if (!msg || typeof msg.t !== "string") return;
            switch (msg.t) {
              case "room":
                cb.onRoom?.({
                  roomId: String(msg.roomId ?? ""),
                  role: msg.role === "host" ? "host" : "guest",
                  levelId: typeof msg.levelId === "number" ? msg.levelId : void 0,
                  difficulty: typeof msg.difficulty === "string" ? msg.difficulty : void 0,
                  hostNick: typeof msg.hostNick === "string" ? msg.hostNick : void 0
                });
                break;
              case "peer":
                cb.onPeer?.(
                  String(msg.nick ?? ""),
                  msg.status === "lost" ? "lost" : msg.status === "back" ? "back" : "joined"
                );
                break;
              case "cmd":
                if (msg.cmd && typeof msg.cmd === "object") cb.onCmd?.(Number(msg.player) || 0, msg.cmd);
                break;
              case "snap":
                if (msg.state && typeof msg.state === "object") {
                  cb.onSnap?.(msg.state, Array.isArray(msg.events) ? msg.events : []);
                }
                break;
              case "end":
                cb.onEnd?.(!!msg.won, typeof msg.reason === "string" ? msg.reason : void 0);
                break;
              case "error":
                cb.onError?.(String(msg.code ?? "unknown"));
                break;
              default:
                break;
            }
          } catch {
          }
        });
        task.onClose(onDead);
        task.onError(() => {
        });
      };
      if (typeof wxImpl?.connectSocket !== "function" || !opts.url) return null;
      let task = null;
      let opened = false;
      let everOpened = false;
      let attempts = 0;
      let closed = false;
      let rejoin = null;
      let pingTimer = null;
      let retryTimer = null;
      connect();
      return {
        get connected() {
          return opened && !closed;
        },
        send: sendRaw,
        setRejoinInfo(info2) {
          rejoin = info2;
        },
        close() {
          closed = true;
          stopPing();
          if (retryTimer !== null) clearTimeout(retryTimer);
          retryTimer = null;
          try {
            task?.close({});
          } catch {
          }
        }
      };
    } catch {
      return null;
    }
  }

  // src/ghost.ts
  var SNAP_DT = 0.2;
  function createGhostEngine(difficulty, levelId, sendCmd) {
    const base = createEngine(difficulty, levelId, { coop: true });
    const state = base.state;
    const evBuf = [];
    const lerp = /* @__PURE__ */ new Map();
    let lerpT = SNAP_DT;
    function applySnap(net, events) {
      const prev = /* @__PURE__ */ new Map();
      for (const e of state.enemies) prev.set(e.id, e.dist);
      const { particles, beams, rings, floaters } = state;
      Object.assign(state, net);
      state.particles = particles;
      state.beams = beams;
      state.rings = rings;
      state.floaters = floaters;
      if (state.golds) state.gold = state.golds[1];
      lerp.clear();
      for (const e of state.enemies) {
        const p = prev.get(e.id);
        lerp.set(e.id, { from: p ?? Math.max(0, e.dist - e.speed * CELL * SNAP_DT), to: e.dist });
      }
      lerpT = 0;
      evBuf.push(...events);
    }
    function tick(dt) {
      if (lerpT >= SNAP_DT) return;
      lerpT = Math.min(SNAP_DT, lerpT + dt);
      const f = lerpT / SNAP_DT;
      for (const e of state.enemies) {
        const seg = lerp.get(e.id);
        if (seg) e.dist = seg.from + (seg.to - seg.from) * f;
      }
    }
    return {
      state,
      difficulty,
      map: base.map,
      level: base.level,
      tick,
      applySnap,
      // 指令上网（乐观返回 true；越权/非法指令由主机引擎拒绝，下个快照自然纠偏）
      dispatch(cmd) {
        sendCmd(cmd);
        return true;
      },
      dispatchAs(_player, cmd) {
        sendCmd(cmd);
        return true;
      },
      serializeNet() {
        const { particles, beams, rings, floaters, ...rest } = state;
        return rest;
      },
      subscribe() {
        return () => {
        };
      },
      drainEvents() {
        return evBuf.splice(0);
      }
    };
  }

  // src/skins/abyss.ts
  var pressPt = null;
  var segAnim = {};
  var codexDrag = null;
  var codexMaxScroll = 0;
  var settingsOpenAt = 0;
  var settingsWasOpen = false;
  var profileOpenAt = 0;
  var profileWasOpen = false;
  var clamp01 = (v) => Math.min(1, Math.max(0, v));
  var easeOut = (t) => 1 - (1 - t) ** 3;
  function enterP(env2, i, step = 0.07) {
    return easeOut(clamp01(((Date.now() - env2.getScreenAt()) / 1e3 - 0.06 - i * step) / 0.38));
  }
  function syncOverlayFlags(env2) {
    if (!env2.showSettings()) settingsWasOpen = false;
    if (!env2.showProfile()) profileWasOpen = false;
  }
  function holoPanel(env2, x, y, w, h, time, stroke, r) {
    const { ctx: ctx2 } = env2;
    const rad = r ?? env2.RADIUS;
    ctx2.save();
    const g = ctx2.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, env2.skin.panelTop);
    g.addColorStop(1, env2.skin.panelBottom);
    env2.rr(x, y, w, h, rad);
    ctx2.fillStyle = g;
    ctx2.fill();
    env2.rr(x, y, w, h, rad);
    ctx2.clip();
    ctx2.strokeStyle = env2.ac(0.045);
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let ly = y + 5; ly < y + h; ly += 8) {
      ctx2.moveTo(x + 3, ly + 0.5);
      ctx2.lineTo(x + w - 3, ly + 0.5);
    }
    ctx2.stroke();
    const sy = y + time * 24 % (h + 48) - 24;
    const sg = ctx2.createLinearGradient(0, sy - 9, 0, sy + 9);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.12));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(x, sy - 9, w, 18);
    const tg = ctx2.createLinearGradient(0, y, 0, y + Math.min(10, h));
    tg.addColorStop(0, env2.ac(0.16));
    tg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = tg;
    ctx2.fillRect(x, y, w, Math.min(10, h));
    ctx2.restore();
    ctx2.save();
    env2.rr(x, y, w, h, rad);
    ctx2.strokeStyle = stroke ?? env2.C.panelLine;
    ctx2.lineWidth = 1.2;
    ctx2.stroke();
    ctx2.strokeStyle = env2.ac(0.7);
    ctx2.lineWidth = 1.6;
    const cl = 7;
    ctx2.beginPath();
    ctx2.moveTo(x + 1, y + cl);
    ctx2.lineTo(x + 1, y + 1);
    ctx2.lineTo(x + cl, y + 1);
    ctx2.moveTo(x + w - cl, y + 1);
    ctx2.lineTo(x + w - 1, y + 1);
    ctx2.lineTo(x + w - 1, y + cl);
    ctx2.moveTo(x + w - 1, y + h - cl);
    ctx2.lineTo(x + w - 1, y + h - 1);
    ctx2.lineTo(x + w - cl, y + h - 1);
    ctx2.moveTo(x + cl, y + h - 1);
    ctx2.lineTo(x + 1, y + h - 1);
    ctx2.lineTo(x + 1, y + h - cl);
    ctx2.stroke();
    ctx2.restore();
  }
  function holoBtn(env2, b, time) {
    const { ctx: ctx2 } = env2;
    const c = b.color ?? env2.C.cyan;
    const r = Math.min(10, b.h / 2);
    const pb = env2.getPressedBtn();
    const pressed = pb !== null && pb.x === b.x && pb.y === b.y && pb.w === b.w && pb.label === b.label;
    ctx2.save();
    if (pressed) {
      ctx2.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx2.scale(0.95, 0.95);
      ctx2.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      ctx2.globalAlpha *= 0.9;
    }
    if (b.disabled) ctx2.globalAlpha *= 0.38;
    env2.rr(b.x, b.y, b.w, b.h, r);
    if (b.primary && !b.disabled) {
      const g = ctx2.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, c);
      g.addColorStop(1, env2.shade(c));
      ctx2.shadowColor = c;
      ctx2.shadowBlur = 8 + 5 * Math.sin(time * 2.6);
      ctx2.fillStyle = g;
      ctx2.fill();
      ctx2.shadowBlur = 0;
    } else {
      ctx2.fillStyle = b.active ? env2.ac(0.22) : env2.ac(0.07);
      ctx2.fill();
      ctx2.strokeStyle = b.active ? c : `${c}88`;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
    }
    ctx2.save();
    env2.rr(b.x, b.y, b.w, b.h, r);
    ctx2.clip();
    const sy = b.y + time * 30 % (b.h + 24) - 12;
    const sg = ctx2.createLinearGradient(0, sy - 6, 0, sy + 6);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, b.primary && !b.disabled ? "rgba(255,255,255,0.18)" : env2.ac(0.14));
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx2.fillStyle = sg;
    ctx2.fillRect(b.x, sy - 6, b.w, 12);
    ctx2.restore();
    if (pressed && pressPt) {
      const dt = (Date.now() - pressPt.at) / 1e3;
      const a = Math.max(0, 0.55 - dt * 1.1);
      if (a > 0) {
        const px = Math.min(Math.max(pressPt.x, b.x), b.x + b.w);
        const py = Math.min(Math.max(pressPt.y, b.y), b.y + b.h);
        ctx2.save();
        ctx2.globalAlpha = a;
        ctx2.strokeStyle = b.primary && !b.disabled ? "#FFFFFF" : c;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.arc(px, py, 5 + dt * 160, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.globalAlpha = a * 0.5;
        ctx2.beginPath();
        ctx2.arc(px, py, 2 + dt * 90, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.restore();
      }
    }
    if (b.label) {
      const labelColor = b.primary && !b.disabled ? "#081226" : b.active ? c : b.disabled ? "#9AA7C2" : env2.C.text;
      env2.fillText(b.label, b.x + b.w / 2, b.y + (b.sub ? b.h / 2 - 9 : b.h / 2), { size: 14, color: labelColor, align: "center" });
      if (b.sub) env2.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 11, { size: 11, color: b.disabled ? "#C77A34" : env2.C.gold, align: "center" });
    }
    ctx2.restore();
    env2.hitBox(b);
  }
  function holoAtmosphere(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    ctx2.save();
    const sy = time * 30 % (VH2 + 160) - 80;
    const g = ctx2.createLinearGradient(0, sy - 34, 0, sy + 34);
    g.addColorStop(0, env2.ac(0));
    g.addColorStop(0.5, env2.ac(0.05));
    g.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = g;
    ctx2.fillRect(0, sy - 34, VW2, 68);
    ctx2.fillStyle = env2.C.cyan;
    for (let i = 0; i < 6; i++) {
      const x = env2.hash01(i * 13 + 5) * VW2;
      const sp = 36 + env2.hash01(i * 7 + 1) * 56;
      const yy = (time * sp + env2.hash01(i * 31 + 3) * VH2) % (VH2 + 40) - 20;
      ctx2.globalAlpha = 0.08 + 0.08 * env2.hash01(i * 17 + 9);
      ctx2.fillRect(x, yy, 1.5, 12);
    }
    ctx2.restore();
  }
  function holoHeader(env2, time, title, back) {
    const { ctx: ctx2, VW: VW2, CAP_MID: CAP_MID2, TOP_SAFE: TOP_SAFE2, CAP_LEFT: CAP_LEFT2, GAME_CENTER_PAD: GAME_CENTER_PAD2, MARGIN: MARGIN2 } = env2;
    const btnS = 36;
    const top = CAP_MID2 - btnS / 2;
    ctx2.save();
    const g = ctx2.createLinearGradient(0, top - 6, 0, TOP_SAFE2);
    g.addColorStop(0, env2.skin.panelTop);
    g.addColorStop(1, env2.skin.panelBottom);
    ctx2.fillStyle = g;
    ctx2.fillRect(0, top - 6, VW2, TOP_SAFE2 - top + 6);
    ctx2.strokeStyle = env2.ac(0.18);
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(0, TOP_SAFE2 - 0.5);
    ctx2.lineTo(VW2, TOP_SAFE2 - 0.5);
    ctx2.stroke();
    ctx2.strokeStyle = env2.ac(0.5);
    ctx2.setLineDash([22, 74]);
    ctx2.lineDashOffset = -time * 90;
    ctx2.beginPath();
    ctx2.moveTo(0, TOP_SAFE2 - 0.5);
    ctx2.lineTo(VW2, TOP_SAFE2 - 0.5);
    ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.restore();
    let tx = MARGIN2;
    const rightLimit = CAP_LEFT2 - 8 - GAME_CENTER_PAD2;
    if (back) {
      holoBtn(env2, { x: MARGIN2, y: top, w: btnS, h: btnS, label: "\u2039", cb: back }, time);
      tx = MARGIN2 + btnS + 12;
    }
    const maxW = rightLimit - tx - 8;
    let tSize = 16;
    ctx2.save();
    while (tSize > 11) {
      ctx2.font = `bold ${tSize}px sans-serif`;
      if (ctx2.measureText(title).width <= maxW) break;
      tSize--;
    }
    ctx2.restore();
    env2.fillText("TOWER LINE DEFENSE", tx, CAP_MID2 - 11, { size: 9, color: env2.ac(0.7), weight: "600" });
    env2.fillText(title, tx, CAP_MID2 + 8, { size: tSize });
  }
  function holoSeg(env2, x, y, w, items, activeIdx, key, onPick, time) {
    const { ctx: ctx2 } = env2;
    const h = 34;
    holoPanel(env2, x, y, w, h, time, env2.ac(0.3), 17);
    const sw = w / items.length;
    const cur = segAnim[key] ?? activeIdx;
    const next = cur + (activeIdx - cur) * 0.28;
    segAnim[key] = Math.abs(activeIdx - next) < 0.01 ? activeIdx : next;
    ctx2.save();
    env2.rr(x + segAnim[key] * sw + 3, y + 3, sw - 6, h - 6, 14);
    const g = ctx2.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, env2.C.cyan);
    g.addColorStop(1, env2.shade(env2.C.cyan));
    ctx2.shadowColor = env2.C.cyan;
    ctx2.shadowBlur = 8;
    ctx2.fillStyle = g;
    ctx2.fill();
    ctx2.restore();
    items.forEach((label, i) => {
      env2.fillText(label, x + i * sw + sw / 2, y + h / 2 + 0.5, { size: 13, color: i === activeIdx ? "#081226" : env2.C.sub, align: "center" });
      env2.hitBox({ x: x + i * sw, y, w: sw, h, label: "", cb: () => {
        if (i !== activeIdx) {
          onPick(i);
          env2.buzz("light");
        }
      } });
    });
  }
  function drawOverlays(env2, time) {
    if (env2.showSettings()) drawSettings(env2, time);
    if (env2.showProfile()) drawProfile(env2, time);
  }
  function drawSplashMenu(env2, time, menuA) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    const slide = (1 - menuA) * 16;
    ctx2.save();
    ctx2.globalAlpha = menuA;
    const titleY = VH2 * 0.28 + (VW2 * 0.17 + 8) * 1.9;
    const menuY = titleY + 124 + slide;
    const bw = 220;
    const bx = VW2 / 2 - bw / 2;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    const halo = ctx2.createRadialGradient(VW2 / 2, menuY + 27, 0, VW2 / 2, menuY + 27, 130);
    halo.addColorStop(0, `rgba(255,201,77,${0.14 + 0.08 * pulse})`);
    halo.addColorStop(1, "rgba(255,201,77,0)");
    ctx2.fillStyle = halo;
    ctx2.fillRect(bx - 60, menuY - 70, bw + 120, 200);
    for (let k = 0; k < 2; k++) {
      const pt = (time * 0.55 + k * 0.5) % 1;
      ctx2.save();
      ctx2.globalAlpha = menuA * (1 - pt) * 0.4;
      ctx2.strokeStyle = env2.C.gold;
      ctx2.lineWidth = 1.5;
      env2.rr(bx - pt * 26, menuY - pt * 12, bw + pt * 52, 54 + pt * 24, 27 + pt * 12);
      ctx2.stroke();
      ctx2.restore();
    }
    holoBtn(env2, { x: bx, y: menuY, w: bw, h: 54, label: "\u25B6 \u5F00\u59CB\u6218\u5F79", color: env2.C.gold, primary: true, cb: () => env2.goto("home") }, time);
    const entries = [
      ["\u{1F4D6}", "\u56FE\u9274", "CODEX", env2.C.gold, () => {
        env2.codex.scroll = 0;
        env2.goto("codex");
      }],
      ["\u2699", "\u8BBE\u7F6E", "SYSTEM", env2.C.cyan, () => {
        env2.setShowProfile(false);
        env2.setShowSettings(true);
      }],
      ["", "\u6863\u6848", "PROFILE", env2.C.green, () => {
        env2.setShowSettings(false);
        env2.setShowProfile(true);
      }]
    ];
    const entryY = menuY + 54 + 18;
    const entryW = (VW2 - MARGIN2 * 2 - 20) / 3;
    entries.forEach(([icon, label, en, color, cb], i) => {
      const x = MARGIN2 + i * (entryW + 10);
      const fy = Math.sin(time * 1.3 + i * 2.1) * 3;
      holoPanel(env2, x, entryY + fy, entryW, 66, time + i * 3, `${color}44`, 12);
      if (icon) env2.fillText(icon, x + entryW / 2, entryY + fy + 24, { size: 18, align: "center" });
      else env2.drawAvatar(x + entryW / 2, entryY + fy + 24, 12);
      env2.fillText(label, x + entryW / 2, entryY + fy + 46, { size: 12, color: env2.C.text, align: "center" });
      env2.fillText(en, x + entryW / 2, entryY + fy + 59, { size: 7, color: env2.ac(0.55), align: "center", weight: "600" });
      env2.hitBox({ x, y: entryY - 4, w: entryW, h: 74, label: "", cb });
    });
    ctx2.restore();
  }
  var CARD_H = 116;
  var CARD_GAP = 12;
  function drawHome(env2, time) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    env2.drawSpaceBg(time);
    holoAtmosphere(env2, time);
    holoHeader(env2, time, "\u9AD8\u5854\u9632\u7EBF \xB7 \u6218\u5F79\u9009\u62E9", () => env2.goto("splash"));
    const segW = VW2 - MARGIN2 * 2;
    const diffW = Math.round(segW * 0.6);
    holoSeg(env2, MARGIN2, env2.TOP_SAFE + 4, diffW, env2.DIFF_LIST.map((d) => env2.DIFFICULTIES[d].name), env2.DIFF_LIST.indexOf(env2.app.difficulty), "diff", (i) => {
      env2.app.difficulty = env2.DIFF_LIST[i];
      env2.track("difficulty_select", { difficulty: env2.app.difficulty });
    }, time);
    holoSeg(env2, MARGIN2 + diffW + 10, env2.TOP_SAFE + 4, segW - diffW - 10, ["\u5355\u4EBA", "\u540C\u5C4F", "\u8054\u673A"], env2.app.mode === "coop" ? 1 : env2.app.mode === "online" ? 2 : 0, "coop", (i) => {
      env2.setMode(i === 1 ? "coop" : i === 2 ? "online" : "single");
      env2.buzz("light");
    }, time);
    const homeTop2 = env2.homeTop;
    const homeBottom2 = env2.homeBottom;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, homeTop2, VW2, homeBottom2 - homeTop2);
    ctx2.clip();
    const cleared = env2.loadProgress().cleared;
    const cardX = MARGIN2;
    const cardW = VW2 - MARGIN2 * 2;
    env2.LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const p = enterP(env2, Math.min(i, 8));
      const y = homeTop2 + 8 + i * (CARD_H + CARD_GAP) - env2.app.scroll + (1 - p) * 18;
      if (y + CARD_H < homeTop2 - 20 || y > homeBottom2 + 20) return;
      ctx2.save();
      ctx2.globalAlpha = p;
      holoPanel(env2, cardX, y, cardW, CARD_H, time + i, unlock ? env2.C.panelLine : "rgba(124,141,176,0.15)");
      const artX = cardX + 8;
      const artY = y + 8;
      const artW = 82;
      const artH = CARD_H - 16;
      env2.drawCardArt(artX, artY, artW, artH, lv.id, time);
      ctx2.save();
      env2.rr(artX, artY, artW, artH, 10);
      ctx2.strokeStyle = env2.ac(0.5);
      ctx2.lineWidth = 1;
      ctx2.stroke();
      if (!unlock) {
        ctx2.fillStyle = "rgba(7,11,24,0.55)";
        ctx2.fill();
      }
      ctx2.restore();
      const tx = artX + artW + 12;
      ctx2.save();
      if (!unlock) ctx2.globalAlpha *= 0.45;
      env2.fillText(`CHAPTER ${String(lv.id).padStart(2, "0")}`, tx, y + 20, { size: 10, color: env2.C.cyan, weight: "600" });
      env2.fillText(lv.name, tx, y + 44, { size: 17 });
      env2.fillText(lv.sub, tx, y + 66, { size: 11, color: env2.C.sub, weight: "normal" });
      const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(" ");
      env2.fillText(`${lv.waves.length} \u6CE2 \xB7 BOSS ${bossTxt || "\u2014"}`, tx, y + 88, { size: 10, color: env2.C.dim, weight: "normal" });
      ctx2.restore();
      if (done) env2.chip(cardX + cardW - 12, y + 18, "\u5DF2\u901A\u5173", env2.C.green);
      else if (!unlock) env2.chip(cardX + cardW - 12, y + 18, "\u672A\u89E3\u9501", env2.C.dim);
      if (unlock) {
        holoBtn(env2, {
          x: cardX + cardW - 92,
          y: y + CARD_H - 50,
          w: 80,
          h: 38,
          label: done ? "\u91CD\u73A9" : "\u51FA\u51FB",
          color: done ? env2.C.green : env2.C.cyan,
          primary: !done,
          cb: () => env2.gotoBriefing(lv.id)
        }, time);
        env2.hitBox({ x: cardX, y, w: cardW - 104, h: CARD_H, label: "", cb: () => env2.gotoBriefing(lv.id) });
      } else {
        const lx = cardX + cardW - 52;
        const ly = y + CARD_H - 34;
        ctx2.save();
        ctx2.strokeStyle = env2.C.dim;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.rect(lx - 9, ly - 2, 18, 14);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.arc(lx, ly - 2, 6, Math.PI, 0);
        ctx2.stroke();
        ctx2.restore();
        env2.hitBox({
          x: cardX,
          y,
          w: cardW,
          h: CARD_H,
          label: "",
          cb: () => {
            env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
            env2.buzz("light");
          }
        });
      }
      ctx2.restore();
    });
    ctx2.restore();
    const fadeH = 18;
    const gf = ctx2.createLinearGradient(0, homeTop2, 0, homeTop2 + fadeH);
    gf.addColorStop(0, "rgba(8,12,26,0.9)");
    gf.addColorStop(1, "rgba(8,12,26,0)");
    ctx2.fillStyle = gf;
    ctx2.fillRect(0, homeTop2, VW2, fadeH);
    const gb = ctx2.createLinearGradient(0, homeBottom2 - fadeH, 0, homeBottom2);
    gb.addColorStop(0, "rgba(10,15,36,0)");
    gb.addColorStop(1, "rgba(10,15,36,0.9)");
    ctx2.fillStyle = gb;
    ctx2.fillRect(0, homeBottom2 - fadeH, VW2, fadeH);
    const smax = env2.totalScrollMax();
    if (smax > 0) {
      const viewH = homeBottom2 - homeTop2;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
      const ty = homeTop2 + (viewH - thumbH) * (env2.app.scroll / smax);
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.35);
      env2.rr(VW2 - 4, ty, 3, thumbH, 1.5);
      ctx2.fill();
      ctx2.restore();
    }
    env2.fillText("\u5FAE\u4FE1\u5C0F\u6E38\u620F \xB7 \u8BD5\u8FD0\u8425\u5305", VW2 / 2, VH2 - 12, { size: 10, color: "rgba(124,141,176,0.7)", align: "center" });
    drawOverlays(env2, time);
  }
  function drawBriefing(env2, time) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    env2.drawSpaceBg(time);
    holoAtmosphere(env2, time);
    const lv = env2.LEVELS.find((l) => l.id === env2.app.levelId) ?? env2.LEVELS[0];
    holoHeader(env2, time, "\u4EFB\u52A1\u7B80\u62A5", () => {
      env2.stopNarration();
      env2.goto("home");
    });
    const p0 = enterP(env2, 0);
    const bannerH = Math.min(168, Math.round(VW2 * 0.45));
    const bx = MARGIN2;
    const bw = VW2 - MARGIN2 * 2;
    const by = env2.TOP_SAFE + 6 + (1 - p0) * 14;
    ctx2.save();
    ctx2.globalAlpha = p0;
    env2.drawCardArt(bx, by, bw, bannerH, lv.id, time, env2.RADIUS);
    ctx2.save();
    env2.rr(bx, by, bw, bannerH, env2.RADIUS);
    ctx2.clip();
    const g = ctx2.createLinearGradient(bx, by + bannerH * 0.4, bx, by + bannerH);
    g.addColorStop(0, "rgba(7,11,24,0)");
    g.addColorStop(1, "rgba(7,11,24,0.82)");
    ctx2.fillStyle = g;
    ctx2.fillRect(bx, by, bw, bannerH);
    const swx = bx - 90 + time * 46 % (bw + 180);
    const sg = ctx2.createLinearGradient(swx - 34, 0, swx + 34, 0);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.13));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(swx - 34, by, 68, bannerH);
    ctx2.restore();
    ctx2.save();
    env2.rr(bx, by, bw, bannerH, env2.RADIUS);
    ctx2.strokeStyle = env2.ac(0.4);
    ctx2.lineWidth = 1.2;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText(`\u7B2C ${lv.id} \u7AE0`, bx + 16, by + bannerH - 44, { size: 11, color: env2.C.cyan, weight: "600" });
    env2.fillText(lv.name, bx + 16, by + bannerH - 20, { size: 19 });
    env2.fillText(lv.sub, bx + bw - 16, by + bannerH - 20, { size: 11, color: env2.C.sub, align: "right", weight: "normal" });
    holoBtn(env2, {
      x: bx + bw - 88,
      y: by + 10,
      w: 78,
      h: 30,
      label: env2.narrationMuted() ? "\u{1F507} \u65C1\u767D" : "\u{1F50A} \u65C1\u767D",
      color: env2.narrationMuted() ? env2.C.sub : env2.C.cyan,
      cb: () => env2.toggleNarrationMuted()
    }, time);
    ctx2.restore();
    const p1 = enterP(env2, 1);
    const textSize = 12;
    const lineH = textSize * 1.65;
    const textW = VW2 - MARGIN2 * 2 - 32;
    let totalLines = 0;
    for (const para of lv.briefing) totalLines += env2.wrapCount(para, textW, textSize) + 0.6;
    const boxY = by + bannerH + 12;
    const boxH = Math.ceil(totalLines * lineH) + 26;
    ctx2.save();
    ctx2.globalAlpha = p1;
    ctx2.translate(0, (1 - p1) * 14);
    holoPanel(env2, MARGIN2, boxY, VW2 - MARGIN2 * 2, boxH, time, env2.C.panelLine);
    let ty = boxY + 24;
    for (const para of lv.briefing) ty = env2.wrapBlock(para, MARGIN2 + 16, ty, textW, { size: textSize }) + lineH * 0.6;
    ctx2.restore();
    const p2 = enterP(env2, 2);
    ctx2.save();
    ctx2.globalAlpha = p2;
    ctx2.translate(0, (1 - p2) * 14);
    const afterY = boxY + boxH + 18;
    const diffTxt = `\u96BE\u5EA6 ${env2.DIFFICULTIES[env2.app.difficulty].name} \xB7 ${env2.DIFFICULTIES[env2.app.difficulty].label}`;
    ctx2.save();
    ctx2.font = "bold 11px sans-serif";
    const dw = ctx2.measureText(diffTxt).width + 24;
    env2.rr(VW2 / 2 - dw / 2, afterY - 11, dw, 22, 11);
    ctx2.fillStyle = "rgba(255,201,77,0.12)";
    ctx2.fill();
    ctx2.strokeStyle = `rgba(255,201,77,${0.3 + 0.2 * Math.sin(time * 2.2)})`;
    ctx2.lineWidth = 1;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText(diffTxt, VW2 / 2, afterY + 0.5, { size: 11, color: env2.C.gold, align: "center" });
    if (env2.app.coop) {
      const coopTxt = "\u53CC\u4EBA\u540C\u5C4F \xB7 P1 \u5EFA\u9020 \xB7 P2 \u6307\u6325";
      ctx2.save();
      ctx2.font = "bold 11px sans-serif";
      const cw = ctx2.measureText(coopTxt).width + 24;
      env2.rr(VW2 / 2 - cw / 2, afterY + 13, cw, 22, 11);
      ctx2.fillStyle = "rgba(61,240,140,0.12)";
      ctx2.fill();
      ctx2.strokeStyle = `rgba(61,240,140,${0.3 + 0.2 * Math.sin(time * 2.2)})`;
      ctx2.lineWidth = 1;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(coopTxt, VW2 / 2, afterY + 24.5, { size: 11, color: env2.C.green, align: "center" });
    }
    holoBtn(env2, { x: VW2 / 2 - 100, y: afterY + 42, w: 200, h: 54, label: "\u25B6 \u51FA \u51FB", primary: true, cb: () => env2.startBattle() }, time);
    holoBtn(env2, { x: VW2 / 2 - 100, y: afterY + 118, w: 200, h: 46, label: "\u8FD4\u56DE\u9009\u5173", color: env2.C.sub, cb: () => {
      env2.stopNarration();
      env2.goto("home");
    } }, time);
    ctx2.restore();
    drawOverlays(env2, time);
  }
  function drawBattleHUD(env2, engine) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2 } = env2;
    const st = engine.state;
    const time = st.clock;
    const barX = 12;
    const barY = env2.TOP_SAFE;
    const barW = VW2 - barX * 2;
    const barH = 34;
    const midY = barY + barH / 2;
    holoPanel(env2, barX, barY, barW, barH, time, env2.C.panelLine, 12);
    const resFont = env2.RES_FONT();
    const livesTxt = `\u2764 ${st.lives}`;
    const goldTxt = `\u25C8 ${st.gold}`;
    const waveTxt = `${st.wave}/${st.totalWaves}`;
    ctx2.save();
    ctx2.font = `bold 12px ${resFont}`;
    const livesW = ctx2.measureText(livesTxt).width;
    const goldW = ctx2.measureText(goldTxt).width;
    const waveW = ctx2.measureText(waveTxt).width;
    ctx2.restore();
    const divider = (x, tall) => {
      const dh = tall ? 22 : 14;
      ctx2.save();
      ctx2.strokeStyle = env2.ac(tall ? 0.35 : 0.18);
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(x, midY - dh / 2);
      ctx2.lineTo(x, midY + dh / 2);
      ctx2.stroke();
      ctx2.restore();
    };
    let sx = barX + 14;
    ctx2.save();
    if (st.lives <= 5) ctx2.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 6));
    env2.fillText(livesTxt, sx, midY, { size: 12, color: env2.C.red, font: resFont });
    ctx2.restore();
    sx += livesW + 10;
    divider(sx, false);
    sx += 10;
    env2.fillText(goldTxt, sx, midY, { size: 12, color: env2.C.gold, font: resFont });
    sx += goldW + 10;
    divider(sx, false);
    sx += 10;
    env2.fillText(waveTxt, sx, midY - 2, { size: 12, color: env2.C.cyan, font: resFont });
    const progY = midY + 8;
    ctx2.save();
    ctx2.fillStyle = env2.ac(0.15);
    ctx2.fillRect(sx, progY, waveW, 2);
    ctx2.fillStyle = env2.C.cyan;
    ctx2.fillRect(sx, progY, waveW * clamp01(st.wave / st.totalWaves), 2);
    ctx2.restore();
    const cmdW = 30;
    const btnsX = barX + barW - 6 - cmdW * 3;
    divider(btnsX - 8, true);
    const cmds = [
      [st.paused ? "\u25B6" : "\u23F8", st.paused, st.paused ? env2.C.gold : env2.C.text, () => env2.engineCmd({ type: "TOGGLE_PAUSE" })],
      [st.speed === 2 ? "2x" : "1x", st.speed === 2, st.speed === 2 ? env2.C.cyan : env2.C.text, () => env2.engineCmd({ type: "SET_SPEED", speed: st.speed === 2 ? 1 : 2 })],
      ["\u2261", false, env2.C.text, () => {
        env2.app.engine = null;
        env2.goto("home");
      }]
    ];
    cmds.forEach(([label, active, color, cb], i) => {
      const bx = btnsX + i * cmdW;
      if (active) {
        ctx2.save();
        env2.rr(bx + 2, barY + 5, cmdW - 4, barH - 10, 8);
        ctx2.fillStyle = env2.ac(0.18);
        ctx2.fill();
        ctx2.restore();
      }
      env2.fillText(label, bx + cmdW / 2, midY, { size: 13, color, align: "center" });
      env2.hitBox({ x: bx, y: barY, w: cmdW, h: barH, label: "", cb });
    });
    if (st.phase === "prep") {
      const by2 = barY + barH + 8;
      holoPanel(env2, VW2 / 2 - 118, by2, 236, 56, time, env2.C.panelLine, 19);
      const cd = Math.max(0, Math.ceil(st.prepT));
      const urgent = st.prepT <= 3;
      ctx2.save();
      if (urgent) {
        const s = 1 + 0.08 * Math.sin(time * 10);
        ctx2.translate(VW2 / 2, by2 + 15);
        ctx2.scale(s, s);
        ctx2.translate(-VW2 / 2, -(by2 + 15));
      }
      env2.fillText(`\u7B2C ${st.wave} \u6CE2 \xB7 ${cd}s \u540E\u6765\u88AD`, VW2 / 2, by2 + 15, { size: 13, align: "center", color: urgent ? env2.C.gold : env2.C.text, font: env2.RES_FONT() });
      ctx2.restore();
      const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
      const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
      const summary = [...new Set(groups.map((gsp) => `${env2.ENEMIES[gsp.type].name}\xD7${gsp.count}`))].join(" ");
      env2.fillText(`${isBossWave ? "\u26A0 BOSS \u6CE2 \xB7 " : ""}${summary}`, VW2 / 2, by2 + 34, { size: 9, color: isBossWave ? env2.C.pink : "#FF9F43", align: "center", weight: "normal" });
      env2.fillText(
        env2.app.coop ? "P1 \u5EFA\u9020\u9632\u7EBF \xB7 P2 \u628A\u63E1\u5347\u7EA7\u4E0E\u79D1\u6280\u65F6\u673A" : isBossWave ? "\u5EFA\u8BAE\u7559\u597D\u91D1\u5E01\u4E0E\u7A7F\u7532\u706B\u529B" : "\u636E\u6B64\u63D0\u524D\u8C03\u6574\u5E03\u9632",
        VW2 / 2,
        by2 + 47,
        { size: 9, color: env2.C.sub, align: "center", weight: "normal" }
      );
      holoBtn(env2, { x: VW2 / 2 - 62, y: by2 + 66, w: 124, h: 36, label: "\u25B6 \u7ACB\u5373\u5F00\u6218", color: env2.C.gold, primary: true, cb: () => env2.engineCmd({ type: "SKIP_PREP" }) }, time);
    }
  }
  function drawBottomBar(env2, engine) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, BAR_H: BAR_H2 } = env2;
    const st = engine.state;
    const time = st.clock;
    ctx2.save();
    const bg = ctx2.createLinearGradient(0, VH2 - BAR_H2, 0, VH2);
    bg.addColorStop(0, "rgba(13,20,42,0.96)");
    bg.addColorStop(1, "rgba(8,12,26,0.96)");
    ctx2.fillStyle = bg;
    ctx2.fillRect(0, VH2 - BAR_H2, VW2, BAR_H2);
    ctx2.strokeStyle = env2.ac(0.28);
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(0, VH2 - BAR_H2 + 0.5);
    ctx2.lineTo(VW2, VH2 - BAR_H2 + 0.5);
    ctx2.stroke();
    ctx2.strokeStyle = env2.ac(0.5);
    ctx2.setLineDash([18, 66]);
    ctx2.lineDashOffset = -time * 70;
    ctx2.beginPath();
    ctx2.moveTo(0, VH2 - BAR_H2 + 0.5);
    ctx2.lineTo(VW2, VH2 - BAR_H2 + 0.5);
    ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.restore();
    if (st.phase === "tech") return;
    const sel = env2.app.selectedId != null ? st.towers.find((t) => t.id === env2.app.selectedId) : void 0;
    if (sel) {
      const def = env2.TOWERS[sel.type];
      env2.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN2 + 4, VH2 - BAR_H2 + 17, { size: 12, color: def.color });
      const upCost = sel.level < 2 ? def.levels[sel.level + 1].cost : -1;
      holoBtn(env2, {
        x: MARGIN2,
        y: VH2 - BAR_H2 + 30,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: upCost >= 0 ? `\u5347\u7EA7 \u25C8 ${upCost}` : "\u5DF2\u6EE1\u7EA7",
        disabled: upCost < 0 || st.gold < upCost,
        color: env2.C.green,
        primary: upCost >= 0 && st.gold >= upCost,
        cb: () => {
          if (env2.engineCmd({ type: "UPGRADE", id: sel.id })) {
            env2.sfx.play("upgrade");
            env2.buzz("light");
          }
        }
      }, time);
      const refund = Math.floor(sel.invested * env2.SELL_RATE);
      holoBtn(env2, {
        x: VW2 / 2 + 6,
        y: VH2 - BAR_H2 + 30,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: `\u51FA\u552E +${refund}`,
        color: "#FF9F43",
        cb: () => {
          if (env2.engineCmd({ type: "SELL", id: sel.id })) env2.sfx.play("sell");
          env2.app.selectedId = null;
        }
      }, time);
      return;
    }
    if (env2.app.placing) {
      const def = env2.TOWERS[env2.app.placing];
      env2.fillText(`\u70B9\u51FB\u5730\u56FE\u4E0A\u7EFF\u8272\u683C\u5EFA\u9020\u300C${def.name}\u300D`, VW2 / 2, VH2 - BAR_H2 + 20, { size: 12, color: def.color, align: "center" });
      holoBtn(env2, { x: VW2 / 2 - 76, y: VH2 - BAR_H2 + 32, w: 152, h: 44, label: "\u53D6\u6D88\u653E\u7F6E", cb: () => {
        env2.app.placing = null;
      } }, time);
      return;
    }
    const sw = env2.SLOT_W;
    const slotH = BAR_H2 - 24;
    const viewX = MARGIN2;
    const viewW = VW2 - MARGIN2 * 2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(viewX - 4, VH2 - BAR_H2 + 4, viewW + 8, BAR_H2 - 8);
    ctx2.clip();
    env2.TOWER_ORDER.forEach((type, i) => {
      const def = env2.TOWERS[type];
      const cost = def.levels[0].cost;
      const locked = !env2.towerUnlocked(type);
      const bx = viewX + i * (sw + env2.SLOT_GAP) - env2.barScroll;
      const by = VH2 - BAR_H2 + 12;
      if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
      const disabled = locked || st.gold < cost;
      ctx2.save();
      ctx2.globalAlpha = disabled ? 0.55 : 1;
      env2.rr(bx, by, sw, slotH, 12);
      const gg = ctx2.createLinearGradient(bx, by, bx, by + slotH);
      gg.addColorStop(0, "rgba(24,34,66,0.92)");
      gg.addColorStop(1, "rgba(13,19,40,0.92)");
      ctx2.fillStyle = gg;
      ctx2.fill();
      if (!disabled) {
        ctx2.shadowColor = def.color;
        ctx2.shadowBlur = 5 + 3 * Math.sin(time * 2 + i * 1.3);
      }
      ctx2.strokeStyle = disabled ? "rgba(124,141,176,0.4)" : `${def.color}AA`;
      ctx2.lineWidth = 1.4;
      ctx2.stroke();
      ctx2.shadowBlur = 0;
      ctx2.save();
      env2.rr(bx, by, sw, slotH, 12);
      ctx2.clip();
      const sy = by + (time * 22 + i * 26) % (slotH + 20) - 10;
      ctx2.fillStyle = env2.ac(0.08);
      ctx2.fillRect(bx, sy, sw, 5);
      ctx2.restore();
      ctx2.translate(bx + sw / 2, by + 27);
      env2.drawTower(ctx2, type, 0, 40, Math.sin(time * 1.1) * 0.1, 0, time, { ticks: false });
      ctx2.restore();
      env2.fillText(`\u25C8${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? "#C77A34" : env2.C.gold, align: "center" });
      if (locked) {
        ctx2.save();
        env2.rr(bx, by, sw, slotH, 12);
        ctx2.fillStyle = "rgba(7,11,24,0.55)";
        ctx2.fill();
        ctx2.strokeStyle = env2.C.sub;
        ctx2.lineWidth = 1.6;
        const lx = bx + sw / 2;
        const ly = by + 25;
        ctx2.beginPath();
        ctx2.rect(lx - 7, ly - 1, 14, 11);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.arc(lx, ly - 1, 5, Math.PI, 0);
        ctx2.stroke();
        ctx2.restore();
        env2.fillText(`\u7B2C${env2.TOWER_UNLOCK[type]}\u7AE0`, bx + sw / 2, by + 54, { size: 10, color: env2.C.sub, align: "center" });
      }
    });
    ctx2.restore();
    if (env2.stripMaxScroll > 0) {
      if (env2.barScroll > 0) {
        const gl = ctx2.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
        gl.addColorStop(0, "rgba(10,15,32,0.95)");
        gl.addColorStop(1, "rgba(10,15,32,0)");
        ctx2.fillStyle = gl;
        ctx2.fillRect(viewX - 4, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
      if (env2.barScroll < env2.stripMaxScroll) {
        const gr = ctx2.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
        gr.addColorStop(0, "rgba(10,15,32,0)");
        gr.addColorStop(1, "rgba(10,15,32,0.95)");
        ctx2.fillStyle = gr;
        ctx2.fillRect(viewX + viewW - 18, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
    }
  }
  function drawDragGhost(env2, engine, type, p) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    const st = engine.state;
    const def = env2.TOWERS[type];
    const gx = Math.floor(env2.toMapX(p.x) / CELL);
    const gy = Math.floor(env2.toMapY(p.y) / CELL);
    const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
    const canBuild = inMap && engine.map.isBuildable(gx, gy) && !st.towers.some((tw) => tw.col === gx && tw.row === gy) && st.gold >= def.levels[0].cost;
    if (inMap) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.rect(0, env2.TOP_SAFE - 2, VW2, VH2 - env2.BAR_H - env2.TOP_SAFE + 2);
      ctx2.clip();
      const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
      ctx2.translate(env2.mapOX + (Math.random() - 0.5) * shk * 2, env2.mapOY + env2.getMapPan() + (Math.random() - 0.5) * shk);
      ctx2.scale(env2.mapScale, env2.mapScale);
      const cx = gx * CELL;
      const cy = gy * CELL;
      ctx2.fillStyle = canBuild ? "rgba(61,240,140,0.18)" : "rgba(255,90,90,0.16)";
      ctx2.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
      ctx2.strokeStyle = canBuild ? env2.C.green : env2.C.red;
      ctx2.lineWidth = 2.5;
      const cl = CELL * 0.24;
      ctx2.beginPath();
      ctx2.moveTo(cx + 2, cy + 2 + cl);
      ctx2.lineTo(cx + 2, cy + 2);
      ctx2.lineTo(cx + 2 + cl, cy + 2);
      ctx2.moveTo(cx + CELL - 2 - cl, cy + 2);
      ctx2.lineTo(cx + CELL - 2, cy + 2);
      ctx2.lineTo(cx + CELL - 2, cy + 2 + cl);
      ctx2.moveTo(cx + CELL - 2, cy + CELL - 2 - cl);
      ctx2.lineTo(cx + CELL - 2, cy + CELL - 2);
      ctx2.lineTo(cx + CELL - 2 - cl, cy + CELL - 2);
      ctx2.moveTo(cx + 2 + cl, cy + CELL - 2);
      ctx2.lineTo(cx + 2, cy + CELL - 2);
      ctx2.lineTo(cx + 2, cy + CELL - 2 - cl);
      ctx2.stroke();
      if (canBuild) {
        ctx2.save();
        ctx2.strokeStyle = `${def.color}66`;
        ctx2.lineWidth = 1.5;
        ctx2.setLineDash([10, 8]);
        ctx2.lineDashOffset = -st.clock * 24;
        ctx2.beginPath();
        ctx2.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.globalAlpha = 0.85;
        ctx2.translate(cx + CELL / 2, cy + CELL / 2);
        env2.drawTower(ctx2, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
        ctx2.restore();
      }
      ctx2.restore();
    }
    const msg = canBuild ? "\u677E\u624B\u5EFA\u9020" : inMap ? "\u6B64\u5904\u4E0D\u53EF\u5EFA\u9020" : "\u62D6\u5230\u5730\u56FE\u7A7A\u683C\u4E0A";
    const mc = canBuild ? env2.C.green : env2.C.sub;
    ctx2.save();
    ctx2.font = "bold 12px sans-serif";
    const mw = ctx2.measureText(msg).width + 30;
    env2.rr(VW2 / 2 - mw / 2, VH2 - env2.BAR_H - 36, mw, 24, 12);
    ctx2.fillStyle = "rgba(10,16,34,0.85)";
    ctx2.fill();
    ctx2.strokeStyle = `${mc}66`;
    ctx2.lineWidth = 1;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText(msg, VW2 / 2, VH2 - env2.BAR_H - 23.5, { size: 12, color: mc, align: "center" });
  }
  function drawTechOverlay(env2, engine) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    const st = engine.state;
    const time = st.clock;
    ctx2.fillStyle = "rgba(7,11,24,0.92)";
    ctx2.fillRect(0, 0, VW2, VH2);
    holoAtmosphere(env2, time);
    env2.fillText("TACTICAL MODULE", VW2 / 2, env2.TOP_SAFE + 12, { size: 11, color: env2.C.cyan, align: "center", weight: "600" });
    env2.fillText(`\u7B2C ${st.wave} \u6CE2\u524D \xB7 \u9009\u62E9\u6218\u672F\u6A21\u5757`, VW2 / 2, env2.TOP_SAFE + 42, { size: 19, align: "center" });
    env2.fillText(`\u4E09\u9009\u4E00 \xB7 \u540C\u540D\u53EF\u53E0\u52A0 \xB7 \u5DF2\u88C5 ${st.techs.length}`, VW2 / 2, env2.TOP_SAFE + 66, { size: 11, color: env2.C.sub, align: "center", weight: "normal" });
    const taken = {};
    for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
    const cardH = 128;
    const top = env2.TOP_SAFE + 92;
    st.techChoices.forEach((id, i) => {
      const y = top + i * (cardH + 16);
      const def = env2.TECHS[id];
      const at = (Date.now() - env2.getTechShownAt()) / 1e3 - 0.1 - i * 0.11;
      const e = easeOut(clamp01(at / 0.45));
      if (e <= 0) return;
      const cx = VW2 / 2;
      const cy = y + cardH / 2;
      ctx2.save();
      ctx2.globalAlpha = e;
      ctx2.translate(cx, cy);
      ctx2.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e);
      ctx2.translate(-cx, -cy);
      holoPanel(env2, MARGIN2, y, VW2 - MARGIN2 * 2, cardH, time + i, `${def.color}55`);
      ctx2.save();
      env2.rr(MARGIN2 + 16, y + (cardH - 64) / 2, 64, 64, 12);
      ctx2.fillStyle = `${def.color}1A`;
      ctx2.fill();
      ctx2.strokeStyle = `${def.color}88`;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(def.glyph, MARGIN2 + 48, y + cardH / 2 + Math.sin(time * 2.4 + i * 1.7) * 2, { size: 30, color: def.color, align: "center" });
      const tx = MARGIN2 + 96;
      const textW = VW2 - MARGIN2 * 2 - 96 - 16;
      const descLines = env2.wrapCount(def.desc, textW, 12);
      const blockH = 24 + descLines * 12 * 1.65;
      const ty0 = y + cardH / 2 - blockH / 2;
      env2.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
      if (taken[id]) env2.chip(MARGIN2 + (VW2 - MARGIN2 * 2) - 12, y + 22, `\u5DF2\u88C5\xD7${taken[id]}`, def.color);
      env2.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: "rgba(141,160,198,1)", size: 12 });
      ctx2.restore();
      env2.hitBox({ x: MARGIN2, y, w: VW2 - MARGIN2 * 2, h: cardH, label: "", cb: () => {
        if (env2.engineCmd({ type: "PICK_TECH", id })) env2.sfx.play("tech");
      } });
    });
    env2.fillText("\u70B9\u9009\u6A21\u5757\u5361 \xB7 \u88C5\u5165\u9632\u7EBF\u7CFB\u7EDF", VW2 / 2, top + 3 * (cardH + 16) + 8, { size: 10, color: env2.C.dim, align: "center", weight: "normal" });
  }
  function drawResult(env2, time) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2 } = env2;
    env2.drawSpaceBg(time);
    holoAtmosphere(env2, time);
    const won = env2.app.result.won;
    const st = env2.app.engine.state;
    const oi = env2.getOnlineInfo();
    const t = (Date.now() - env2.getScreenAt()) / 1e3;
    if (won && t < 3) {
      const r0 = env2.rng(99);
      for (let i = 0; i < 56; i++) {
        const x0 = r0() * VW2;
        const delay = r0() * 0.6;
        const vy = 130 + r0() * 170;
        const vx = (r0() - 0.5) * 70;
        const size = 3 + r0() * 4;
        const rot = r0() * Math.PI;
        const spin = (r0() - 0.5) * 9;
        const color = [env2.C.cyan, env2.C.gold, env2.C.green, env2.C.pink][Math.floor(r0() * 4)];
        const t2 = t - delay;
        if (t2 <= 0) continue;
        ctx2.save();
        ctx2.globalAlpha = t2 > 2.4 ? Math.max(0, (3 - t2) / 0.6) : 1;
        ctx2.translate(x0 + vx * t2, -12 + vy * t2 + 60 * t2 * t2);
        ctx2.rotate(rot + spin * t2);
        ctx2.fillStyle = color;
        ctx2.fillRect(-size / 2, -size / 2, size, size * 0.62);
        ctx2.restore();
      }
    }
    if (!won) {
      ctx2.save();
      ctx2.globalAlpha = 0.22 + 0.08 * Math.sin(time * 2);
      const rg = ctx2.createRadialGradient(VW2 / 2, env2.VH / 2, Math.min(VW2, env2.VH) * 0.32, VW2 / 2, env2.VH / 2, Math.max(VW2, env2.VH) * 0.72);
      rg.addColorStop(0, "rgba(255,61,90,0)");
      rg.addColorStop(1, "rgba(255,61,90,0.5)");
      ctx2.fillStyle = rg;
      ctx2.fillRect(0, 0, VW2, env2.VH);
      ctx2.restore();
    }
    holoHeader(env2, time, env2.app.coop || oi ? "\u534F\u540C\u4F5C\u6218\u7ED3\u7B97" : "\u6218\u6597\u7ED3\u7B97", () => env2.goto("home"));
    const y0 = env2.TOP_SAFE + 16;
    const bt = Math.min(1, t / 0.45);
    const bounce = 1 + 2.7 * (bt - 1) ** 3 + 1.7 * (bt - 1) ** 2;
    ctx2.save();
    ctx2.translate(VW2 / 2, y0);
    ctx2.scale(bounce, bounce);
    env2.fillText(won ? "\u2605 \u9632\u7EBF\u5B88\u4F4F\u4E86" : "\u2715 \u9632\u7EBF\u5931\u5B88", -1.5, 0, { size: 26, color: env2.ac(0.5), align: "center" });
    env2.fillText(won ? "\u2605 \u9632\u7EBF\u5B88\u4F4F\u4E86" : "\u2715 \u9632\u7EBF\u5931\u5B88", 0, 0, { size: 26, color: won ? env2.C.green : env2.C.pink, align: "center" });
    ctx2.restore();
    env2.fillText(
      won ? oi ? "\u5728\u7EBF\u534F\u540C \xB7 \u53CC\u5B50\u661F\u95E8" : `\u7B2C ${env2.app.levelId} \u7AE0 \xB7 ${env2.LEVELS.find((l) => l.id === env2.app.levelId)?.name ?? ""}` : `\u6491\u5230\u4E86\u7B2C ${st.wave} / ${st.totalWaves} \u6CE2`,
      VW2 / 2,
      y0 + 32,
      { size: 13, color: env2.C.sub, align: "center", weight: "normal" }
    );
    const settle = env2.getLastSettlement();
    const myKills = oi ? st.killsBy?.[oi.player] ?? st.kills : st.kills;
    const rows = [
      ["\u51FB\u6740", String(myKills), myKills],
      ["\u6F0F\u602A", String(st.leaked), st.leaked],
      ["\u5269\u4F59\u751F\u547D", `${st.lives} / ${st.maxLives}`, null],
      ["\u8D5A\u53D6\u91D1\u5E01", String(st.goldEarned), st.goldEarned],
      ["\u6218\u672F\u6A21\u5757", String(st.techs.length), st.techs.length],
      ["\u79EF\u5206", `+${settle?.score ?? 0}`, settle?.score ?? 0, env2.C.gold, true]
    ];
    if (oi) rows.splice(1, 0, ["\u5728\u7EBF\u534F\u540C", `\u961F\u53CB ${oi.peerNick || "\u2014"}`, null, env2.C.cyan]);
    const px = 24;
    const pw = VW2 - 48;
    const py = y0 + 58;
    const rowH = 34;
    const panelH = rows.length * rowH + 20;
    holoPanel(env2, px, py, pw, panelH, time, env2.C.panelLine);
    ctx2.save();
    env2.rr(px, py, pw, panelH, env2.RADIUS);
    ctx2.clip();
    const sweepT = t * 0.55 % 1.8;
    if (sweepT < 1) {
      const sx = px - 80 + sweepT * (pw + 160);
      const sgc = ctx2.createLinearGradient(sx - 40, 0, sx + 40, 0);
      sgc.addColorStop(0, env2.ac(0));
      sgc.addColorStop(0.5, env2.ac(0.14));
      sgc.addColorStop(1, env2.ac(0));
      ctx2.fillStyle = sgc;
      ctx2.fillRect(sx - 40, py, 80, panelH);
    }
    ctx2.restore();
    rows.forEach(([k, v, num, color, plus], i) => {
      const ry = py + 27 + i * rowH;
      env2.fillText(k, px + 22, ry, { size: 13, color: color ?? env2.C.sub, weight: "normal" });
      const shown = num === null ? v : `${plus ? "+" : ""}${Math.round(num * clamp01((t - 0.25 - i * 0.12) / 0.6))}`;
      env2.fillText(shown, px + pw - 22, ry, { size: 16, align: "right", font: env2.RES_FONT(), color });
      if (i < rows.length - 1) {
        ctx2.save();
        ctx2.strokeStyle = "rgba(124,141,176,0.12)";
        ctx2.beginPath();
        ctx2.moveTo(px + 22, ry + rowH / 2);
        ctx2.lineTo(px + pw - 22, ry + rowH / 2);
        ctx2.stroke();
        ctx2.restore();
      }
    });
    const grade = !won ? "D" : st.leaked === 0 ? "S" : st.leaked <= 2 ? "A" : "B";
    const gradeColor = grade === "S" ? env2.C.gold : grade === "A" ? env2.C.green : grade === "B" ? env2.C.cyan : env2.C.pink;
    const gxp = px + 44;
    const gyp = py + panelH + 46;
    const ge = clamp01((t - 0.9) / 0.35);
    ctx2.save();
    ctx2.globalAlpha = ge;
    const gs = 1.6 - 0.6 * easeOut(ge);
    ctx2.translate(gxp, gyp);
    ctx2.scale(gs, gs);
    ctx2.strokeStyle = gradeColor;
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.arc(0, 0, 26, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.setLineDash([6, 7]);
    ctx2.lineDashOffset = -time * 16;
    ctx2.lineWidth = 1.2;
    ctx2.globalAlpha = ge * 0.6;
    ctx2.beginPath();
    ctx2.arc(0, 0, 32, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.setLineDash([]);
    env2.fillText(grade, 0, -1, { size: 30, color: gradeColor, align: "center", font: env2.RES_FONT() });
    ctx2.restore();
    ctx2.save();
    ctx2.globalAlpha = ge;
    env2.fillText(["\u5B8C\u7F8E\u9632\u7EBF", "\u9632\u5B88\u597D\u624B", "\u5B88\u4F4F\u9632\u7EBF", "\u9632\u7EBF\u5931\u5B88"][["S", "A", "B", "D"].indexOf(grade)], gxp + 46, gyp - 8, { size: 15, color: gradeColor });
    env2.fillText(won ? oi ? "\u534F\u540C\u52A0\u6210 \xD71.2 \u5DF2\u5165\u8D26" : "\u4E0B\u4E00\u7AE0\u89E3\u9501\u5DF2\u8BB0\u5F55" : "\u518D\u6311\u6218\u4E00\u6B21\u5C31\u80FD\u901A\u8FC7", gxp + 46, gyp + 12, { size: 10, color: env2.C.sub, weight: "normal" });
    const rprog = env2.getRankProgress();
    env2.fillText(
      rprog.next === null ? `${rprog.name} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `${rprog.name} \xB7 \u8DDD\u300C${rprog.nextName}\u300D\u8FD8\u5DEE ${(rprog.next - rprog.points).toLocaleString("en-US")} \u5206`,
      gxp + 46,
      gyp + 30,
      { size: 10, color: env2.C.gold, weight: "normal" }
    );
    ctx2.restore();
    let y = gyp + 48;
    const nextId = env2.app.levelId + 1;
    const hasNext = !oi && env2.LEVELS.some((l) => l.id === nextId);
    const bp = enterP(env2, 3);
    ctx2.save();
    ctx2.globalAlpha = bp;
    ctx2.translate(0, (1 - bp) * 14);
    if (won) {
      holoBtn(env2, { x: px, y, w: pw, h: 44, label: "\u25C8 \u53CC\u500D\u6218\u5229 \xB7 \u89C2\u770B\u89C6\u9891", color: env2.C.gold, cb: () => env2.showToast("\u5E7F\u544A\u6A21\u5757\u5F00\u53D1\u4E2D") }, time);
      y += 54;
    }
    if (won && hasNext) {
      holoBtn(env2, { x: px, y, w: pw, h: 48, label: `\u25B6 \u8FDB\u5165\u7B2C ${nextId} \u7AE0`, color: env2.C.green, primary: true, cb: () => env2.gotoBriefing(nextId) }, time);
      y += 58;
    }
    holoBtn(env2, {
      x: px,
      y,
      w: pw,
      h: 42,
      label: "\u{1F4E3} \u70AB\u8000\u6218\u7EE9",
      color: env2.C.pink,
      cb: () => {
        env2.track("share_click", { channel: "result", result: won ? "win" : "lose", wave: st.wave });
        env2.shareAppMessage({
          title: won ? `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u5B88\u4F4F\u4E86\u7B2C ${env2.app.levelId} \u5173 \xB7 \u5168 ${st.totalWaves} \u6CE2\uFF0C\u6F0F\u602A ${st.leaked}\uFF01` : `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u7B2C ${env2.app.levelId} \u5173\u6491\u5230\u4E86\u7B2C ${st.wave} \u6CE2\uFF0C\u6C42\u652F\u63F4\uFF01`,
          imageUrl: "assets/share-cover.jpg"
        });
      }
    }, time);
    y += 52;
    holoBtn(env2, { x: px, y, w: (pw - 12) / 2, h: 42, label: won ? "\u518D\u6765\u4E00\u5C40" : "\u518D\u6218\u672C\u5173", color: env2.C.gold, cb: () => env2.gotoBriefing(env2.app.levelId) }, time);
    holoBtn(env2, { x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 42, label: "\u8FD4\u56DE\u9009\u5173", cb: () => env2.goto("home") }, time);
    ctx2.restore();
    drawOverlays(env2, time);
  }
  function drawSettings(env2, time = Date.now() / 1e3) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    if (!settingsWasOpen) {
      settingsOpenAt = Date.now();
      settingsWasOpen = true;
    }
    const e = easeOut(clamp01((Date.now() - settingsOpenAt) / 220));
    ctx2.fillStyle = "rgba(7,11,24,0.78)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.hitBox({ x: 0, y: 0, w: VW2, h: VH2, label: "", cb: () => {
    } });
    const pw = VW2 - 72;
    const px = 36;
    const rowH = 56;
    const rows = [
      ["\u{1F50A}", "\u97F3\u6548", "\u653B\u51FB / \u7206\u70B8 / \u91D1\u5E01\u7B49\u6218\u6597\u97F3\u6548", !env2.sfx.muted, () => env2.sfx.setMuted(!env2.sfx.muted)],
      ["\u{1F3B5}", "\u97F3\u4E50", "\u4E3B\u9875\u4E0E\u6218\u6597\u80CC\u666F\u97F3\u4E50", !env2.musicMuted(), () => env2.toggleMusicMuted()],
      ["\u{1F399}", "\u65C1\u767D", "\u4EFB\u52A1\u7B80\u62A5\u8BED\u97F3\u89E3\u8BF4", !env2.narrationMuted(), () => env2.toggleNarrationMuted()],
      ["\u{1F4F3}", "\u9707\u52A8", "\u5EFA\u9020 / \u6F0F\u602A / BOSS \u6218\u89E6\u611F\u53CD\u9988", !env2.vibrateMuted(), () => env2.toggleVibrateMuted()],
      ["\u2728", "\u9AD8\u753B\u8D28", "Bloom \u8F89\u5149\u7279\u6548\uFF0C\u4F4E\u7AEF\u673A\u5EFA\u8BAE\u5173\u95ED", env2.readQualityHigh(), () => env2.setQualityHigh(!env2.readQualityHigh())]
    ];
    const skinH = 74;
    const ph = 72 + rows.length * rowH + skinH + 68;
    const py = VH2 / 2 - ph / 2;
    ctx2.save();
    ctx2.globalAlpha = e;
    ctx2.translate(VW2 / 2, VH2 / 2);
    ctx2.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e);
    ctx2.translate(-VW2 / 2, -VH2 / 2);
    holoPanel(env2, px, py, pw, ph, time, env2.C.panelLine);
    env2.fillText("SETTINGS", VW2 / 2, py + 24, { size: 9, color: env2.ac(0.7), weight: "600", align: "center" });
    env2.fillText("\u8BBE\u7F6E\u4E2D\u5FC3", VW2 / 2, py + 46, { size: 17, align: "center" });
    rows.forEach(([icon, label, desc, on, cb], i) => {
      const y = py + 66 + i * rowH;
      if (i > 0) {
        ctx2.save();
        ctx2.strokeStyle = env2.ac(0.1);
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(px + 20, y + 0.5);
        ctx2.lineTo(px + pw - 20, y + 0.5);
        ctx2.stroke();
        ctx2.restore();
      }
      env2.fillText(icon, px + 34, y + rowH / 2, { size: 16, align: "center" });
      env2.fillText(label, px + 56, y + 19, { size: 14 });
      env2.fillText(desc, px + 56, y + 39, { size: 10, color: env2.C.sub, weight: "normal" });
      env2.drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
      env2.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: "", cb: () => {
        cb();
        env2.buzz("light");
      } });
    });
    const skY = py + 66 + rows.length * rowH;
    env2.fillText("\u{1F3A8}", px + 34, skY + 15, { size: 16, align: "center" });
    env2.fillText("\u754C\u9762\u76AE\u80A4", px + 56, skY + 10, { size: 14 });
    env2.fillText(env2.skin.ref, px + 56, skY + 30, { size: 10, color: env2.C.sub, weight: "normal" });
    const chipW = (pw - 40 - 12) / env2.SKINS.length;
    env2.SKINS.forEach((s, i) => {
      const cx0 = px + 20 + i * (chipW + 6);
      const cy0 = skY + 38;
      const on = s.id === env2.skin.id;
      ctx2.save();
      env2.rr(cx0, cy0, chipW, 30, 8);
      ctx2.fillStyle = on ? env2.ac(0.18) : "rgba(90,107,140,0.12)";
      ctx2.fill();
      ctx2.strokeStyle = on ? s.accent : "rgba(124,141,176,0.35)";
      ctx2.lineWidth = on ? 1.6 : 1;
      ctx2.stroke();
      ctx2.fillStyle = s.accent;
      ctx2.beginPath();
      ctx2.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
      env2.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env2.C.text : env2.C.sub });
      env2.hitBox({ x: cx0, y: cy0, w: chipW, h: 30, label: "", cb: () => {
        env2.applySkin(s.id);
        env2.buzz("light");
        env2.showToast(`\u5DF2\u5207\u6362\u300C${s.name}\u300D`);
      } });
    });
    holoBtn(env2, { x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => env2.setShowSettings(false) }, time);
    ctx2.restore();
  }
  function drawProfile(env2, time = Date.now() / 1e3) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    if (!profileWasOpen) {
      profileOpenAt = Date.now();
      profileWasOpen = true;
    }
    const e = easeOut(clamp01((Date.now() - profileOpenAt) / 220));
    ctx2.fillStyle = "rgba(7,11,24,0.78)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.hitBox({ x: 0, y: 0, w: VW2, h: VH2, label: "", cb: () => {
    } });
    const pw = VW2 - 72;
    const ph = 456;
    const px = 36;
    const py = VH2 / 2 - ph / 2;
    ctx2.save();
    ctx2.globalAlpha = e;
    ctx2.translate(VW2 / 2, VH2 / 2);
    ctx2.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e);
    ctx2.translate(-VW2 / 2, -VH2 / 2);
    holoPanel(env2, px, py, pw, ph, time, env2.C.panelLine);
    env2.drawAvatar(VW2 / 2, py + 60, 34);
    ctx2.save();
    ctx2.strokeStyle = env2.ac(0.6);
    ctx2.lineWidth = 1.5;
    ctx2.setLineDash([14, 10]);
    ctx2.lineDashOffset = -time * 20;
    ctx2.beginPath();
    ctx2.arc(VW2 / 2, py + 60, 42, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.setLineDash([]);
    ctx2.restore();
    env2.fillText(env2.displayNick(), VW2 / 2, py + 116, { size: 18, align: "center" });
    env2.fillText(env2.commanderRank(), VW2 / 2, py + 140, { size: 11, color: env2.C.gold, align: "center", weight: "normal" });
    const cleared = env2.loadProgress().cleared.length;
    const bw = pw - 64;
    const bx = px + 32;
    const by = py + 162;
    env2.fillText(`\u6218\u5F79\u8FDB\u5EA6 ${cleared} / ${env2.LEVELS.length}`, VW2 / 2, by - 8, { size: 11, color: env2.C.sub, align: "center", weight: "normal" });
    env2.rr(bx, by + 6, bw, 10, 5);
    ctx2.fillStyle = env2.ac(0.12);
    ctx2.fill();
    if (cleared > 0) {
      const fw = Math.max(10, bw * (cleared / env2.LEVELS.length));
      env2.rr(bx, by + 6, fw, 10, 5);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.C.cyan);
      g.addColorStop(1, env2.C.gold);
      ctx2.fillStyle = g;
      ctx2.fill();
      ctx2.save();
      ctx2.shadowColor = env2.C.cyan;
      ctx2.shadowBlur = 6;
      ctx2.fillStyle = "#EAFBFF";
      ctx2.beginPath();
      ctx2.arc(bx + fw - 5, by + 11, 2.2, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }
    const rp = env2.getRankProgress();
    const ry = by + 42;
    env2.fillText(
      rp.next === null ? `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} / ${rp.next.toLocaleString("en-US")} \xB7 \u8DDD\u300C${rp.nextName}\u300D\u8FD8\u5DEE ${(rp.next - rp.points).toLocaleString("en-US")} \u5206`,
      VW2 / 2,
      ry - 8,
      { size: 11, color: env2.C.sub, align: "center", weight: "normal" }
    );
    env2.rr(bx, ry + 6, bw, 10, 5);
    ctx2.fillStyle = "rgba(255,201,77,0.12)";
    ctx2.fill();
    const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
    if (frac > 0) {
      const fw2 = Math.max(10, bw * frac);
      env2.rr(bx, ry + 6, fw2, 10, 5);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.shade(env2.C.gold));
      g.addColorStop(1, env2.C.gold);
      ctx2.fillStyle = g;
      ctx2.fill();
      ctx2.save();
      ctx2.shadowColor = env2.C.gold;
      ctx2.shadowBlur = 6;
      ctx2.fillStyle = "#FFF3D6";
      ctx2.beginPath();
      ctx2.arc(bx + fw2 - 5, ry + 11, 2.2, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }
    const openid = env2.getProfile().openid;
    if (openid) {
      env2.fillText(`\u5DF2\u7ED1\u5B9A \xB7 ${openid.slice(0, 12)}\u2026`, VW2 / 2, ry + 34, { size: 10, color: env2.C.green, align: "center", weight: "normal" });
    }
    holoBtn(env2, { x: px + 24, y: py + 268, w: pw - 48, h: 40, label: "\u{1F4AC} \u610F\u89C1\u53CD\u9988", color: env2.C.gold, cb: () => env2.openFeedback() }, time);
    let y = py + 320;
    if (!env2.getProfile().real) {
      holoBtn(env2, { x: px + 24, y, w: pw - 48, h: 44, label: "\u540C\u6B65\u5FAE\u4FE1\u5934\u50CF\u6635\u79F0", color: env2.C.green, primary: true, cb: () => env2.authUser() }, time);
      y += 56;
    }
    holoBtn(env2, { x: px + 24, y, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => env2.setShowProfile(false) }, time);
    ctx2.restore();
  }
  function drawCodex(env2, time) {
    syncOverlayFlags(env2);
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    env2.drawSpaceBg(time);
    holoAtmosphere(env2, time);
    holoHeader(env2, time, "\u6307\u6325\u5B98\u56FE\u9274", () => env2.goto("home"));
    const segY = env2.TOP_SAFE + 6;
    holoSeg(
      env2,
      MARGIN2,
      segY,
      VW2 - MARGIN2 * 2,
      env2.CODEX_TABS.map((t) => t[1]),
      env2.CODEX_TABS.findIndex((t) => t[0] === env2.codex.tab),
      "codex",
      (i) => {
        env2.codex.tab = env2.CODEX_TABS[i][0];
        env2.codex.scroll = 0;
      },
      time
    );
    const top = segY + 46;
    const bottom = VH2 - 22;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, top, VW2, bottom - top);
    ctx2.clip();
    const y0 = top + 8 - env2.codex.scroll;
    let endY;
    if (env2.codex.tab === "story") endY = codexStory(env2, y0, time, top, bottom);
    else if (env2.codex.tab === "towers") endY = codexTowers(env2, y0, time, top, bottom);
    else endY = codexEnemies(env2, y0, time, top, bottom);
    ctx2.restore();
    codexMaxScroll = Math.max(0, endY - y0 - (bottom - top) + 20);
    env2.codex.scroll = Math.max(0, Math.min(codexMaxScroll, env2.codex.scroll));
    const fadeH = 16;
    const gf = ctx2.createLinearGradient(0, top, 0, top + fadeH);
    gf.addColorStop(0, "rgba(8,12,26,0.9)");
    gf.addColorStop(1, "rgba(8,12,26,0)");
    ctx2.fillStyle = gf;
    ctx2.fillRect(0, top, VW2, fadeH);
    const gb = ctx2.createLinearGradient(0, bottom - fadeH, 0, bottom);
    gb.addColorStop(0, "rgba(10,15,36,0)");
    gb.addColorStop(1, "rgba(10,15,36,0.9)");
    ctx2.fillStyle = gb;
    ctx2.fillRect(0, bottom - fadeH, VW2, fadeH);
    if (codexMaxScroll > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMaxScroll)));
      const ty = top + (viewH - thumbH) * (env2.codex.scroll / codexMaxScroll);
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.35);
      env2.rr(VW2 - 4, ty, 3, thumbH, 1.5);
      ctx2.fill();
      ctx2.restore();
    }
    drawOverlays(env2, time);
  }
  function codexStory(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    const textSize = 12;
    const textW = w - 32;
    let totalLines = 0;
    for (const p of env2.STORY_PARAS) totalLines += env2.wrapCount(p, textW, textSize) + 0.6;
    const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
    holoPanel(env2, x, y0, w, boxH, time, env2.C.panelLine);
    env2.fillText("\u4E16\u754C\u89C2\u6863\u6848", x + 16, y0 + 20, { size: 13, color: env2.C.cyan });
    let ty = y0 + 44;
    for (const p of env2.STORY_PARAS) ty = env2.wrapBlock(p, x + 16, ty, textW, { size: textSize }) + textSize * 1.65 * 0.6;
    let y = y0 + boxH + 20;
    env2.fillText("\u6218\u5F79\u7F16\u5E74\u53F2", x + 4, y + 8, { size: 14 });
    env2.fillText("\u70B9\u51FB\u5DF2\u89E3\u9501\u7AE0\u8282\u76F4\u63A5\u51FA\u51FB", x + w - 4, y + 9, { size: 10, color: env2.C.dim, align: "right", weight: "normal" });
    y += 28;
    const cleared = env2.loadProgress().cleared;
    env2.LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const rowH = 60;
      if (y + rowH > top && y < bottom) {
        holoPanel(env2, x, y, w, rowH, time + i, unlock ? env2.C.panelLine : "rgba(124,141,176,0.15)", 12);
        env2.drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
        const tx = x + 94;
        ctx2.save();
        if (!unlock) ctx2.globalAlpha = 0.45;
        env2.fillText(`CHAPTER ${String(lv.id).padStart(2, "0")}`, tx, y + 18, { size: 9, color: env2.C.cyan, weight: "600" });
        env2.fillText(lv.name, tx, y + 36, { size: 14 });
        env2.fillText(lv.sub, tx, y + 52, { size: 10, color: env2.C.sub, weight: "normal" });
        ctx2.restore();
        if (done) env2.chip(x + w - 12, y + 16, "\u5DF2\u901A\u5173", env2.C.green);
        else if (!unlock) env2.chip(x + w - 12, y + 16, "\u672A\u89E3\u9501", env2.C.dim);
        if (unlock) env2.hitBox({ x, y, w, h: rowH, label: "", cb: () => env2.gotoBriefing(lv.id) });
        else env2.hitBox({ x, y, w, h: rowH, label: "", cb: () => {
          env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
          env2.buzz("light");
        } });
      }
      y += rowH + 10;
    });
    return y;
  }
  function codexTowers(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    let y = y0;
    for (const def of env2.TOWER_LIST) {
      const cardH = 134;
      const unlocked = env2.towerUnlocked(def.type);
      if (y + cardH > top && y < bottom) {
        holoPanel(env2, x, y, w, cardH, time, unlocked ? `${def.color}55` : "rgba(124,141,176,0.15)");
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx2.save();
        env2.rr(ix, iy, ib, ib, 12);
        ctx2.fillStyle = `${def.color}14`;
        ctx2.fill();
        ctx2.strokeStyle = `${def.color}55`;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.clip();
        ctx2.translate(ix + ib / 2, iy + ib / 2);
        ctx2.globalAlpha = unlocked ? 1 : 0.35;
        const charge2 = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
        env2.drawTower(ctx2, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge2, time, { ticks: false });
        ctx2.restore();
        const tx = ix + ib + 14;
        ctx2.save();
        if (!unlocked) ctx2.globalAlpha = 0.55;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600" });
        env2.fillText(def.role, tx, y + 53, { size: 11, color: env2.C.sub, weight: "normal" });
        env2.fillText(`\u4F24\u5BB3 ${def.levels.map((l) => l.damage).join(" \u2192 ")} \xB7 \u5C04\u7A0B ${def.levels.map((l) => l.range).join(" \u2192 ")}`, tx, y + 71, { size: 10, weight: "normal" });
        env2.fillText(`\u5C04\u901F ${def.levels.map((l) => l.rate).join(" \u2192 ")}/s \xB7 \u9020\u4EF7 \u25C8${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: "normal" });
        env2.fillText(`\u514B\u5236 ${def.strong}`, tx, y + 105, { size: 10, color: env2.C.green, weight: "normal" });
        env2.fillText(`\u77ED\u677F ${def.weak}`, tx, y + 121, { size: 10, color: env2.C.sub, weight: "normal" });
        ctx2.restore();
        env2.chip(x + w - 12, y + 17, def.tag, def.color);
        if (!unlocked) {
          env2.fillText(`\u901A\u5173\u7B2C ${env2.TOWER_UNLOCK[def.type]} \u7AE0\u89E3\u9501`, x + w - 12, y + cardH - 12, { size: 10, color: env2.C.gold, align: "right" });
        }
      }
      y += cardH + 12;
    }
    return y;
  }
  function codexEnemies(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    let y = y0;
    for (const def of env2.ENEMY_LIST) {
      const textW = w - 92 - 14;
      const descLines = env2.wrapCount(def.desc, textW, 10);
      const cardH = Math.ceil(92 + descLines * 13.2 + 22);
      if (y + cardH > top && y < bottom) {
        holoPanel(env2, x, y, w, cardH, time, `${def.color}44`);
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx2.save();
        env2.rr(ix, iy, ib, ib, 12);
        ctx2.fillStyle = `${def.color}12`;
        ctx2.fill();
        ctx2.strokeStyle = `${def.color}44`;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.clip();
        ctx2.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
        env2.drawEnemy(ctx2, def.type, Math.min(21, def.size), time, {});
        ctx2.restore();
        const tx = ix + ib + 14;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600" });
        env2.chip(x + w - 12, y + 17, env2.ENEMY_CATEGORY[def.category] ?? def.category, def.color);
        env2.fillText(`\u5A01\u80C1 ${"\u2605".repeat(def.threat)}`, tx, y + 54, { size: 10, color: env2.C.gold });
        env2.fillText(`\u751F\u547D ${def.hp} \xB7 \u901F\u5EA6 ${def.speed} \xB7 \u51FB\u6740 \u25C8${def.reward} \xB7 \u6F0F\u602A -${def.leak}`, tx, y + 70, { size: 10, color: env2.C.sub, weight: "normal" });
        const dy = env2.wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: "rgba(232,241,255,0.75)" });
        env2.fillText(`\u5F31\u70B9\uFF1A${def.weakness}`, tx, dy + 2, { size: 10, color: env2.C.cyan, weight: "normal" });
      }
      y += cardH + 12;
    }
    return y;
  }
  function drawToast(env2) {
    const toast2 = env2.getToast();
    if (!toast2) return;
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    const t = (Date.now() - toast2.at) / 1e3;
    if (t > 1.6) return;
    const a = t < 0.15 ? t / 0.15 : t > 1.25 ? (1.6 - t) / 0.35 : 1;
    ctx2.save();
    ctx2.globalAlpha = a;
    ctx2.font = "bold 12px sans-serif";
    const w = ctx2.measureText(toast2.text).width + 34;
    const x = VW2 / 2 - w / 2;
    const y = VH2 * 0.4;
    env2.rr(x, y, w, 34, 17);
    ctx2.fillStyle = env2.skin.panelSolid;
    ctx2.fill();
    ctx2.save();
    ctx2.shadowColor = env2.C.cyan;
    ctx2.shadowBlur = 10;
    ctx2.strokeStyle = env2.ac(0.8);
    ctx2.lineWidth = 1.2;
    ctx2.stroke();
    ctx2.restore();
    ctx2.save();
    env2.rr(x, y, w, 34, 17);
    ctx2.clip();
    const sx = x + Date.now() / 6 % (w + 40) - 20;
    const sg = ctx2.createLinearGradient(sx - 12, 0, sx + 12, 0);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.25));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(sx - 12, y, 24, 34);
    ctx2.restore();
    env2.fillText(toast2.text, VW2 / 2, y + 17, { size: 12, color: env2.C.gold, align: "center" });
    ctx2.restore();
  }
  function handleTouch(env2, phase, p) {
    if (phase === "start") {
      pressPt = { x: p.x, y: p.y, at: Date.now() };
      if (env2.app.screen === "codex" && !env2.showSettings() && !env2.showProfile()) {
        codexDrag = { startY: p.y, lastY: p.y, scroll0: env2.codex.scroll, acc: 0 };
      }
      return false;
    }
    if (phase === "move") {
      if (codexDrag && env2.app.screen === "codex") {
        codexDrag.acc += Math.abs(p.y - codexDrag.lastY);
        codexDrag.lastY = p.y;
        env2.codex.scroll = Math.max(0, Math.min(codexMaxScroll, codexDrag.scroll0 + (codexDrag.startY - p.y)));
        return true;
      }
      return false;
    }
    pressPt = null;
    if (codexDrag) {
      const dragged = codexDrag.acc > 8;
      codexDrag = null;
      if (dragged) env2.consumeTap();
    }
    return false;
  }
  var abyssSkin = {
    id: "abyss",
    drawSplashMenu,
    drawHome,
    drawBriefing,
    drawResult,
    drawCodex,
    drawBattleHUD,
    drawBottomBar,
    drawTechOverlay,
    drawSettings,
    drawProfile,
    drawToast,
    drawDragGhost,
    handleTouch
  };

  // src/skins/ember.ts
  var armKey = "";
  var armAt = 0;
  var ARM_MS = 1600;
  var stampDoneFor = 0;
  var codexMax = 0;
  var codexDrag2 = null;
  function armed(key) {
    return armKey === key && Date.now() - armAt < ARM_MS;
  }
  var clamp012 = (v) => Math.min(1, Math.max(0, v));
  function stripes(env2, x, y, w, h, color, gap, lw, phase) {
    const { ctx: ctx2 } = env2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(x, y, w, h);
    ctx2.clip();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = lw;
    const step = gap * 2;
    const off = (phase % step + step) % step;
    for (let sx = x - h + off - step; sx < x + w + h; sx += step) {
      ctx2.beginPath();
      ctx2.moveTo(sx, y + h);
      ctx2.lineTo(sx + h, y);
      ctx2.stroke();
    }
    ctx2.restore();
  }
  function rivets(env2, x, y, w, h) {
    const { ctx: ctx2 } = env2;
    ctx2.save();
    ctx2.fillStyle = env2.ac(0.55);
    const d = 7;
    for (const [rx, ry] of [[x + d, y + d], [x + w - d, y + d], [x + d, y + h - d], [x + w - d, y + h - d]]) {
      ctx2.beginPath();
      ctx2.arc(rx, ry, 1.6, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }
  function emberBg(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    const g = ctx2.createLinearGradient(0, 0, 0, VH2);
    g.addColorStop(0, "#1B130A");
    g.addColorStop(0.5, "#100B06");
    g.addColorStop(1, "#090603");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, VW2, VH2);
    const glow = ctx2.createRadialGradient(VW2 * 0.85, -VH2 * 0.05, 0, VW2 * 0.85, -VH2 * 0.05, VW2 * 0.95);
    glow.addColorStop(0, env2.ac(0.1));
    glow.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = glow;
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.drawStars(time, 0.3);
    stripes(env2, 0, 0, VW2, VH2, "rgba(255,176,32,0.016)", 26, 8, time * 3);
  }
  function emberHeader(env2, title, en, back) {
    const { ctx: ctx2, VW: VW2, TOP_SAFE: TOP_SAFE2, CAP_MID: CAP_MID2, CAP_LEFT: CAP_LEFT2, GAME_CENTER_PAD: GAME_CENTER_PAD2, MARGIN: MARGIN2 } = env2;
    const btnS = 36;
    const top = CAP_MID2 - btnS / 2;
    const g = ctx2.createLinearGradient(0, top - 6, 0, TOP_SAFE2);
    g.addColorStop(0, "#261B0E");
    g.addColorStop(1, "#130E08");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, top - 6, VW2, TOP_SAFE2 - top + 6);
    ctx2.fillStyle = env2.ac(0.5);
    ctx2.fillRect(0, TOP_SAFE2 - 2, VW2, 2);
    ctx2.fillStyle = env2.C.cyan;
    ctx2.fillRect(0, top - 6, 6, TOP_SAFE2 - top + 6);
    let tx = MARGIN2;
    const rightLimit = CAP_LEFT2 - 8 - GAME_CENTER_PAD2;
    if (back) {
      env2.btn({ x: MARGIN2, y: top, w: btnS, h: btnS, label: "\u2039", cb: back });
      tx = MARGIN2 + btnS + 12;
    }
    const maxW = rightLimit - tx - 8;
    let tSize = 16;
    ctx2.save();
    while (tSize > 11) {
      ctx2.font = `bold ${tSize}px sans-serif`;
      if (ctx2.measureText(title).width <= maxW) break;
      tSize--;
    }
    ctx2.restore();
    env2.fillText(en, tx, CAP_MID2 - 11, { size: 9, color: env2.ac(0.75), weight: "600", font: env2.RES_FONT() });
    env2.fillText(title, tx, CAP_MID2 + 8, { size: tSize });
  }
  function armBtn(env2, key, b) {
    const on = armed(key);
    env2.btn({
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      label: on ? b.armedLabel : b.label,
      color: on ? env2.C.red : b.color,
      primary: !b.disabled,
      disabled: b.disabled,
      cb: () => {
        if (armed(key)) {
          armKey = "";
          env2.buzz("heavy");
          b.cb();
        } else {
          armKey = key;
          armAt = Date.now();
          env2.buzz("medium");
        }
      }
    });
    if (on) {
      const left = 1 - (Date.now() - armAt) / ARM_MS;
      env2.ctx.save();
      env2.ctx.fillStyle = env2.ac(0.25);
      env2.ctx.fillRect(b.x + 4, b.y + b.h - 4, b.w - 8, 2);
      env2.ctx.fillStyle = env2.C.red;
      env2.ctx.fillRect(b.x + 4, b.y + b.h - 4, (b.w - 8) * clamp012(left), 2);
      env2.ctx.restore();
    }
  }
  function drawSplashMenu2(env2, time, menuA) {
    const { VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    const slide = (1 - menuA) * 16;
    const entries = [
      ["\u5F00\u59CB\u6218\u5F79", "START OPERATION", env2.C.gold, true, () => env2.goto("home")],
      ["\u6307\u6325\u5B98\u56FE\u9274", "CODEX ARCHIVE", env2.C.cyan, false, () => {
        env2.codex.scroll = 0;
        env2.goto("codex");
      }],
      ["\u7CFB\u7EDF\u8BBE\u7F6E", "SYSTEM CONFIG", env2.C.sub, false, () => {
        env2.setShowProfile(false);
        env2.setShowSettings(true);
      }],
      ["\u6307\u6325\u6863\u6848", "COMMANDER FILE", env2.C.green, false, () => {
        env2.setShowSettings(false);
        env2.setShowProfile(true);
      }]
    ];
    const x0 = MARGIN2;
    const w0 = VW2 - MARGIN2 * 2;
    const barH = 50;
    const gap = 9;
    const y0 = Math.min(VH2 * 0.28 + (VW2 * 0.17 + 8) * 1.9 + 88 + slide, VH2 - entries.length * (barH + gap) - 64);
    entries.forEach(([label, en, color, primary, cb], i) => {
      const y = y0 + i * (barH + gap);
      const a = clamp012(menuA * 1.5 - i * 0.14);
      if (a <= 0) return;
      const ctx2 = env2.ctx;
      ctx2.save();
      ctx2.globalAlpha = a;
      if (primary) {
        env2.rr(x0, y, w0, barH, 10);
        const g = ctx2.createLinearGradient(x0, y, x0, y + barH);
        g.addColorStop(0, color);
        g.addColorStop(1, env2.shade(color));
        ctx2.fillStyle = g;
        ctx2.fill();
        stripes(env2, x0 + 6, y + 3, w0 - 12, 4, "rgba(8,6,2,0.35)", 7, 4, time * 10);
      } else {
        env2.panel(x0, y, w0, barH, `${color}55`, 10);
      }
      ctx2.fillStyle = primary ? "#1A1209" : color;
      ctx2.fillRect(x0, y, 7, barH);
      env2.fillText(`0${i + 1}`, x0 + 34, y + barH / 2, {
        size: 18,
        color: primary ? "rgba(26,18,9,0.75)" : color,
        align: "center",
        font: env2.RES_FONT()
      });
      env2.fillText(label, x0 + 64, y + barH / 2, { size: 16, color: primary ? "#1A1209" : env2.C.text });
      env2.fillText(en, x0 + w0 - 30, y + barH / 2, {
        size: 9,
        color: primary ? "rgba(26,18,9,0.6)" : env2.C.dim,
        align: "right",
        weight: "600",
        font: env2.RES_FONT()
      });
      env2.fillText("\u203A", x0 + w0 - 16, y + barH / 2, { size: 15, color: primary ? "#1A1209" : env2.C.sub, align: "center" });
      ctx2.restore();
      env2.hitBox({ x: x0, y, w: w0, h: barH, label: "", cb });
    });
  }
  var E_CARD_H = 116;
  var E_CARD_GAP = 12;
  function drawHome2(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    emberBg(env2, time);
    emberHeader(env2, "\u6218\u5F79\u6863\u6848", "OPERATION ARCHIVE", () => env2.goto("splash"));
    const tabY = env2.TOP_SAFE + 6;
    const fullW = VW2 - MARGIN2 * 2;
    const diffW = Math.round(fullW * 0.62);
    const tabW = (diffW - 16) / 3;
    env2.DIFF_LIST.forEach((d, i) => {
      const x = MARGIN2 + i * (tabW + 8);
      const on = env2.app.difficulty === d;
      ctx2.save();
      env2.rr(x, tabY, tabW, 40, 9);
      if (on) {
        const g = ctx2.createLinearGradient(x, tabY, x, tabY + 40);
        g.addColorStop(0, env2.C.gold);
        g.addColorStop(1, env2.shade(env2.C.gold));
        ctx2.fillStyle = g;
        ctx2.fill();
      } else {
        ctx2.fillStyle = env2.skin.panelSolid;
        ctx2.fill();
        ctx2.strokeStyle = env2.ac(0.3);
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
      }
      ctx2.restore();
      env2.fillText(env2.DIFFICULTIES[d].name, x + tabW / 2, tabY + 15, {
        size: 13,
        color: on ? "#1A1209" : env2.C.text,
        align: "center"
      });
      env2.fillText(d.toUpperCase(), x + tabW / 2, tabY + 30, {
        size: 8,
        color: on ? "rgba(26,18,9,0.65)" : env2.C.dim,
        align: "center",
        weight: "600",
        font: env2.RES_FONT()
      });
      env2.hitBox({
        x,
        y: tabY,
        w: tabW,
        h: 40,
        label: "",
        cb: () => {
          if (env2.app.difficulty !== d) {
            env2.app.difficulty = d;
            env2.track("difficulty_select", { difficulty: d });
            env2.buzz("light");
          }
        }
      });
    });
    const coopX = MARGIN2 + diffW + 10;
    const coopTabW = (fullW - diffW - 10 - 12) / 3;
    const MODE_TABS = [
      ["\u5355\u4EBA", "SOLO", "single"],
      ["\u540C\u5C4F", "CO-OP", "coop"],
      ["\u8054\u673A", "ONLINE", "online"]
    ];
    MODE_TABS.forEach(([label, en, mode], i) => {
      const x = coopX + i * (coopTabW + 6);
      const on = env2.app.mode === mode;
      ctx2.save();
      env2.rr(x, tabY, coopTabW, 40, 9);
      if (on) {
        const g = ctx2.createLinearGradient(x, tabY, x, tabY + 40);
        g.addColorStop(0, i >= 1 ? env2.C.green : env2.C.gold);
        g.addColorStop(1, env2.shade(i >= 1 ? env2.C.green : env2.C.gold));
        ctx2.fillStyle = g;
        ctx2.fill();
      } else {
        ctx2.fillStyle = env2.skin.panelSolid;
        ctx2.fill();
        ctx2.strokeStyle = env2.ac(0.3);
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
      }
      ctx2.restore();
      env2.fillText(label, x + coopTabW / 2, tabY + 15, {
        size: 13,
        color: on ? "#1A1209" : env2.C.text,
        align: "center"
      });
      env2.fillText(en, x + coopTabW / 2, tabY + 30, {
        size: 8,
        color: on ? "rgba(26,18,9,0.65)" : env2.C.dim,
        align: "center",
        weight: "600",
        font: env2.RES_FONT()
      });
      env2.hitBox({
        x,
        y: tabY,
        w: coopTabW,
        h: 40,
        label: `mode-${mode}`,
        cb: () => {
          if (env2.app.mode !== mode) {
            env2.setMode(mode);
            env2.buzz("light");
          }
        }
      });
    });
    const trackX = MARGIN2 + 16;
    const top = env2.homeTop;
    const bottom = env2.homeBottom;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, top, VW2, bottom - top);
    ctx2.clip();
    ctx2.fillStyle = env2.ac(0.18);
    ctx2.fillRect(trackX - 1.5, top, 3, bottom - top);
    const cleared = env2.loadProgress().cleared;
    const cardX = MARGIN2 + 44;
    const cardW = VW2 - cardX - MARGIN2;
    env2.LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const y = top + 8 + i * (E_CARD_H + E_CARD_GAP) - env2.app.scroll;
      if (y + E_CARD_H < top || y > bottom) return;
      const nodeColor = done ? env2.C.green : unlock ? env2.C.cyan : env2.C.dim;
      const midY = y + E_CARD_H / 2;
      ctx2.save();
      ctx2.strokeStyle = nodeColor;
      ctx2.lineWidth = 1.6;
      ctx2.beginPath();
      ctx2.arc(trackX, midY, 5, 0, Math.PI * 2);
      if (done) {
        ctx2.fillStyle = env2.C.green;
        ctx2.fill();
      } else ctx2.stroke();
      if (unlock && !done) {
        ctx2.fillStyle = nodeColor;
        ctx2.globalAlpha = 0.5 + 0.5 * Math.sin(time * 3);
        ctx2.beginPath();
        ctx2.arc(trackX, midY, 2.2, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.globalAlpha = 1;
      }
      ctx2.strokeStyle = env2.ac(0.25);
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(trackX + 5, midY);
      ctx2.lineTo(cardX, midY);
      ctx2.stroke();
      ctx2.restore();
      env2.panel(cardX, y, cardW, E_CARD_H, unlock ? `${nodeColor}55` : "rgba(138,118,92,0.25)");
      ctx2.fillStyle = nodeColor;
      ctx2.fillRect(cardX, y, 6, E_CARD_H);
      rivets(env2, cardX, y, cardW, E_CARD_H);
      ctx2.save();
      if (!unlock) ctx2.globalAlpha = 0.4;
      env2.fillText(String(lv.id).padStart(2, "0"), cardX + 34, y + 34, {
        size: 26,
        color: nodeColor,
        align: "center",
        font: env2.RES_FONT()
      });
      env2.fillText(lv.name, cardX + 64, y + 24, { size: 16 });
      env2.fillText(lv.sub, cardX + 64, y + 44, { size: 10, color: env2.C.sub, weight: "normal" });
      const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(" ");
      env2.fillText(`${lv.waves.length} \u6CE2 \xB7 BOSS ${bossTxt || "\u2014"}`, cardX + 64, y + 62, {
        size: 9,
        color: env2.C.dim,
        weight: "normal",
        font: env2.RES_FONT()
      });
      ctx2.restore();
      if (done) env2.chip(cardX + cardW - 12, y + 18, "\u5DF2\u901A\u5173", env2.C.green);
      else if (!unlock) env2.chip(cardX + cardW - 12, y + 18, "\u672A\u89E3\u9501", env2.C.dim);
      env2.fillText(`FILE // OP-${String(lv.id).padStart(3, "0")}`, cardX + 12, y + E_CARD_H - 12, {
        size: 8,
        color: env2.C.dim,
        weight: "600",
        font: env2.RES_FONT()
      });
      if (unlock) {
        env2.btn({
          x: cardX + cardW - 90,
          y: y + E_CARD_H - 48,
          w: 78,
          h: 36,
          label: done ? "\u91CD\u73A9" : "\u51FA\u51FB",
          color: done ? env2.C.green : env2.C.cyan,
          primary: !done,
          cb: () => env2.gotoBriefing(lv.id)
        });
        env2.hitBox({ x: cardX, y, w: cardW - 100, h: E_CARD_H, label: "", cb: () => env2.gotoBriefing(lv.id) });
      } else {
        ctx2.save();
        env2.rr(cardX, y, cardW, E_CARD_H, 10);
        ctx2.fillStyle = "rgba(10,7,4,0.45)";
        ctx2.fill();
        ctx2.restore();
        stripes(env2, cardX + cardW - 96, y + E_CARD_H - 46, 84, 34, "rgba(138,118,92,0.25)", 8, 5, 0);
        env2.fillText("\u{1F512}", cardX + cardW - 54, y + E_CARD_H - 30, { size: 14, color: env2.C.dim, align: "center" });
        env2.hitBox({
          x: cardX,
          y,
          w: cardW,
          h: E_CARD_H,
          label: "",
          cb: () => {
            env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
            env2.buzz("light");
          }
        });
      }
    });
    ctx2.restore();
    const fadeH = 18;
    const gf = ctx2.createLinearGradient(0, top, 0, top + fadeH);
    gf.addColorStop(0, "rgba(16,11,6,0.92)");
    gf.addColorStop(1, "rgba(16,11,6,0)");
    ctx2.fillStyle = gf;
    ctx2.fillRect(0, top, VW2, fadeH);
    const gb = ctx2.createLinearGradient(0, bottom - fadeH, 0, bottom);
    gb.addColorStop(0, "rgba(9,6,3,0)");
    gb.addColorStop(1, "rgba(9,6,3,0.92)");
    ctx2.fillStyle = gb;
    ctx2.fillRect(0, bottom - fadeH, VW2, fadeH);
    const smax = env2.totalScrollMax();
    if (smax > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
      const ty = top + (viewH - thumbH) * (env2.app.scroll / smax);
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.35);
      env2.rr(VW2 - 4, ty, 3, thumbH, 1.5);
      ctx2.fill();
      ctx2.restore();
    }
    env2.fillText("\u5FAE\u4FE1\u5C0F\u6E38\u620F \xB7 \u8BD5\u8FD0\u8425\u5305", VW2 / 2, VH2 - 12, { size: 10, color: "rgba(192,169,138,0.6)", align: "center" });
    if (env2.showProfile()) drawProfileImpl(env2);
    if (env2.showSettings()) drawSettingsImpl(env2);
  }
  function drawBriefing2(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    emberBg(env2, time);
    const lv = env2.LEVELS.find((l) => l.id === env2.app.levelId) ?? env2.LEVELS[0];
    emberHeader(env2, "\u4F5C\u6218\u547D\u4EE4", "OPERATION ORDER", () => {
      env2.stopNarration();
      env2.goto("home");
    });
    const bx = MARGIN2;
    const bw = VW2 - MARGIN2 * 2;
    const bandY = env2.TOP_SAFE + 8;
    ctx2.save();
    env2.rr(bx, bandY, bw, 34, 8);
    ctx2.fillStyle = "#6E1D10";
    ctx2.fill();
    ctx2.restore();
    stripes(env2, bx + 4, bandY + 4, 52, 26, "rgba(255,176,32,0.5)", 8, 5, time * 8);
    stripes(env2, bx + bw - 56, bandY + 4, 52, 26, "rgba(255,176,32,0.5)", 8, 5, time * 8);
    env2.fillText("OPERATION ORDER", VW2 / 2, bandY + 12, {
      size: 12,
      color: "#FFD9A8",
      align: "center",
      weight: "600",
      font: env2.RES_FONT()
    });
    env2.fillText(`\u7B2C ${lv.id} \u7AE0 \xB7 \u673A\u5BC6`, VW2 / 2, bandY + 25, { size: 9, color: "rgba(255,217,168,0.7)", align: "center", weight: "normal" });
    const docY = bandY + 44;
    const bannerH = Math.min(150, Math.round(VW2 * 0.4), Math.max(96, (VH2 - docY - 260) * 0.45));
    const textSize = 12;
    const lineH = textSize * 1.65;
    const textW = bw - 32;
    let totalLines = 0;
    for (const para of lv.briefing) totalLines += env2.wrapCount(para, textW, textSize) + 0.6;
    const coopH = env2.app.coop ? 18 : 0;
    const docH = 40 + bannerH + 10 + Math.ceil(totalLines * lineH) + 44 + coopH;
    env2.panel(bx, docY, bw, docH, env2.C.panelLine);
    rivets(env2, bx, docY, bw, docH);
    env2.fillText(`NO. SRD-${String(lv.id).padStart(3, "0")}`, bx + 16, docY + 16, {
      size: 10,
      color: env2.C.cyan,
      weight: "600",
      font: env2.RES_FONT()
    });
    env2.fillText("\u7B7E\u53D1\uFF1A\u661F\u73AF\u9632\u7EBF\u6307\u6325\u90E8", bx + bw - 16, docY + 16, { size: 9, color: env2.C.sub, align: "right", weight: "normal" });
    env2.fillText(`${lv.name} \xB7 ${lv.sub}`, bx + 16, docY + 32, { size: 12, color: env2.C.text });
    env2.drawCardArt(bx + 12, docY + 44, bw - 24, bannerH, lv.id, time, 8);
    env2.btn({
      x: bx + bw - 90,
      y: docY + 52,
      w: 74,
      h: 28,
      label: env2.narrationMuted() ? "\u{1F507} \u65C1\u767D" : "\u{1F50A} \u65C1\u767D",
      color: env2.narrationMuted() ? env2.C.sub : env2.C.cyan,
      cb: () => env2.toggleNarrationMuted()
    });
    let ty = docY + 44 + bannerH + 22;
    for (const para of lv.briefing) ty = env2.wrapBlock(para, bx + 16, ty, textW, { size: textSize, color: "rgba(255,243,226,0.85)" }) + lineH * 0.6;
    if (env2.app.coop) {
      env2.fillText(
        "\u534F\u540C\u5206\u5DE5\uFF1AP1 \u5DE5\u7A0B\u5B98\u5EFA\u9020\u5E03\u9632 \xB7 P2 \u6218\u672F\u5B98\u5347\u7EA7\u4E0E\u79D1\u6280",
        bx + 16,
        docY + docH - 26 - coopH,
        { size: 10, color: env2.C.green, weight: "normal" }
      );
    }
    env2.fillText(
      `\u6267\u884C\u96BE\u5EA6\uFF1A${env2.DIFFICULTIES[env2.app.difficulty].name} \xB7 ${env2.DIFFICULTIES[env2.app.difficulty].label}`,
      bx + 16,
      docY + docH - 26,
      { size: 10, color: env2.C.gold, weight: "normal" }
    );
    ctx2.save();
    ctx2.translate(bx + bw - 52, docY + docH - 30);
    ctx2.rotate(-0.22);
    ctx2.strokeStyle = "rgba(255,90,61,0.75)";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(0, 0, 20, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.arc(0, 0, 15, 0, Math.PI * 2);
    ctx2.stroke();
    env2.fillText("SRD", 0, 0, { size: 11, color: "rgba(255,90,61,0.85)", align: "center", font: env2.RES_FONT() });
    ctx2.restore();
    const ay = docY + docH + 14;
    armBtn(env2, `strike:${lv.id}`, {
      x: VW2 / 2 - 110,
      y: ay,
      w: 220,
      h: 52,
      label: "\u25B6 \u51FA \u51FB",
      armedLabel: "\u26A0 \u518D\u6B21\u786E\u8BA4\u51FA\u51FB",
      color: env2.C.gold,
      cb: () => env2.startBattle()
    });
    env2.btn({
      x: VW2 / 2 - 110,
      y: ay + 64,
      w: 220,
      h: 42,
      label: "\u8FD4\u56DE\u9009\u5173",
      color: env2.C.sub,
      cb: () => {
        env2.stopNarration();
        env2.goto("home");
      }
    });
    if (env2.showSettings()) drawSettingsImpl(env2);
  }
  function drawBattleHUD2(env2, engine) {
    const { ctx: ctx2 } = env2;
    const st = engine.state;
    const barX = 12;
    const barY = env2.TOP_SAFE;
    const barH = 34;
    const barW = env2.CAP_LEFT - 8 - env2.GAME_CENTER_PAD - barX;
    const midY = barY + barH / 2;
    const font = env2.RES_FONT();
    env2.panel(barX, barY, barW, barH, env2.C.panelLine, 8);
    ctx2.fillStyle = env2.C.cyan;
    ctx2.fillRect(barX, barY, 5, barH);
    stripes(env2, barX + 9, barY + 3, barW - 18, 3, env2.ac(0.3), 8, 5, st.clock * 10);
    const measure = (txt) => {
      ctx2.save();
      ctx2.font = `bold 12px ${font}`;
      const w = ctx2.measureText(txt).width;
      ctx2.restore();
      return w;
    };
    const divider = (x) => {
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.28);
      ctx2.fillRect(x, barY + 9, 1, barH - 18);
      ctx2.restore();
    };
    let cx = barX + 15;
    const livesTxt = `\u2764 ${st.lives}`;
    ctx2.save();
    if (st.lives <= 5) ctx2.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(st.clock * 6));
    env2.fillText(livesTxt, cx, midY, { size: 12, color: env2.C.red, font });
    ctx2.restore();
    cx += measure(livesTxt) + 8;
    divider(cx);
    cx += 9;
    const goldTxt = `\u25C8 ${st.gold}`;
    env2.fillText(goldTxt, cx, midY, { size: 12, color: env2.C.gold, font });
    cx += measure(goldTxt) + 8;
    divider(cx);
    cx += 9;
    const waveTxt = `${st.wave}/${st.totalWaves}`;
    const waveW = measure(waveTxt);
    env2.fillText(waveTxt, cx, midY - 2, { size: 12, color: env2.C.cyan, font });
    ctx2.save();
    ctx2.fillStyle = env2.ac(0.2);
    ctx2.fillRect(cx, midY + 9, waveW, 2);
    ctx2.fillStyle = env2.C.cyan;
    ctx2.fillRect(cx, midY + 9, waveW * clamp012(st.wave / st.totalWaves), 2);
    ctx2.restore();
    const btnW = 30;
    const btnsX = barX + barW - btnW * 3;
    ctx2.save();
    ctx2.fillStyle = env2.ac(0.35);
    ctx2.fillRect(btnsX - 8, barY + 6, 1, barH - 12);
    ctx2.restore();
    const cmdSegs = [
      [st.paused ? "\u25B6" : "\u23F8", env2.C.text, () => env2.engineCmd({ type: "TOGGLE_PAUSE" })],
      [st.speed === 2 ? "2x" : "1x", st.speed === 2 ? env2.C.gold : env2.C.text, () => env2.engineCmd({ type: "SET_SPEED", speed: st.speed === 2 ? 1 : 2 })],
      ["\u2261", env2.C.text, () => {
        env2.app.engine = null;
        env2.goto("home");
      }]
    ];
    cmdSegs.forEach(([label, color, cb], i) => {
      const sx = btnsX + i * btnW;
      env2.fillText(label, sx + btnW / 2, midY, { size: 12, color, align: "center", font });
      env2.hitBox({ x: sx, y: barY, w: btnW, h: barH, label: "", cb });
    });
    if (st.phase === "prep") {
      const pw = 244;
      const px = env2.VW / 2 - pw / 2;
      const py = barY + barH + 8;
      env2.panel(px, py, pw, 74, `${env2.C.gold}66`, 10);
      stripes(env2, px + 4, py + 4, pw - 8, 6, env2.ac(0.5), 8, 6, st.clock * 12);
      env2.fillText(`\u7B2C ${st.wave} \u6CE2 \xB7 ${Math.max(0, Math.ceil(st.prepT))}s \u540E\u6765\u88AD`, env2.VW / 2, py + 22, {
        size: 13,
        align: "center",
        font: env2.RES_FONT()
      });
      const wave = engine.level.waves[st.wave - 1];
      const groups = wave?.groups ?? [];
      const isBossWave = wave?.isBoss ?? false;
      const summary = [...new Set(groups.map((g) => `${env2.ENEMIES[g.type].name}\xD7${g.count}`))].join(" ");
      env2.fillText(`${isBossWave ? "\u26A0 BOSS \u6CE2 \xB7 " : ""}${summary}`, env2.VW / 2, py + 42, {
        size: 9,
        color: isBossWave ? env2.C.pink : env2.C.gold,
        align: "center",
        weight: "normal"
      });
      env2.fillText(
        env2.app.coop ? "P1 \u5EFA\u9020\u9632\u7EBF \xB7 P2 \u628A\u63E1\u5347\u7EA7\u4E0E\u79D1\u6280\u65F6\u673A" : isBossWave ? "\u5EFA\u8BAE\u7559\u597D\u91D1\u5E01\u4E0E\u7A7F\u7532\u706B\u529B" : "\u636E\u6B64\u63D0\u524D\u8C03\u6574\u5E03\u9632",
        env2.VW / 2,
        py + 58,
        {
          size: 9,
          color: env2.C.sub,
          align: "center",
          weight: "normal"
        }
      );
      armBtn(env2, `skipPrep:${st.wave}`, {
        x: env2.VW / 2 - 70,
        y: py + 84,
        w: 140,
        h: 38,
        label: "\u25B6 \u7ACB\u5373\u5F00\u6218",
        armedLabel: "\u26A0 \u786E\u8BA4\u5F00\u6218",
        color: env2.C.gold,
        cb: () => {
          env2.engineCmd({ type: "SKIP_PREP" });
        }
      });
    }
  }
  function drawBottomBar2(env2, engine) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, BAR_H: BAR_H2 } = env2;
    const st = engine.state;
    ctx2.fillStyle = "#120D07";
    ctx2.fillRect(0, VH2 - BAR_H2, VW2, BAR_H2);
    stripes(env2, 0, VH2 - BAR_H2, VW2, 5, env2.ac(0.35), 8, 5, st.clock * 10);
    ctx2.fillStyle = env2.ac(0.4);
    ctx2.fillRect(0, VH2 - BAR_H2 + 5, VW2, 1.5);
    if (st.phase === "tech") return;
    const sel = env2.app.selectedId != null ? st.towers.find((t) => t.id === env2.app.selectedId) : void 0;
    if (sel) {
      const def = env2.TOWERS[sel.type];
      ctx2.fillStyle = def.color;
      ctx2.fillRect(MARGIN2, VH2 - BAR_H2 + 10, 5, 16);
      env2.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN2 + 14, VH2 - BAR_H2 + 18, { size: 13, color: def.color });
      const upCost = sel.level < 2 ? def.levels[sel.level + 1].cost : -1;
      env2.btn({
        x: MARGIN2,
        y: VH2 - BAR_H2 + 32,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: upCost >= 0 ? `\u5347\u7EA7 \u25C8 ${upCost}` : "\u5DF2\u6EE1\u7EA7",
        disabled: upCost < 0 || st.gold < upCost,
        color: env2.C.green,
        primary: upCost >= 0 && st.gold >= upCost,
        cb: () => {
          if (env2.engineCmd({ type: "UPGRADE", id: sel.id })) {
            env2.sfx.play("upgrade");
            env2.buzz("light");
          }
        }
      });
      const refund = Math.floor(sel.invested * env2.SELL_RATE);
      env2.btn({
        x: VW2 / 2 + 6,
        y: VH2 - BAR_H2 + 32,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: `\u51FA\u552E +${refund}`,
        color: env2.C.gold,
        cb: () => {
          if (env2.engineCmd({ type: "SELL", id: sel.id })) env2.sfx.play("sell");
          env2.app.selectedId = null;
        }
      });
      return;
    }
    if (env2.app.placing) {
      const def = env2.TOWERS[env2.app.placing];
      ctx2.fillStyle = def.color;
      ctx2.fillRect(MARGIN2, VH2 - BAR_H2 + 10, 5, 16);
      env2.fillText(`\u70B9\u51FB\u5730\u56FE\u4E0A\u7EFF\u8272\u683C\u5EFA\u9020\u300C${def.name}\u300D`, MARGIN2 + 14, VH2 - BAR_H2 + 18, { size: 12, color: def.color });
      env2.btn({ x: VW2 / 2 - 76, y: VH2 - BAR_H2 + 30, w: 152, h: 44, label: "\u53D6\u6D88\u653E\u7F6E", cb: () => {
        env2.app.placing = null;
      } });
      return;
    }
    const sw = env2.SLOT_W;
    const slotH = BAR_H2 - 24;
    const viewX = MARGIN2;
    const viewW = VW2 - MARGIN2 * 2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(viewX - 4, VH2 - BAR_H2 + 4, viewW + 8, BAR_H2 - 8);
    ctx2.clip();
    env2.TOWER_ORDER.forEach((type, i) => {
      const def = env2.TOWERS[type];
      const cost = def.levels[0].cost;
      const locked = !env2.towerUnlocked(type);
      const bx = viewX + i * (sw + env2.SLOT_GAP) - env2.barScroll;
      const by = VH2 - BAR_H2 + 12;
      if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
      const disabled = locked || st.gold < cost;
      ctx2.save();
      ctx2.globalAlpha = disabled ? 0.55 : 1;
      env2.rr(bx, by, sw, slotH, 8);
      ctx2.fillStyle = "#1C1409";
      ctx2.fill();
      ctx2.strokeStyle = disabled ? "rgba(138,118,92,0.4)" : `${def.color}AA`;
      ctx2.lineWidth = 1.4;
      ctx2.stroke();
      ctx2.fillStyle = disabled ? "rgba(138,118,92,0.5)" : def.color;
      ctx2.fillRect(bx + 4, by, sw - 8, 3);
      ctx2.translate(bx + sw / 2, by + 27);
      env2.drawTower(ctx2, type, 0, 39, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
      ctx2.restore();
      env2.fillText(`\u25C8${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? "#8A6A34" : env2.C.gold, align: "center", font: env2.RES_FONT() });
      if (locked) {
        ctx2.save();
        env2.rr(bx, by, sw, slotH, 8);
        ctx2.fillStyle = "rgba(10,7,4,0.6)";
        ctx2.fill();
        ctx2.restore();
        stripes(env2, bx + 6, by + 13, sw - 12, 26, "rgba(138,118,92,0.3)", 7, 4, 0);
        env2.fillText("\u{1F512}", bx + sw / 2, by + 27, { size: 12, color: env2.C.sub, align: "center" });
        env2.fillText(`\u7B2C${env2.TOWER_UNLOCK[type]}\u7AE0`, bx + sw / 2, by + 52, { size: 10, color: env2.C.sub, align: "center" });
      }
    });
    ctx2.restore();
    if (env2.stripMaxScroll > 0) {
      if (env2.barScroll > 0) {
        const gl = ctx2.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
        gl.addColorStop(0, "rgba(18,13,7,0.95)");
        gl.addColorStop(1, "rgba(18,13,7,0)");
        ctx2.fillStyle = gl;
        ctx2.fillRect(viewX - 4, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
      if (env2.barScroll < env2.stripMaxScroll) {
        const gr = ctx2.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
        gr.addColorStop(0, "rgba(18,13,7,0)");
        gr.addColorStop(1, "rgba(18,13,7,0.95)");
        ctx2.fillStyle = gr;
        ctx2.fillRect(viewX + viewW - 18, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
    }
  }
  function drawTechOverlay2(env2, engine) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const st = engine.state;
    ctx2.fillStyle = "rgba(10,7,4,0.92)";
    ctx2.fillRect(0, 0, VW2, env2.VH);
    stripes(env2, MARGIN2, env2.TOP_SAFE + 6, VW2 - MARGIN2 * 2, 5, env2.ac(0.4), 8, 5, 0);
    env2.fillText("TACTICAL SUPPLY", VW2 / 2, env2.TOP_SAFE + 22, {
      size: 11,
      color: env2.C.cyan,
      align: "center",
      weight: "600",
      font: env2.RES_FONT()
    });
    env2.fillText(`\u7B2C ${st.wave} \u6CE2\u524D \xB7 \u9009\u62E9\u6218\u672F\u8865\u7ED9`, VW2 / 2, env2.TOP_SAFE + 48, { size: 19, align: "center" });
    env2.fillText(`\u4E09\u9009\u4E00 \xB7 \u540C\u540D\u53EF\u53E0\u52A0 \xB7 \u5DF2\u88C5 ${st.techs.length}`, VW2 / 2, env2.TOP_SAFE + 72, {
      size: 11,
      color: env2.C.sub,
      align: "center",
      weight: "normal"
    });
    const taken = {};
    for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
    const cardH = 124;
    const top = env2.TOP_SAFE + 92;
    st.techChoices.forEach((id, i) => {
      const y = top + i * (cardH + 14);
      const def = env2.TECHS[id];
      const at = (Date.now() - env2.getTechShownAt()) / 1e3 - i * 0.09;
      const eo = 1 - (1 - clamp012(at / 0.3)) ** 3;
      ctx2.save();
      ctx2.globalAlpha = eo;
      ctx2.translate((1 - eo) * VW2 * 0.35, 0);
      env2.panel(MARGIN2, y, VW2 - MARGIN2 * 2, cardH, `${def.color}66`);
      rivets(env2, MARGIN2, y, VW2 - MARGIN2 * 2, cardH);
      const ib = 72;
      const ix = MARGIN2 + 14;
      const iy = y + (cardH - ib) / 2;
      ctx2.save();
      env2.rr(ix, iy, ib, ib, 8);
      ctx2.fillStyle = `${def.color}14`;
      ctx2.fill();
      ctx2.strokeStyle = `${def.color}88`;
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.restore();
      stripes(env2, ix + 3, iy + 3, ib - 6, ib - 6, `${def.color}22`, 9, 5, st.clock * 6);
      env2.fillText(def.glyph, ix + ib / 2, iy + ib / 2, { size: 30, color: def.color, align: "center" });
      env2.fillText(`SUPPLY-0${i + 1}`, ix, iy - 10, { size: 8, color: env2.C.dim, weight: "600", font: env2.RES_FONT() });
      const tx = ix + ib + 14;
      const textW = VW2 - MARGIN2 * 2 - (tx - MARGIN2) - 14;
      const descLines = env2.wrapCount(def.desc, textW, 12);
      const blockH = 24 + descLines * 12 * 1.65;
      const ty0 = y + cardH / 2 - blockH / 2;
      env2.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
      env2.fillText(def.nameEn, tx + 4 + ctx2.measureText(def.name).width, ty0 + 12, {
        size: 8,
        color: env2.C.dim,
        weight: "600",
        font: env2.RES_FONT()
      });
      if (taken[id]) env2.chip(MARGIN2 + (VW2 - MARGIN2 * 2) - 12, y + 22, `\u5DF2\u88C5\xD7${taken[id]}`, def.color);
      env2.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: "rgba(192,169,138,1)", size: 12 });
      ctx2.restore();
      env2.hitBox({
        x: MARGIN2,
        y,
        w: VW2 - MARGIN2 * 2,
        h: cardH,
        label: "",
        cb: () => {
          if (env2.engineCmd({ type: "PICK_TECH", id })) env2.sfx.play("tech");
        }
      });
    });
  }
  function drawResult2(env2, time) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    emberBg(env2, time);
    const won = env2.app.result.won;
    const st = env2.app.engine.state;
    const oi = env2.getOnlineInfo();
    const t = (Date.now() - env2.getScreenAt()) / 1e3;
    if (!won) {
      ctx2.save();
      ctx2.globalAlpha = 0.2 + 0.07 * Math.sin(time * 2);
      const rg = ctx2.createRadialGradient(VW2 / 2, env2.VH / 2, Math.min(VW2, env2.VH) * 0.32, VW2 / 2, env2.VH / 2, Math.max(VW2, env2.VH) * 0.72);
      rg.addColorStop(0, "rgba(255,61,90,0)");
      rg.addColorStop(1, "rgba(255,61,90,0.5)");
      ctx2.fillStyle = rg;
      ctx2.fillRect(0, 0, VW2, env2.VH);
      ctx2.restore();
    }
    emberHeader(env2, env2.app.coop || oi ? "\u534F\u540C\u6218\u540E\u62A5\u544A" : "\u6218\u540E\u62A5\u544A", env2.app.coop || oi ? "CO-OP AFTER ACTION REPORT" : "AFTER ACTION REPORT", () => env2.goto("home"));
    const px = MARGIN2;
    const pw = VW2 - MARGIN2 * 2;
    const bandY = env2.TOP_SAFE + 10;
    ctx2.save();
    env2.rr(px, bandY, pw, 36, 8);
    ctx2.fillStyle = won ? "rgba(126,217,87,0.14)" : "rgba(255,90,61,0.16)";
    ctx2.fill();
    ctx2.strokeStyle = won ? `${env2.C.green}88` : `${env2.C.red}88`;
    ctx2.lineWidth = 1.2;
    ctx2.stroke();
    ctx2.restore();
    stripes(env2, px + 4, bandY + 4, 40, 28, won ? `${env2.C.green}55` : `${env2.C.red}55`, 8, 5, 0);
    stripes(env2, px + pw - 44, bandY + 4, 40, 28, won ? `${env2.C.green}55` : `${env2.C.red}55`, 8, 5, 0);
    env2.fillText(won ? "\u2605 \u4F5C\u6218\u6210\u529F \xB7 MISSION COMPLETE" : "\u2715 \u9632\u7EBF\u5931\u5B88 \xB7 MISSION FAILED", VW2 / 2, bandY + 18, {
      size: 14,
      color: won ? env2.C.green : env2.C.red,
      align: "center"
    });
    env2.fillText(
      won ? oi ? "\u5728\u7EBF\u534F\u540C \xB7 \u53CC\u5B50\u661F\u95E8" : `\u7B2C ${env2.app.levelId} \u7AE0 \xB7 ${env2.LEVELS.find((l) => l.id === env2.app.levelId)?.name ?? ""}` : `\u6491\u5230\u4E86\u7B2C ${st.wave} / ${st.totalWaves} \u6CE2`,
      VW2 / 2,
      bandY + 50,
      { size: 12, color: env2.C.sub, align: "center", weight: "normal" }
    );
    const settle = env2.getLastSettlement();
    const myKills = oi ? st.killsBy?.[oi.player] ?? st.kills : st.kills;
    const rows = [
      ["\u51FB\u6740", String(myKills), myKills],
      ["\u6F0F\u602A", String(st.leaked), st.leaked],
      ["\u5269\u4F59\u751F\u547D", `${st.lives} / ${st.maxLives}`, null],
      ["\u8D5A\u53D6\u91D1\u5E01", String(st.goldEarned), st.goldEarned],
      ["\u6218\u672F\u6A21\u5757", String(st.techs.length), st.techs.length],
      ["\u79EF\u5206", `+${settle?.score ?? 0}`, settle?.score ?? 0, env2.C.gold, true]
    ];
    if (oi) rows.splice(1, 0, ["\u5728\u7EBF\u534F\u540C", `\u961F\u53CB ${oi.peerNick || "\u2014"}`, null, env2.C.cyan]);
    const py = bandY + 64;
    const rowH = 33;
    const docH = rows.length * rowH + 42;
    env2.panel(px, py, pw, docH, env2.C.panelLine);
    rivets(env2, px, py, pw, docH);
    env2.fillText("RECORD // \u6218\u7EE9\u8BB0\u5F55", px + 16, py + 16, { size: 10, color: env2.C.cyan, weight: "600", font: env2.RES_FONT() });
    rows.forEach(([k, v, num, color, plus], i) => {
      const ry = py + 42 + i * rowH;
      ctx2.fillStyle = color ?? env2.C.sub;
      ctx2.fillRect(px + 16, ry - 4, 3, 8);
      env2.fillText(k, px + 26, ry, { size: 13, color: color ?? env2.C.sub, weight: "normal" });
      const shown = num === null ? v : `${plus ? "+" : ""}${Math.round(num * clamp012((t - 0.25 - i * 0.12) / 0.6))}`;
      env2.fillText(shown, px + pw - 22, ry, { size: 16, align: "right", font: env2.RES_FONT(), color });
      if (i < rows.length - 1) {
        ctx2.save();
        ctx2.strokeStyle = "rgba(192,169,138,0.12)";
        ctx2.beginPath();
        ctx2.moveTo(px + 26, ry + rowH / 2);
        ctx2.lineTo(px + pw - 22, ry + rowH / 2);
        ctx2.stroke();
        ctx2.restore();
      }
    });
    const grade = !won ? "D" : st.leaked === 0 ? "S" : st.leaked <= 2 ? "A" : "B";
    const gradeColor = grade === "S" ? env2.C.gold : grade === "A" ? env2.C.green : grade === "B" ? env2.C.cyan : env2.C.red;
    const sx = px + pw - 64;
    const sy = py + 30;
    const sp = clamp012((t - 0.85) / 0.28);
    const seo = 1 - (1 - sp) ** 3;
    if (sp > 0) {
      ctx2.save();
      ctx2.translate(sx, sy);
      ctx2.rotate(-0.55 + seo * 0.38);
      ctx2.scale(1 + (1 - seo) * 1.8, 1 + (1 - seo) * 1.8);
      ctx2.globalAlpha = seo;
      ctx2.strokeStyle = gradeColor;
      ctx2.lineWidth = 2.6;
      ctx2.beginPath();
      ctx2.arc(0, 0, 30, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(0, 0, 24, 0, Math.PI * 2);
      ctx2.stroke();
      env2.fillText(grade, 0, 0, { size: 28, color: gradeColor, align: "center", font: env2.RES_FONT() });
      ctx2.restore();
    }
    if (sp >= 1 && stampDoneFor !== env2.getScreenAt()) {
      stampDoneFor = env2.getScreenAt();
      env2.buzz("heavy");
    }
    const rp = clamp012((t - 1.13) / 0.4);
    if (rp > 0 && rp < 1) {
      ctx2.save();
      ctx2.globalAlpha = (1 - rp) * 0.6;
      ctx2.strokeStyle = gradeColor;
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.arc(sx, sy, 30 + rp * 26, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.restore();
    }
    env2.fillText(["\u5B8C\u7F8E\u9632\u7EBF", "\u9632\u5B88\u597D\u624B", "\u5B88\u4F4F\u9632\u7EBF", "\u9632\u7EBF\u5931\u5B88"][["S", "A", "B", "D"].indexOf(grade)], px + 16, py + docH - 16, {
      size: 12,
      color: gradeColor
    });
    env2.fillText(won ? oi ? "\u534F\u540C\u52A0\u6210 \xD71.2 \u5DF2\u5165\u8D26" : "\u4E0B\u4E00\u7AE0\u89E3\u9501\u5DF2\u8BB0\u5F55" : "\u518D\u6311\u6218\u4E00\u6B21\u5C31\u80FD\u901A\u8FC7", px + pw - 120, py + docH - 16, {
      size: 9,
      color: env2.C.sub,
      align: "center",
      weight: "normal"
    });
    const rprog = env2.getRankProgress();
    env2.fillText(
      rprog.next === null ? `\u25B8 ${rprog.name} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854 \u25C2` : `\u25B8 ${rprog.name} \xB7 \u8DDD\u300C${rprog.nextName}\u300D\u8FD8\u5DEE ${(rprog.next - rprog.points).toLocaleString("en-US")} \u5206 \u25C2`,
      VW2 / 2,
      py + docH + 22,
      { size: 10, color: env2.C.gold, align: "center", weight: "normal" }
    );
    let y = py + docH + 40;
    const nextId = env2.app.levelId + 1;
    const hasNext = !oi && env2.LEVELS.some((l) => l.id === nextId);
    if (won) {
      env2.btn({ x: px, y, w: pw, h: 44, label: "\u25C8 \u53CC\u500D\u6218\u5229 \xB7 \u89C2\u770B\u89C6\u9891", color: env2.C.gold, cb: () => env2.showToast("\u5E7F\u544A\u6A21\u5757\u5F00\u53D1\u4E2D") });
      y += 54;
    }
    if (won && hasNext) {
      armBtn(env2, "nextChapter", {
        x: px,
        y,
        w: pw,
        h: 50,
        label: `\u25B6 \u8FDB\u5165\u7B2C ${nextId} \u7AE0`,
        armedLabel: "\u26A0 \u518D\u6B21\u786E\u8BA4\u8FDB\u5165",
        color: env2.C.green,
        cb: () => env2.gotoBriefing(nextId)
      });
      y += 62;
    }
    env2.btn({
      x: px,
      y,
      w: pw,
      h: 42,
      label: "\u{1F4E3} \u70AB\u8000\u6218\u7EE9",
      color: env2.C.pink,
      cb: () => {
        env2.track("share_click", { channel: "result", result: won ? "win" : "lose", wave: st.wave });
        env2.shareAppMessage({
          title: won ? `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u5B88\u4F4F\u4E86\u7B2C ${env2.app.levelId} \u5173 \xB7 \u5168 ${st.totalWaves} \u6CE2\uFF0C\u6F0F\u602A ${st.leaked}\uFF01` : `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u7B2C ${env2.app.levelId} \u5173\u6491\u5230\u4E86\u7B2C ${st.wave} \u6CE2\uFF0C\u6C42\u652F\u63F4\uFF01`,
          imageUrl: "assets/share-cover.jpg"
        });
      }
    });
    y += 52;
    env2.btn({ x: px, y, w: (pw - 12) / 2, h: 42, label: won ? "\u518D\u6765\u4E00\u5C40" : "\u518D\u6218\u672C\u5173", color: env2.C.gold, cb: () => env2.gotoBriefing(env2.app.levelId) });
    env2.btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 42, label: "\u8FD4\u56DE\u9009\u5173", cb: () => env2.goto("home") });
    if (env2.showSettings()) drawSettingsImpl(env2);
  }
  function drawCodex2(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2 } = env2;
    emberBg(env2, time);
    emberHeader(env2, "\u6307\u6325\u5B98\u56FE\u9274", "CODEX ARCHIVE", () => env2.goto("home"));
    const tabY = env2.TOP_SAFE + 6;
    const tabW = (VW2 - MARGIN2 * 2 - 16) / env2.CODEX_TABS.length;
    env2.CODEX_TABS.forEach(([id, label], i) => {
      const x = MARGIN2 + i * (tabW + 8);
      const on = env2.codex.tab === id;
      ctx2.save();
      env2.rr(x, tabY, tabW, 36, 8);
      if (on) {
        const g = ctx2.createLinearGradient(x, tabY, x, tabY + 36);
        g.addColorStop(0, env2.C.cyan);
        g.addColorStop(1, env2.shade(env2.C.cyan));
        ctx2.fillStyle = g;
        ctx2.fill();
      } else {
        ctx2.fillStyle = env2.skin.panelSolid;
        ctx2.fill();
        ctx2.strokeStyle = env2.ac(0.3);
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
      }
      ctx2.restore();
      env2.fillText(label, x + tabW / 2, tabY + 18, { size: 13, color: on ? "#1A1209" : env2.C.text, align: "center" });
      env2.hitBox({
        x,
        y: tabY,
        w: tabW,
        h: 36,
        label: "",
        cb: () => {
          if (!on) {
            env2.codex.tab = id;
            env2.codex.scroll = 0;
            env2.buzz("light");
          }
        }
      });
    });
    const top = tabY + 46;
    const bottom = VH2 - 22;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, top, VW2, bottom - top);
    ctx2.clip();
    const y0 = top + 8 - env2.codex.scroll;
    let endY;
    if (env2.codex.tab === "story") endY = codexStory2(env2, y0, time, top, bottom);
    else if (env2.codex.tab === "towers") endY = codexTowers2(env2, y0, time, top, bottom);
    else endY = codexEnemies2(env2, y0, time, top, bottom);
    ctx2.restore();
    codexMax = Math.max(0, endY - y0 - (bottom - top) + 20);
    env2.codex.scroll = Math.max(0, Math.min(codexMax, env2.codex.scroll));
    const fadeH = 16;
    const gf = ctx2.createLinearGradient(0, top, 0, top + fadeH);
    gf.addColorStop(0, "rgba(16,11,6,0.92)");
    gf.addColorStop(1, "rgba(16,11,6,0)");
    ctx2.fillStyle = gf;
    ctx2.fillRect(0, top, VW2, fadeH);
    const gb = ctx2.createLinearGradient(0, bottom - fadeH, 0, bottom);
    gb.addColorStop(0, "rgba(9,6,3,0)");
    gb.addColorStop(1, "rgba(9,6,3,0.92)");
    ctx2.fillStyle = gb;
    ctx2.fillRect(0, bottom - fadeH, VW2, fadeH);
    if (codexMax > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMax)));
      const ty = top + (viewH - thumbH) * (env2.codex.scroll / codexMax);
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.35);
      env2.rr(VW2 - 4, ty, 3, thumbH, 1.5);
      ctx2.fill();
      ctx2.restore();
    }
    if (env2.showProfile()) drawProfileImpl(env2);
    if (env2.showSettings()) drawSettingsImpl(env2);
  }
  function codexStory2(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    const textSize = 12;
    const textW = w - 40;
    let totalLines = 0;
    for (const p of env2.STORY_PARAS) totalLines += env2.wrapCount(p, textW, textSize) + 0.6;
    const boxH = Math.ceil(totalLines * textSize * 1.65) + 48;
    env2.panel(x, y0, w, boxH, env2.C.panelLine);
    rivets(env2, x, y0, w, boxH);
    ctx2.fillStyle = env2.C.cyan;
    ctx2.fillRect(x, y0, 6, boxH);
    env2.fillText("\u4E16\u754C\u89C2\u6863\u6848 // WORLD FILE", x + 18, y0 + 20, { size: 12, color: env2.C.cyan, font: env2.RES_FONT() });
    let ty = y0 + 44;
    for (const p of env2.STORY_PARAS) ty = env2.wrapBlock(p, x + 18, ty, textW, { size: textSize, color: "rgba(255,243,226,0.85)" }) + textSize * 1.65 * 0.6;
    let y = y0 + boxH + 20;
    env2.fillText("\u6218\u5F79\u7F16\u5E74\u53F2", x + 4, y + 8, { size: 14 });
    env2.fillText("\u70B9\u51FB\u5DF2\u89E3\u9501\u7AE0\u8282\u76F4\u63A5\u51FA\u51FB", x + w - 4, y + 9, { size: 10, color: env2.C.dim, align: "right", weight: "normal" });
    y += 28;
    const cleared = env2.loadProgress().cleared;
    env2.LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const rowH = 60;
      if (y + rowH > top && y < bottom) {
        const nodeColor = done ? env2.C.green : unlock ? env2.C.cyan : env2.C.dim;
        env2.panel(x, y, w, rowH, unlock ? `${nodeColor}44` : "rgba(138,118,92,0.2)", 8);
        ctx2.fillStyle = nodeColor;
        ctx2.fillRect(x, y, 5, rowH);
        env2.drawCardArt(x + 12, y + 8, 66, rowH - 16, lv.id, time, 6);
        const tx = x + 90;
        ctx2.save();
        if (!unlock) ctx2.globalAlpha = 0.45;
        env2.fillText(`CH.${String(lv.id).padStart(2, "0")}`, tx, y + 18, { size: 9, color: env2.C.cyan, weight: "600", font: env2.RES_FONT() });
        env2.fillText(lv.name, tx, y + 36, { size: 14 });
        env2.fillText(lv.sub, tx, y + 52, { size: 10, color: env2.C.sub, weight: "normal" });
        ctx2.restore();
        if (done) env2.chip(x + w - 12, y + 16, "\u5DF2\u901A\u5173", env2.C.green);
        else if (!unlock) env2.chip(x + w - 12, y + 16, "\u672A\u89E3\u9501", env2.C.dim);
        if (unlock) env2.hitBox({ x, y, w, h: rowH, label: "", cb: () => env2.gotoBriefing(lv.id) });
        else env2.hitBox({
          x,
          y,
          w,
          h: rowH,
          label: "",
          cb: () => {
            env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
            env2.buzz("light");
          }
        });
      }
      y += rowH + 10;
    });
    return y;
  }
  function codexTowers2(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    let y = y0;
    for (const def of env2.TOWER_LIST) {
      const cardH = 134;
      const unlocked = env2.towerUnlocked(def.type);
      if (y + cardH > top && y < bottom) {
        env2.panel(x, y, w, cardH, unlocked ? `${def.color}55` : "rgba(138,118,92,0.2)");
        ctx2.fillStyle = unlocked ? def.color : env2.C.dim;
        ctx2.fillRect(x, y, 5, cardH);
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx2.save();
        env2.rr(ix, iy, ib, ib, 8);
        ctx2.fillStyle = `${def.color}14`;
        ctx2.fill();
        ctx2.strokeStyle = `${def.color}55`;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.clip();
        stripes(env2, ix, iy, ib, ib, `${def.color}18`, 9, 5, 0);
        ctx2.translate(ix + ib / 2, iy + ib / 2);
        ctx2.globalAlpha = unlocked ? 1 : 0.35;
        const charge2 = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
        env2.drawTower(ctx2, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge2, time, { ticks: false });
        ctx2.restore();
        const tx = ix + ib + 14;
        ctx2.save();
        if (!unlocked) ctx2.globalAlpha = 0.55;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600", font: env2.RES_FONT() });
        env2.fillText(def.role, tx, y + 53, { size: 11, color: env2.C.sub, weight: "normal" });
        env2.fillText(`\u4F24\u5BB3 ${def.levels.map((l) => l.damage).join(" \u2192 ")} \xB7 \u5C04\u7A0B ${def.levels.map((l) => l.range).join(" \u2192 ")}`, tx, y + 71, { size: 10, weight: "normal" });
        env2.fillText(`\u5C04\u901F ${def.levels.map((l) => l.rate).join(" \u2192 ")}/s \xB7 \u9020\u4EF7 \u25C8${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: "normal" });
        env2.fillText(`\u514B\u5236 ${def.strong}`, tx, y + 105, { size: 10, color: env2.C.green, weight: "normal" });
        env2.fillText(`\u77ED\u677F ${def.weak}`, tx, y + 121, { size: 10, color: env2.C.sub, weight: "normal" });
        ctx2.restore();
        env2.chip(x + w - 12, y + 17, def.tag, def.color);
        if (!unlocked) {
          env2.fillText(`\u901A\u5173\u7B2C ${env2.TOWER_UNLOCK[def.type]} \u7AE0\u89E3\u9501`, x + w - 12, y + cardH - 12, { size: 10, color: env2.C.gold, align: "right" });
        }
      }
      y += cardH + 12;
    }
    return y;
  }
  function codexEnemies2(env2, y0, time, top, bottom) {
    const { ctx: ctx2, VW: VW2, MARGIN: MARGIN2 } = env2;
    const x = MARGIN2;
    const w = VW2 - MARGIN2 * 2;
    let y = y0;
    for (const def of env2.ENEMY_LIST) {
      const textW = w - 92 - 14;
      const descLines = env2.wrapCount(def.desc, textW, 10);
      const cardH = Math.ceil(92 + descLines * 13.2 + 22);
      if (y + cardH > top && y < bottom) {
        env2.panel(x, y, w, cardH, `${def.color}44`);
        ctx2.fillStyle = def.color;
        ctx2.fillRect(x, y, 5, cardH);
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx2.save();
        env2.rr(ix, iy, ib, ib, 8);
        ctx2.fillStyle = `${def.color}12`;
        ctx2.fill();
        ctx2.strokeStyle = `${def.color}44`;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.clip();
        stripes(env2, ix, iy, ib, ib, `${def.color}14`, 9, 5, 0);
        ctx2.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
        env2.drawEnemy(ctx2, def.type, Math.min(21, def.size), time, {});
        ctx2.restore();
        const tx = ix + ib + 14;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600", font: env2.RES_FONT() });
        env2.chip(x + w - 12, y + 17, env2.ENEMY_CATEGORY[def.category] ?? def.category, def.color);
        env2.fillText(`\u5A01\u80C1 ${"\u2605".repeat(def.threat)}`, tx, y + 54, { size: 10, color: env2.C.gold });
        env2.fillText(`\u751F\u547D ${def.hp} \xB7 \u901F\u5EA6 ${def.speed} \xB7 \u51FB\u6740 \u25C8${def.reward} \xB7 \u6F0F\u602A -${def.leak}`, tx, y + 70, { size: 10, color: env2.C.sub, weight: "normal" });
        const dy = env2.wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: "rgba(255,243,226,0.75)" });
        env2.fillText(`\u5F31\u70B9\uFF1A${def.weakness}`, tx, dy + 2, { size: 10, color: env2.C.cyan, weight: "normal" });
      }
      y += cardH + 12;
    }
    return y;
  }
  function drawSettingsImpl(env2) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    ctx2.fillStyle = "rgba(8,5,3,0.8)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.hitBox({ x: 0, y: 0, w: VW2, h: VH2, label: "", cb: () => {
    } });
    const pw = VW2 - 72;
    const px = 36;
    const rowH = 54;
    const rows = [
      ["\u97F3\u6548", "\u653B\u51FB / \u7206\u70B8 / \u91D1\u5E01\u7B49\u6218\u6597\u97F3\u6548", !env2.sfx.muted, () => env2.sfx.setMuted(!env2.sfx.muted)],
      ["\u97F3\u4E50", "\u4E3B\u9875\u4E0E\u6218\u6597\u80CC\u666F\u97F3\u4E50", !env2.musicMuted(), () => env2.toggleMusicMuted()],
      ["\u65C1\u767D", "\u4EFB\u52A1\u7B80\u62A5\u8BED\u97F3\u89E3\u8BF4", !env2.narrationMuted(), () => env2.toggleNarrationMuted()],
      ["\u9707\u52A8", "\u5EFA\u9020 / \u6F0F\u602A / BOSS \u6218\u89E6\u611F\u53CD\u9988", !env2.vibrateMuted(), () => env2.toggleVibrateMuted()],
      ["\u9AD8\u753B\u8D28", "Bloom \u8F89\u5149\u7279\u6548\uFF0C\u4F4E\u7AEF\u673A\u5EFA\u8BAE\u5173\u95ED", env2.readQualityHigh(), () => env2.setQualityHigh(!env2.readQualityHigh())]
    ];
    const skinH = 78;
    const ph = 74 + rows.length * rowH + skinH + 64;
    const py = VH2 / 2 - ph / 2;
    env2.panel(px, py, pw, ph, env2.C.panelLine);
    rivets(env2, px, py, pw, ph);
    stripes(env2, px + 8, py + 6, pw - 16, 5, env2.ac(0.4), 8, 5, 0);
    env2.fillText("SYSTEM CONFIG", VW2 / 2, py + 26, { size: 9, color: env2.ac(0.75), weight: "600", align: "center", font: env2.RES_FONT() });
    env2.fillText("\u8BBE\u7F6E\u4E2D\u5FC3", VW2 / 2, py + 48, { size: 17, align: "center" });
    rows.forEach(([label, desc, on, cb], i) => {
      const y = py + 68 + i * rowH;
      if (i > 0) {
        ctx2.save();
        ctx2.strokeStyle = env2.ac(0.12);
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(px + 20, y + 0.5);
        ctx2.lineTo(px + pw - 20, y + 0.5);
        ctx2.stroke();
        ctx2.restore();
      }
      ctx2.fillStyle = on ? env2.C.cyan : env2.C.dim;
      ctx2.fillRect(px + 16, y + rowH / 2 - 10, 4, 20);
      env2.fillText(label, px + 30, y + 18, { size: 14 });
      env2.fillText(desc, px + 30, y + 38, { size: 10, color: env2.C.sub, weight: "normal" });
      env2.drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
      env2.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: "", cb: () => {
        cb();
        env2.buzz("light");
      } });
    });
    const skY = py + 68 + rows.length * rowH;
    env2.fillText("\u754C\u9762\u76AE\u80A4", px + 30, skY + 12, { size: 14 });
    env2.fillText("INTERFACE SKIN", px + 30, skY + 30, { size: 8, color: env2.C.dim, weight: "600", font: env2.RES_FONT() });
    const chipW = (pw - 40 - 12) / env2.SKINS.length;
    env2.SKINS.forEach((s, i) => {
      const cx0 = px + 20 + i * (chipW + 6);
      const cy0 = skY + 40;
      const on = s.id === env2.skin.id;
      ctx2.save();
      env2.rr(cx0, cy0, chipW, 30, 6);
      ctx2.fillStyle = on ? env2.ac(0.2) : "rgba(138,118,92,0.12)";
      ctx2.fill();
      ctx2.strokeStyle = on ? s.accent : "rgba(138,118,92,0.4)";
      ctx2.lineWidth = on ? 1.6 : 1;
      ctx2.stroke();
      ctx2.fillStyle = s.accent;
      ctx2.beginPath();
      ctx2.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
      env2.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env2.C.text : env2.C.sub });
      env2.hitBox({
        x: cx0,
        y: cy0,
        w: chipW,
        h: 30,
        label: "",
        cb: () => {
          env2.applySkin(s.id);
          env2.buzz("light");
          env2.showToast(`\u5DF2\u5207\u6362\u300C${s.name}\u300D`);
        }
      });
    });
    env2.btn({
      x: px + 24,
      y: py + 68 + rows.length * rowH + skinH + 8,
      w: pw - 48,
      h: 40,
      label: "\u5173\u95ED",
      cb: () => env2.setShowSettings(false)
    });
  }
  function drawProfileImpl(env2) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    ctx2.fillStyle = "rgba(8,5,3,0.8)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.hitBox({ x: 0, y: 0, w: VW2, h: VH2, label: "", cb: () => {
    } });
    const pw = VW2 - 72;
    const ph = 460;
    const px = 36;
    const py = VH2 / 2 - ph / 2;
    env2.panel(px, py, pw, ph, env2.C.panelLine);
    rivets(env2, px, py, pw, ph);
    stripes(env2, px + 8, py + 6, pw - 16, 5, env2.ac(0.4), 8, 5, 0);
    env2.fillText("COMMANDER FILE", VW2 / 2, py + 24, { size: 9, color: env2.ac(0.75), weight: "600", align: "center", font: env2.RES_FONT() });
    env2.drawAvatar(VW2 / 2, py + 66, 34);
    env2.fillText(env2.displayNick(), VW2 / 2, py + 122, { size: 18, align: "center" });
    env2.fillText(env2.commanderRank(), VW2 / 2, py + 146, { size: 11, color: env2.C.gold, align: "center", weight: "normal" });
    const cleared = env2.loadProgress().cleared.length;
    const bw = pw - 64;
    const bx = px + 32;
    const by = py + 168;
    env2.fillText(`\u6218\u5F79\u8FDB\u5EA6 ${cleared} / ${env2.LEVELS.length}`, VW2 / 2, by - 6, { size: 11, color: env2.C.sub, align: "center", weight: "normal" });
    env2.rr(bx, by + 8, bw, 10, 3);
    ctx2.fillStyle = env2.ac(0.12);
    ctx2.fill();
    if (cleared > 0) {
      env2.rr(bx, by + 8, Math.max(10, bw * (cleared / env2.LEVELS.length)), 10, 3);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.C.cyan);
      g.addColorStop(1, env2.C.gold);
      ctx2.fillStyle = g;
      ctx2.fill();
    }
    ctx2.save();
    ctx2.fillStyle = "rgba(255,243,226,0.25)";
    for (let i = 1; i < env2.LEVELS.length; i++) ctx2.fillRect(bx + bw * i / env2.LEVELS.length, by + 8, 1, 10);
    ctx2.restore();
    const rp = env2.getRankProgress();
    const ry = by + 46;
    env2.fillText(
      rp.next === null ? `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} / ${rp.next.toLocaleString("en-US")} \xB7 \u8DDD\u300C${rp.nextName}\u300D\u8FD8\u5DEE ${(rp.next - rp.points).toLocaleString("en-US")} \u5206`,
      VW2 / 2,
      ry - 6,
      { size: 11, color: env2.C.sub, align: "center", weight: "normal" }
    );
    env2.rr(bx, ry + 8, bw, 10, 3);
    ctx2.fillStyle = "rgba(192,169,138,0.14)";
    ctx2.fill();
    const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
    if (frac > 0) {
      env2.rr(bx, ry + 8, Math.max(10, bw * frac), 10, 3);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.shade(env2.C.gold));
      g.addColorStop(1, env2.C.gold);
      ctx2.fillStyle = g;
      ctx2.fill();
    }
    ctx2.save();
    ctx2.fillStyle = "rgba(255,243,226,0.25)";
    for (let i = 1; i < 6; i++) ctx2.fillRect(bx + bw * i / 6, ry + 8, 1, 10);
    ctx2.restore();
    const openid = env2.getProfile().openid;
    if (openid) {
      env2.fillText(`\u5DF2\u7ED1\u5B9A \xB7 ${openid.slice(0, 12)}\u2026`, VW2 / 2, ry + 36, { size: 10, color: env2.C.green, align: "center", weight: "normal" });
    }
    env2.btn({ x: px + 24, y: py + 278, w: pw - 48, h: 40, label: "\u{1F4AC} \u610F\u89C1\u53CD\u9988", color: env2.C.gold, cb: () => env2.openFeedback() });
    let y = py + 330;
    if (!env2.getProfile().real) {
      env2.btn({
        x: px + 24,
        y,
        w: pw - 48,
        h: 44,
        label: "\u540C\u6B65\u5FAE\u4FE1\u5934\u50CF\u6635\u79F0",
        color: env2.C.green,
        primary: true,
        cb: () => env2.authUser()
      });
      y += 56;
    }
    env2.btn({ x: px + 24, y, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => env2.setShowProfile(false) });
  }
  function drawDragGhost2(env2, engine, type, p) {
    const { ctx: ctx2, VW: VW2, VH: VH2, BAR_H: BAR_H2 } = env2;
    const st = engine.state;
    const def = env2.TOWERS[type];
    const gx = Math.floor(env2.toMapX(p.x) / CELL);
    const gy = Math.floor(env2.toMapY(p.y) / CELL);
    const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
    const canBuild = inMap && engine.map.isBuildable(gx, gy) && !st.towers.some((tw) => tw.col === gx && tw.row === gy) && st.gold >= def.levels[0].cost;
    if (inMap) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.rect(0, env2.TOP_SAFE - 2, VW2, VH2 - BAR_H2 - env2.TOP_SAFE + 2);
      ctx2.clip();
      const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
      ctx2.translate(env2.mapOX + (Math.random() - 0.5) * shk * 2, env2.mapOY + env2.getMapPan() + (Math.random() - 0.5) * shk);
      ctx2.scale(env2.mapScale, env2.mapScale);
      const cx = gx * CELL;
      const cy = gy * CELL;
      env2.rr(cx + 2, cy + 2, CELL - 4, CELL - 4, 6);
      ctx2.fillStyle = canBuild ? "rgba(126,217,87,0.22)" : "rgba(255,90,90,0.20)";
      ctx2.fill();
      ctx2.strokeStyle = canBuild ? env2.C.green : env2.C.red;
      ctx2.lineWidth = 2;
      ctx2.stroke();
      if (canBuild) {
        ctx2.strokeStyle = env2.ac(0.5);
        ctx2.lineWidth = 1.5;
        ctx2.setLineDash([8, 6]);
        ctx2.beginPath();
        ctx2.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.save();
        ctx2.globalAlpha = 0.85;
        ctx2.translate(cx + CELL / 2, cy + CELL / 2);
        env2.drawTower(ctx2, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
        ctx2.restore();
      }
      ctx2.restore();
    }
    const hint = canBuild ? "\u677E\u624B\u5EFA\u9020" : inMap ? "\u6B64\u5904\u4E0D\u53EF\u5EFA\u9020" : "\u62D6\u5230\u5730\u56FE\u7A7A\u683C\u4E0A";
    const hColor = canBuild ? env2.C.green : env2.C.sub;
    ctx2.save();
    ctx2.font = "bold 12px sans-serif";
    const hw = ctx2.measureText(hint).width + 36;
    env2.rr(VW2 / 2 - hw / 2, VH2 - BAR_H2 - 34, hw, 26, 6);
    ctx2.fillStyle = "#120D07";
    ctx2.fill();
    ctx2.strokeStyle = `${hColor}88`;
    ctx2.lineWidth = 1.2;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText(hint, VW2 / 2, VH2 - BAR_H2 - 21, { size: 12, color: hColor, align: "center" });
  }
  function handleTouch2(env2, phase, p) {
    if (env2.app.screen !== "codex" || env2.showSettings() || env2.showProfile()) {
      codexDrag2 = null;
      return false;
    }
    if (phase === "start") {
      codexDrag2 = { y: p.y, moved: 0 };
      return false;
    }
    if (phase === "move") {
      if (!codexDrag2) return false;
      env2.codex.scroll = Math.max(0, Math.min(codexMax, env2.codex.scroll + (codexDrag2.y - p.y)));
      codexDrag2.moved += Math.abs(codexDrag2.y - p.y);
      codexDrag2.y = p.y;
      return true;
    }
    const moved = codexDrag2?.moved ?? 0;
    codexDrag2 = null;
    if (moved > 8) env2.consumeTap();
    return false;
  }
  var emberSkin = {
    id: "ember",
    drawSplashMenu: drawSplashMenu2,
    drawHome: drawHome2,
    drawBriefing: drawBriefing2,
    drawBattleHUD: drawBattleHUD2,
    drawBottomBar: drawBottomBar2,
    drawTechOverlay: drawTechOverlay2,
    drawResult: drawResult2,
    drawCodex: drawCodex2,
    drawSettings: drawSettingsImpl,
    drawProfile: drawProfileImpl,
    drawDragGhost: drawDragGhost2,
    handleTouch: handleTouch2
  };

  // src/skins/matrix.ts
  var carPos = 0;
  var carTarget = 0;
  var carInit = false;
  var homeDrag = null;
  var codexDrag3 = null;
  var codexMax2 = 0;
  var HOLD_MS = 600;
  var charge = null;
  var briefCache = null;
  function neonStroke(env2, x, y, w, h, r, a = 0.8) {
    const { ctx: ctx2 } = env2;
    const g = ctx2.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, env2.ac(a));
    g.addColorStop(1, `rgba(255,61,129,${a * 0.75})`);
    ctx2.save();
    env2.rr(x, y, w, h, r);
    ctx2.strokeStyle = g;
    ctx2.lineWidth = 1.4;
    ctx2.stroke();
    ctx2.restore();
  }
  function neonPanel(env2, x, y, w, h, r = 14) {
    env2.panel(x, y, w, h, env2.ac(0.16), r);
    neonStroke(env2, x, y, w, h, r);
  }
  function hexPath2(env2, cx, cy, r) {
    const { ctx: ctx2 } = env2;
    ctx2.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + Math.PI * 2 * i / 6;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx2.moveTo(px, py);
      else ctx2.lineTo(px, py);
    }
    ctx2.closePath();
  }
  function matrixBg(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    const g = ctx2.createLinearGradient(0, 0, 0, VH2);
    g.addColorStop(0, "#0D0719");
    g.addColorStop(0.55, "#070310");
    g.addColorStop(1, "#130A26");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, VW2, VH2);
    const fog1 = ctx2.createRadialGradient(VW2 * 0.85, VH2 * 0.1, 0, VW2 * 0.85, VH2 * 0.1, VW2 * 0.9);
    fog1.addColorStop(0, env2.ac(0.1));
    fog1.addColorStop(1, "rgba(0,0,0,0)");
    ctx2.fillStyle = fog1;
    ctx2.fillRect(0, 0, VW2, VH2);
    const fog2 = ctx2.createRadialGradient(VW2 * 0.12, VH2 * 0.82, 0, VW2 * 0.12, VH2 * 0.82, VW2 * 0.75);
    fog2.addColorStop(0, "rgba(255,61,129,0.07)");
    fog2.addColorStop(1, "rgba(0,0,0,0)");
    ctx2.fillStyle = fog2;
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.drawStars(time, 0.45);
    const horizon = VH2 * 0.62;
    ctx2.save();
    ctx2.strokeStyle = env2.ac(0.07);
    ctx2.lineWidth = 1;
    for (let i = -7; i <= 7; i++) {
      ctx2.beginPath();
      ctx2.moveTo(VW2 / 2 + i * VW2 * 0.028, horizon);
      ctx2.lineTo(VW2 / 2 + i * VW2 * 0.19, VH2);
      ctx2.stroke();
    }
    const scroll = time * 0.06 % 0.125;
    for (let k = 0; k < 8; k++) {
      const f = k / 8 + scroll;
      if (f > 1) break;
      const yy = horizon + (VH2 - horizon) * f * f;
      ctx2.globalAlpha = 0.05 + f * 0.06;
      ctx2.beginPath();
      ctx2.moveTo(0, yy);
      ctx2.lineTo(VW2, yy);
      ctx2.stroke();
    }
    ctx2.restore();
    const hg = ctx2.createLinearGradient(0, horizon - 14, 0, horizon + 14);
    hg.addColorStop(0, "rgba(255,61,129,0)");
    hg.addColorStop(0.5, "rgba(255,61,129,0.10)");
    hg.addColorStop(1, "rgba(255,61,129,0)");
    ctx2.fillStyle = hg;
    ctx2.fillRect(0, horizon - 14, VW2, 28);
    const sy = time * 26 % (VH2 + 120) - 60;
    const sg = ctx2.createLinearGradient(0, sy - 24, 0, sy + 24);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.05));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(0, sy - 24, VW2, 48);
    const seed = Math.floor(time / 5.3);
    const gt = time - seed * 5.3;
    if (env2.hash01(seed * 17 + 5) > 0.4 && gt < 0.22) {
      for (let i = 0; i < 3; i++) {
        const gy = env2.hash01(seed * 31 + i * 7) * VH2;
        const gh = 4 + env2.hash01(seed * 13 + i) * 20;
        const gx = (env2.hash01(seed * 7 + i * 3) - 0.5) * 36;
        ctx2.fillStyle = i % 2 ? `rgba(255,61,129,${0.05 + env2.hash01(seed + i) * 0.05})` : env2.ac(0.05 + env2.hash01(seed + i * 11) * 0.05);
        ctx2.fillRect(gx, gy, VW2, gh);
      }
    }
  }
  function drawMxHeader(env2, title, back) {
    const { ctx: ctx2, VW: VW2, CAP_MID: CAP_MID2, CAP_LEFT: CAP_LEFT2, GAME_CENTER_PAD: GAME_CENTER_PAD2, MARGIN: MARGIN2, TOP_SAFE: TOP_SAFE2 } = env2;
    const btnS = 36;
    const top = CAP_MID2 - btnS / 2;
    const g = ctx2.createLinearGradient(0, top - 6, 0, TOP_SAFE2);
    g.addColorStop(0, "rgba(20,10,40,0.94)");
    g.addColorStop(1, "rgba(10,5,22,0.88)");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, top - 6, VW2, TOP_SAFE2 - top + 6);
    const lg = ctx2.createLinearGradient(0, 0, VW2, 0);
    lg.addColorStop(0, env2.ac(0.55));
    lg.addColorStop(0.55, "rgba(255,61,129,0.35)");
    lg.addColorStop(1, env2.ac(0.04));
    ctx2.fillStyle = lg;
    ctx2.fillRect(0, TOP_SAFE2 - 1, VW2, 1.5);
    const dotX = Date.now() / 14 % (VW2 + 40) - 20;
    ctx2.save();
    ctx2.shadowColor = env2.C.pink;
    ctx2.shadowBlur = 6;
    ctx2.fillStyle = env2.C.pink;
    ctx2.beginPath();
    ctx2.arc(dotX, TOP_SAFE2 - 0.5, 1.6, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
    const hexBtn = (cx, glyph, cb) => {
      const pressed = env2.getPressedBtn();
      const isP = pressed !== null && pressed.label === glyph && Math.abs(pressed.x - (cx - btnS / 2)) < 1 && Math.abs(pressed.y - top) < 1;
      const r = isP ? btnS * 0.4 : btnS * 0.46;
      ctx2.save();
      hexPath2(env2, cx, CAP_MID2, r);
      ctx2.fillStyle = isP ? env2.ac(0.3) : env2.ac(0.1);
      ctx2.fill();
      ctx2.strokeStyle = env2.ac(0.7);
      ctx2.lineWidth = 1.2;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(glyph, cx, CAP_MID2 + 1, { size: 16, color: env2.C.text, align: "center" });
      env2.hitBox({ x: cx - btnS / 2, y: top, w: btnS, h: btnS, label: glyph, cb });
    };
    let tx = MARGIN2;
    const rightLimit = CAP_LEFT2 - 8 - GAME_CENTER_PAD2;
    if (back) {
      hexBtn(MARGIN2 + btnS / 2, "\u2039", back);
      tx = MARGIN2 + btnS + 12;
    }
    let tSize = 16;
    ctx2.save();
    while (tSize > 11) {
      ctx2.font = `bold ${tSize}px sans-serif`;
      if (ctx2.measureText(title).width <= rightLimit - tx - 8) break;
      tSize--;
    }
    ctx2.restore();
    env2.fillText("MATRIX // TOWER LINE DEFENSE", tx, CAP_MID2 - 11, { size: 8, color: env2.ac(0.7), weight: "600" });
    env2.fillText(title, tx, CAP_MID2 + 8, { size: tSize });
  }
  function chargeButton(env2, x, y, w, h, label, cb) {
    const { ctx: ctx2 } = env2;
    const pressed = env2.getPressedBtn();
    const match = pressed !== null && pressed.x === x && pressed.y === y && pressed.w === w && pressed.label === label;
    if (match) {
      if (!charge || charge.key !== label) charge = { key: label, startT: Date.now(), fired: false };
    } else if (charge && charge.key === label) {
      charge = null;
    }
    const prog = charge && charge.key === label ? Math.min(1, (Date.now() - charge.startT) / HOLD_MS) : 0;
    if (prog >= 1 && charge && !charge.fired) {
      charge.fired = true;
      env2.buzz("heavy");
      cb();
    }
    ctx2.save();
    env2.rr(x, y, w, h, 12);
    ctx2.fillStyle = env2.skin.panelSolid;
    ctx2.fill();
    if (prog > 0) {
      ctx2.save();
      env2.rr(x, y, w, h, 12);
      ctx2.clip();
      const fg = ctx2.createLinearGradient(x, y + h, x, y);
      fg.addColorStop(0, env2.ac(0.55));
      fg.addColorStop(1, "rgba(255,61,129,0.45)");
      ctx2.fillStyle = fg;
      ctx2.fillRect(x, y + h * (1 - prog), w, h * prog);
      ctx2.restore();
    }
    const lg = ctx2.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, env2.ac(0.9));
    lg.addColorStop(1, "rgba(255,61,129,0.8)");
    env2.rr(x, y, w, h, 12);
    ctx2.strokeStyle = lg;
    ctx2.lineWidth = 1.6;
    ctx2.shadowColor = env2.C.cyan;
    ctx2.shadowBlur = prog > 0 ? 10 : 0;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText(prog > 0 ? `\u5145\u80FD ${Math.round(prog * 100)}%` : label, x + w / 2, y + h / 2, {
      size: 15,
      color: prog > 0 ? "#FFFFFF" : env2.C.text,
      align: "center"
    });
    if (prog === 0) {
      env2.fillText("HOLD TO CONFIRM", x + w / 2, y + h + 12, { size: 8, color: env2.C.dim, align: "center", weight: "600" });
    }
    env2.hitBox({ x, y, w, h, label, cb: () => {
      env2.showToast("\u957F\u6309 0.6s \u5145\u80FD\u786E\u8BA4");
      env2.buzz("light");
    } });
  }
  function drawOverlays2(env2) {
    if (env2.showProfile()) drawProfile2(env2);
    if (env2.showSettings()) drawSettings2(env2);
  }
  function drawSplashMenu3(env2, time, menuA) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    const slide = (1 - menuA) * 16;
    ctx2.save();
    ctx2.globalAlpha = menuA;
    const cx = VW2 / 2;
    const cy = VH2 * 0.8 + slide;
    for (let k = 0; k < 2; k++) {
      const ph = (time * 0.7 + k * 0.5) % 1;
      ctx2.save();
      ctx2.globalAlpha = menuA * (1 - ph) * 0.5;
      ctx2.strokeStyle = k ? env2.C.pink : env2.C.cyan;
      ctx2.lineWidth = 1.6;
      ctx2.beginPath();
      ctx2.arc(cx, cy, 46 + ph * 30, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.restore();
    }
    const pressed = env2.getPressedBtn();
    const mainP = pressed !== null && pressed.label === "\u25B6 \u5F00\u59CB\u6218\u5F79";
    const R = mainP ? 42 : 45;
    ctx2.save();
    const bg = ctx2.createRadialGradient(cx, cy - R * 0.4, R * 0.1, cx, cy, R);
    bg.addColorStop(0, env2.ac(0.5));
    bg.addColorStop(1, "rgba(20,10,40,0.95)");
    ctx2.beginPath();
    ctx2.arc(cx, cy, R, 0, Math.PI * 2);
    ctx2.fillStyle = bg;
    ctx2.fill();
    const rg = ctx2.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rg.addColorStop(0, env2.ac(0.95));
    rg.addColorStop(1, "rgba(255,61,129,0.85)");
    ctx2.strokeStyle = rg;
    ctx2.lineWidth = 2;
    ctx2.shadowColor = env2.C.cyan;
    ctx2.shadowBlur = 12;
    ctx2.stroke();
    ctx2.restore();
    env2.fillText("\u25B6", cx, cy - 9, { size: 22, color: "#FFFFFF", align: "center" });
    env2.fillText("\u5F00\u59CB\u6218\u5F79", cx, cy + 14, { size: 13, align: "center" });
    env2.hitBox({ x: cx - 48, y: cy - 48, w: 96, h: 96, label: "\u25B6 \u5F00\u59CB\u6218\u5F79", cb: () => env2.goto("home") });
    const entries = [
      ["\u2726", "\u56FE\u9274", env2.C.gold, () => {
        env2.codex.scroll = 0;
        env2.goto("codex");
      }],
      ["\u2699", "\u8BBE\u7F6E", env2.C.cyan, () => {
        env2.setShowProfile(false);
        env2.setShowSettings(true);
      }],
      ["\u25C8", "\u6863\u6848", env2.C.green, () => {
        env2.setShowSettings(false);
        env2.setShowProfile(true);
      }]
    ];
    const satR = Math.min(84, VW2 * 0.24);
    const angles = [-Math.PI * 0.86, -Math.PI * 0.5, -Math.PI * 0.14];
    entries.forEach(([glyph, label, color, cb], i) => {
      const bx = cx + Math.cos(angles[i]) * satR * 1.5;
      const by = cy + Math.sin(angles[i]) * satR + Math.sin(time * 1.2 + i * 2.1) * 3;
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(bx, by, 24, 0, Math.PI * 2);
      ctx2.fillStyle = env2.skin.panelSolid;
      ctx2.fill();
      ctx2.strokeStyle = color;
      ctx2.lineWidth = 1.4;
      ctx2.shadowColor = color;
      ctx2.shadowBlur = 10;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(glyph, bx, by, { size: 15, color, align: "center" });
      env2.fillText(label, bx, by + 36, { size: 11, color: env2.C.sub, align: "center" });
      env2.hitBox({ x: bx - 26, y: by - 26, w: 52, h: 52, label: `sat-${label}`, cb });
    });
    ctx2.restore();
  }
  var carCardW = (env2) => env2.VW * 0.74;
  var carStep = (env2) => carCardW(env2) + 20;
  function drawHome3(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, TOP_SAFE: TOP_SAFE2 } = env2;
    matrixBg(env2, time);
    drawMxHeader(env2, "\u6218\u5F79\u9009\u62E9", () => env2.goto("splash"));
    const tabY = TOP_SAFE2 + 8;
    const tabH = 36;
    const fullW = VW2 - MARGIN2 * 2;
    const diffW = Math.round(fullW * 0.62);
    const tabW = (diffW - 16) / 3;
    env2.DIFF_LIST.forEach((d, i) => {
      const x = MARGIN2 + i * (tabW + 8);
      const on = env2.app.difficulty === d;
      ctx2.save();
      env2.rr(x, tabY, tabW, tabH, 10);
      ctx2.fillStyle = on ? env2.ac(0.16) : "rgba(20,12,36,0.85)";
      ctx2.fill();
      ctx2.strokeStyle = on ? env2.ac(0.8) : "rgba(110,92,142,0.4)";
      ctx2.lineWidth = on ? 1.5 : 1;
      ctx2.stroke();
      if (on) {
        const ug = ctx2.createLinearGradient(x, 0, x + tabW, 0);
        ug.addColorStop(0, env2.ac(0.9));
        ug.addColorStop(1, "rgba(255,61,129,0.9)");
        ctx2.fillStyle = ug;
        ctx2.shadowColor = env2.C.cyan;
        ctx2.shadowBlur = 6;
        ctx2.fillRect(x + 10, tabY + tabH - 3, tabW - 20, 2);
      }
      ctx2.restore();
      env2.fillText(env2.DIFFICULTIES[d].name, x + tabW / 2, tabY + tabH / 2, {
        size: 13,
        color: on ? env2.C.text : env2.C.dim,
        align: "center"
      });
      env2.hitBox({
        x,
        y: tabY,
        w: tabW,
        h: tabH,
        label: `diff-${d}`,
        cb: () => {
          if (env2.app.difficulty === d) return;
          env2.app.difficulty = d;
          env2.track("difficulty_select", { difficulty: d });
          env2.buzz("light");
        }
      });
    });
    const coopX = MARGIN2 + diffW + 10;
    const coopTabW = (fullW - diffW - 10 - 12) / 3;
    const MODE_TABS = [
      ["\u5355\u4EBA", "single"],
      ["\u540C\u5C4F", "coop"],
      ["\u8054\u673A", "online"]
    ];
    MODE_TABS.forEach(([label, mode], i) => {
      const x = coopX + i * (coopTabW + 6);
      const on = env2.app.mode === mode;
      ctx2.save();
      env2.rr(x, tabY, coopTabW, tabH, 10);
      ctx2.fillStyle = on ? env2.ac(0.16) : "rgba(20,12,36,0.85)";
      ctx2.fill();
      ctx2.strokeStyle = on ? env2.ac(0.8) : "rgba(110,92,142,0.4)";
      ctx2.lineWidth = on ? 1.5 : 1;
      ctx2.stroke();
      if (on) {
        const ug = ctx2.createLinearGradient(x, 0, x + coopTabW, 0);
        ug.addColorStop(0, i === 1 ? "rgba(61,240,140,0.9)" : i === 2 ? "rgba(255,201,77,0.9)" : env2.ac(0.9));
        ug.addColorStop(1, "rgba(255,61,129,0.9)");
        ctx2.fillStyle = ug;
        ctx2.shadowColor = env2.C.cyan;
        ctx2.shadowBlur = 6;
        ctx2.fillRect(x + 8, tabY + tabH - 3, coopTabW - 16, 2);
      }
      ctx2.restore();
      env2.fillText(label, x + coopTabW / 2, tabY + tabH / 2, {
        size: 13,
        color: on ? env2.C.text : env2.C.dim,
        align: "center"
      });
      env2.hitBox({
        x,
        y: tabY,
        w: coopTabW,
        h: tabH,
        label: `mode-${mode}`,
        cb: () => {
          if (env2.app.mode !== mode) {
            env2.setMode(mode);
            env2.buzz("light");
          }
        }
      });
    });
    const N = env2.LEVELS.length;
    if (!carInit) {
      carInit = true;
      carPos = carTarget = Math.max(0, Math.min(env2.unlockedChapter() - 1, N - 1));
    }
    if (!homeDrag) {
      carPos += (carTarget - carPos) * 0.18;
      if (Math.abs(carTarget - carPos) < 2e-3) carPos = carTarget;
    }
    const regionTop = tabY + tabH + 16;
    const regionBottom = VH2 - 52;
    const cardW = carCardW(env2);
    const cardH = Math.min(330, regionBottom - regionTop - 30);
    const step = carStep(env2);
    const cy = (regionTop + regionBottom) / 2;
    const cleared = env2.loadProgress().cleared;
    const order = env2.LEVELS.map((_, i) => i).sort((a, b) => Math.abs(b - carPos) - Math.abs(a - carPos));
    for (const i of order) {
      const off = i - carPos;
      if (Math.abs(off) > 1.7) continue;
      const lv = env2.LEVELS[i];
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const scale = 1 - Math.min(0.16, Math.abs(off) * 0.13);
      const w = cardW * scale;
      const h = cardH * scale;
      const x = VW2 / 2 + off * step - w / 2;
      const y = cy - h / 2;
      const isCurrent = Math.abs(off) < 0.5;
      ctx2.save();
      ctx2.globalAlpha = Math.max(0.3, 1 - Math.abs(off) * 0.45);
      neonPanel(env2, x, y, w, h, 14);
      const artH = h * 0.42;
      env2.drawCardArt(x + 8, y + 8, w - 16, artH, lv.id, time, 10);
      env2.rr(x + 8, y + 8, w - 16, artH, 10);
      ctx2.strokeStyle = env2.ac(0.35);
      ctx2.lineWidth = 1;
      ctx2.stroke();
      if (!unlock) {
        env2.rr(x + 8, y + 8, w - 16, artH, 10);
        ctx2.fillStyle = "rgba(7,4,14,0.55)";
        ctx2.fill();
      }
      const tx = x + 18;
      const iy = y + artH + 24;
      ctx2.save();
      if (!unlock) ctx2.globalAlpha *= 0.5;
      env2.fillText(`CH-${String(lv.id).padStart(2, "0")} // SECTOR`, tx, iy + 8, { size: 9, color: env2.C.cyan, weight: "600" });
      env2.fillText(lv.name, tx, iy + 30, { size: 18 });
      env2.fillText(lv.sub, tx, iy + 50, { size: 11, color: env2.C.sub, weight: "normal" });
      const bossTxt = lv.waves.filter((wv) => wv.isBoss).map((wv) => `W${wv.wave}`).join(" ");
      env2.fillText(`${lv.waves.length} \u6CE2 \xB7 BOSS ${bossTxt || "\u2014"}`, tx, iy + 68, { size: 10, color: env2.C.dim, weight: "normal" });
      ctx2.restore();
      if (done) env2.chip(x + w - 12, y + 16, "\u5DF2\u901A\u5173", env2.C.green);
      else if (!unlock) env2.chip(x + w - 12, y + 16, "\u672A\u89E3\u9501", env2.C.dim);
      if (isCurrent) {
        if (unlock) {
          env2.btn({
            x: x + 20,
            y: y + h - 54,
            w: w - 40,
            h: 40,
            label: done ? "\u91CD\u73A9" : "\u25B6 \u51FA\u51FB",
            color: done ? env2.C.green : env2.C.cyan,
            primary: !done,
            cb: () => env2.gotoBriefing(lv.id)
          });
        } else {
          env2.fillText("\u{1F512}", x + w / 2, y + h - 46, { size: 16, align: "center" });
          env2.fillText(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`, x + w / 2, y + h - 24, { size: 10, color: env2.C.sub, align: "center", weight: "normal" });
          env2.hitBox({
            x,
            y,
            w,
            h,
            label: `lock-${lv.id}`,
            cb: () => {
              env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
              env2.buzz("light");
            }
          });
        }
      } else {
        env2.hitBox({ x, y, w, h, label: `nav-${lv.id}`, cb: () => {
          carTarget = i;
          env2.buzz("light");
        } });
      }
      ctx2.restore();
    }
    const dotY = cy + cardH / 2 + 20;
    const dotGap = 16;
    const dotsX = VW2 / 2 - (N - 1) * dotGap / 2;
    for (let i = 0; i < N; i++) {
      const on = i === Math.round(carPos);
      ctx2.save();
      hexPath2(env2, dotsX + i * dotGap, dotY, on ? 4.5 : 3);
      ctx2.fillStyle = on ? env2.ac(0.95) : "rgba(110,92,142,0.45)";
      if (on) {
        ctx2.shadowColor = env2.C.cyan;
        ctx2.shadowBlur = 6;
      }
      ctx2.fill();
      ctx2.restore();
    }
    env2.fillText("\u25C0 \u5DE6\u53F3\u6ED1\u52A8\u5207\u6362\u7AE0\u8282 \u25B6", VW2 / 2, VH2 - 30, { size: 9, color: env2.C.dim, align: "center", weight: "normal" });
    env2.fillText("\u5FAE\u4FE1\u5C0F\u6E38\u620F \xB7 \u8BD5\u8FD0\u8425\u5305", VW2 / 2, VH2 - 12, { size: 10, color: "rgba(110,92,142,0.7)", align: "center" });
    drawOverlays2(env2);
  }
  function briefLines(env2, lv, textW, size) {
    const key = `${lv.id}|${textW}|${env2.skin.id}|${env2.app.difficulty}|${env2.app.coop ? 1 : 0}`;
    if (briefCache && briefCache.key === key) return briefCache.lines;
    const per = Math.max(6, Math.floor(textW / size));
    const body = "rgba(164,143,200,0.95)";
    const lines = [
      [`> OPERATION BRIEFING // CH-${String(lv.id).padStart(2, "0")}`, env2.C.cyan],
      [`> \u76EE\u6807\u533A\u57DF\uFF1A${lv.name} \xB7 ${lv.sub}`, env2.C.text],
      ["", body]
    ];
    for (const para of lv.briefing) {
      for (let i = 0; i < para.length; i += per) lines.push([para.slice(i, i + per), body]);
      lines.push(["", body]);
    }
    const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(" ");
    lines.push([`> \u6CE2\u6B21 ${lv.waves.length} \xB7 BOSS ${bossTxt || "\u2014"}`, "#FF9F43"]);
    lines.push([`> \u96BE\u5EA6 ${env2.DIFFICULTIES[env2.app.difficulty].name} \xB7 ${env2.DIFFICULTIES[env2.app.difficulty].label}`, env2.C.gold]);
    if (env2.app.coop) lines.push(["> CO-OP \u53CC\u4EBA\u540C\u5C4F // P1 \u5EFA\u9020 \xB7 P2 \u6307\u6325", env2.C.green]);
    briefCache = { key, lines };
    return lines;
  }
  function drawBriefing3(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, TOP_SAFE: TOP_SAFE2 } = env2;
    matrixBg(env2, time);
    const lv = env2.LEVELS.find((l) => l.id === env2.app.levelId) ?? env2.LEVELS[0];
    drawMxHeader(env2, "\u4EFB\u52A1\u7B80\u62A5", () => {
      env2.stopNarration();
      env2.goto("home");
    });
    const bannerH = Math.min(112, Math.round(VW2 * 0.3));
    const bx = MARGIN2;
    const bw = VW2 - MARGIN2 * 2;
    const by = TOP_SAFE2 + 6;
    env2.drawCardArt(bx, by, bw, bannerH, lv.id, time, 10);
    ctx2.save();
    env2.rr(bx, by, bw, bannerH, 10);
    ctx2.clip();
    const scanY = by + time * 34 % (bannerH + 30) - 15;
    const sg = ctx2.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.18));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(bx, scanY - 10, bw, 20);
    ctx2.restore();
    neonStroke(env2, bx, by, bw, bannerH, 10);
    ctx2.save();
    env2.rr(bx, by, bw, bannerH, 10);
    ctx2.clip();
    const tg = ctx2.createLinearGradient(0, by + bannerH * 0.4, 0, by + bannerH);
    tg.addColorStop(0, "rgba(7,4,14,0)");
    tg.addColorStop(1, "rgba(7,4,14,0.85)");
    ctx2.fillStyle = tg;
    ctx2.fillRect(bx, by, bw, bannerH);
    ctx2.restore();
    env2.fillText(`CH-${String(lv.id).padStart(2, "0")}`, bx + 14, by + bannerH - 34, { size: 10, color: env2.C.cyan, weight: "600" });
    env2.fillText(lv.name, bx + 14, by + bannerH - 14, { size: 17 });
    env2.btn({
      x: bx + bw - 88,
      y: by + 10,
      w: 78,
      h: 30,
      label: env2.narrationMuted() ? "\u{1F507} \u65C1\u767D" : "\u{1F50A} \u65C1\u767D",
      color: env2.narrationMuted() ? env2.C.sub : env2.C.cyan,
      cb: env2.toggleNarrationMuted
    });
    const textSize = 12;
    const lineH = textSize * 1.6;
    const textW = VW2 - MARGIN2 * 2 - 32;
    const lines = briefLines(env2, lv, textW, textSize);
    const boxY = by + bannerH + 12;
    const boxH = Math.ceil(lines.length * lineH) + 30;
    neonPanel(env2, MARGIN2, boxY, VW2 - MARGIN2 * 2, boxH, 12);
    const t = (Date.now() - env2.getScreenAt()) / 1e3 - 0.35;
    let budget = Math.max(0, Math.floor(t * 30));
    let cy0 = boxY + 24;
    let cursorX = MARGIN2 + 16;
    let cursorY = cy0;
    let typingDone = true;
    for (const [text, color] of lines) {
      if (budget <= 0) {
        typingDone = false;
        break;
      }
      const shown = text.slice(0, budget);
      env2.fillText(shown, MARGIN2 + 16, cy0, { size: textSize, color, weight: "normal" });
      cursorX = MARGIN2 + 16 + shown.length * textSize;
      cursorY = cy0;
      budget -= text.length;
      cy0 += lineH;
      if (shown.length < text.length) {
        typingDone = false;
        break;
      }
    }
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      env2.fillText("\u258C", Math.min(cursorX + 2, MARGIN2 + 16 + textW), cursorY, { size: textSize, color: env2.C.cyan, weight: "normal" });
    }
    const afterY = boxY + boxH + 26;
    chargeButton(env2, VW2 / 2 - 110, afterY, 220, 52, "\u25B6 \u957F \u6309 \u51FA \u51FB", () => env2.startBattle());
    env2.btn({
      x: VW2 / 2 - 110,
      y: afterY + 78,
      w: 220,
      h: 42,
      label: "\u8FD4\u56DE\u9009\u5173",
      color: env2.C.sub,
      cb: () => {
        env2.stopNarration();
        env2.goto("home");
      }
    });
    if (!typingDone && t > 0) {
      env2.fillText("DECODING\u2026", VW2 / 2, VH2 - 14, { size: 8, color: env2.C.dim, align: "center", weight: "600" });
    }
    drawOverlays2(env2);
  }
  function drawBattleHUD3(env2, engine) {
    const { ctx: ctx2, VW: VW2, TOP_SAFE: TOP_SAFE2, CAP_LEFT: CAP_LEFT2, GAME_CENTER_PAD: GAME_CENTER_PAD2 } = env2;
    const st = engine.state;
    const hudY = TOP_SAFE2;
    const barH = 34;
    const barX = 12;
    const barR = CAP_LEFT2 - 8 - GAME_CENTER_PAD2;
    const barW = barR - barX;
    const numFont = env2.RES_FONT();
    neonPanel(env2, barX, hudY, barW, barH, 17);
    ctx2.save();
    env2.rr(barX, hudY, barW, barH, 17);
    ctx2.clip();
    const sx = barX + Date.now() / 18 % (barW + 60) - 30;
    const sg = ctx2.createLinearGradient(sx - 14, 0, sx + 14, 0);
    sg.addColorStop(0, env2.ac(0));
    sg.addColorStop(0.5, env2.ac(0.14));
    sg.addColorStop(1, env2.ac(0));
    ctx2.fillStyle = sg;
    ctx2.fillRect(sx - 14, hudY, 28, barH);
    ctx2.restore();
    const cy = hudY + barH / 2;
    const measure = (s) => {
      ctx2.save();
      ctx2.font = `bold 12px ${numFont}`;
      const w = ctx2.measureText(s).width;
      ctx2.restore();
      return w;
    };
    const hairline = (x) => {
      ctx2.fillStyle = env2.ac(0.3);
      ctx2.fillRect(x, hudY + 11, 1, barH - 22);
    };
    let tx = barX + 14;
    const lifeTxt = `\u2764 ${st.lives}`;
    ctx2.save();
    if (st.lives <= 5) ctx2.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 180));
    env2.fillText(lifeTxt, tx, cy, { size: 12, color: env2.C.red, font: numFont });
    ctx2.restore();
    tx += measure(lifeTxt) + 10;
    hairline(tx);
    tx += 10;
    const goldTxt = `\u25C8 ${st.gold}`;
    env2.fillText(goldTxt, tx, cy, { size: 12, color: env2.C.gold, font: numFont });
    tx += measure(goldTxt) + 10;
    hairline(tx);
    tx += 10;
    const waveTxt = `${st.wave}/${st.totalWaves}`;
    env2.fillText(waveTxt, tx, cy - 2, { size: 12, color: env2.C.cyan, font: numFont });
    const waveW = Math.max(measure(waveTxt), 26);
    ctx2.fillStyle = env2.ac(0.25);
    ctx2.fillRect(tx, hudY + barH - 8, waveW, 2);
    const pg = ctx2.createLinearGradient(tx, 0, tx + waveW, 0);
    pg.addColorStop(0, env2.ac(0.9));
    pg.addColorStop(1, "rgba(255,61,129,0.9)");
    ctx2.fillStyle = pg;
    ctx2.fillRect(tx, hudY + barH - 8, waveW * Math.min(1, st.wave / st.totalWaves), 2);
    const btnW = 30;
    const btns = [
      [st.paused ? "\u25B6" : "\u23F8", st.paused, () => env2.engineCmd({ type: "TOGGLE_PAUSE" })],
      [st.speed === 2 ? "2x" : "1x", st.speed === 2, () => env2.engineCmd({ type: "SET_SPEED", speed: st.speed === 2 ? 1 : 2 })],
      ["\u2261", false, () => {
        env2.app.engine = null;
        env2.goto("home");
      }]
    ];
    const segX = barR - 2 - btnW * btns.length;
    ctx2.fillStyle = env2.ac(0.45);
    ctx2.fillRect(segX - 6, hudY + 7, 1, barH - 14);
    btns.forEach(([label, active, cb], i) => {
      const bx = segX + i * btnW;
      const pressed = env2.getPressedBtn();
      const isP = pressed !== null && pressed.label === `hud-${label}` && Math.abs(pressed.x - bx) < 1 && Math.abs(pressed.y - hudY) < 1;
      if (active || isP) {
        ctx2.fillStyle = active ? env2.ac(0.22) : env2.ac(0.14);
        ctx2.fillRect(bx, hudY + 2, btnW, barH - 4);
      }
      env2.fillText(label, bx + btnW / 2, cy, {
        size: 12,
        color: active ? env2.C.cyan : env2.C.text,
        align: "center",
        font: numFont
      });
      env2.hitBox({ x: bx, y: hudY, w: btnW, h: barH, label: `hud-${label}`, cb });
    });
    if (st.phase === "prep") {
      const py = hudY + barH + 8;
      neonPanel(env2, VW2 / 2 - 128, py, 256, 74, 14);
      env2.fillText(`\u7B2C ${st.wave} \u6CE2 \xB7 ${Math.max(0, Math.ceil(st.prepT))}s \u540E\u6765\u88AD`, VW2 / 2, py + 17, { size: 13, align: "center", font: env2.RES_FONT() });
      const wave = engine.level.waves[st.wave - 1];
      const groups = wave?.groups ?? [];
      const isBossWave = wave?.isBoss ?? false;
      const summary = [...new Set(groups.map((g) => `${env2.ENEMIES[g.type].name}\xD7${g.count}`))].join(" ");
      env2.fillText(`${isBossWave ? "\u26A0 BOSS \u6CE2 \xB7 " : ""}${summary}`, VW2 / 2, py + 38, {
        size: 9,
        color: isBossWave ? env2.C.pink : "#FF9F43",
        align: "center",
        weight: "normal"
      });
      env2.fillText(
        env2.app.coop ? "P1 \u5EFA\u9020\u9632\u7EBF \xB7 P2 \u628A\u63E1\u5347\u7EA7\u4E0E\u79D1\u6280\u65F6\u673A" : isBossWave ? "\u5EFA\u8BAE\u7559\u597D\u91D1\u5E01\u4E0E\u7A7F\u7532\u706B\u529B" : "\u636E\u6B64\u63D0\u524D\u8C03\u6574\u5E03\u9632",
        VW2 / 2,
        py + 54,
        { size: 9, color: env2.C.sub, align: "center", weight: "normal" }
      );
      chargeButton(env2, VW2 / 2 - 85, py + 84, 170, 42, "\u25B6 \u957F\u6309\u5F00\u6218", () => env2.engineCmd({ type: "SKIP_PREP" }));
    }
  }
  function drawBottomBar3(env2, engine) {
    const { ctx: ctx2, VW: VW2, VH: VH2, BAR_H: BAR_H2, MARGIN: MARGIN2 } = env2;
    const st = engine.state;
    const g = ctx2.createLinearGradient(0, VH2 - BAR_H2, 0, VH2);
    g.addColorStop(0, "#150B28");
    g.addColorStop(1, "#0A0516");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, VH2 - BAR_H2, VW2, BAR_H2);
    const lg = ctx2.createLinearGradient(0, 0, VW2, 0);
    lg.addColorStop(0, env2.ac(0.5));
    lg.addColorStop(0.5, "rgba(255,61,129,0.4)");
    lg.addColorStop(1, env2.ac(0.1));
    ctx2.fillStyle = lg;
    ctx2.fillRect(0, VH2 - BAR_H2, VW2, 1.5);
    if (st.phase === "tech") return;
    const sel = env2.app.selectedId != null ? st.towers.find((t) => t.id === env2.app.selectedId) : void 0;
    if (sel) {
      const def = env2.TOWERS[sel.type];
      env2.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN2 + 4, VH2 - BAR_H2 + 15, { size: 13, color: def.color });
      const upCost = sel.level < 2 ? env2.TOWERS[sel.type].levels[sel.level + 1].cost : -1;
      env2.btn({
        x: MARGIN2,
        y: VH2 - BAR_H2 + 32,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: upCost >= 0 ? `\u5347\u7EA7 \u25C8 ${upCost}` : "\u5DF2\u6EE1\u7EA7",
        disabled: upCost < 0 || st.gold < upCost,
        color: env2.C.green,
        primary: upCost >= 0 && st.gold >= upCost,
        cb: () => {
          if (env2.engineCmd({ type: "UPGRADE", id: sel.id })) {
            env2.sfx.play("upgrade");
            env2.buzz("light");
          }
        }
      });
      const refund = Math.floor(sel.invested * env2.SELL_RATE);
      env2.btn({
        x: VW2 / 2 + 6,
        y: VH2 - BAR_H2 + 32,
        w: VW2 / 2 - MARGIN2 - 6,
        h: 46,
        label: `\u51FA\u552E +${refund}`,
        color: "#FF9F43",
        cb: () => {
          if (env2.engineCmd({ type: "SELL", id: sel.id })) env2.sfx.play("sell");
          env2.app.selectedId = null;
        }
      });
      return;
    }
    if (env2.app.placing) {
      const def = env2.TOWERS[env2.app.placing];
      env2.fillText(`\u70B9\u51FB\u5730\u56FE\u4E0A\u7EFF\u8272\u683C\u5EFA\u9020\u300C${def.name}\u300D`, VW2 / 2, VH2 - BAR_H2 + 18, { size: 12, color: def.color, align: "center" });
      env2.btn({ x: VW2 / 2 - 76, y: VH2 - BAR_H2 + 36, w: 152, h: 40, label: "\u53D6\u6D88\u653E\u7F6E", cb: () => {
        env2.app.placing = null;
      } });
      return;
    }
    const sw = env2.SLOT_W;
    const slotH = BAR_H2 - 24;
    const viewX = MARGIN2;
    const viewW = VW2 - MARGIN2 * 2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(viewX - 4, VH2 - BAR_H2 + 4, viewW + 8, BAR_H2 - 8);
    ctx2.clip();
    env2.TOWER_ORDER.forEach((type, i) => {
      const def = env2.TOWERS[type];
      const cost = def.levels[0].cost;
      const locked = !env2.towerUnlocked(type);
      const bx = viewX + i * (sw + env2.SLOT_GAP) - env2.barScroll;
      const by = VH2 - BAR_H2 + 12;
      if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
      const disabled = locked || st.gold < cost;
      ctx2.save();
      ctx2.globalAlpha = disabled ? 0.55 : 1;
      env2.rr(bx, by, sw, slotH, 12);
      const sg2 = ctx2.createLinearGradient(bx, by, bx, by + slotH);
      sg2.addColorStop(0, "rgba(36,20,60,0.96)");
      sg2.addColorStop(1, "rgba(18,10,34,0.96)");
      ctx2.fillStyle = sg2;
      ctx2.fill();
      if (disabled) {
        ctx2.strokeStyle = "rgba(110,92,142,0.45)";
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
      } else {
        const bg2 = ctx2.createLinearGradient(bx, by, bx + sw, by + slotH);
        bg2.addColorStop(0, `${def.color}CC`);
        bg2.addColorStop(1, "rgba(255,61,129,0.7)");
        ctx2.strokeStyle = bg2;
        ctx2.lineWidth = 1.5;
        ctx2.stroke();
      }
      ctx2.translate(bx + sw / 2, by + 27);
      env2.drawTower(ctx2, type, 0, 38, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
      ctx2.restore();
      env2.fillText(`\u25C8${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? "#9A6A34" : env2.C.gold, align: "center", font: env2.RES_FONT() });
      if (locked) {
        ctx2.save();
        env2.rr(bx, by, sw, slotH, 12);
        ctx2.fillStyle = "rgba(7,4,14,0.6)";
        ctx2.fill();
        ctx2.restore();
        env2.fillText("\u{1F512}", bx + sw / 2, by + 22, { size: 14, align: "center" });
        env2.fillText(`\u7B2C${env2.TOWER_UNLOCK[type]}\u7AE0`, bx + sw / 2, by + 54, { size: 10, color: env2.C.sub, align: "center" });
      }
    });
    ctx2.restore();
    if (env2.stripMaxScroll > 0) {
      if (env2.barScroll > 0) {
        const gl2 = ctx2.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
        gl2.addColorStop(0, "rgba(13,7,25,0.95)");
        gl2.addColorStop(1, "rgba(13,7,25,0)");
        ctx2.fillStyle = gl2;
        ctx2.fillRect(viewX - 4, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
      if (env2.barScroll < env2.stripMaxScroll) {
        const gr2 = ctx2.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
        gr2.addColorStop(0, "rgba(13,7,25,0)");
        gr2.addColorStop(1, "rgba(13,7,25,0.95)");
        ctx2.fillStyle = gr2;
        ctx2.fillRect(viewX + viewW - 18, VH2 - BAR_H2 + 4, 22, BAR_H2 - 8);
      }
    }
  }
  function drawTechOverlay3(env2, engine) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, TOP_SAFE: TOP_SAFE2 } = env2;
    const st = engine.state;
    ctx2.fillStyle = "rgba(8,4,16,0.94)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.fillText("TACTICAL MODULE", VW2 / 2, TOP_SAFE2 + 12, { size: 11, color: env2.C.cyan, align: "center", weight: "600" });
    env2.fillText(`\u7B2C ${st.wave} \u6CE2\u524D \xB7 \u9009\u62E9\u6218\u672F\u6A21\u5757`, VW2 / 2, TOP_SAFE2 + 42, { size: 19, align: "center" });
    env2.fillText(`\u4E09\u9009\u4E00 \xB7 \u540C\u540D\u53EF\u53E0\u52A0 \xB7 \u5DF2\u88C5 ${st.techs.length}`, VW2 / 2, TOP_SAFE2 + 66, { size: 11, color: env2.C.sub, align: "center", weight: "normal" });
    const taken = {};
    for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
    const cardH = 128;
    const top = TOP_SAFE2 + 92;
    st.techChoices.forEach((id, i) => {
      const y = top + i * (cardH + 16);
      const def = env2.TECHS[id];
      const at = (Date.now() - env2.getTechShownAt()) / 1e3 - i * 0.12;
      const k = Math.min(1, Math.max(0, at / 0.4));
      const seed = Math.floor(Math.max(0, at) * 24);
      const xOff = k < 1 ? (env2.hash01(seed * 31 + i * 7) - 0.5) * 46 * (1 - k) : 0;
      ctx2.save();
      ctx2.globalAlpha = Math.max(0, Math.min(1, at / 0.15));
      ctx2.translate(xOff, 0);
      neonPanel(env2, MARGIN2, y, VW2 - MARGIN2 * 2, cardH, 12);
      const igx = MARGIN2 + 48;
      const igy = y + cardH / 2;
      ctx2.save();
      hexPath2(env2, igx, igy, 34);
      ctx2.fillStyle = `${def.color}1A`;
      ctx2.fill();
      ctx2.strokeStyle = `${def.color}99`;
      ctx2.lineWidth = 1.4;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(def.glyph, igx, igy, { size: 26, color: def.color, align: "center" });
      const tx = MARGIN2 + 96;
      const textW = VW2 - MARGIN2 * 2 - 96 - 16;
      const descLines = env2.wrapCount(def.desc, textW, 12);
      const blockH = 24 + descLines * 12 * 1.65;
      const ty0 = y + cardH / 2 - blockH / 2;
      if (k < 0.7) {
        env2.fillText(def.name, tx - 2, ty0 + 10, { size: 16, color: "rgba(255,61,129,0.55)" });
        env2.fillText(def.name, tx + 2, ty0 + 10, { size: 16, color: env2.ac(0.55) });
      }
      env2.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
      if (taken[id]) env2.chip(MARGIN2 + (VW2 - MARGIN2 * 2) - 12, y + 22, `\u5DF2\u88C5\xD7${taken[id]}`, def.color);
      env2.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: "rgba(164,143,200,1)", size: 12 });
      ctx2.restore();
      env2.hitBox({ x: MARGIN2, y, w: VW2 - MARGIN2 * 2, h: cardH, label: `tech-${id}`, cb: () => {
        if (env2.engineCmd({ type: "PICK_TECH", id })) env2.sfx.play("tech");
      } });
    });
  }
  var GRADE_GLYPHS = "SABCDX#%@&";
  function drawResult3(env2, time) {
    const { ctx: ctx2, VW: VW2, TOP_SAFE: TOP_SAFE2 } = env2;
    matrixBg(env2, time);
    const won = env2.app.result.won;
    const st = env2.app.engine.state;
    const oi = env2.getOnlineInfo();
    const t = (Date.now() - env2.getScreenAt()) / 1e3;
    drawMxHeader(env2, env2.app.coop || oi ? "\u534F\u540C\u4F5C\u6218\u7ED3\u7B97 // CO-OP" : "\u6218\u6597\u7ED3\u7B97", () => env2.goto("home"));
    const lvName = env2.LEVELS.find((l) => l.id === env2.app.levelId)?.name ?? "";
    const head = won ? [[`> MISSION ${oi ? "CO-OP" : env2.app.levelId} // ${oi ? "\u53CC\u5B50\u661F\u95E8" : lvName}`, env2.C.cyan], ["> STATUS: \u9632\u7EBF\u5B88\u4F4F\u4E86 \u2713", env2.C.green]] : [[`> MISSION ${oi ? "CO-OP" : env2.app.levelId} // ${oi ? "\u53CC\u5B50\u661F\u95E8" : lvName}`, env2.C.cyan], [`> STATUS: \u9632\u7EBF\u5931\u5B88 \xB7 \u6491\u5230\u7B2C ${st.wave}/${st.totalWaves} \u6CE2`, env2.C.pink]];
    const myKills = oi ? st.killsBy?.[oi.player] ?? st.kills : st.kills;
    const stats = [
      ["\u51FB\u6740", myKills],
      ["\u6F0F\u602A", st.leaked],
      ["\u8D5A\u53D6\u91D1\u5E01", st.goldEarned],
      ["\u6218\u672F\u6A21\u5757", st.techs.length],
      ["\u79EF\u5206", env2.getLastSettlement()?.score ?? 0, env2.C.gold, true]
    ];
    if (oi) stats.splice(1, 0, [`\u961F\u53CB ${oi.peerNick || "\u2014"}`, -1, env2.C.cyan]);
    const px = 24;
    const pw = VW2 - 48;
    const py = TOP_SAFE2 + 14;
    const lineH = 26;
    const panelH = (head.length + stats.length + 1) * lineH + 22;
    neonPanel(env2, px, py, pw, panelH, 12);
    let ly = py + 24;
    head.forEach(([text, color], i) => {
      const at = t - 0.2 - i * 0.3;
      if (at <= 0) return;
      const n = Math.min(text.length, Math.floor(at * 34));
      env2.fillText(text.slice(0, n), px + 18, ly, { size: 13, color, weight: "normal" });
      ly += lineH;
    });
    ly += 4;
    stats.forEach(([label, num, color, plus], i) => {
      const at = t - 0.8 - i * 0.28;
      if (at <= 0) return;
      const shown = Math.round(num * Math.min(1, at / 0.55));
      env2.fillText(`> ${label}`, px + 18, ly, { size: 12, color: color ?? env2.C.sub, weight: "normal" });
      if (num < 0) {
        ly += lineH;
        return;
      }
      env2.fillText(`${plus ? "+" : ""}${shown}`, px + pw - 18, ly, { size: 15, align: "right", font: env2.RES_FONT(), color });
      if (at < 0.55) {
        const sx = px + pw - 60 + at * 40;
        ctx2.save();
        ctx2.fillStyle = env2.ac(0.15 * (1 - at / 0.55));
        ctx2.fillRect(sx, ly - 8, 3, 16);
        ctx2.restore();
      }
      ly += lineH;
    });
    env2.fillText(`> \u5269\u4F59\u751F\u547D ${st.lives}/${st.maxLives}`, px + 18, ly, { size: 12, color: env2.C.sub, weight: "normal" });
    const grade = !won ? "D" : st.leaked === 0 ? "S" : st.leaked <= 2 ? "A" : "B";
    const gradeColor = grade === "S" ? env2.C.gold : grade === "A" ? env2.C.green : grade === "B" ? env2.C.cyan : env2.C.pink;
    const gStart = 0.9 + stats.length * 0.28;
    const gt = t - gStart;
    if (gt > 0) {
      const settle = gt > 1.1;
      const gx = px + 52;
      const gy = py + panelH + 56;
      const ch = settle ? grade : GRADE_GLYPHS[Math.floor(env2.hash01(Math.floor(t * 18) * 7 + 3) * GRADE_GLYPHS.length)];
      const jx = settle ? 0 : (env2.hash01(Math.floor(t * 18) * 13 + 5) - 0.5) * 10;
      ctx2.save();
      if (!settle) {
        env2.fillText(ch, gx + jx - 3, gy, { size: 44, color: "rgba(255,61,129,0.6)", align: "center", font: env2.RES_FONT() });
        env2.fillText(ch, gx + jx + 3, gy, { size: 44, color: env2.ac(0.6), align: "center", font: env2.RES_FONT() });
      } else {
        ctx2.shadowColor = gradeColor;
        ctx2.shadowBlur = 16;
      }
      env2.fillText(ch, gx + jx, gy, { size: 44, color: settle ? gradeColor : env2.C.text, align: "center", font: env2.RES_FONT() });
      ctx2.restore();
      ctx2.save();
      ctx2.strokeStyle = gradeColor;
      ctx2.globalAlpha = settle ? 0.9 : 0.4;
      ctx2.lineWidth = 2.5;
      ctx2.beginPath();
      ctx2.arc(gx, gy, 34, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(["\u5B8C\u7F8E\u9632\u7EBF", "\u9632\u5B88\u597D\u624B", "\u5B88\u4F4F\u9632\u7EBF", "\u9632\u7EBF\u5931\u5B88"][["S", "A", "B", "D"].indexOf(grade)], gx + 52, gy - 8, { size: 15, color: gradeColor });
      env2.fillText(won ? oi ? "\u534F\u540C\u52A0\u6210 \xD71.2 \u5DF2\u5165\u8D26" : "\u4E0B\u4E00\u7AE0\u89E3\u9501\u5DF2\u8BB0\u5F55" : "\u518D\u6311\u6218\u4E00\u6B21\u5C31\u80FD\u901A\u8FC7", gx + 52, gy + 14, { size: 10, color: env2.C.sub, weight: "normal" });
      const rprog = env2.getRankProgress();
      env2.fillText(
        rprog.next === null ? `> RANK: ${rprog.name} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `> RANK: ${rprog.name} \xB7 \u8DDD\u300C${rprog.nextName}\u300D\u8FD8\u5DEE ${(rprog.next - rprog.points).toLocaleString("en-US")} \u5206`,
        gx + 52,
        gy + 32,
        { size: 10, color: env2.C.gold, weight: "normal" }
      );
    }
    let y = py + panelH + 108;
    const nextId = env2.app.levelId + 1;
    const hasNext = !oi && env2.LEVELS.some((l) => l.id === nextId);
    if (won) {
      env2.btn({ x: px, y, w: pw, h: 48, label: "\u25C8 \u53CC\u500D\u6218\u5229 \xB7 \u89C2\u770B\u89C6\u9891", color: env2.C.gold, cb: () => env2.showToast("\u5E7F\u544A\u6A21\u5757\u5F00\u53D1\u4E2D") });
      y += 60;
    }
    if (won && hasNext) {
      env2.btn({ x: px, y, w: pw, h: 52, label: `\u25B6 \u8FDB\u5165\u7B2C ${nextId} \u7AE0`, color: env2.C.green, primary: true, cb: () => env2.gotoBriefing(nextId) });
      y += 64;
    }
    env2.btn({
      x: px,
      y,
      w: pw,
      h: 44,
      label: "\u{1F4E3} \u70AB\u8000\u6218\u7EE9",
      color: env2.C.pink,
      cb: () => {
        env2.track("share_click", { channel: "result", result: won ? "win" : "lose", wave: st.wave });
        env2.shareAppMessage({
          title: won ? `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u5B88\u4F4F\u4E86\u7B2C ${env2.app.levelId} \u5173 \xB7 \u5168 ${st.totalWaves} \u6CE2\uFF0C\u6F0F\u602A ${st.leaked}\uFF01` : `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u7B2C ${env2.app.levelId} \u5173\u6491\u5230\u4E86\u7B2C ${st.wave} \u6CE2\uFF0C\u6C42\u652F\u63F4\uFF01`,
          imageUrl: "assets/share-cover.jpg"
        });
      }
    });
    y += 56;
    env2.btn({ x: px, y, w: (pw - 12) / 2, h: 44, label: won ? "\u518D\u6765\u4E00\u5C40" : "\u518D\u6218\u672C\u5173", color: env2.C.gold, cb: () => env2.gotoBriefing(env2.app.levelId) });
    env2.btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 44, label: "\u8FD4\u56DE\u9009\u5173", cb: () => env2.goto("home") });
    drawOverlays2(env2);
  }
  function drawSettings2(env2) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    ctx2.fillStyle = "rgba(6,3,12,0.82)";
    ctx2.fillRect(0, 0, VW2, VH2);
    env2.hitBox({ x: 0, y: 0, w: VW2, h: VH2, label: "", cb: () => {
    } });
    const pw = VW2 - 72;
    const px = 36;
    const rowH = 56;
    const rows = [
      ["\u{1F50A}", "\u97F3\u6548", "\u653B\u51FB / \u7206\u70B8 / \u91D1\u5E01\u7B49\u6218\u6597\u97F3\u6548", !env2.sfx.muted, () => env2.sfx.setMuted(!env2.sfx.muted)],
      ["\u{1F3B5}", "\u97F3\u4E50", "\u4E3B\u9875\u4E0E\u6218\u6597\u80CC\u666F\u97F3\u4E50", !env2.musicMuted(), env2.toggleMusicMuted],
      ["\u{1F399}", "\u65C1\u767D", "\u4EFB\u52A1\u7B80\u62A5\u8BED\u97F3\u89E3\u8BF4", !env2.narrationMuted(), env2.toggleNarrationMuted],
      ["\u{1F4F3}", "\u9707\u52A8", "\u5EFA\u9020 / \u6F0F\u602A / BOSS \u6218\u89E6\u611F\u53CD\u9988", !env2.vibrateMuted(), env2.toggleVibrateMuted],
      ["\u2728", "\u9AD8\u753B\u8D28", "Bloom \u8F89\u5149\u7279\u6548\uFF0C\u4F4E\u7AEF\u673A\u5EFA\u8BAE\u5173\u95ED", env2.readQualityHigh(), () => env2.setQualityHigh(!env2.readQualityHigh())]
    ];
    const skinH = 74;
    const ph = 72 + rows.length * rowH + skinH + 68;
    const py = VH2 / 2 - ph / 2;
    neonPanel(env2, px, py, pw, ph, 16);
    env2.fillText("SETTINGS", VW2 / 2, py + 24, { size: 9, color: env2.ac(0.7), weight: "600", align: "center" });
    env2.fillText("\u8BBE\u7F6E\u4E2D\u5FC3", VW2 / 2, py + 46, { size: 17, align: "center" });
    rows.forEach(([icon, label, desc, on, cb], i) => {
      const y = py + 66 + i * rowH;
      if (i > 0) {
        ctx2.save();
        ctx2.strokeStyle = env2.ac(0.12);
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(px + 20, y + 0.5);
        ctx2.lineTo(px + pw - 20, y + 0.5);
        ctx2.stroke();
        ctx2.restore();
      }
      env2.fillText(icon, px + 34, y + rowH / 2, { size: 16, align: "center" });
      env2.fillText(label, px + 56, y + 19, { size: 14 });
      env2.fillText(desc, px + 56, y + 39, { size: 10, color: env2.C.sub, weight: "normal" });
      env2.drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
      env2.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: `set-${label}`, cb: () => {
        cb();
        env2.buzz("light");
      } });
    });
    const skY = py + 66 + rows.length * rowH;
    env2.fillText("\u{1F3A8}", px + 34, skY + 15, { size: 16, align: "center" });
    env2.fillText("\u754C\u9762\u76AE\u80A4", px + 56, skY + 10, { size: 14 });
    env2.fillText(env2.skin.ref, px + 56, skY + 30, { size: 10, color: env2.C.sub, weight: "normal" });
    const chipW = (pw - 40 - 12) / env2.SKINS.length;
    env2.SKINS.forEach((s, i) => {
      const cx0 = px + 20 + i * (chipW + 6);
      const cy0 = skY + 38;
      const on = s.id === env2.skin.id;
      ctx2.save();
      env2.rr(cx0, cy0, chipW, 30, 8);
      ctx2.fillStyle = on ? env2.ac(0.18) : "rgba(110,92,142,0.12)";
      ctx2.fill();
      ctx2.strokeStyle = on ? s.accent : "rgba(110,92,142,0.4)";
      ctx2.lineWidth = on ? 1.6 : 1;
      if (on) {
        ctx2.shadowColor = s.accent;
        ctx2.shadowBlur = 6;
      }
      ctx2.stroke();
      ctx2.fillStyle = s.accent;
      ctx2.beginPath();
      ctx2.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
      env2.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env2.C.text : env2.C.sub });
      env2.hitBox({
        x: cx0,
        y: cy0,
        w: chipW,
        h: 30,
        label: `skin-${s.id}`,
        cb: () => {
          env2.applySkin(s.id);
          env2.buzz("light");
          env2.showToast(`\u5DF2\u5207\u6362\u300C${s.name}\u300D`);
        }
      });
    });
    env2.btn({ x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => env2.setShowSettings(false) });
  }
  function drawProfile2(env2) {
    const { ctx: ctx2, VW: VW2, VH: VH2 } = env2;
    ctx2.fillStyle = "rgba(6,3,12,0.82)";
    ctx2.fillRect(0, 0, VW2, VH2);
    const pw = VW2 - 72;
    const ph = 456;
    const px = 36;
    const py = VH2 / 2 - ph / 2;
    neonPanel(env2, px, py, pw, ph, 16);
    ctx2.save();
    hexPath2(env2, VW2 / 2, py + 60, 44);
    ctx2.strokeStyle = env2.ac(0.5);
    ctx2.lineWidth = 1.4;
    ctx2.stroke();
    ctx2.restore();
    env2.drawAvatar(VW2 / 2, py + 60, 34);
    env2.fillText(env2.displayNick(), VW2 / 2, py + 116, { size: 18, align: "center" });
    env2.fillText(env2.commanderRank(), VW2 / 2, py + 140, { size: 11, color: env2.C.gold, align: "center", weight: "normal" });
    const cleared = env2.loadProgress().cleared.length;
    const bw = pw - 64;
    const bx = px + 32;
    const by = py + 162;
    env2.fillText(`\u6218\u5F79\u8FDB\u5EA6 ${cleared} / ${env2.LEVELS.length}`, VW2 / 2, by - 8, { size: 11, color: env2.C.sub, align: "center", weight: "normal" });
    ctx2.save();
    env2.rr(bx, by + 6, bw, 10, 5);
    ctx2.fillStyle = env2.ac(0.12);
    ctx2.fill();
    if (cleared > 0) {
      env2.rr(bx, by + 6, Math.max(10, bw * (cleared / env2.LEVELS.length)), 10, 5);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.C.cyan);
      g.addColorStop(1, env2.C.pink);
      ctx2.fillStyle = g;
      ctx2.fill();
    }
    ctx2.restore();
    const rp = env2.getRankProgress();
    const ry = by + 42;
    env2.fillText(
      rp.next === null ? `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} / ${rp.next.toLocaleString("en-US")} \xB7 \u8DDD\u300C${rp.nextName}\u300D\u8FD8\u5DEE ${(rp.next - rp.points).toLocaleString("en-US")} \u5206`,
      VW2 / 2,
      ry - 8,
      { size: 11, color: env2.C.sub, align: "center", weight: "normal" }
    );
    ctx2.save();
    env2.rr(bx, ry + 6, bw, 10, 5);
    ctx2.fillStyle = env2.ac(0.12);
    ctx2.fill();
    const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
    if (frac > 0) {
      const fw2 = Math.max(10, bw * frac);
      env2.rr(bx, ry + 6, fw2, 10, 5);
      const g = ctx2.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, env2.C.gold);
      g.addColorStop(1, env2.C.pink);
      ctx2.fillStyle = g;
      ctx2.shadowColor = env2.C.pink;
      ctx2.shadowBlur = 8;
      ctx2.fill();
    }
    ctx2.restore();
    const openid = env2.getProfile().openid;
    if (openid) {
      env2.fillText(`> LINKED: ${openid.slice(0, 12)}\u2026`, VW2 / 2, ry + 34, { size: 10, color: env2.C.green, align: "center", weight: "normal" });
    }
    env2.btn({ x: px + 24, y: py + 268, w: pw - 48, h: 40, label: "\u{1F4AC} \u610F\u89C1\u53CD\u9988", color: env2.C.gold, cb: () => env2.openFeedback() });
    let y = py + 320;
    if (!env2.getProfile().real) {
      env2.btn({ x: px + 24, y, w: pw - 48, h: 44, label: "\u540C\u6B65\u5FAE\u4FE1\u5934\u50CF\u6635\u79F0", color: env2.C.green, primary: true, cb: () => env2.authUser() });
      y += 56;
    }
    env2.btn({ x: px + 24, y, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => env2.setShowProfile(false) });
  }
  function drawCodex3(env2, time) {
    const { ctx: ctx2, VW: VW2, VH: VH2, MARGIN: MARGIN2, TOP_SAFE: TOP_SAFE2 } = env2;
    matrixBg(env2, time);
    drawMxHeader(env2, "\u6307\u6325\u5B98\u56FE\u9274", () => env2.goto("home"));
    const segY = TOP_SAFE2 + 6;
    const segW = (VW2 - MARGIN2 * 2 - 16) / 3;
    env2.CODEX_TABS.forEach(([tab, label], i) => {
      const x = MARGIN2 + i * (segW + 8);
      const on = env2.codex.tab === tab;
      ctx2.save();
      env2.rr(x, segY, segW, 34, 10);
      ctx2.fillStyle = on ? env2.ac(0.16) : "rgba(20,12,36,0.85)";
      ctx2.fill();
      ctx2.strokeStyle = on ? env2.ac(0.8) : "rgba(110,92,142,0.4)";
      ctx2.lineWidth = on ? 1.5 : 1;
      ctx2.stroke();
      ctx2.restore();
      env2.fillText(label, x + segW / 2, segY + 17, { size: 13, color: on ? env2.C.text : env2.C.dim, align: "center" });
      env2.hitBox({
        x,
        y: segY,
        w: segW,
        h: 34,
        label: `codex-${tab}`,
        cb: () => {
          if (env2.codex.tab !== tab) {
            env2.codex.tab = tab;
            env2.codex.scroll = 0;
            env2.buzz("light");
          }
        }
      });
    });
    const top = segY + 46;
    const bottom = VH2 - 22;
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, top, VW2, bottom - top);
    ctx2.clip();
    const y0 = top + 8 - env2.codex.scroll;
    let endY;
    if (env2.codex.tab === "story") endY = codexStory3(env2, time, y0, top, bottom);
    else if (env2.codex.tab === "towers") endY = codexTowers3(env2, time, y0, top, bottom);
    else endY = codexEnemies3(env2, time, y0, top, bottom);
    ctx2.restore();
    codexMax2 = Math.max(0, endY - (top + 8) - (bottom - top) + 20);
    env2.codex.scroll = Math.max(0, Math.min(codexMax2, env2.codex.scroll));
    const fadeH = 16;
    const gf = ctx2.createLinearGradient(0, top, 0, top + fadeH);
    gf.addColorStop(0, "rgba(10,5,22,0.9)");
    gf.addColorStop(1, "rgba(10,5,22,0)");
    ctx2.fillStyle = gf;
    ctx2.fillRect(0, top, VW2, fadeH);
    const gb = ctx2.createLinearGradient(0, bottom - fadeH, 0, bottom);
    gb.addColorStop(0, "rgba(13,7,25,0)");
    gb.addColorStop(1, "rgba(13,7,25,0.9)");
    ctx2.fillStyle = gb;
    ctx2.fillRect(0, bottom - fadeH, VW2, fadeH);
    if (codexMax2 > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMax2)));
      const ty = top + (viewH - thumbH) * (env2.codex.scroll / codexMax2);
      ctx2.save();
      ctx2.fillStyle = env2.ac(0.3);
      env2.rr(VW2 - 4, ty, 3, thumbH, 1.5);
      ctx2.fill();
      ctx2.restore();
    }
    drawOverlays2(env2);
  }
  function codexStory3(env2, time, y0, top, bottom) {
    const x = env2.MARGIN;
    const w = env2.VW - env2.MARGIN * 2;
    const textSize = 12;
    const textW = w - 32;
    let totalLines = 0;
    for (const p of env2.STORY_PARAS) totalLines += env2.wrapCount(p, textW, textSize) + 0.6;
    const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
    neonPanel(env2, x, y0, w, boxH, 12);
    env2.fillText("\u4E16\u754C\u89C2\u6863\u6848", x + 16, y0 + 20, { size: 13, color: env2.C.cyan });
    let ty = y0 + 44;
    for (const p of env2.STORY_PARAS) ty = env2.wrapBlock(p, x + 16, ty, textW, { size: textSize }) + textSize * 1.65 * 0.6;
    let y = y0 + boxH + 20;
    env2.fillText("\u6218\u5F79\u7F16\u5E74\u53F2", x + 4, y + 8, { size: 14 });
    env2.fillText("\u70B9\u51FB\u5DF2\u89E3\u9501\u7AE0\u8282\u76F4\u63A5\u51FA\u51FB", x + w - 4, y + 9, { size: 10, color: env2.C.dim, align: "right", weight: "normal" });
    y += 28;
    const cleared = env2.loadProgress().cleared;
    env2.LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(env2.LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const rowH = 60;
      if (y + rowH > top && y < bottom) {
        env2.panel(x, y, w, rowH, unlock ? env2.ac(0.3) : "rgba(110,92,142,0.2)", 12);
        env2.drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
        const tx = x + 94;
        env2.ctx.save();
        if (!unlock) env2.ctx.globalAlpha = 0.45;
        env2.fillText(`CH-${String(lv.id).padStart(2, "0")}`, tx, y + 18, { size: 9, color: env2.C.cyan, weight: "600" });
        env2.fillText(lv.name, tx, y + 36, { size: 14 });
        env2.fillText(lv.sub, tx, y + 52, { size: 10, color: env2.C.sub, weight: "normal" });
        env2.ctx.restore();
        if (done) env2.chip(x + w - 12, y + 16, "\u5DF2\u901A\u5173", env2.C.green);
        else if (!unlock) env2.chip(x + w - 12, y + 16, "\u672A\u89E3\u9501", env2.C.dim);
        if (unlock) env2.hitBox({ x, y, w, h: rowH, label: `cx-${lv.id}`, cb: () => env2.gotoBriefing(lv.id) });
        else env2.hitBox({ x, y, w, h: rowH, label: `cx-lock-${lv.id}`, cb: () => {
          env2.showToast(`\u901A\u5173\u300C${env2.LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
          env2.buzz("light");
        } });
      }
      y += rowH + 10;
    });
    return y;
  }
  function codexTowers3(env2, time, y0, top, bottom) {
    const x = env2.MARGIN;
    const w = env2.VW - env2.MARGIN * 2;
    let y = y0;
    for (const def of env2.TOWER_LIST) {
      const cardH = 134;
      const unlocked = env2.towerUnlocked(def.type);
      if (y + cardH > top && y < bottom) {
        env2.panel(x, y, w, cardH, unlocked ? `${def.color}55` : "rgba(110,92,142,0.2)", 12);
        if (unlocked) neonStroke(env2, x, y, w, cardH, 12, 0.35);
        const igx = x + 14 + 32;
        const igy = y + cardH / 2;
        env2.ctx.save();
        hexPath2(env2, igx, igy, 34);
        env2.ctx.fillStyle = `${def.color}14`;
        env2.ctx.fill();
        env2.ctx.strokeStyle = `${def.color}55`;
        env2.ctx.lineWidth = 1.2;
        env2.ctx.stroke();
        hexPath2(env2, igx, igy, 33);
        env2.ctx.clip();
        env2.ctx.translate(igx, igy);
        env2.ctx.globalAlpha = unlocked ? 1 : 0.35;
        const chargeV = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
        env2.drawTower(env2.ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, chargeV, time, { ticks: false });
        env2.ctx.restore();
        const tx = x + 14 + 64 + 14;
        env2.ctx.save();
        if (!unlocked) env2.ctx.globalAlpha = 0.55;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600" });
        env2.fillText(def.role, tx, y + 53, { size: 11, color: env2.C.sub, weight: "normal" });
        env2.fillText(`\u4F24\u5BB3 ${def.levels.map((l) => l.damage).join(" \u2192 ")} \xB7 \u5C04\u7A0B ${def.levels.map((l) => l.range).join(" \u2192 ")}`, tx, y + 71, { size: 10, weight: "normal" });
        env2.fillText(`\u5C04\u901F ${def.levels.map((l) => l.rate).join(" \u2192 ")}/s \xB7 \u9020\u4EF7 \u25C8${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: "normal" });
        env2.fillText(`\u514B\u5236 ${def.strong}`, tx, y + 105, { size: 10, color: env2.C.green, weight: "normal" });
        env2.fillText(`\u77ED\u677F ${def.weak}`, tx, y + 121, { size: 10, color: env2.C.sub, weight: "normal" });
        env2.ctx.restore();
        env2.chip(x + w - 12, y + 17, def.tag, def.color);
        if (!unlocked) {
          env2.fillText(`\u901A\u5173\u7B2C ${env2.TOWER_UNLOCK[def.type]} \u7AE0\u89E3\u9501`, x + w - 12, y + cardH - 12, { size: 10, color: env2.C.gold, align: "right" });
        }
      }
      y += cardH + 12;
    }
    return y;
  }
  function codexEnemies3(env2, time, y0, top, bottom) {
    const x = env2.MARGIN;
    const w = env2.VW - env2.MARGIN * 2;
    let y = y0;
    for (const def of env2.ENEMY_LIST) {
      const textW = w - 92 - 14;
      const descLines = env2.wrapCount(def.desc, textW, 10);
      const cardH = Math.ceil(92 + descLines * 13.2 + 22);
      if (y + cardH > top && y < bottom) {
        env2.panel(x, y, w, cardH, `${def.color}44`, 12);
        neonStroke(env2, x, y, w, cardH, 12, 0.25);
        const igx = x + 14 + 32;
        const igy = y + (cardH - 64) / 2 + 32;
        env2.ctx.save();
        hexPath2(env2, igx, igy, 34);
        env2.ctx.fillStyle = `${def.color}12`;
        env2.ctx.fill();
        env2.ctx.strokeStyle = `${def.color}44`;
        env2.ctx.lineWidth = 1.2;
        env2.ctx.stroke();
        hexPath2(env2, igx, igy, 33);
        env2.ctx.clip();
        env2.ctx.translate(igx, igy + Math.sin(time * 2.2) * 2);
        env2.drawEnemy(env2.ctx, def.type, Math.min(21, def.size), time, {});
        env2.ctx.restore();
        const tx = x + 14 + 64 + 14;
        env2.fillText(def.name, tx, y + 20, { size: 15 });
        env2.fillText(def.nameEn, tx, y + 37, { size: 9, color: env2.C.dim, weight: "600" });
        env2.chip(x + w - 12, y + 17, env2.ENEMY_CATEGORY[def.category] ?? def.category, def.color);
        env2.fillText(`\u5A01\u80C1 ${"\u2605".repeat(def.threat)}`, tx, y + 54, { size: 10, color: env2.C.gold });
        env2.fillText(`\u751F\u547D ${def.hp} \xB7 \u901F\u5EA6 ${def.speed} \xB7 \u51FB\u6740 \u25C8${def.reward} \xB7 \u6F0F\u602A -${def.leak}`, tx, y + 70, { size: 10, color: env2.C.sub, weight: "normal" });
        const dy = env2.wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: "rgba(232,241,255,0.75)" });
        env2.fillText(`\u5F31\u70B9\uFF1A${def.weakness}`, tx, dy + 2, { size: 10, color: env2.C.cyan, weight: "normal" });
      }
      y += cardH + 12;
    }
    return y;
  }
  function handleTouch3(env2, phase, p) {
    const screen = env2.app.screen;
    if (screen !== "home") homeDrag = null;
    if (screen !== "codex") codexDrag3 = null;
    if (env2.showSettings() || env2.showProfile()) return false;
    if (screen === "home") {
      if (phase === "start") {
        homeDrag = { startX: p.x, startY: p.y, startPos: carPos, lastX: p.x, lastT: Date.now(), vx: 0, moved: false };
        return false;
      }
      if (!homeDrag) return false;
      if (phase === "move") {
        const now = Date.now();
        const dx = p.x - homeDrag.startX;
        const dy = p.y - homeDrag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 10) homeDrag.moved = true;
        const dt = Math.max(1, now - homeDrag.lastT);
        homeDrag.vx = homeDrag.vx * 0.7 + (p.x - homeDrag.lastX) / dt * 1e3 * 0.3;
        homeDrag.lastX = p.x;
        homeDrag.lastT = now;
        const N = env2.LEVELS.length;
        carPos = Math.max(-0.35, Math.min(N - 1 + 0.35, homeDrag.startPos - dx / carStep(env2)));
        carTarget = carPos;
        return true;
      }
      const d = homeDrag;
      homeDrag = null;
      if (d.moved) {
        const N = env2.LEVELS.length;
        const fling = -d.vx / carStep(env2) * 0.22;
        carTarget = Math.max(0, Math.min(N - 1, Math.round(carPos + fling)));
        return true;
      }
      return false;
    }
    if (screen === "codex") {
      if (phase === "start") {
        codexDrag3 = { startY: p.y, scroll0: env2.codex.scroll, moved: false };
        return false;
      }
      if (!codexDrag3) return false;
      if (phase === "move") {
        if (Math.abs(p.y - codexDrag3.startY) > 8) codexDrag3.moved = true;
        env2.codex.scroll = Math.max(0, Math.min(codexMax2, codexDrag3.scroll0 + (codexDrag3.startY - p.y)));
        return true;
      }
      const moved = codexDrag3.moved;
      codexDrag3 = null;
      return moved;
    }
    return false;
  }
  var matrixSkin = {
    id: "matrix",
    drawSplashMenu: drawSplashMenu3,
    drawHome: drawHome3,
    drawBriefing: drawBriefing3,
    drawBattleHUD: drawBattleHUD3,
    drawBottomBar: drawBottomBar3,
    drawTechOverlay: drawTechOverlay3,
    drawResult: drawResult3,
    drawSettings: drawSettings2,
    drawCodex: drawCodex3,
    drawProfile: drawProfile2,
    handleTouch: handleTouch3
  };

  // src/skins/index.ts
  var SKIN_MODULES = {
    abyss: abyssSkin,
    ember: emberSkin,
    matrix: matrixSkin
  };

  // src/main.ts
  var touchId = (t) => t.identifier ?? 0;
  var canvas = wx.createCanvas();
  var info = wx.getSystemInfoSync();
  var VW = info.windowWidth;
  var VH = info.windowHeight;
  var DPR = Math.min(info.pixelRatio ?? 2, 2);
  canvas.width = VW * DPR;
  canvas.height = VH * DPR;
  var ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  try {
    const um = wx.getUpdateManager?.();
    if (um) {
      um.onCheckForUpdate((r) => {
        if (r.hasUpdate) console.log("[SRD] \u53D1\u73B0\u65B0\u7248\u672C\uFF0C\u4E0B\u8F7D\u4E2D\u2026");
      });
      um.onUpdateReady(() => {
        wx.showModal?.({
          title: "\u66F4\u65B0\u63D0\u793A",
          content: "\u65B0\u7248\u672C\u5DF2\u5C31\u7EEA\uFF0C\u91CD\u542F\u540E\u7ACB\u5373\u751F\u6548\uFF1F",
          success: (r) => {
            if (r.confirm) um.applyUpdate();
          }
        });
      });
      um.onUpdateFailed(() => {
      });
    }
  } catch {
  }
  try {
    wx.showShareMenu?.({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  } catch {
  }
  function shareTitle() {
    const n = Math.max(0, ...loadProgress().cleared);
    return n > 0 ? `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u5B88\u5230\u4E86\u7B2C ${n} \u5173\uFF0C\u4F60\u80FD\u6491\u5230\u7B2C\u51E0\u6CE2\uFF1F` : "\u866B\u7FA4\u538B\u5883\uFF0C\u661F\u73AF\u544A\u6025\uFF01\u6765\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u6307\u6325\u4F60\u7684\u7B2C\u4E00\u5EA7\u70AE\u5854";
  }
  try {
    wx.onShareAppMessage?.(() => {
      track("share_click", { channel: "menu" });
      return { title: shareTitle(), imageUrl: "assets/share-cover.jpg" };
    });
    wx.onShareTimeline?.(() => ({
      title: `\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u2014\u2014 \u5341\u4E09\u7AE0\u661F\u73AF\u6218\u5F79\u5854\u9632\uFF1A${shareTitle()}`,
      imageUrl: "assets/share-cover.jpg"
    }));
  } catch {
  }
  var fontLoaded = false;
  try {
    wx.loadFontFace({
      familyName: "Orbitron",
      source: "assets/orbitron-700.woff2",
      global: true,
      success: () => {
        fontLoaded = true;
      },
      fail: () => {
        fontLoaded = false;
      }
    });
  } catch {
  }
  var RES_FONT = () => fontLoaded ? "Orbitron, sans-serif" : "sans-serif";
  var store = {
    get(key) {
      try {
        return wx.getStorageSync(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        wx.setStorageSync(key, value);
      } catch {
      }
    }
  };
  function loadProgress() {
    const raw = store.get("srd.progress");
    return { cleared: Array.isArray(raw?.cleared) ? raw.cleared : [] };
  }
  function recordLevelClear(levelId) {
    const p = loadProgress();
    if (p.cleared.includes(levelId)) return;
    p.cleared.push(levelId);
    store.set("srd.progress", p);
  }
  function readWxQualityHigh() {
    const s = store.get("srd.settings");
    return s?.quality === "high";
  }
  function setWxQualityHigh(high) {
    store.set("srd.settings", { quality: high ? "high" : "low" });
  }
  setFxPlatform({
    createCanvas: () => wx.createCanvas(),
    createImage: () => wx.createImage(),
    readQualityHigh: readWxQualityHigh,
    hardwareConcurrency: () => null,
    // 微信无核数 API：不硬关 Bloom，交由画质开关控制（默认低画质=关）
    nebulaUrl: () => "assets/nebula-texture.jpg"
  });
  var API_BASE = (() => {
    try {
      const saved = store.get("srd.apiBase");
      if (typeof saved === "string" && saved.trim()) return saved.trim();
    } catch {
    }
    return "https://game.chujian.site";
  })();
  var session = (() => {
    try {
      const raw = store.get("srd.user");
      if (raw && typeof raw.openid === "string" && raw.openid) {
        return { openid: raw.openid, token: String(raw.token ?? ""), loginAt: Number(raw.loginAt ?? 0) || 0 };
      }
    } catch {
    }
    return null;
  })();
  var numOr = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
  function loadScore() {
    const raw = store.get("srd.score");
    const per = {};
    if (raw?.perLevelBest && typeof raw.perLevelBest === "object") {
      for (const [k, v] of Object.entries(raw.perLevelBest)) {
        const key = Number(k);
        if (Number.isFinite(key) && typeof v === "number" && Number.isFinite(v)) per[key] = v;
      }
    }
    return {
      points: numOr(raw?.points),
      spendable: numOr(raw?.spendable),
      bestSingle: numOr(raw?.bestSingle),
      perLevelBest: per,
      season: numOr(raw?.season) || 1,
      updatedAt: numOr(raw?.updatedAt)
    };
  }
  var scoreProfile = loadScore();
  function saveScore() {
    store.set("srd.score", scoreProfile);
  }
  if (!store.get("srd.score")) {
    const n = loadProgress().cleared.length;
    if (n > 0) {
      scoreProfile.points = scoreProfile.spendable = n >= 13 ? 15e3 : n >= 8 ? 6e3 : n >= 4 ? 2e3 : 500;
      scoreProfile.updatedAt = Date.now();
      saveScore();
    }
  }
  var RANKS = [
    [0, "\u65B0\u664B\u5B66\u5458"],
    [500, "\u89C1\u4E60\u6307\u6325\u5B98"],
    [2e3, "\u6218\u5730\u6307\u6325\u5B98"],
    [6e3, "\u661F\u73AF\u5C06\u661F"],
    [15e3, "\u4F20\u5947\u7EDF\u5E05"],
    [4e4, "\u661F\u6D77\u5143\u5E05"]
  ];
  function rankProgress() {
    let i = 0;
    for (let k = 0; k < RANKS.length; k++) if (scoreProfile.points >= RANKS[k][0]) i = k;
    const nxt = i + 1 < RANKS.length ? RANKS[i + 1] : null;
    return {
      name: RANKS[i][1],
      points: scoreProfile.points,
      base: RANKS[i][0],
      next: nxt ? nxt[0] : null,
      nextName: nxt ? nxt[1] : null
    };
  }
  function battleGrade(st, won) {
    return !won ? "D" : st.leaked === 0 ? "S" : st.leaked <= 2 ? "A" : "B";
  }
  var DIFF_MUL = { easy: 0.8, normal: 1, hard: 1.4 };
  var GRADE_BONUS = { S: 1.25, A: 1.1, B: 1, D: 0.4 };
  function calcScore(st, difficulty, levelId, won) {
    const base = st.kills * 10 + st.wave * 60 + st.techs.length * 40 + st.lives * 15 + levelId * 50 - st.leaked * 30;
    return Math.max(0, Math.round(base * DIFF_MUL[difficulty] * GRADE_BONUS[battleGrade(st, won)]));
  }
  function applyCloudScore(cp) {
    let localBigger = false;
    const cPoints = numOr(cp.points);
    const cBest = numOr(cp.bestSingle);
    if (scoreProfile.points > cPoints || scoreProfile.bestSingle > cBest) localBigger = true;
    scoreProfile.spendable += Math.max(0, cPoints - scoreProfile.points);
    scoreProfile.points = Math.max(scoreProfile.points, cPoints);
    scoreProfile.bestSingle = Math.max(scoreProfile.bestSingle, cBest);
    if (cp.perLevelBest && typeof cp.perLevelBest === "object") {
      for (const [k, v] of Object.entries(cp.perLevelBest)) {
        const key = Number(k);
        const nv = numOr(v);
        if (!Number.isFinite(key)) continue;
        if (nv > (scoreProfile.perLevelBest[key] ?? 0)) scoreProfile.perLevelBest[key] = nv;
        else if ((scoreProfile.perLevelBest[key] ?? 0) > nv) localBigger = true;
      }
    }
    scoreProfile.updatedAt = Date.now();
    saveScore();
    return localBigger;
  }
  function syncScoreToCloud() {
    try {
      if (!API_BASE || !session || typeof wx.request !== "function") return;
      wx.request({
        url: `${API_BASE}/api/user/score`,
        method: "POST",
        header: { Authorization: `Bearer ${session.token}` },
        data: {
          points: scoreProfile.points,
          bestSingle: scoreProfile.bestSingle,
          perLevelBest: scoreProfile.perLevelBest
        },
        success: (r) => {
          try {
            const d = r.data;
            if (r.statusCode === 200 && d?.ok && d.profile) applyCloudScore(d.profile);
          } catch {
          }
        },
        fail: () => {
        }
      });
    } catch {
    }
  }
  function mergeScoreWithCloud() {
    try {
      if (!API_BASE || !session || typeof wx.request !== "function") return;
      wx.request({
        url: `${API_BASE}/api/user/score`,
        method: "GET",
        header: { Authorization: `Bearer ${session.token}` },
        success: (r) => {
          try {
            const d = r.data;
            if (r.statusCode === 200 && d?.ok && d.profile) {
              if (applyCloudScore(d.profile)) syncScoreToCloud();
            } else if (r.statusCode === 401) {
              session = null;
              store.set("srd.user", "");
            }
          } catch {
          }
        },
        fail: () => {
        }
      });
    } catch {
    }
  }
  function silentLogin() {
    try {
      if (!API_BASE || typeof wx.login !== "function" || typeof wx.request !== "function") return;
      wx.login({
        success: (r) => {
          try {
            if (!r?.code || typeof wx.request !== "function") return;
            wx.request({
              url: `${API_BASE}/api/login`,
              method: "POST",
              data: { code: r.code },
              success: (res) => {
                try {
                  const d = res.data;
                  if (res.statusCode !== 200 || !d?.ok || !d.openid || !d.token) return;
                  session = { openid: d.openid, token: d.token, loginAt: Date.now() };
                  store.set("srd.user", session);
                  profile.openid = d.openid;
                  store.set("srd.profile", profile);
                  configureAnalytics({
                    endpoint: API_BASE,
                    getOpenid: () => session?.openid ?? "",
                    getBuildId: () => true ? "b1005-0008" : "dev"
                  });
                  track("login_ok", { level: 1 });
                  mergeScoreWithCloud();
                } catch {
                }
              },
              fail: () => {
              }
            });
          } catch {
          }
        },
        fail: () => {
        }
      });
    } catch {
    }
  }
  var profile = (() => {
    const raw = store.get("srd.profile");
    return {
      nick: raw?.nick ?? "",
      avatarUrl: raw?.avatarUrl ?? "",
      real: raw?.real === true,
      openid: typeof raw?.openid === "string" ? raw.openid : ""
    };
  })();
  function commanderRank() {
    return rankProgress().name;
  }
  var displayNick = () => profile.real && profile.nick ? profile.nick : commanderRank();
  var avatarImg = null;
  function loadAvatar() {
    if (avatarImg || !profile.avatarUrl) return;
    const img = wx.createImage();
    const a = { img, ok: false };
    img.onload = () => {
      a.ok = true;
    };
    img.onerror = () => {
      a.ok = false;
    };
    img.src = profile.avatarUrl;
    avatarImg = a;
  }
  loadAvatar();
  silentLogin();
  function authUser() {
    try {
      wx.getUserInfo?.({
        success: (r) => {
          profile = { nick: r.userInfo.nickName, avatarUrl: r.userInfo.avatarUrl, real: true, openid: profile.openid };
          store.set("srd.profile", profile);
          avatarImg = null;
          loadAvatar();
        },
        fail: () => {
        }
      });
    } catch {
    }
  }
  function drawAvatar(cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (avatarImg?.ok) {
      ctx.drawImage(avatarImg.img, cx - r, cy - r, r * 2, r * 2);
    } else {
      const g = ctx.createRadialGradient(cx, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, "#1C3D66");
      g.addColorStop(1, "#0A0F20");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.34, cy);
      ctx.lineTo(cx, cy + r * 0.52);
      ctx.lineTo(cx - r * 0.34, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#081226";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  var BAR_H = 92;
  var capsule = wx.getMenuButtonBoundingClientRect?.();
  var TOP_SAFE = capsule ? Math.ceil(capsule.bottom) + 8 : 96;
  var CAP_MID = capsule ? (capsule.top + capsule.bottom) / 2 : 48;
  var CAP_LEFT = capsule ? capsule.left : VW - 94;
  var envVersion = (() => {
    try {
      return wx.getAccountInfoSync?.().miniProgram?.envVersion;
    } catch {
      return void 0;
    }
  })();
  var GAME_CENTER_PAD = envVersion === "develop" || envVersion === "trial" ? 46 : 0;
  var mapScale = VW / W;
  var mapViewH = VH - BAR_H - TOP_SAFE;
  var mapH = H * mapScale;
  var mapOX = 0;
  var mapOY = TOP_SAFE;
  var mapPanMin = Math.min(0, mapViewH - mapH);
  var mapPan = mapPanMin === 0 ? (mapViewH - mapH) / 2 : mapPanMin;
  var toMapX = (vx) => (vx - mapOX) / mapScale;
  var toMapY = (vy) => (vy - mapOY - mapPan) / mapScale;
  var C = {
    cyan: "#22E0FF",
    gold: "#FFC94D",
    green: "#3DF08C",
    red: "#FF5A5A",
    pink: "#FF3D81",
    text: "#E8F1FF",
    sub: "#8DA0C6",
    dim: "#5A6B8C",
    panelLine: "rgba(34,224,255,0.25)"
  };
  var MARGIN = 16;
  var RADIUS = 14;
  var SKINS = [
    {
      id: "abyss",
      name: "\u6DF1\u7A7A\u5168\u606F",
      ref: "\u539F\u4F5C \xB7 \u5168\u606F\u79D1\u5E7B",
      accent: "#22E0FF",
      rgb: [34, 224, 255],
      danger: "#FF3D81",
      gold: "#FFC94D",
      green: "#3DF08C",
      red: "#FF5A5A",
      text: "#E8F1FF",
      sub: "#8DA0C6",
      dim: "#5A6B8C",
      panelTop: "rgba(20,30,58,0.94)",
      panelBottom: "rgba(11,17,36,0.94)",
      panelSolid: "rgba(15,23,46,0.94)",
      chrome: "round",
      pressFx: "scale",
      transition: "fade"
    },
    {
      id: "ember",
      name: "\u7425\u73C0\u5DE5\u4E1A",
      ref: "\u53C2\u8003\u300A\u660E\u65E5\u65B9\u821F\u300B\u5DE5\u4E1A\u6307\u6325\u98CE",
      accent: "#FFB020",
      rgb: [255, 176, 32],
      danger: "#FF5A3D",
      gold: "#FFC94D",
      green: "#7ED957",
      red: "#FF5A5A",
      text: "#FFF3E2",
      sub: "#C0A98A",
      dim: "#8A765C",
      panelTop: "rgba(40,30,18,0.94)",
      panelBottom: "rgba(22,16,10,0.94)",
      panelSolid: "rgba(26,19,10,0.94)",
      chrome: "chamfer",
      pressFx: "stamp",
      transition: "wipe"
    },
    {
      id: "matrix",
      name: "\u7D2B\u6676\u77E9\u9635",
      ref: "\u53C2\u8003\u300A\u8D5B\u535A\u670B\u514B2077\u300B\u9713\u8679\u98CE",
      accent: "#B16CFF",
      rgb: [177, 108, 255],
      danger: "#FF3D81",
      gold: "#FFD75E",
      green: "#3DF08C",
      red: "#FF5A5A",
      text: "#F1E9FF",
      sub: "#A48FC8",
      dim: "#6E5C8E",
      panelTop: "rgba(34,20,54,0.94)",
      panelBottom: "rgba(16,9,30,0.94)",
      panelSolid: "rgba(20,12,36,0.94)",
      chrome: "round",
      pressFx: "glitch",
      transition: "glitch"
    }
  ];
  var skin = SKINS[0];
  var ac = (a) => `rgba(${skin.rgb[0]},${skin.rgb[1]},${skin.rgb[2]},${a})`;
  function applySkin(id) {
    skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
    C.cyan = skin.accent;
    C.pink = skin.danger;
    C.gold = skin.gold;
    C.green = skin.green;
    C.red = skin.red;
    C.text = skin.text;
    C.sub = skin.sub;
    C.dim = skin.dim;
    C.panelLine = ac(0.25);
    store.set("srd.skin", skin.id);
  }
  applySkin(String(store.get("srd.skin") || "abyss"));
  var hooks = [];
  var btn = (b) => {
    drawButton(b);
    hooks.push(b);
  };
  var hitBox = (b) => {
    hooks.push(b);
  };
  var pressedBtn = null;
  var toast = null;
  function showToast(text) {
    toast = { text, at: Date.now() };
  }
  function drawToast2() {
    const m = SKIN_MODULES[skin.id];
    if (m?.drawToast) {
      m.drawToast(env);
      return;
    }
    if (!toast) return;
    const t = (Date.now() - toast.at) / 1e3;
    if (t > 1.6) {
      toast = null;
      return;
    }
    const a = t < 0.15 ? t / 0.15 : t > 1.25 ? (1.6 - t) / 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = "bold 12px sans-serif";
    const w = ctx.measureText(toast.text).width + 34;
    rr(VW / 2 - w / 2, VH * 0.4, w, 34, 17);
    ctx.fillStyle = skin.panelSolid;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,201,77,0.5)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    fillText(toast.text, VW / 2, VH * 0.4 + 17, { size: 12, color: C.gold, align: "center" });
    ctx.restore();
  }
  var touchPoint = (t) => ({ x: t.clientX, y: t.clientY });
  var hit = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function fillText(str, x, y, o = {}) {
    ctx.save();
    ctx.fillStyle = o.color ?? C.text;
    ctx.textAlign = o.align ?? "left";
    ctx.textBaseline = o.baseline ?? "middle";
    ctx.font = `${o.weight ?? "bold"} ${o.size ?? 14}px ${o.font ?? "sans-serif"}`;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function rr(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (skin.chrome === "chamfer") {
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.lineTo(x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.lineTo(x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.lineTo(x, y + h - rad);
      ctx.lineTo(x, y + rad);
      ctx.closePath();
      return;
    }
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function wrapCount(str, w, size) {
    return Math.ceil(str.length / Math.max(6, Math.floor(w / size)));
  }
  function wrapBlock(str, x, y, w, o) {
    const size = o?.size ?? 13;
    const charsPerLine = Math.max(6, Math.floor(w / size));
    for (let i = 0; i < str.length; i += charsPerLine) {
      fillText(str.slice(i, i + charsPerLine), x, y, { size, color: o?.color ?? "rgba(232,241,255,0.85)", weight: "normal" });
      y += size * 1.65;
    }
    return y;
  }
  function panel(x, y, w, h, stroke = C.panelLine, r = RADIUS) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, skin.panelTop);
    g.addColorStop(1, skin.panelBottom);
    rr(x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  function drawButton(b) {
    const c = b.color ?? C.cyan;
    const r = Math.min(10, b.h / 2);
    const pressed = pressedBtn !== null && pressedBtn.x === b.x && pressedBtn.y === b.y && pressedBtn.w === b.w && pressedBtn.label === b.label;
    if (pressed) {
      ctx.save();
      if (skin.pressFx === "stamp") {
        ctx.translate(0, 2);
        ctx.globalAlpha = 0.72;
      } else if (skin.pressFx === "glitch") {
        ctx.translate((hash01(Math.floor(Date.now() / 60)) - 0.5) * 4, 0);
        ctx.globalAlpha = 0.9;
      } else {
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(0.93, 0.93);
        ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
        ctx.globalAlpha = 0.82;
      }
    }
    ctx.save();
    ctx.globalAlpha = b.disabled ? 0.38 : 1;
    rr(b.x, b.y, b.w, b.h, r);
    if (b.primary && !b.disabled) {
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, c);
      g.addColorStop(1, shade(c));
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.fillStyle = b.active ? `${c}30` : skin.panelSolid;
      ctx.fill();
      ctx.strokeStyle = b.active ? c : `${c}77`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
    if (b.label) {
      const labelColor = b.primary && !b.disabled ? "#081226" : b.active ? c : b.disabled ? "#9AA7C2" : C.text;
      const labelY = b.y + (b.sub ? b.h / 2 - 9 : b.h / 2);
      if (pressed && skin.pressFx === "glitch") {
        fillText(b.label, b.x + b.w / 2 - 2, labelY, { size: 14, color: "rgba(255,61,129,0.7)", align: "center" });
        fillText(b.label, b.x + b.w / 2 + 2, labelY, { size: 14, color: ac(0.7), align: "center" });
      }
      fillText(b.label, b.x + b.w / 2, labelY, {
        size: 14,
        color: labelColor,
        align: "center"
      });
      if (b.sub) fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 11, { size: 11, color: b.disabled ? "#C77A34" : C.gold, align: "center" });
    }
    if (pressed) ctx.restore();
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.62);
    return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  }
  var segAnim2 = {};
  function segControl(x, y, w, items, activeIdx, key, onPick) {
    panel(x, y, w, 34, "rgba(255,201,77,0.25)", 17);
    const sw = w / items.length;
    const cur = segAnim2[key] ?? activeIdx;
    const next = cur + (activeIdx - cur) * 0.28;
    segAnim2[key] = Math.abs(activeIdx - next) < 0.01 ? activeIdx : next;
    ctx.save();
    rr(x + segAnim2[key] * sw + 3, y + 3, sw - 6, 28, 14);
    const g = ctx.createLinearGradient(0, y, 0, y + 34);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, shade(C.gold));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    items.forEach((label, i) => {
      fillText(label, x + i * sw + sw / 2, y + 17, { size: 13, color: i === activeIdx ? "#081226" : C.sub, align: "center" });
      hitBox({ x: x + i * sw, y, w: sw, h: 34, label: "", cb: () => {
        if (i !== activeIdx) {
          onPick(i);
          buzz("light");
        }
      } });
    });
  }
  function chip(x, y, text, color) {
    ctx.save();
    ctx.font = "bold 10px sans-serif";
    const w = ctx.measureText(text).width + 16;
    rr(x - w, y - 9, w, 18, 9);
    ctx.fillStyle = `${color}22`;
    ctx.fill();
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    fillText(text, x - w / 2, y + 0.5, { size: 10, color, align: "center" });
  }
  var showProfile = false;
  var showSettings = false;
  function drawHeader(title, opts = {}) {
    const btnS = 36;
    const top = CAP_MID - btnS / 2;
    ctx.save();
    const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
    g.addColorStop(0, skin.panelTop);
    g.addColorStop(1, skin.panelBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
    ctx.strokeStyle = ac(0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TOP_SAFE - 0.5);
    ctx.lineTo(VW, TOP_SAFE - 0.5);
    ctx.stroke();
    ctx.restore();
    let tx = MARGIN;
    const rightLimit = CAP_LEFT - 8 - GAME_CENTER_PAD;
    if (opts.back) {
      btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: "\u2039", cb: opts.back });
      tx = MARGIN + btnS + 12;
    }
    const maxW = rightLimit - tx - 8;
    let tSize = 16;
    ctx.save();
    while (tSize > 11) {
      ctx.font = `bold ${tSize}px sans-serif`;
      if (ctx.measureText(title).width <= maxW) break;
      tSize--;
    }
    ctx.restore();
    fillText("TOWER LINE DEFENSE", tx, CAP_MID - 11, { size: 9, color: ac(0.7), weight: "600" });
    fillText(title, tx, CAP_MID + 8, { size: tSize });
  }
  function copyFeedbackMail() {
    const mail = "feedback@example.com";
    try {
      wx.setClipboardData?.({ data: mail, success: () => showToast("\u53CD\u9988\u90AE\u7BB1\u5DF2\u590D\u5236") });
    } catch {
    }
  }
  function openFeedback() {
    try {
      if (typeof wx.openCustomerServiceChat === "function") {
        wx.openCustomerServiceChat({
          corpId: "",
          // TODO 替换为 mp 后台「客服」企业微信的 corpId
          extInfo: { url: "" },
          // TODO 替换为客服链接（mp 后台生成）
          fail: () => copyFeedbackMail()
        });
        return;
      }
    } catch {
    }
    copyFeedbackMail();
  }
  function drawProfileOverlay() {
    const m = SKIN_MODULES[skin.id];
    if (m?.drawProfile) {
      m.drawProfile(env);
      return;
    }
    ctx.fillStyle = "rgba(7,11,24,0.78)";
    ctx.fillRect(0, 0, VW, VH);
    const pw = VW - 72;
    const ph = 456;
    const px = 36;
    const py = VH / 2 - ph / 2;
    panel(px, py, pw, ph, C.panelLine);
    drawAvatar(VW / 2, py + 60, 34);
    fillText(displayNick(), VW / 2, py + 116, { size: 18, align: "center" });
    fillText(commanderRank(), VW / 2, py + 140, { size: 11, color: C.gold, align: "center", weight: "normal" });
    const cleared = loadProgress().cleared.length;
    const bw = pw - 64;
    const bx = px + 32;
    const by = py + 162;
    fillText(`\u6218\u5F79\u8FDB\u5EA6 ${cleared} / ${LEVELS.length}`, VW / 2, by - 8, { size: 11, color: C.sub, align: "center", weight: "normal" });
    rr(bx, by + 6, bw, 10, 5);
    ctx.fillStyle = ac(0.12);
    ctx.fill();
    if (cleared > 0) {
      rr(bx, by + 6, Math.max(10, bw * (cleared / LEVELS.length)), 10, 5);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, C.cyan);
      g.addColorStop(1, C.gold);
      ctx.fillStyle = g;
      ctx.fill();
    }
    const rp = rankProgress();
    const ry = by + 42;
    fillText(
      rp.next === null ? `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `\u79EF\u5206 ${rp.points.toLocaleString("en-US")} / ${rp.next.toLocaleString("en-US")} \xB7 \u8DDD\u300C${rp.nextName}\u300D\u8FD8\u5DEE ${(rp.next - rp.points).toLocaleString("en-US")} \u5206`,
      VW / 2,
      ry - 8,
      { size: 11, color: C.sub, align: "center", weight: "normal" }
    );
    rr(bx, ry + 6, bw, 10, 5);
    ctx.fillStyle = "rgba(255,201,77,0.12)";
    ctx.fill();
    const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
    if (frac > 0) {
      rr(bx, ry + 6, Math.max(10, bw * frac), 10, 5);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, shade(C.gold));
      g.addColorStop(1, C.gold);
      ctx.fillStyle = g;
      ctx.fill();
    }
    if (profile.openid) {
      fillText(`\u5DF2\u7ED1\u5B9A \xB7 ${profile.openid.slice(0, 12)}\u2026`, VW / 2, ry + 34, { size: 10, color: C.green, align: "center", weight: "normal" });
    }
    btn({
      x: px + 24,
      y: py + 266,
      w: pw - 48,
      h: 40,
      label: "\u{1F4AC} \u610F\u89C1\u53CD\u9988",
      color: C.gold,
      cb: () => openFeedback()
    });
    let y = py + 318;
    if (!profile.real) {
      btn({
        x: px + 24,
        y,
        w: pw - 48,
        h: 44,
        label: "\u540C\u6B65\u5FAE\u4FE1\u5934\u50CF\u6635\u79F0",
        color: C.green,
        primary: true,
        cb: () => authUser()
      });
      y += 56;
    }
    btn({ x: px + 24, y, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => {
      showProfile = false;
    } });
  }
  function drawSwitch(x, y, on) {
    ctx.save();
    rr(x, y, 46, 26, 13);
    ctx.fillStyle = on ? ac(0.85) : "rgba(90,107,140,0.45)";
    ctx.fill();
    ctx.strokeStyle = on ? C.cyan : "rgba(124,141,176,0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + (on ? 32 : 14), y + 13, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#081226" : "#C7D2EA";
    ctx.fill();
    ctx.restore();
  }
  function drawSettingsOverlay() {
    const m = SKIN_MODULES[skin.id];
    if (m?.drawSettings) {
      m.drawSettings(env);
      return;
    }
    ctx.fillStyle = "rgba(7,11,24,0.78)";
    ctx.fillRect(0, 0, VW, VH);
    hitBox({ x: 0, y: 0, w: VW, h: VH, label: "", cb: () => {
    } });
    const pw = VW - 72;
    const px = 36;
    const rowH = 56;
    const rows = [
      ["\u{1F50A}", "\u97F3\u6548", "\u653B\u51FB / \u7206\u70B8 / \u91D1\u5E01\u7B49\u6218\u6597\u97F3\u6548", !sfx.muted, () => sfx.setMuted(!sfx.muted)],
      ["\u{1F3B5}", "\u97F3\u4E50", "\u4E3B\u9875\u4E0E\u6218\u6597\u80CC\u666F\u97F3\u4E50", !musicMuted, toggleMusicMuted],
      ["\u{1F399}", "\u65C1\u767D", "\u4EFB\u52A1\u7B80\u62A5\u8BED\u97F3\u89E3\u8BF4", !narrationMuted, toggleNarrationMuted],
      ["\u{1F4F3}", "\u9707\u52A8", "\u5EFA\u9020 / \u6F0F\u602A / BOSS \u6218\u89E6\u611F\u53CD\u9988", !vibrateMuted, toggleVibrateMuted],
      ["\u2728", "\u9AD8\u753B\u8D28", "Bloom \u8F89\u5149\u7279\u6548\uFF0C\u4F4E\u7AEF\u673A\u5EFA\u8BAE\u5173\u95ED", readWxQualityHigh(), () => {
        const q = !readWxQualityHigh();
        setWxQualityHigh(q);
        qualityHigh = q;
      }]
    ];
    const skinH = 74;
    const ph = 72 + rows.length * rowH + skinH + 68;
    const py = VH / 2 - ph / 2;
    panel(px, py, pw, ph, C.panelLine);
    fillText("SETTINGS", VW / 2, py + 24, { size: 9, color: ac(0.7), weight: "600", align: "center" });
    fillText("\u8BBE\u7F6E\u4E2D\u5FC3", VW / 2, py + 46, { size: 17, align: "center" });
    rows.forEach(([icon, label, desc, on, cb], i) => {
      const y = py + 66 + i * rowH;
      if (i > 0) {
        ctx.save();
        ctx.strokeStyle = ac(0.1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 20, y + 0.5);
        ctx.lineTo(px + pw - 20, y + 0.5);
        ctx.stroke();
        ctx.restore();
      }
      fillText(icon, px + 34, y + rowH / 2, { size: 16, align: "center" });
      fillText(label, px + 56, y + 19, { size: 14 });
      fillText(desc, px + 56, y + 39, { size: 10, color: C.sub, weight: "normal" });
      drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
      hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: "", cb: () => {
        cb();
        buzz("light");
      } });
    });
    const skY = py + 66 + rows.length * rowH;
    fillText("\u{1F3A8}", px + 34, skY + 15, { size: 16, align: "center" });
    fillText("\u754C\u9762\u76AE\u80A4", px + 56, skY + 10, { size: 14 });
    fillText(SKINS.find((s) => s.id === skin.id)?.ref ?? "", px + 56, skY + 30, { size: 10, color: C.sub, weight: "normal" });
    const chipW = (pw - 40 - 12) / SKINS.length;
    SKINS.forEach((s, i) => {
      const cx0 = px + 20 + i * (chipW + 6);
      const cy0 = skY + 38;
      const on = s.id === skin.id;
      ctx.save();
      rr(cx0, cy0, chipW, 30, 8);
      ctx.fillStyle = on ? ac(0.18) : "rgba(90,107,140,0.12)";
      ctx.fill();
      ctx.strokeStyle = on ? s.accent : "rgba(124,141,176,0.35)";
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.stroke();
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? C.text : C.sub });
      hitBox({ x: cx0, y: cy0, w: chipW, h: 30, label: "", cb: () => {
        applySkin(s.id);
        buzz("light");
        showToast(`\u5DF2\u5207\u6362\u300C${s.name}\u300D`);
      } });
    });
    btn({ x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: "\u5173\u95ED", cb: () => {
      showSettings = false;
    } });
  }
  var ART = {};
  function artwork(chapter) {
    const cached = ART[chapter];
    if (cached) return cached;
    const img = wx.createImage();
    const a = { img, ok: false };
    const file = `assets/lv${String(chapter).padStart(2, "0")}.jpg`;
    let retried = false;
    img.onload = () => {
      a.ok = true;
    };
    img.onerror = (e) => {
      if (!retried) {
        retried = true;
        img.src = `./${file}`;
      } else {
        console.error("[SRD] \u7AE0\u8282\u5BA3\u4F20\u56FE\u52A0\u8F7D\u5931\u8D25:", file, e ?? "");
      }
    };
    img.src = file;
    ART[chapter] = a;
    return a;
  }
  LEVELS.forEach((lv) => artwork(lv.id));
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeStars(seed, n, w, h) {
    const r = rng(seed);
    return Array.from({ length: n }, () => ({
      x: r() * w,
      y: r() * h,
      r: 0.6 + r() * 1.6,
      tw: r() * Math.PI * 2,
      speed: 0.8 + r() * 2
    }));
  }
  var bgStars = makeStars(41, 70, VW, VH);
  function drawStars(time, alpha = 1) {
    ctx.save();
    for (const s of bgStars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * s.speed + s.tw));
      ctx.globalAlpha = alpha * tw;
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawSpaceBg(time) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#0B1230");
    g.addColorStop(0.4, "#070B18");
    g.addColorStop(1, "#0A0F24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    const nebR = VW * 0.9;
    const gg = ctx.createRadialGradient(VW * 0.8, VH * 0.1, 0, VW * 0.8, VH * 0.1, nebR);
    gg.addColorStop(0, "rgba(34,224,255,0.10)");
    gg.addColorStop(0.5, "rgba(34,224,255,0.05)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, VW, VH);
    const gg2 = ctx.createRadialGradient(VW * 0.15, VH * 0.75, 0, VW * 0.15, VH * 0.75, nebR * 0.8);
    gg2.addColorStop(0, "rgba(139,92,246,0.10)");
    gg2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg2;
    ctx.fillRect(0, 0, VW, VH);
    drawStars(time, 0.9);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1;
    for (let x = 0; x < VW; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VH);
      ctx.stroke();
    }
    for (let y = 0; y < VH; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  var CHAPTER_THEME = [
    { hue1: "#0E2440", hue2: "#16203A", enemy: "crawler", planet: "#22E0FF", ring: "#7C8DB0" },
    { hue1: "#331208", hue2: "#40200E", enemy: "splitter", planet: "#FF9F43", ring: "#FF6B3D" },
    { hue1: "#241040", hue2: "#33154F", enemy: "boss", planet: "#8B5CF6", ring: "#22E0FF" },
    { hue1: "#1A2A33", hue2: "#20303A", enemy: "speeder", planet: "#4FD0C8", ring: "#22E0FF" },
    { hue1: "#0F2A2A", hue2: "#10352F", enemy: "lurker", planet: "#3DF08C", ring: "#B8FF3D" },
    { hue1: "#2A2A12", hue2: "#35351A", enemy: "tanker", planet: "#FFC94D", ring: "#FF9F43" },
    { hue1: "#120A2E", hue2: "#1C1038", enemy: "boss", planet: "#8B5CF6", ring: "#FF3D81" },
    { hue1: "#0A2340", hue2: "#0F2E50", enemy: "lurker", planet: "#22E0FF", ring: "#B8FF3D" },
    { hue1: "#30101E", hue2: "#3D1626", enemy: "splitter", planet: "#FF3D81", ring: "#8B5CF6" },
    { hue1: "#2E1230", hue2: "#3A1A3D", enemy: "boss", planet: "#FF3D81", ring: "#22E0FF" },
    { hue1: "#31140F", hue2: "#401C14", enemy: "tanker", planet: "#FF6B3D", ring: "#FFC94D" },
    { hue1: "#2E0F14", hue2: "#3B1A1C", enemy: "boss", planet: "#FF3D81", ring: "#FFC94D" },
    { hue1: "#0B0B2E", hue2: "#141440", enemy: "boss", planet: "#FFC94D", ring: "#FF3D81" }
  ];
  function drawCardArt(x, y, w, h, chapter, time, r = 10) {
    const art = artwork(chapter);
    if (art.ok) {
      const iw = art.img.width > 0 ? art.img.width : 512;
      const ih = art.img.height > 0 ? art.img.height : 768;
      const s = Math.max(w / iw, h / ih) * (1.03 + 0.035 * Math.sin(time * 0.12));
      const dw = iw * s;
      const dh = ih * s;
      ctx.save();
      rr(x, y, w, h, r);
      ctx.clip();
      ctx.drawImage(art.img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      const g = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
      g.addColorStop(0, "rgba(7,11,24,0)");
      g.addColorStop(1, "rgba(7,11,24,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      return;
    }
    drawCardArtProcedural(x, y, w, h, chapter, time, r);
  }
  function drawCardArtProcedural(x, y, w, h, chapter, time, r = 10) {
    const th = CHAPTER_THEME[(chapter - 1) % CHAPTER_THEME.length];
    ctx.save();
    rr(x, y, w, h, r);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, th.hue1);
    g.addColorStop(1, th.hue2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const stars = CARD_STARS[chapter] ?? (CARD_STARS[chapter] = makeStars(chapter * 97, 16, Math.max(2, w), Math.max(2, h)));
    for (const s of stars) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 2 + s.tw));
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(x + s.x, y + s.y, s.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const px = x + w * 0.68;
    const py = y + h * 0.42;
    const pr = h * 0.26;
    ctx.save();
    ctx.strokeStyle = `${th.ring}AA`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.9, pr * 0.62, -0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, `${th.planet}CC`);
    pg.addColorStop(1, "#0A0F20");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x + w * 0.82, y + h * 0.72);
    drawEnemy(ctx, th.enemy, h * 9e-3, time, {});
    ctx.restore();
    ctx.save();
    ctx.translate(x + w * 0.16, y + h * 0.78);
    drawTower(ctx, "laser", 0, h * 0.5, Math.atan2(-1, 1) + Math.PI / 2, 0, time);
    ctx.restore();
    ctx.restore();
  }
  var CARD_STARS = {};
  var app = {
    screen: "splash",
    splashAt: Date.now(),
    difficulty: loadProgress().cleared.length > 0 ? "normal" : "easy",
    levelId: 1,
    engine: null,
    scroll: 0,
    dragY: null,
    dragAcc: 0,
    placing: null,
    selectedId: null,
    result: null,
    techShownAt: 0,
    techPickedAt: 0,
    // 双人同屏协作开关（§4.1 A 档；按会话保持，不落盘）。与 mode 同步：coop === (mode==='coop')
    coop: false,
    // 玩法模式三档（§4.3 C 档）：单人 / 双人同屏 / 在线联机
    mode: "single",
    // 分享卡片带入的待加入房间码（邀请横幅数据源）
    pendingRoom: null
  };
  function setMode(m) {
    if (app.mode === m) return;
    app.mode = m;
    app.coop = m === "coop";
    track("coop_toggle", { mode: m === "single" ? 0 : m === "coop" ? 1 : 2 });
  }
  function toggleCoop() {
    setMode(app.mode === "coop" ? "single" : "coop");
  }
  try {
    const room = wx.getLaunchOptionsSync?.().query?.room;
    if (typeof room === "string" && /^[A-Z0-9]{4,8}$/.test(room)) app.pendingRoom = room;
  } catch {
  }
  var screenAt = Date.now();
  function goto(s) {
    if (app.screen === s) return;
    if (app.screen === "battle" && online) teardownOnline(!online.ended);
    if (app.screen === "result" && s !== "result") onlineResultInfo = null;
    app.screen = s;
    screenAt = Date.now();
  }
  var TOWER_ORDER = TOWER_LIST.map((t) => t.type);
  var TOWER_UNLOCK = {
    laser: 1,
    missile: 1,
    frost: 2,
    railgun: 3,
    tesla: 5,
    plasma: 7
  };
  var unlockedChapter = () => Math.max(0, ...loadProgress().cleared) + 1;
  var towerUnlocked = (t) => TOWER_UNLOCK[t] <= unlockedChapter();
  var DIFF_LIST = ["easy", "normal", "hard"];
  var engineCmd = (cmd) => app.engine ? app.engine.dispatch(cmd) : false;
  var codex = { tab: "story", scroll: 0 };
  var codexMaxScroll2 = 0;
  var STORY_PARAS = [
    "2242 \u5E74\uFF0C\u4EBA\u7C7B\u5728\u67EF\u4F0A\u4F2F\u5E26\u5916\u6CBF\u5EFA\u8D77\u661F\u73AF\u6B96\u6C11\u5730\u7FA4\uFF0C\u4F9D\u9760\u8F68\u9053\u62A4\u76FE\u4E0E\u81EA\u52A8\u70AE\u5854\u7F51\u7EDC\u7EF4\u7CFB\u5B58\u4EA1\u3002\u6E6E\u706D\u866B\u7FA4\u2014\u2014\u4EE5\u6052\u661F\u80FD\u91CF\u4E3A\u98DF\u7684\u7845\u57FA\u866B\u65CF\u2014\u2014\u6495\u5F00\u4E86\u5916\u73AF\u9884\u8B66\u7F51\uFF0C\u6CBF\u5F15\u529B\u8D70\u5ECA\u76F4\u6251\u6B96\u6C11\u5730\u3002",
    "\u4F60\u662F\u9632\u7EBF\u6307\u6325\u5B98\u3002\u5DE5\u7A0B\u90E8\u5DF2\u5728\u866B\u7FA4\u8DEF\u5F84\u4E24\u4FA7\u6E05\u7A7A\u5EFA\u9020\u4F4D\uFF1A\u6FC0\u5149\u3001\u5BFC\u5F39\u3001\u51CF\u901F\u3001\u7535\u78C1\u3001\u7279\u65AF\u62C9\u3001\u7B49\u79BB\u5B50\u516D\u7CFB\u70AE\u5854\u4EFB\u4F60\u8C03\u9063\uFF0C\u5F39\u836F\u4E0E\u80FD\u6E90\u65E0\u9650\u2014\u2014\u4EE3\u4EF7\u662F\uFF0C\u6CA1\u6709\u9000\u8DEF\u3002",
    "\u6BCF\u5B88\u4F4F\u4E00\u9053\u9632\u7EBF\uFF0C\u661F\u73AF\u62A4\u76FE\u7684\u91CD\u542F\u8FDB\u5EA6\u5C31\u63A8\u8FDB\u4E00\u683C\u3002\u5341\u4E09\u7AE0\u6218\u5F79\u4E4B\u540E\uFF0C\u8981\u4E48\u6B96\u6C11\u5730\u8FCE\u6765\u9ECE\u660E\uFF0C\u8981\u4E48\u661F\u73AF\u6C38\u8FDC\u6C89\u5BC2\u3002\u6307\u6325\u5B98\uFF0C\u6B96\u6C11\u5730\u5728\u4F60\u8EAB\u540E\u3002"
  ];
  var ENEMY_CATEGORY = {
    normal: "\u666E\u901A",
    fast: "\u5FEB\u901F",
    tank: "\u91CD\u88C5",
    special: "\u7279\u6B8A",
    boss: "\u9996\u9886"
  };
  var barScroll = 0;
  var barTouch = null;
  var dragPos = null;
  var mapTouch = null;
  var battleMoved = 0;
  var techShownAt = 0;
  var leakFlashAt = -9999;
  var SLOT_W = 64;
  var SLOT_GAP = 8;
  var stripContentW = TOWER_ORDER.length * (SLOT_W + SLOT_GAP) - SLOT_GAP;
  var stripMaxScroll = Math.max(0, stripContentW - (VW - MARGIN * 2));
  function towerSlotAt(p) {
    if (p.y < VH - BAR_H) return null;
    for (let i = 0; i < TOWER_ORDER.length; i++) {
      const bx = MARGIN + i * (SLOT_W + SLOT_GAP) - barScroll;
      if (p.x >= bx && p.x <= bx + SLOT_W) return TOWER_ORDER[i];
    }
    return null;
  }
  var pkgState = {};
  var pkgCbs = {};
  function ensurePkg(name, cb) {
    const s = pkgState[name];
    if (s === "ok") {
      cb?.(true);
      return;
    }
    if (s === "fail") {
      cb?.(false);
      return;
    }
    if (cb) (pkgCbs[name] ?? (pkgCbs[name] = [])).push(cb);
    if (s === "loading") return;
    pkgState[name] = "loading";
    try {
      wx.loadSubpackage({
        name,
        success: () => {
          pkgState[name] = "ok";
          (pkgCbs[name] ?? []).splice(0).forEach((f) => f(true));
        },
        fail: (e) => {
          pkgState[name] = "fail";
          console.error("[SRD] \u5206\u5305\u52A0\u8F7D\u5931\u8D25:", name, e ?? "");
          (pkgCbs[name] ?? []).splice(0).forEach((f) => f(false));
        }
      });
    } catch {
      pkgState[name] = "fail";
      cb?.(false);
    }
  }
  ensurePkg("bgm");
  ensurePkg("audio");
  var bgmAc = null;
  var musicTarget = "";
  var legacyMuted = store.get("srd.muted") === "1";
  if (legacyMuted) {
    if (store.get("srd.musicMuted") === "") store.set("srd.musicMuted", "1");
    if (store.get("srd.sfxMuted") === "") sfx.setMuted(true);
  }
  var musicMuted = store.get("srd.musicMuted") === "1";
  function stopMusic() {
    if (!bgmAc) return;
    try {
      bgmAc.ac.destroy();
    } catch {
    }
    bgmAc = null;
  }
  function playMusic(name) {
    stopMusic();
    ensurePkg("bgm", (ok) => {
      if (!ok || musicTarget !== name || bgmAc) return;
      try {
        const ac2 = wx.createInnerAudioContext();
        ac2.loop = true;
        ac2.autoplay = true;
        ac2.obeyMuteSwitch = false;
        ac2.volume = name === "battle" ? 0.5 : 0.45;
        ac2.onError((e) => console.error("[SRD] BGM \u64AD\u653E\u5931\u8D25:", ac2.src, e ?? ""));
        ac2.onCanplay(() => {
          try {
            ac2.play();
          } catch {
          }
        });
        ac2.src = `assets/bgm/bgm-${name}.mp3`;
        bgmAc = { ac: ac2, name };
      } catch {
      }
    });
  }
  function syncMusic() {
    const want = musicMuted ? "" : app.screen === "battle" ? "battle" : "home";
    if (want === musicTarget) return;
    musicTarget = want;
    if (!want) {
      stopMusic();
      return;
    }
    playMusic(want);
  }
  function toggleMusicMuted() {
    musicMuted = !musicMuted;
    store.set("srd.musicMuted", musicMuted ? "1" : "0");
    if (musicMuted) stopMusic();
    musicTarget = "";
  }
  var vibrateMuted = store.get("srd.vibrateMuted") === "1";
  var vibrateLastError = "";
  function toggleVibrateMuted() {
    vibrateMuted = !vibrateMuted;
    store.set("srd.vibrateMuted", vibrateMuted ? "1" : "0");
    if (!vibrateMuted) {
      vibrateLastError = "";
      lastBuzzAt = 0;
      buzz("medium");
      setTimeout(() => {
        showToast(vibrateLastError ? `\u9707\u52A8\u8C03\u7528\u5931\u8D25\uFF1A${vibrateLastError}` : "\u5DF2\u8BD5\u9707\u4E00\u6B21 \xB7 \u82E5\u65E0\u9707\u611F\u8BF7\u68C0\u67E5\u300C\u8BBE\u7F6E-\u58F0\u97F3\u4E0E\u89E6\u611F-\u7CFB\u7EDF\u89E6\u611F\u53CD\u9988\u300D");
      }, 350);
    }
  }
  var lastBuzzAt = 0;
  function buzz(type) {
    if (vibrateMuted) return;
    const now = Date.now();
    if (now - lastBuzzAt < 90) return;
    lastBuzzAt = now;
    try {
      wx.vibrateShort?.({ type, fail: (e) => {
        vibrateLastError = e?.errMsg || "fail";
      } });
    } catch {
      vibrateLastError = "exception";
    }
  }
  var narration = null;
  var narrationMuted = store.get("srd.narrationMuted") === "1";
  function stopNarration() {
    if (!narration) return;
    try {
      narration.ac.destroy();
    } catch {
    }
    narration = null;
  }
  function startNarration(levelId) {
    stopNarration();
    if (narrationMuted) return;
    ensurePkg("audio", (ok) => {
      if (!ok || narration || narrationMuted) return;
      try {
        const ac2 = wx.createInnerAudioContext();
        ac2.autoplay = true;
        ac2.obeyMuteSwitch = false;
        ac2.onError((e) => console.error("[SRD] \u65C1\u767D\u64AD\u653E\u5931\u8D25:", ac2.src, e ?? ""));
        ac2.onCanplay(() => {
          try {
            ac2.play();
          } catch {
          }
        });
        ac2.src = `assets/audio/lv${String(levelId).padStart(2, "0")}.mp3`;
        narration = { ac: ac2, levelId };
      } catch {
      }
    });
  }
  function toggleNarrationMuted() {
    narrationMuted = !narrationMuted;
    store.set("srd.narrationMuted", narrationMuted ? "1" : "0");
    if (narrationMuted) stopNarration();
    else if (app.screen === "briefing") startNarration(app.levelId);
  }
  function gotoBriefing(levelId) {
    if (app.mode === "online") {
      enterLobby();
      return;
    }
    app.levelId = levelId;
    track("chapter_select", { level_id: levelId });
    goto("briefing");
    startNarration(levelId);
  }
  var splashStars = makeStars(97, 110, VW, VH);
  var welcomeBgImg = wx.createImage();
  var welcomeBg = { ok: false };
  welcomeBgImg.onload = () => {
    welcomeBg.ok = true;
  };
  welcomeBgImg.onerror = () => {
    welcomeBg.ok = false;
  };
  welcomeBgImg.src = "assets/welcome-bg.jpg";
  var splashSwarm = Array.from({ length: 42 }, (_, i) => ({
    ox: hash01(i * 3 + 11),
    oy: hash01(i * 7 + 23),
    sp: 0.5 + hash01(i * 13 + 5) * 0.9,
    wob: hash01(i * 17 + 3) * Math.PI * 2,
    big: hash01(i * 29 + 7) < 0.18
  }));
  function drawSplash(time) {
    hooks = [];
    const t = (Date.now() - app.splashAt) / 1e3;
    ctx.fillStyle = "#04060E";
    ctx.fillRect(0, 0, VW, VH);
    if (welcomeBg.ok) {
      const iw = welcomeBgImg.width || 720;
      const ih = welcomeBgImg.height || 1280;
      const sc = Math.max(VW / iw, VH / ih);
      const dw = iw * sc;
      const dh = ih * sc;
      ctx.drawImage(welcomeBgImg, (VW - dw) / 2 - 1, (VH - dh) / 2 - 1, dw + 2, dh + 2);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, "#04060E");
      bg.addColorStop(0.5, "#060A18");
      bg.addColorStop(1, "#02040A");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VW, VH);
      const nebPulse = 0.75 + 0.25 * Math.sin(t * 0.4);
      const neb1 = ctx.createRadialGradient(VW * 1.05, -VH * 0.08, 0, VW * 1.05, -VH * 0.08, VW * 1.15);
      neb1.addColorStop(0, `rgba(255,61,129,${0.14 * nebPulse})`);
      neb1.addColorStop(0.55, `rgba(122,79,208,${0.07 * nebPulse})`);
      neb1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, VW, VH);
      const neb2 = ctx.createRadialGradient(VW * 0.1, VH * 0.85, 0, VW * 0.1, VH * 0.85, VW * 0.9);
      neb2.addColorStop(0, "rgba(139,92,246,0.05)");
      neb2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, VW, VH);
      const px = VW * 1.28;
      const py = VH * 1.12;
      const pr = VW * 0.95;
      ctx.save();
      const pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
      pg.addColorStop(0, "#0B1124");
      pg.addColorStop(1, "#02040A");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      const crackA = 0.35 + 0.3 * Math.sin(t * 0.9);
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const a0 = Math.PI * (1.02 + hash01(i * 41) * 0.44);
        const r0 = pr * (0.55 + hash01(i * 17) * 0.35);
        let tx = px + Math.cos(a0) * r0;
        let ty = py + Math.sin(a0) * r0;
        ctx.strokeStyle = i % 2 ? `rgba(184,255,61,${crackA * 0.5})` : `rgba(255,61,129,${crackA * 0.45})`;
        ctx.lineWidth = 1.2 + hash01(i * 5) * 1.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        for (let k = 1; k <= 4; k++) {
          tx += Math.cos(a0 + k) * (6 + hash01(i * 53 + k) * 14);
          ty += Math.sin(a0 + k * 1.7) * (6 + hash01(i * 71 + k) * 14);
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = ac(0.28);
      ctx.beginPath();
      ctx.arc(px, py, pr, Math.PI, Math.PI * 1.25);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,61,129,0.34)";
      ctx.beginPath();
      ctx.arc(px, py, pr, Math.PI * 1.25, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    for (let i = 0; i < splashStars.length; i++) {
      const s = splashStars[i];
      let a = 0.25 + 0.5 * Math.abs(Math.sin(t * s.speed * 0.6 + s.tw));
      if (hash01(i * 31 + 1) < 0.12) {
        const cycle = 9 + hash01(i * 7 + 2) * 8;
        const ph = (t + hash01(i * 13 + 4) * 30) % cycle;
        if (ph < 0.9) a *= Math.abs(ph / 0.45 - 1);
      }
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = "#CFE0FF";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    for (let i = 0; i < splashSwarm.length; i++) {
      const sp = splashSwarm[i];
      const prog = (t * 0.03 * sp.sp + sp.ox) % 1.15;
      const sx = VW * (1.12 - prog * 1.05) + Math.sin(t * 0.7 + sp.wob) * 14;
      const sy = VH * (-0.06 + prog * 0.78 + sp.oy * 0.12) + Math.cos(t * 0.5 + sp.wob * 1.3) * 10;
      const tw = 0.5 + 0.5 * Math.sin(t * (2 + sp.sp * 3) + sp.wob * 5);
      ctx.globalAlpha = 0.2 + 0.45 * tw;
      ctx.fillStyle = sp.big ? "#B8FF3D" : "#FF3D81";
      ctx.beginPath();
      ctx.arc(sx, sy, sp.big ? 2.1 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const gSeed = Math.floor(t / 6.5);
    const gT = t - gSeed * 6.5;
    const glitch = t > 0.8 && hash01(gSeed * 13 + 7) > 0.25 && gT < 0.3;
    if (glitch) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, VW, VH);
      for (let i = 0; i < 3; i++) {
        const gy = hash01(gSeed * 31 + i * 7) * VH;
        ctx.fillStyle = `rgba(2,4,10,${0.25 + hash01(gSeed + i) * 0.3})`;
        ctx.fillRect(0, gy, VW, 6 + hash01(gSeed * 7 + i) * 26);
        ctx.fillStyle = ac(0.05 + hash01(gSeed * 11 + i) * 0.08);
        ctx.fillRect(0, gy - 1, VW, 1.5);
      }
      ctx.restore();
    }
    const cx = VW / 2;
    const cy = VH * 0.28;
    const ringR = Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5) * VW * 0.17 + 8;
    const stutter = hash01(Math.floor(t * 6) * 3 + 1) < 0.12 ? 0.15 : 1;
    const emA = Math.min(1, t);
    ctx.save();
    ctx.lineCap = "round";
    const rot = t * 0.12;
    for (let i = 0; i < 3; i++) {
      const a0 = rot + i * (Math.PI * 2 / 3) + hash01(i * 7 + 1) * 0.3;
      const span = Math.PI * 2 / 3 - 0.55 - hash01(i * 13 + 2) * 0.25;
      const arcColor = glitch ? C.pink : C.cyan;
      ctx.globalAlpha = emA * 0.85;
      ctx.strokeStyle = arcColor;
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, a0, a0 + span);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = emA * 0.5;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 1.18, -rot * 1.6 + 0.6, -rot * 1.6 + 1.5);
    ctx.stroke();
    ctx.globalAlpha = emA * 0.32;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ringR * 1.7, ringR * 0.42, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.2);
    const beaconGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.55);
    beaconGlow.addColorStop(0, ac(0.26 * pulse * emA));
    beaconGlow.addColorStop(1, ac(0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = beaconGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = emA * stutter;
    ctx.fillStyle = "#EAFBFF";
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2 + pulse * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, Math.max(0, t - 0.35)) * stutter * (0.5 + 0.3 * Math.sin(t * 4));
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ringR * 1.45);
    ctx.lineTo(cx, cy - 8);
    ctx.stroke();
    ctx.restore();
    const titleY = cy + ringR * 1.9;
    const titleSize = Math.min(30, VW * 0.082);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.5) / 0.8));
    if (glitch) {
      fillText("\u9AD8 \u5854 \u9632 \u7EBF", VW / 2 - 2, titleY + 34, { size: titleSize, color: "rgba(255,61,129,0.65)", align: "center" });
      fillText("\u9AD8 \u5854 \u9632 \u7EBF", VW / 2 + 2, titleY + 34, { size: titleSize, color: ac(0.65), align: "center" });
    }
    fillText("TOWER LINE DEFENSE", VW / 2, titleY, { size: 13, color: C.cyan, align: "center", weight: "600" });
    fillText("\u9AD8 \u5854 \u9632 \u7EBF", VW / 2, titleY + 34, { size: titleSize, align: "center" });
    fillText("LAST SIGNAL FROM THE RIM", VW / 2, titleY + 58, { size: 9, color: "rgba(255,61,129,0.8)", align: "center", weight: "600" });
    ctx.restore();
    const msgs = [
      ["\xBB \u5916\u73AF\u9884\u8B66\u7F51 \u2026\u2026 \u5DF2\u5931\u8054", "rgba(61,240,140,0.75)"],
      ["\xBB \u5B83\u4EEC\u6B63\u4ECE\u661F\u6D77\u6DF1\u5904\u800C\u6765", "rgba(255,61,129,0.85)"]
    ];
    msgs.forEach(([m, color], i) => {
      const start = 1.2 + i * 1.1;
      const n = Math.max(0, Math.min(m.length, Math.floor((t - start) * 12)));
      if (n > 0) fillText(m.slice(0, n) + (n < m.length ? "\u258C" : ""), VW / 2, titleY + 82 + i * 20, { size: 11, color, align: "center", weight: "normal" });
    });
    const vg = ctx.createRadialGradient(VW / 2, VH * 0.42, Math.min(VW, VH) * 0.25, VW / 2, VH * 0.42, Math.max(VW, VH) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(1,2,6,${(welcomeBg.ok ? 0.45 : 0.8) + 0.08 * Math.sin(t * 0.5)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);
    const dim = 0.4 + 0.3 * Math.sin(t * 1.1);
    fillText("\u6DF1\u7A7A\u76D1\u542C\u7AD9 \xB7 \u7B2C 41 \u8F68\u9053\u5468\u671F", VW / 2, VH - 46, { size: 9, color: `rgba(124,141,176,${dim})`, align: "center", weight: "normal" });
    fillText("SIGNAL FADING", VW / 2, VH - 30, { size: 8, color: `rgba(255,61,129,${dim * 0.8})`, align: "center", weight: "600" });
    fillText(true ? "b1005-0008" : "dev", VW - 10, VH - 10, { size: 8, color: "rgba(124,141,176,0.4)", align: "right", weight: "normal" });
    const menuA = Math.min(1, Math.max(0, (t - 1) / 0.5));
    if (menuA <= 0) {
      if (t > 0.2) hitBox({ x: 0, y: 0, w: VW, h: VH, label: "", cb: () => {
        app.splashAt = Date.now() - 1500;
      } });
      return;
    }
    const slide = (1 - menuA) * 16;
    const sm = SKIN_MODULES[skin.id];
    if (sm?.drawSplashMenu) {
      sm.drawSplashMenu(env, time, menuA);
    } else {
      const entries = [
        ["\u{1F4D6}", "\u56FE\u9274", C.gold, () => {
          codex.scroll = 0;
          goto("codex");
        }],
        ["\u2699", "\u8BBE\u7F6E", C.cyan, () => {
          showProfile = false;
          showSettings = true;
        }],
        ["", "\u6863\u6848", C.green, () => {
          showSettings = false;
          showProfile = true;
        }]
      ];
      ctx.save();
      ctx.globalAlpha = menuA;
      if (skin.id === "ember") {
        const x0 = MARGIN;
        const w0 = VW - MARGIN * 2;
        const y0 = titleY + 100 + slide;
        panel(x0, y0, w0, 52, `${C.gold}66`);
        ctx.fillStyle = C.gold;
        ctx.fillRect(x0, y0, 6, 52);
        fillText("\u25B6", x0 + 30, y0 + 26, { size: 16, color: C.gold, align: "center" });
        fillText("\u5F00\u59CB\u6218\u5F79", x0 + 56, y0 + 26, { size: 16 });
        fillText("START OPERATION", x0 + w0 - 16, y0 + 26, { size: 9, color: C.sub, align: "right", weight: "normal" });
        hitBox({ x: x0, y: y0, w: w0, h: 52, label: "", cb: () => goto("home") });
        entries.forEach(([icon, label, color, cb], i) => {
          const y = y0 + 62 + i * 54;
          panel(x0, y, w0, 44, `${color}44`);
          ctx.fillStyle = color;
          ctx.fillRect(x0, y, 6, 44);
          if (icon) fillText(icon, x0 + 30, y + 22, { size: 15, align: "center" });
          else drawAvatar(x0 + 30, y + 22, 11);
          fillText(label, x0 + 56, y + 22, { size: 14 });
          fillText("\u203A", x0 + w0 - 20, y + 22, { size: 15, color: C.sub, align: "center" });
          hitBox({ x: x0, y, w: w0, h: 44, label: "", cb });
        });
      } else if (skin.id === "matrix") {
        const menuY = titleY + 118 + slide;
        btn({ x: VW / 2 - 110, y: menuY, w: 220, h: 54, label: "\u25B6 \u5F00\u59CB\u6218\u5F79", color: C.gold, primary: true, cb: () => goto("home") });
        const offs = [[-108, -4], [0, 18], [108, -4]];
        entries.forEach(([icon, label, color, cb], i) => {
          const bx = VW / 2 + offs[i][0];
          const by = menuY + 122 + offs[i][1];
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(bx, by, 26, 0, Math.PI * 2);
          ctx.fillStyle = skin.panelSolid;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
          if (icon) fillText(icon, bx, by, { size: 16, align: "center" });
          else drawAvatar(bx, by, 11);
          fillText(label, bx, by + 40, { size: 11, color: C.sub, align: "center" });
          hitBox({ x: bx - 28, y: by - 28, w: 56, h: 56, label: "", cb });
        });
      } else {
        const menuY = titleY + 124 + slide;
        btn({ x: VW / 2 - 110, y: menuY, w: 220, h: 54, label: "\u25B6 \u5F00\u59CB\u6218\u5F79", color: C.gold, primary: true, cb: () => goto("home") });
        const entryY = menuY + 54 + 16;
        const entryW = (VW - MARGIN * 2 - 20) / 3;
        entries.forEach(([icon, label, color, cb], i) => {
          const x = MARGIN + i * (entryW + 10);
          panel(x, entryY, entryW, 60, `${color}44`);
          if (icon) fillText(icon, x + entryW / 2, entryY + 22, { size: 18, align: "center" });
          else drawAvatar(x + entryW / 2, entryY + 22, 12);
          fillText(label, x + entryW / 2, entryY + 45, { size: 12, color: C.sub, align: "center" });
          hitBox({ x, y: entryY, w: entryW, h: 60, label: "", cb });
        });
      }
      ctx.restore();
    }
    if (showProfile) drawProfileOverlay();
    if (showSettings) drawSettingsOverlay();
  }
  var CARD_H2 = 116;
  var CARD_GAP2 = 12;
  var homeTop = TOP_SAFE + 48;
  var homeBottom = VH - 26;
  var totalScrollMax = () => Math.max(0, LEVELS.length * (CARD_H2 + CARD_GAP2) - (homeBottom - homeTop) + 8);
  function drawHome4(time) {
    hooks = [];
    const m = SKIN_MODULES[skin.id];
    if (m?.drawHome) {
      m.drawHome(env, time);
      return;
    }
    drawSpaceBg(time);
    drawHeader("\u9AD8\u5854\u9632\u7EBF \xB7 \u6218\u5F79\u9009\u62E9", { back: () => goto("splash") });
    const segW = VW - MARGIN * 2;
    const segY = TOP_SAFE + 4;
    const diffW = Math.round(segW * 0.6);
    segControl(MARGIN, segY, diffW, DIFF_LIST.map((d) => DIFFICULTIES[d].name), DIFF_LIST.indexOf(app.difficulty), "diff", (i) => {
      app.difficulty = DIFF_LIST[i];
      track("difficulty_select", { difficulty: app.difficulty });
    });
    segControl(MARGIN + diffW + 10, segY, segW - diffW - 10, ["\u5355\u4EBA", "\u540C\u5C4F", "\u8054\u673A"], app.mode === "coop" ? 1 : app.mode === "online" ? 2 : 0, "coop", (i) => setMode(i === 1 ? "coop" : i === 2 ? "online" : "single"));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, homeTop, VW, homeBottom - homeTop);
    ctx.clip();
    const cleared = loadProgress().cleared;
    const cardX = MARGIN;
    const cardW = VW - MARGIN * 2;
    LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const y = homeTop + 8 + i * (CARD_H2 + CARD_GAP2) - app.scroll;
      if (y + CARD_H2 < homeTop || y > homeBottom) return;
      panel(cardX, y, cardW, CARD_H2, unlock ? C.panelLine : "rgba(124,141,176,0.15)");
      const artX = cardX + 8;
      const artY = y + 8;
      const artW = 82;
      const artH = CARD_H2 - 16;
      drawCardArt(artX, artY, artW, artH, lv.id, time);
      if (!unlock) {
        ctx.save();
        rr(artX, artY, artW, artH, 10);
        ctx.fillStyle = "rgba(7,11,24,0.55)";
        ctx.fill();
        ctx.restore();
      }
      const tx = artX + artW + 12;
      ctx.save();
      if (!unlock) ctx.globalAlpha = 0.45;
      fillText(`CHAPTER ${String(lv.id).padStart(2, "0")}`, tx, y + 20, { size: 10, color: C.cyan, weight: "600" });
      fillText(lv.name, tx, y + 44, { size: 17 });
      fillText(lv.sub, tx, y + 66, { size: 11, color: C.sub, weight: "normal" });
      const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(" ");
      fillText(`${lv.waves.length} \u6CE2 \xB7 BOSS ${bossTxt || "\u2014"}`, tx, y + 88, { size: 10, color: C.dim, weight: "normal" });
      ctx.restore();
      if (done) chip(cardX + cardW - 12, y + 18, "\u5DF2\u901A\u5173", C.green);
      else if (!unlock) chip(cardX + cardW - 12, y + 18, "\u672A\u89E3\u9501", C.dim);
      if (unlock) {
        btn({
          x: cardX + cardW - 92,
          y: y + CARD_H2 - 50,
          w: 80,
          h: 38,
          label: done ? "\u91CD\u73A9" : "\u51FA\u51FB",
          color: done ? C.green : C.cyan,
          primary: !done,
          cb: () => gotoBriefing(lv.id)
        });
        hitBox({ x: cardX, y, w: cardW - 104, h: CARD_H2, label: "", cb: () => gotoBriefing(lv.id) });
      } else {
        const lx = cardX + cardW - 52;
        const ly = y + CARD_H2 - 34;
        ctx.save();
        ctx.strokeStyle = C.dim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(lx - 9, ly - 2, 18, 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly - 2, 6, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
        hitBox({
          x: cardX,
          y,
          w: cardW,
          h: CARD_H2,
          label: "",
          cb: () => {
            showToast(`\u901A\u5173\u300C${LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
            buzz("light");
          }
        });
      }
    });
    ctx.restore();
    const fadeH = 18;
    const gf = ctx.createLinearGradient(0, homeTop, 0, homeTop + fadeH);
    gf.addColorStop(0, "rgba(8,12,26,0.9)");
    gf.addColorStop(1, "rgba(8,12,26,0)");
    ctx.fillStyle = gf;
    ctx.fillRect(0, homeTop, VW, fadeH);
    const gb = ctx.createLinearGradient(0, homeBottom - fadeH, 0, homeBottom);
    gb.addColorStop(0, "rgba(10,15,36,0)");
    gb.addColorStop(1, "rgba(10,15,36,0.9)");
    ctx.fillStyle = gb;
    ctx.fillRect(0, homeBottom - fadeH, VW, fadeH);
    const smax = totalScrollMax();
    if (smax > 0) {
      const viewH = homeBottom - homeTop;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
      const ty = homeTop + (viewH - thumbH) * (app.scroll / smax);
      ctx.save();
      ctx.fillStyle = ac(0.25);
      rr(VW - 4, ty, 3, thumbH, 1.5);
      ctx.fill();
      ctx.restore();
    }
    fillText("\u5FAE\u4FE1\u5C0F\u6E38\u620F \xB7 \u8BD5\u8FD0\u8425\u5305", VW / 2, VH - 12, { size: 10, color: "rgba(124,141,176,0.7)", align: "center" });
    if (showProfile) drawProfileOverlay();
    if (showSettings) drawSettingsOverlay();
  }
  function drawBriefing4(time) {
    hooks = [];
    const m = SKIN_MODULES[skin.id];
    if (m?.drawBriefing) {
      m.drawBriefing(env, time);
      return;
    }
    drawSpaceBg(time);
    const lv = LEVELS.find((l) => l.id === app.levelId) ?? LEVELS[0];
    drawHeader("\u4EFB\u52A1\u7B80\u62A5", { back: () => {
      stopNarration();
      goto("home");
    } });
    const bannerH = Math.min(168, Math.round(VW * 0.45));
    const bx = MARGIN;
    const bw = VW - MARGIN * 2;
    const by = TOP_SAFE + 6;
    drawCardArt(bx, by, bw, bannerH, lv.id, time, RADIUS);
    ctx.save();
    rr(bx, by, bw, bannerH, RADIUS);
    ctx.strokeStyle = C.panelLine;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const g = ctx.createLinearGradient(bx, by + bannerH * 0.4, bx, by + bannerH);
    g.addColorStop(0, "rgba(7,11,24,0)");
    g.addColorStop(1, "rgba(7,11,24,0.82)");
    rr(bx, by, bw, bannerH, RADIUS);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bannerH);
    ctx.restore();
    fillText(`\u7B2C ${lv.id} \u7AE0`, bx + 16, by + bannerH - 44, { size: 11, color: C.cyan, weight: "600" });
    fillText(lv.name, bx + 16, by + bannerH - 20, { size: 19 });
    fillText(lv.sub, bx + bw - 16, by + bannerH - 20, { size: 11, color: C.sub, align: "right", weight: "normal" });
    btn({
      x: bx + bw - 88,
      y: by + 10,
      w: 78,
      h: 30,
      label: narrationMuted ? "\u{1F507} \u65C1\u767D" : "\u{1F50A} \u65C1\u767D",
      color: narrationMuted ? C.sub : C.cyan,
      cb: toggleNarrationMuted
    });
    const textSize = 12;
    const lineH = textSize * 1.65;
    const textW = VW - MARGIN * 2 - 32;
    let totalLines = 0;
    for (const para of lv.briefing) totalLines += wrapCount(para, textW, textSize) + 0.6;
    const boxY = by + bannerH + 12;
    const boxH = Math.ceil(totalLines * lineH) + 26;
    panel(MARGIN, boxY, VW - MARGIN * 2, boxH, C.panelLine);
    let ty = boxY + 24;
    for (const para of lv.briefing) ty = wrapBlock(para, MARGIN + 16, ty, textW, { size: textSize }) + lineH * 0.6;
    const afterY = boxY + boxH + 18;
    const diffTxt = `\u96BE\u5EA6 ${DIFFICULTIES[app.difficulty].name} \xB7 ${DIFFICULTIES[app.difficulty].label}`;
    ctx.save();
    ctx.font = "bold 11px sans-serif";
    const dw = ctx.measureText(diffTxt).width + 24;
    rr(VW / 2 - dw / 2, afterY - 11, dw, 22, 11);
    ctx.fillStyle = "rgba(255,201,77,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,201,77,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    fillText(diffTxt, VW / 2, afterY + 0.5, { size: 11, color: C.gold, align: "center" });
    if (app.coop) {
      const coopTxt = "\u53CC\u4EBA\u540C\u5C4F \xB7 P1 \u5EFA\u9020 \xB7 P2 \u6307\u6325";
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      const cw = ctx.measureText(coopTxt).width + 24;
      rr(VW / 2 - cw / 2, afterY + 13, cw, 22, 11);
      ctx.fillStyle = "rgba(61,240,140,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(61,240,140,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      fillText(coopTxt, VW / 2, afterY + 24.5, { size: 11, color: C.green, align: "center" });
    }
    btn({ x: VW / 2 - 100, y: afterY + 42, w: 200, h: 54, label: "\u25B6 \u51FA \u51FB", primary: true, cb: startBattle });
    btn({ x: VW / 2 - 100, y: afterY + 118, w: 200, h: 46, label: "\u8FD4\u56DE\u9009\u5173", color: C.sub, cb: () => {
      stopNarration();
      goto("home");
    } });
    if (showSettings) drawSettingsOverlay();
  }
  var nebulaBg = new NebulaBg("assets/nebula-texture.jpg");
  var fx = null;
  var bloom = null;
  var pathPixels = [];
  var qualityHigh = readWxQualityHigh();
  var fxFrame = 0;
  var battleStartAt = 0;
  var lastSettlement = null;
  function initBattleView() {
    app.placing = null;
    app.selectedId = null;
    app.result = null;
    lastSettlement = null;
    barScroll = 0;
    fx = new FxLayer();
    bloom = new BloomLayer(W, H);
    pathPixels = app.engine.map.paths.map((p) => p.pixels);
    battleStartAt = Date.now();
    coopClearTouches();
  }
  function startBattle() {
    stopNarration();
    app.engine = createEngine(app.difficulty, app.levelId);
    initBattleView();
    track("game_start", { level_id: app.levelId, difficulty: app.difficulty, coop: app.coop ? 1 : 0 });
    goto("battle");
  }
  var online = null;
  var snapEvents = [];
  var onlineResultInfo = null;
  function getOnlineInfo() {
    if (online) return { peerNick: online.peerNick, player: online.player };
    return onlineResultInfo;
  }
  function roomHash(roomId) {
    let h = 0;
    for (const ch of roomId) h = (h + ch.charCodeAt(0)) % 1e5;
    return h;
  }
  function teardownOnline(sendLeave) {
    const sess = online;
    if (!sess) return;
    online = null;
    if (sess.snapTimer !== null) clearInterval(sess.snapTimer);
    const conn = sess.conn;
    if (conn) {
      if (sendLeave) conn.send({ t: "leave" });
      conn.close();
    }
  }
  function settleOnline(won) {
    const sess = online;
    if (app.result || !app.engine || !sess) return;
    app.result = { won };
    if (sess.player === 0 && !sess.ended) sess.conn?.send({ t: "end", won });
    sess.ended = true;
    onlineResultInfo = { peerNick: sess.peerNick, player: sess.player };
    const st0 = app.engine.state;
    const myKills = st0.killsBy?.[sess.player] ?? st0.kills;
    const gained = Math.round(calcScore({ ...st0, kills: myKills }, app.difficulty, 0, won) * 1.2);
    const grade = battleGrade(st0, won);
    lastSettlement = { score: gained, grade };
    const rankBefore = commanderRank();
    scoreProfile.points += gained;
    scoreProfile.spendable += gained;
    if (gained > scoreProfile.bestSingle) scoreProfile.bestSingle = gained;
    scoreProfile.updatedAt = Date.now();
    saveScore();
    coopClearTouches();
    syncScoreToCloud();
    track("score_gain", { score: gained, grade, level_id: 0, coop: 2 });
    track("game_end", {
      level_id: 0,
      difficulty: app.difficulty,
      result: won ? "win" : "lose",
      wave_reached: st0.wave,
      duration_sec: Math.round((Date.now() - battleStartAt) / 1e3),
      kills: myKills,
      leaks: st0.leaked,
      score: gained,
      grade,
      coop: 2
    });
    track("room_finish", { room_id: roomHash(sess.roomId), result: won ? "win" : "lose", wave: st0.wave });
    const rankAfter = commanderRank();
    if (rankAfter !== rankBefore) showToast(`\u664B\u5347 \xB7 ${rankAfter}`);
    goto("result");
  }
  function makeNetHandlers(sess) {
    return {
      onOpen: (reconnected) => {
        if (online !== sess) return;
        sess.connecting = false;
        if (reconnected) {
          showToast("\u5DF2\u91CD\u65B0\u8FDE\u63A5");
          return;
        }
        if (sess.intent.action === "create") {
          sess.conn?.send({ t: "create", nick: displayNick(), levelId: 0, difficulty: app.difficulty });
        } else {
          sess.conn?.send({ t: "join", roomId: sess.intent.roomId, nick: displayNick() });
        }
      },
      onRoom: (info2) => {
        if (online !== sess) return;
        if (sess.roomId) return;
        sess.roomId = info2.roomId;
        sess.conn?.setRejoinInfo({ roomId: info2.roomId });
        if (info2.role === "host") {
          sess.player = 0;
          track("room_create", { room_id: roomHash(info2.roomId) });
        } else {
          sess.player = 1;
          sess.peerNick = info2.hostNick ?? "";
          sess.peerReady = true;
          if (info2.difficulty === "easy" || info2.difficulty === "normal" || info2.difficulty === "hard") {
            app.difficulty = info2.difficulty;
          }
          track("room_join", { room_id: roomHash(info2.roomId) });
          showToast(`\u5DF2\u52A0\u5165 ${sess.peerNick || "\u597D\u53CB"} \u7684\u623F\u95F4`);
        }
      },
      onPeer: (nick, status) => {
        if (online !== sess) return;
        if (status === "joined") {
          sess.peerNick = nick;
          sess.peerReady = true;
          sess.peerLost = false;
          showToast(`${nick} \u52A0\u5165\u4E86\u623F\u95F4`);
          buzz("light");
        } else if (status === "lost") {
          sess.peerLost = true;
          showToast("\u5BF9\u624B\u65AD\u7EBF\uFF0C\u7B49\u5F85\u91CD\u8FDE\u2026");
        } else {
          sess.peerLost = false;
          showToast("\u5BF9\u624B\u5DF2\u91CD\u8FDE");
        }
      },
      onCmd: (player, cmd) => {
        if (online !== sess) return;
        if (sess.player === 0 && app.engine && app.screen === "battle") app.engine.dispatchAs(player, cmd);
      },
      onSnap: (netState, events) => {
        if (online !== sess || sess.player !== 1) return;
        if (!app.engine) {
          app.levelId = 0;
          const conn = sess.conn;
          app.engine = createGhostEngine(app.difficulty, 0, (cmd) => {
            conn?.send({ t: "cmd", player: 1, cmd });
          });
          initBattleView();
          sess.started = true;
          track("game_start", { level_id: 0, difficulty: app.difficulty, coop: 2 });
          goto("battle");
        }
        app.engine.applySnap(netState, events);
      },
      onEnd: (won, reason) => {
        if (online !== sess) return;
        sess.ended = true;
        if (app.result) return;
        if (app.screen === "battle" && app.engine) {
          settleOnline(won);
        } else {
          showToast(reason === "peer_left" ? "\u5BF9\u624B\u79BB\u5F00\u4E86\u623F\u95F4" : "\u623F\u95F4\u5DF2\u89E3\u6563");
          teardownOnline(false);
          goto("home");
        }
      },
      onError: (code) => {
        if (online !== sess) return;
        showToast(
          code === "room_full" ? "\u623F\u95F4\u5DF2\u6EE1" : code === "room_not_found" ? "\u623F\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u89E3\u6563" : code === "server_full" ? "\u670D\u52A1\u5668\u7E41\u5FD9\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" : "\u8054\u673A\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
        );
        if (!sess.started) teardownOnline(false);
      },
      onReconnecting: (n) => {
        if (online !== sess) return;
        sess.connecting = true;
        showToast(`\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6B63\u5728\u91CD\u8FDE\uFF08${n}/3\uFF09\u2026`);
      },
      onClose: () => {
        if (online !== sess) return;
        if (sess.started && app.screen === "battle" && app.engine) {
          if (sess.player === 0) {
            settleOnline(false);
          } else {
            showToast("\u8FDE\u63A5\u5DF2\u65AD\u5F00");
            app.engine = null;
            teardownOnline(false);
            goto("home");
          }
        } else {
          showToast("\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC");
          teardownOnline(false);
        }
      }
    };
  }
  function openOnlineSession(intent) {
    if (online) teardownOnline(false);
    const sess = {
      conn: null,
      intent,
      roomId: "",
      player: intent.action === "create" ? 0 : 1,
      peerNick: "",
      peerReady: false,
      peerLost: false,
      started: false,
      ended: false,
      connecting: true,
      snapTimer: null
    };
    online = sess;
    const conn = connectCoop(wx, { url: wsUrlFromApiBase(API_BASE), nick: displayNick() }, makeNetHandlers(sess));
    if (!conn) {
      online = null;
      showToast("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u8054\u673A");
      return false;
    }
    sess.conn = conn;
    return true;
  }
  function hostCreateRoom() {
    openOnlineSession({ action: "create" });
  }
  function joinRoom(code) {
    app.pendingRoom = null;
    openOnlineSession({ action: "join", roomId: code });
  }
  function enterLobby() {
    goto("lobby");
    if (app.pendingRoom && !online) joinRoom(app.pendingRoom);
  }
  function shareInvite(roomId) {
    track("share_click", { channel: "coop_invite" });
    try {
      wx.shareAppMessage?.({
        title: `\u6765\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u548C\u6211\u534F\u540C\u9632\u5B88\u300C\u53CC\u5B50\u661F\u95E8\u300D\uFF01\u623F\u95F4\u7801 ${roomId}`,
        imageUrl: "assets/share-cover.jpg",
        query: `room=${roomId}`
      });
    } catch {
    }
    showToast("\u5206\u4EAB\u540E\u597D\u53CB\u70B9\u5F00\u5361\u7247\u5373\u53EF\u52A0\u5165");
  }
  function startOnlineBattle() {
    const sess = online;
    if (!sess || sess.player !== 0 || !sess.peerReady || sess.started) return;
    stopNarration();
    app.levelId = 0;
    app.engine = createEngine(app.difficulty, 0, { coop: true });
    initBattleView();
    sess.started = true;
    snapEvents.length = 0;
    sess.snapTimer = setInterval(() => {
      const eng = app.engine;
      if (online !== sess || !eng || !sess.conn?.connected) return;
      sess.conn.send({ t: "snap", state: eng.serializeNet(), events: snapEvents.splice(0) });
    }, 200);
    track("game_start", { level_id: 0, difficulty: app.difficulty, coop: 2 });
    goto("battle");
  }
  function drawLobby() {
    hooks = [];
    drawSpaceBg(Date.now() / 1e3);
    drawHeader("\u5728\u7EBF\u8054\u673A \xB7 \u53CC\u5B50\u661F\u95E8", { back: () => {
      teardownOnline(true);
      goto("home");
    } });
    const sess = online;
    const px = MARGIN;
    const pw = VW - MARGIN * 2;
    let y = TOP_SAFE + 24;
    panel(px, y, pw, 96, C.panelLine);
    fillText("CO-OP ONLINE", px + 16, y + 20, { size: 10, color: C.cyan, weight: "600" });
    fillText("\u4E0E\u597D\u53CB\u5404\u5B88\u4E00\u6761\u9632\u7EBF", px + 16, y + 42, { size: 15 });
    fillText("\u5171\u4EAB\u751F\u547D \xB7 \u7ECF\u6D4E\u72EC\u7ACB \xB7 \u51FB\u6740\u5404\u8BA1 \xB7 \u7ED3\u7B97 \xD71.2", px + 16, y + 66, { size: 11, color: C.sub, weight: "normal" });
    y += 116;
    if (!sess) {
      if (app.pendingRoom) {
        btn({
          x: px,
          y,
          w: pw,
          h: 52,
          label: `\u52A0\u5165\u597D\u53CB\u7684\u623F\u95F4 ${app.pendingRoom}`,
          color: C.green,
          primary: true,
          cb: () => joinRoom(app.pendingRoom)
        });
        y += 66;
      }
      btn({ x: px, y, w: pw, h: 52, label: "\u271A \u521B\u5EFA\u623F\u95F4", color: C.cyan, primary: !app.pendingRoom, cb: hostCreateRoom });
      y += 66;
      fillText("\u5EFA\u623F\u540E\u9080\u8BF7\u597D\u53CB\uFF0C\u597D\u53CB\u70B9\u5F00\u5206\u4EAB\u5361\u7247\u5373\u53EF\u52A0\u5165", VW / 2, y + 10, { size: 11, color: C.dim, align: "center", weight: "normal" });
      return;
    }
    if (sess.player === 0) {
      panel(px, y, pw, 132, C.panelLine);
      fillText("\u623F\u95F4\u7801", px + 16, y + 22, { size: 11, color: C.sub, weight: "normal" });
      fillText(sess.roomId || "\xB7\xB7\xB7\xB7\xB7\xB7", VW / 2, y + 62, { size: 34, color: C.gold, align: "center", font: RES_FONT() });
      fillText(
        sess.connecting ? "\u8FDE\u63A5\u670D\u52A1\u5668\u4E2D\u2026" : sess.peerReady ? `${sess.peerNick} \u5DF2\u5C31\u4F4D` : "\u7B49\u5F85\u597D\u53CB\u52A0\u5165\u2026",
        VW / 2,
        y + 102,
        { size: 12, color: sess.peerReady ? C.green : C.sub, align: "center", weight: "normal" }
      );
      y += 150;
      btn({ x: px, y, w: pw, h: 46, label: "\u{1F4E3} \u9080\u8BF7\u597D\u53CB", color: C.pink, disabled: !sess.roomId, cb: () => shareInvite(sess.roomId) });
      y += 60;
      btn({
        x: px,
        y,
        w: pw,
        h: 54,
        label: "\u25B6 \u5F00\u59CB\u6218\u6597",
        color: C.green,
        primary: true,
        disabled: !sess.peerReady || sess.connecting,
        cb: startOnlineBattle
      });
      y += 68;
      fillText(`\u96BE\u5EA6 ${DIFFICULTIES[app.difficulty].name}\uFF08\u5EFA\u623F\u65F6\u9009\u5B9A\uFF09`, VW / 2, y + 8, { size: 11, color: C.dim, align: "center", weight: "normal" });
    } else {
      panel(px, y, pw, 120, C.panelLine);
      fillText(`\u5DF2\u52A0\u5165 ${sess.peerNick || "\u597D\u53CB"} \u7684\u623F\u95F4`, VW / 2, y + 32, { size: 16, align: "center" });
      fillText(`\u623F\u95F4\u7801 ${sess.roomId} \xB7 \u96BE\u5EA6 ${DIFFICULTIES[app.difficulty].name}`, VW / 2, y + 60, { size: 11, color: C.sub, align: "center", weight: "normal" });
      const dots = ".".repeat(1 + Math.floor(Date.now() / 500) % 3);
      fillText(sess.connecting ? "\u8FDE\u63A5\u670D\u52A1\u5668\u4E2D\u2026" : `\u7B49\u5F85\u4E3B\u673A\u5F00\u59CB\u6218\u6597${dots}`, VW / 2, y + 90, { size: 12, color: C.gold, align: "center", weight: "normal" });
      y += 140;
    }
    if (sess.peerLost) {
      fillText("\u26A0 \u5BF9\u624B\u65AD\u7EBF\uFF0C\u7B49\u5F85\u91CD\u8FDE\uFF0860s \u5185\uFF09\u2026", VW / 2, y + 10, { size: 12, color: C.red, align: "center" });
    }
  }
  function drawTechWaiting() {
    ctx.fillStyle = "rgba(7,11,24,0.85)";
    ctx.fillRect(0, 0, VW, VH);
    const pw2 = VW - 96;
    const ph2 = 108;
    const py2 = VH / 2 - ph2 / 2;
    panel(48, py2, pw2, ph2, C.panelLine);
    fillText("\u6218\u672F\u6A21\u5757\u6574\u5907\u4E2D", VW / 2, py2 + 34, { size: 16, align: "center" });
    const dots = ".".repeat(1 + Math.floor(Date.now() / 500) % 3);
    fillText(`\u7B49\u5F85\u4E3B\u673A\u9009\u62E9\u6218\u672F\u6A21\u5757${dots}`, VW / 2, py2 + 66, { size: 12, color: C.sub, align: "center", weight: "normal" });
  }
  function drawInviteBanner() {
    const bx = MARGIN;
    const bw = VW - MARGIN * 2;
    const by = TOP_SAFE + 4;
    panel(bx, by, bw, 64, "rgba(61,240,140,0.45)");
    fillText("\u{1F91D} \u597D\u53CB\u9080\u4F60\u8054\u673A\u534F\u4F5C", bx + 16, by + 20, { size: 13, color: C.green });
    fillText(`\u623F\u95F4\u7801 ${app.pendingRoom} \xB7 \u53CC\u5B50\u661F\u95E8`, bx + 16, by + 42, { size: 11, color: C.sub, weight: "normal" });
    btn({
      x: bx + bw - 140,
      y: by + 14,
      w: 96,
      h: 36,
      label: "\u63A5\u53D7\u9080\u8BF7",
      color: C.green,
      primary: true,
      cb: () => {
        setMode("online");
        enterLobby();
      }
    });
    btn({ x: bx + bw - 36, y: by + 14, w: 30, h: 36, label: "\u2715", color: C.sub, cb: () => {
      app.pendingRoom = null;
    } });
  }
  function drawBattle() {
    hooks = [];
    ctx.fillStyle = "#070B18";
    ctx.fillRect(0, 0, VW, VH);
    const engine = app.engine;
    const st = engine.state;
    drawBattleScene();
    const bm = SKIN_MODULES[skin.id];
    if (bm?.drawBattleHUD) {
      bm.drawBattleHUD(env, engine);
    } else {
      const hudY = TOP_SAFE;
      const hudH = 34;
      const hudX = 12;
      const hudR = Math.min(VW - 12, CAP_LEFT - 8 - GAME_CENTER_PAD);
      const hudW = hudR - hudX;
      panel(hudX, hudY, hudW, hudH, C.panelLine, 10);
      const midY = hudY + hudH / 2;
      const vDiv = (x, inset = 8) => {
        ctx.save();
        ctx.strokeStyle = ac(0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, hudY + inset);
        ctx.lineTo(x + 0.5, hudY + hudH - inset);
        ctx.stroke();
        ctx.restore();
      };
      const segW = 30;
      const btnX0 = hudR - segW * 3;
      const segBtns = [
        [st.paused ? "\u25B6" : "\u23F8", C.text, () => engineCmd({ type: "TOGGLE_PAUSE" })],
        [st.speed === 2 ? "2x" : "1x", st.speed === 2 ? C.gold : C.text, () => engineCmd({ type: "SET_SPEED", speed: st.speed === 2 ? 1 : 2 })],
        ["\u2261", C.text, () => {
          app.engine = null;
          goto("home");
        }]
      ];
      segBtns.forEach(([label, color, cb], i) => {
        fillText(label, btnX0 + i * segW + segW / 2, midY, { size: 12, color, align: "center", font: RES_FONT() });
        if (i > 0) vDiv(btnX0 + i * segW, 10);
        hitBox({ x: btnX0 + i * segW, y: hudY, w: segW, h: hudH, label: "", cb });
      });
      vDiv(btnX0 - 8);
      const livesTxt = `\u2764 ${st.lives}`;
      const goldTxt = `\u25C8 ${st.gold}`;
      const waveTxt = `${st.wave}/${st.totalWaves}`;
      ctx.save();
      ctx.font = `bold 12px ${RES_FONT()}`;
      const livesW = ctx.measureText(livesTxt).width;
      const goldW = ctx.measureText(goldTxt).width;
      const waveW = ctx.measureText(waveTxt).width;
      ctx.restore();
      const blinkOff = st.lives <= 5 && Math.floor(Date.now() / 400) % 2 === 1;
      let cx = hudX + 12;
      fillText(livesTxt, cx, midY, { size: 12, color: blinkOff ? "rgba(255,61,90,0.35)" : C.red, font: RES_FONT() });
      cx += livesW + 8;
      vDiv(cx);
      cx += 8;
      fillText(goldTxt, cx, midY, { size: 12, color: C.gold, font: RES_FONT() });
      cx += goldW + 8;
      vDiv(cx);
      cx += 8;
      const waveCx = Math.min(cx + (btnX0 - 16 - cx) / 2, btnX0 - 16 - waveW / 2);
      fillText(waveTxt, waveCx, midY - 2, { size: 12, color: C.cyan, align: "center", font: RES_FONT() });
      const progW = waveW + 10;
      const progX = waveCx - progW / 2;
      const progY = hudY + hudH - 5;
      ctx.save();
      ctx.fillStyle = ac(0.18);
      ctx.fillRect(progX, progY, progW, 2);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(progX, progY, progW * Math.min(1, st.wave / st.totalWaves), 2);
      ctx.restore();
      if (st.phase === "prep") {
        const by2 = hudY + hudH + 8;
        panel(VW / 2 - 118, by2, 236, 56, C.panelLine, 19);
        fillText(`\u7B2C ${st.wave} \u6CE2 \xB7 ${Math.max(0, Math.ceil(st.prepT))}s \u540E\u6765\u88AD`, VW / 2, by2 + 15, { size: 13, align: "center", font: RES_FONT() });
        const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
        const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
        const summary = [...new Set(groups.map((g) => `${ENEMIES[g.type].name}\xD7${g.count}`))].join(" ");
        const cCol = isBossWave ? C.pink : "#FF9F43";
        fillText(`${isBossWave ? "\u26A0 BOSS \u6CE2 \xB7 " : ""}${summary}`, VW / 2, by2 + 34, { size: 9, color: isBossWave ? C.pink : "#FF9F43", align: "center", weight: "normal" });
        fillText(
          app.coop ? "P1 \u5EFA\u9020\u9632\u7EBF \xB7 P2 \u628A\u63E1\u5347\u7EA7\u4E0E\u79D1\u6280\u65F6\u673A" : isBossWave ? "\u5EFA\u8BAE\u7559\u597D\u91D1\u5E01\u4E0E\u7A7F\u7532\u706B\u529B" : "\u636E\u6B64\u63D0\u524D\u8C03\u6574\u5E03\u9632",
          VW / 2,
          by2 + 47,
          { size: 9, color: C.sub, align: "center", weight: "normal" }
        );
        btn({ x: VW / 2 - 62, y: by2 + 66, w: 124, h: 36, label: "\u25B6 \u7ACB\u5373\u5F00\u6218", color: C.gold, primary: true, cb: () => engineCmd({ type: "SKIP_PREP" }) });
      }
    }
    if (bm?.drawBottomBar) bm.drawBottomBar(env, engine);
    else drawBottomBar4(st);
    if (barTouch?.mode === "drag" && dragPos && barTouch.type) {
      if (bm?.drawDragGhost) bm.drawDragGhost(env, engine, barTouch.type, dragPos);
      else drawDragGhost3(st, barTouch.type, dragPos);
    }
    if (app.coop) {
      for (const [tid, bt] of coopBar) {
        if (bt.mode !== "drag" || !bt.type) continue;
        const dp = coopDrag.get(tid);
        if (!dp) continue;
        if (bm?.drawDragGhost) bm.drawDragGhost(env, engine, bt.type, dp);
        else drawDragGhost3(st, bt.type, dp);
      }
    }
    if (st.paused) {
      ctx.fillStyle = "rgba(7,11,24,0.6)";
      ctx.fillRect(0, 0, VW, VH);
      const pw2 = 220;
      const ph2 = 84;
      const px2 = VW / 2 - pw2 / 2;
      const py2 = (VH - BAR_H) / 2 - ph2 / 2;
      panel(px2, py2, pw2, ph2, "rgba(255,201,77,0.5)");
      fillText("\u5DF2\u6682\u505C", VW / 2, py2 + 32, { size: 16, color: C.gold, align: "center" });
      fillText("\u70B9\u51FB \u25B6 \u7EE7\u7EED\u6218\u6597", VW / 2, py2 + 58, { size: 12, color: C.sub, align: "center", weight: "normal" });
    }
    const lt = (Date.now() - leakFlashAt) / 550;
    if (lt < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - lt) * 0.45;
      const rg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      rg.addColorStop(0, "rgba(255,61,90,0)");
      rg.addColorStop(1, "rgba(255,61,90,0.55)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
    if (st.phase === "tech" && st.techChoices) {
      if (!techShownAt) techShownAt = Date.now();
      if (online?.started && online.player === 1) drawTechWaiting();
      else if (bm?.drawTechOverlay) bm.drawTechOverlay(env, engine);
      else drawTechOverlay4(st);
    } else {
      techShownAt = 0;
    }
    if (online?.peerLost) {
      panel(40, VH * 0.16, VW - 80, 40, "rgba(255,90,90,0.5)");
      fillText("\u26A0 \u5BF9\u624B\u65AD\u7EBF\uFF0C\u7B49\u5F85\u91CD\u8FDE\uFF0860s \u5185\uFF09\u2026", VW / 2, VH * 0.16 + 20, { size: 12, color: C.red, align: "center" });
    }
    if (showSettings) drawSettingsOverlay();
  }
  function drawDragGhost3(st, type, p) {
    const engine = app.engine;
    const def = TOWERS[type];
    const gx = Math.floor(toMapX(p.x) / CELL);
    const gy = Math.floor(toMapY(p.y) / CELL);
    const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
    const canBuild = inMap && engine.map.isBuildable(gx, gy) && !st.towers.some((tw) => tw.col === gx && tw.row === gy) && st.gold >= def.levels[0].cost;
    if (inMap) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
      ctx.clip();
      const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
      ctx.translate(mapOX + (Math.random() - 0.5) * shk * 2, mapOY + mapPan + (Math.random() - 0.5) * shk);
      ctx.scale(mapScale, mapScale);
      const cx = gx * CELL;
      const cy = gy * CELL;
      ctx.fillStyle = canBuild ? "rgba(61,240,140,0.22)" : "rgba(255,90,90,0.20)";
      ctx.strokeStyle = canBuild ? C.green : C.red;
      ctx.lineWidth = 2;
      ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
      ctx.strokeRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
      if (canBuild) {
        ctx.strokeStyle = `${def.color}55`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(cx + CELL / 2, cy + CELL / 2);
        drawTower(ctx, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
        ctx.restore();
      }
      ctx.restore();
    }
    fillText(
      canBuild ? "\u677E\u624B\u5EFA\u9020" : inMap ? "\u6B64\u5904\u4E0D\u53EF\u5EFA\u9020" : "\u62D6\u5230\u5730\u56FE\u7A7A\u683C\u4E0A",
      VW / 2,
      VH - BAR_H - 18,
      { size: 12, color: canBuild ? C.green : C.sub, align: "center" }
    );
  }
  function drawBottomBar4(st) {
    ctx.fillStyle = "#0A0F20";
    ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
    ctx.strokeStyle = ac(0.22);
    ctx.beginPath();
    ctx.moveTo(0, VH - BAR_H + 0.5);
    ctx.lineTo(VW, VH - BAR_H + 0.5);
    ctx.stroke();
    if (st.phase === "tech") return;
    const sel = app.selectedId != null ? st.towers.find((t) => t.id === app.selectedId) : void 0;
    if (sel) {
      const def = TOWERS[sel.type];
      fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 17, { size: 13, color: def.color });
      const upCost = sel.level < 2 ? TOWERS[sel.type].levels[sel.level + 1].cost : -1;
      btn({
        x: MARGIN,
        y: VH - BAR_H + 34,
        w: VW / 2 - MARGIN - 6,
        h: 46,
        label: upCost >= 0 ? `\u5347\u7EA7 \u25C8 ${upCost}` : "\u5DF2\u6EE1\u7EA7",
        disabled: upCost < 0 || st.gold < upCost,
        color: C.green,
        primary: upCost >= 0 && st.gold >= upCost,
        cb: () => {
          if (engineCmd({ type: "UPGRADE", id: sel.id })) {
            sfx.play("upgrade");
            buzz("light");
          }
        }
      });
      const refund = Math.floor(sel.invested * SELL_RATE);
      btn({
        x: VW / 2 + 6,
        y: VH - BAR_H + 34,
        w: VW / 2 - MARGIN - 6,
        h: 46,
        label: `\u51FA\u552E +${refund}`,
        color: "#FF9F43",
        cb: () => {
          if (engineCmd({ type: "SELL", id: sel.id })) sfx.play("sell");
          app.selectedId = null;
        }
      });
      return;
    }
    if (app.placing) {
      const def = TOWERS[app.placing];
      fillText(`\u70B9\u51FB\u5730\u56FE\u4E0A\u7EFF\u8272\u683C\u5EFA\u9020\u300C${def.name}\u300D`, VW / 2, VH - BAR_H + 19, { size: 13, color: def.color, align: "center" });
      btn({ x: VW / 2 - 76, y: VH - BAR_H + 38, w: 152, h: 42, label: "\u53D6\u6D88\u653E\u7F6E", cb: () => {
        app.placing = null;
      } });
      return;
    }
    const sw = SLOT_W;
    const slotH = BAR_H - 24;
    const viewX = MARGIN;
    const viewW = VW - MARGIN * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewX - 4, VH - BAR_H + 4, viewW + 8, BAR_H - 8);
    ctx.clip();
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const cost = def.levels[0].cost;
      const locked = !towerUnlocked(type);
      const bx = viewX + i * (sw + SLOT_GAP) - barScroll;
      const by = VH - BAR_H + 12;
      if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
      const disabled = locked || st.gold < cost;
      ctx.save();
      ctx.globalAlpha = disabled ? 0.55 : 1;
      rr(bx, by, sw, slotH, 12);
      const g = ctx.createLinearGradient(bx, by, bx, by + slotH);
      g.addColorStop(0, "rgba(28,40,76,0.96)");
      g.addColorStop(1, "rgba(16,24,48,0.96)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = disabled ? "rgba(124,141,176,0.4)" : `${def.color}AA`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.translate(bx + sw / 2, by + 27);
      drawTower(ctx, type, 0, 38, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
      ctx.restore();
      fillText(`\u25C8${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? "#C77A34" : C.gold, align: "center" });
      if (locked) {
        ctx.save();
        rr(bx, by, sw, slotH, 12);
        ctx.fillStyle = "rgba(7,11,24,0.55)";
        ctx.fill();
        ctx.strokeStyle = C.sub;
        ctx.lineWidth = 1.6;
        const lx = bx + sw / 2;
        const ly = by + 27;
        ctx.beginPath();
        ctx.rect(lx - 7, ly - 1, 14, 11);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly - 1, 5, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
        fillText(`\u7B2C${TOWER_UNLOCK[type]}\u7AE0`, bx + sw / 2, by + 54, { size: 10, color: C.sub, align: "center" });
      }
    });
    ctx.restore();
    if (stripMaxScroll > 0) {
      if (barScroll > 0) {
        const gl = ctx.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
        gl.addColorStop(0, "rgba(10,15,32,0.95)");
        gl.addColorStop(1, "rgba(10,15,32,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(viewX - 4, VH - BAR_H + 4, 22, BAR_H - 8);
      }
      if (barScroll < stripMaxScroll) {
        const gr = ctx.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
        gr.addColorStop(0, "rgba(10,15,32,0)");
        gr.addColorStop(1, "rgba(10,15,32,0.95)");
        ctx.fillStyle = gr;
        ctx.fillRect(viewX + viewW - 18, VH - BAR_H + 4, 22, BAR_H - 8);
      }
    }
  }
  function drawTechOverlay4(st) {
    ctx.fillStyle = "rgba(7,11,24,0.92)";
    ctx.fillRect(0, 0, VW, VH);
    fillText("TACTICAL MODULE", VW / 2, TOP_SAFE + 12, { size: 11, color: C.cyan, align: "center", weight: "600" });
    fillText(`\u7B2C ${st.wave} \u6CE2\u524D \xB7 \u9009\u62E9\u6218\u672F\u6A21\u5757`, VW / 2, TOP_SAFE + 42, { size: 19, align: "center" });
    fillText(`\u4E09\u9009\u4E00 \xB7 \u540C\u540D\u53EF\u53E0\u52A0 \xB7 \u5DF2\u88C5 ${st.techs.length}`, VW / 2, TOP_SAFE + 66, { size: 11, color: C.sub, align: "center", weight: "normal" });
    const taken = {};
    for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
    const cardH = 128;
    const top = TOP_SAFE + 92;
    st.techChoices.forEach((id, i) => {
      const y = top + i * (cardH + 16);
      const def = TECHS[id];
      const at = (Date.now() - techShownAt) / 1e3 - i * 0.09;
      const ease = Math.min(1, Math.max(0, at / 0.3));
      const eo = 1 - (1 - ease) ** 3;
      ctx.save();
      ctx.globalAlpha = eo;
      ctx.translate(0, (1 - eo) * 26);
      panel(MARGIN, y, VW - MARGIN * 2, cardH, `${def.color}55`);
      ctx.save();
      rr(MARGIN + 16, y + (cardH - 64) / 2, 64, 64, 12);
      ctx.fillStyle = `${def.color}1A`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}88`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      fillText(def.glyph, MARGIN + 48, y + cardH / 2, { size: 30, color: def.color, align: "center" });
      const tx = MARGIN + 96;
      const textW = VW - MARGIN * 2 - 96 - 16;
      const descLines = wrapCount(def.desc, textW, 12);
      const blockH = 24 + descLines * 12 * 1.65;
      const ty0 = y + cardH / 2 - blockH / 2;
      fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
      if (taken[id]) chip(MARGIN + (VW - MARGIN * 2) - 12, y + 22, `\u5DF2\u88C5\xD7${taken[id]}`, def.color);
      wrapBlock(def.desc, tx, ty0 + 34, textW, { color: "rgba(141,160,198,1)", size: 12 });
      ctx.restore();
      hitBox({ x: MARGIN, y, w: VW - MARGIN * 2, h: cardH, label: "", cb: () => {
        if (engineCmd({ type: "PICK_TECH", id })) sfx.play("tech");
      } });
    });
  }
  function drawResult4(time) {
    hooks = [];
    const m = SKIN_MODULES[skin.id];
    if (m?.drawResult) {
      m.drawResult(env, time);
      return;
    }
    drawSpaceBg(time);
    const won = app.result.won;
    const st = app.engine.state;
    const oi = getOnlineInfo();
    const t = (Date.now() - screenAt) / 1e3;
    if (won && t < 3) {
      const r0 = rng(99);
      for (let i = 0; i < 56; i++) {
        const x0 = r0() * VW;
        const delay = r0() * 0.6;
        const vy = 130 + r0() * 170;
        const vx = (r0() - 0.5) * 70;
        const size = 3 + r0() * 4;
        const rot = r0() * Math.PI;
        const spin = (r0() - 0.5) * 9;
        const color = [C.cyan, C.gold, C.green, C.pink][Math.floor(r0() * 4)];
        const t2 = t - delay;
        if (t2 <= 0) continue;
        ctx.save();
        ctx.globalAlpha = t2 > 2.4 ? Math.max(0, (3 - t2) / 0.6) : 1;
        ctx.translate(x0 + vx * t2, -12 + vy * t2 + 60 * t2 * t2);
        ctx.rotate(rot + spin * t2);
        ctx.fillStyle = color;
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.62);
        ctx.restore();
      }
    }
    if (!won) {
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.08 * Math.sin(time * 2);
      const rg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
      rg.addColorStop(0, "rgba(255,61,90,0)");
      rg.addColorStop(1, "rgba(255,61,90,0.5)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
    drawHeader(app.coop || oi ? "\u534F\u540C\u4F5C\u6218\u7ED3\u7B97" : "\u6218\u6597\u7ED3\u7B97", { back: () => goto("home") });
    const y0 = TOP_SAFE + 16;
    const bt = Math.min(1, t / 0.45);
    const bounce = 1 + 2.7 * (bt - 1) ** 3 + 1.7 * (bt - 1) ** 2;
    ctx.save();
    ctx.translate(VW / 2, y0);
    ctx.scale(bounce, bounce);
    fillText(won ? "\u2605 \u9632\u7EBF\u5B88\u4F4F\u4E86" : "\u2715 \u9632\u7EBF\u5931\u5B88", 0, 0, { size: 26, color: won ? C.green : C.pink, align: "center" });
    ctx.restore();
    fillText(
      won ? oi ? "\u5728\u7EBF\u534F\u540C \xB7 \u53CC\u5B50\u661F\u95E8" : `\u7B2C ${app.levelId} \u7AE0 \xB7 ${LEVELS.find((l) => l.id === app.levelId)?.name ?? ""}` : `\u6491\u5230\u4E86\u7B2C ${st.wave} / ${st.totalWaves} \u6CE2`,
      VW / 2,
      y0 + 32,
      { size: 13, color: C.sub, align: "center", weight: "normal" }
    );
    const gained = lastSettlement ? lastSettlement.score : calcScore(st, app.difficulty, app.levelId, won);
    const myKills = oi ? st.killsBy?.[oi.player] ?? st.kills : st.kills;
    const rows = [
      ["\u51FB\u6740", String(myKills), myKills],
      ["\u6F0F\u602A", String(st.leaked), st.leaked],
      ["\u5269\u4F59\u751F\u547D", `${st.lives} / ${st.maxLives}`, null],
      ["\u8D5A\u53D6\u91D1\u5E01", String(st.goldEarned), st.goldEarned],
      ["\u6218\u672F\u6A21\u5757", String(st.techs.length), st.techs.length],
      ["\u79EF\u5206", `+${gained}`, gained, C.gold, true]
    ];
    if (oi) rows.splice(1, 0, ["\u5728\u7EBF\u534F\u540C", `\u961F\u53CB ${oi.peerNick || "\u2014"}`, null, C.cyan]);
    const px = 24;
    const pw = VW - 48;
    const py = y0 + 58;
    const rowH = 36;
    panel(px, py, pw, rows.length * rowH + 20, C.panelLine);
    rows.forEach(([k, v, num, color, plus], i) => {
      const ry = py + 28 + i * rowH;
      fillText(k, px + 22, ry, { size: 13, color: color ?? C.sub, weight: "normal" });
      const shown = num === null ? v : `${plus ? "+" : ""}${Math.round(num * Math.min(1, Math.max(0, (t - 0.25 - i * 0.12) / 0.6)))}`;
      fillText(shown, px + pw - 22, ry, { size: 16, align: "right", font: RES_FONT(), color });
      if (i < rows.length - 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(124,141,176,0.12)";
        ctx.beginPath();
        ctx.moveTo(px + 22, ry + rowH / 2);
        ctx.lineTo(px + pw - 22, ry + rowH / 2);
        ctx.stroke();
        ctx.restore();
      }
    });
    const grade = battleGrade(st, won);
    const gradeColor = grade === "S" ? C.gold : grade === "A" ? C.green : grade === "B" ? C.cyan : C.pink;
    const gx = px + 40;
    const gy3 = py + rows.length * rowH + 40;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.9) / 0.35));
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gx, gy3 + 10, 26, 0, Math.PI * 2);
    ctx.stroke();
    fillText(grade, gx, gy3 + 8, { size: 30, color: gradeColor, align: "center", font: RES_FONT() });
    fillText(["\u5B8C\u7F8E\u9632\u7EBF", "\u9632\u5B88\u597D\u624B", "\u5B88\u4F4F\u9632\u7EBF", "\u9632\u7EBF\u5931\u5B88"][["S", "A", "B", "D"].indexOf(grade)], gx + 44, gy3 - 4, { size: 15, color: gradeColor });
    fillText(won ? oi ? "\u534F\u540C\u52A0\u6210 \xD71.2 \u5DF2\u5165\u8D26" : "\u4E0B\u4E00\u7AE0\u89E3\u9501\u5DF2\u8BB0\u5F55" : "\u518D\u6311\u6218\u4E00\u6B21\u5C31\u80FD\u901A\u8FC7", gx + 44, gy3 + 18, { size: 10, color: C.sub, align: "center", weight: "normal" });
    const rp = rankProgress();
    fillText(
      rp.next === null ? `${rp.name} \xB7 \u5DF2\u8FBE\u6700\u9AD8\u519B\u8854` : `${rp.name} \xB7 \u8DDD\u300C${rp.nextName}\u300D\u8FD8\u5DEE ${(rp.next - rp.points).toLocaleString("en-US")} \u5206`,
      gx + 44,
      gy3 + 34,
      { size: 10, color: C.gold, align: "center", weight: "normal" }
    );
    ctx.restore();
    let y = py + rows.length * rowH + 40;
    const nextId = app.levelId + 1;
    const hasNext = !oi && LEVELS.some((l) => l.id === nextId);
    if (won) {
      btn({ x: px, y, w: pw, h: 50, label: "\u25C8 \u53CC\u500D\u6218\u5229 \xB7 \u89C2\u770B\u89C6\u9891", color: C.gold, cb: () => {
        showToast("\u5E7F\u544A\u6A21\u5757\u5F00\u53D1\u4E2D");
      } });
      y += 62;
    }
    if (won && hasNext) {
      btn({ x: px, y, w: pw, h: 54, label: `\u25B6 \u8FDB\u5165\u7B2C ${nextId} \u7AE0`, color: C.green, primary: true, cb: () => gotoBriefing(nextId) });
      y += 68;
    }
    btn({
      x: px,
      y,
      w: pw,
      h: 46,
      label: "\u{1F4E3} \u70AB\u8000\u6218\u7EE9",
      color: C.pink,
      cb: () => {
        track("share_click", { channel: "result", result: won ? "win" : "lose", wave: st.wave });
        try {
          wx.shareAppMessage?.({
            title: won ? `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u5B88\u4F4F\u4E86\u7B2C ${app.levelId} \u5173 \xB7 \u5168 ${st.totalWaves} \u6CE2\uFF0C\u6F0F\u602A ${st.leaked}\uFF01` : `\u6211\u5728\u300A\u9AD8\u5854\u9632\u7EBF\u300B\u7B2C ${app.levelId} \u5173\u6491\u5230\u4E86\u7B2C ${st.wave} \u6CE2\uFF0C\u6C42\u652F\u63F4\uFF01`,
            imageUrl: "assets/share-cover.jpg"
          });
        } catch {
        }
      }
    });
    y += 58;
    btn({ x: px, y, w: (pw - 12) / 2, h: 46, label: won ? "\u518D\u6765\u4E00\u5C40" : "\u518D\u6218\u672C\u5173", color: C.gold, cb: () => gotoBriefing(app.levelId) });
    btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 46, label: "\u8FD4\u56DE\u9009\u5173", cb: () => goto("home") });
    if (showSettings) drawSettingsOverlay();
  }
  function drawBattleScene() {
    const engine = app.engine;
    const st = engine.state;
    const time = st.clock;
    if (++fxFrame % 30 === 0) qualityHigh = readWxQualityHigh();
    const bloomOn = bloom !== null && bloom.hwOk && qualityHigh;
    let shakeX = 0;
    let shakeY = 0;
    if (st.shake > 0) {
      const m = st.shake * 6;
      shakeX = (Math.random() - 0.5) * m;
      shakeY = (Math.random() - 0.5) * m;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
    ctx.clip();
    ctx.fillStyle = "#070B18";
    ctx.fillRect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
    ctx.save();
    ctx.translate(mapOX + shakeX * mapScale, mapOY + mapPan + shakeY * mapScale);
    ctx.scale(mapScale, mapScale);
    drawMapBackground(ctx, W, H, nebulaBg.img);
    drawStarfield(ctx, W, H, time);
    drawVignette(ctx, W, H);
    for (const ex of engine.map.exits) drawBaseGlow(ctx, ex.centerX, ex.centerY, time);
    ctx.save();
    ctx.fillStyle = "#A9C7FF";
    for (let i = 0; i < 26; i++) {
      const sx = (hash01(i * 3 + 1) * W + time * (2 + hash01(i + 40) * 6)) % W;
      const sy = (hash01(i * 7 + 2) * H + Math.sin(time * 0.15 + i * 1.7) * 14 + H) % H;
      const sr = 0.6 + hash01(i * 5 + 3) * 1.1;
      ctx.globalAlpha = 0.04 + 0.09 * (0.5 + 0.5 * Math.sin(time * 0.7 + i * 2.3));
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const pts of engine.level.paths) {
      ctx.beginPath();
      pts.forEach(([c, r], i) => {
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(34,224,255,0.10)";
      ctx.lineWidth = CELL * 0.92;
      ctx.stroke();
      ctx.strokeStyle = "rgba(34,224,255,0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -time * 30;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    drawPath(ctx, engine.level.paths, time);
    fx?.drawScorches(ctx);
    for (const ex of engine.map.exits) drawBase(ctx, time, st.lives / st.maxLives, ex.centerX, ex.centerY);
    if (app.placing) {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (!engine.map.isBuildable(c, r)) continue;
          if (st.towers.some((tw) => tw.col === c && tw.row === r)) continue;
          ctx.fillStyle = "rgba(61,240,140,0.10)";
          ctx.strokeStyle = "rgba(61,240,140,0.35)";
          ctx.fillRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
          ctx.strokeRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
        }
      }
    }
    for (const z of st.zones) {
      ctx.fillStyle = "rgba(255,107,61,0.18)";
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of st.enemies) {
      const p = engine.map.posAt(e.path, e.dist);
      const invisible = e.type === "lurker" && e.stealthT % 4 >= 3;
      ctx.save();
      ctx.translate(p.x, p.y);
      const ahead = engine.map.posAt(e.path, e.dist + 10);
      ctx.rotate(Math.atan2(ahead.y - p.y, ahead.x - p.x));
      drawEnemy(ctx, e.type, ENEMIES[e.type].size, time, {
        alpha: invisible ? 0.12 : 1,
        enraged: e.enraged,
        slowed: st.clock < e.slowUntil
      });
      ctx.restore();
      if (!invisible && e.hp > 0 && e.hp < e.maxHp) {
        const bw = e.isBoss ? 66 : 30;
        const ratio = e.hp / e.maxHp;
        ctx.fillStyle = "rgba(7,11,24,0.85)";
        ctx.fillRect(p.x - bw / 2, p.y - ENEMIES[e.type].size - 12, bw, 5);
        ctx.fillStyle = e.isBoss ? "#FF3D81" : ratio > 0.5 ? "#3DF08C" : "#FF5A5A";
        ctx.fillRect(p.x - bw / 2, p.y - ENEMIES[e.type].size - 12, bw * ratio, 5);
      }
    }
    for (const t of st.towers) {
      const c = { x: (t.col + 0.5) * CELL, y: (t.row + 0.5) * CELL };
      const def = TOWERS[t.type];
      const lv = TOWERS[t.type].levels[t.level];
      if (app.selectedId === t.id) {
        ctx.save();
        ctx.strokeStyle = `${def.color}55`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, lv.range * CELL, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(c.x, c.y);
      drawTower(ctx, t.type, t.level, CELL * 0.92, Math.atan2(t.aimY - c.y, t.aimX - c.x) + Math.PI / 2, t.charging ? 1 - t.chargeT / (TOWERS[t.type].charge ?? 1) : 0, time);
      ctx.restore();
      if (t.level > 0) {
        for (let i = 0; i <= t.level; i++) {
          ctx.fillStyle = "#FFC94D";
          ctx.beginPath();
          ctx.arc(c.x + 10 + i * 8, c.y - CELL * 0.38, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    fx?.drawTrails(ctx);
    for (const pr of st.projectiles) {
      ctx.save();
      ctx.fillStyle = pr.kind === "plasma" ? "#FF6B3D" : "#FF9F43";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.kind === "plasma" ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const b of st.beams) {
      const a = Math.max(0, b.ttl / b.maxTtl);
      const isRail = b.color === "#8B5CF6";
      const isLaser = b.color.startsWith("#22E0FF");
      const jx = (Math.random() - 0.5) * 2;
      const jy = (Math.random() - 0.5) * 2;
      if (isRail) {
        ctx.save();
        ctx.globalAlpha = a * 0.35;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * 2.4;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(b.x1 + jx, b.y1 + jy);
        ctx.lineTo(b.x2 + jx, b.y2 + jy);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#F4F0FF";
        ctx.lineWidth = Math.max(1.5, b.width * 0.4);
        ctx.beginPath();
        ctx.moveTo(b.x1 + jx, b.y1 + jy);
        ctx.lineTo(b.x2 + jx, b.y2 + jy);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * (0.5 + a * 0.5);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(b.x1 + jx, b.y1 + jy);
        ctx.lineTo(b.x2 + jx, b.y2 + jy);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a * 0.9;
      const gr = (8 + b.width * 1.5) * (isRail ? 1.9 : 1);
      const bg = ctx.createRadialGradient(b.x2, b.y2, 0, b.x2, b.y2, gr);
      bg.addColorStop(0, "#FFFFFF");
      bg.addColorStop(0.35, b.color);
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(b.x2, b.y2, gr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isLaser) fx?.spawnSparks(b.x2, b.y2, "#BDF3FF", SPARKS_PER_HIT);
    }
    for (const r of st.rings) {
      ctx.save();
      ctx.globalAlpha = r.ttl / r.maxTtl * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5;
      const t = 1 - r.ttl / r.maxTtl;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const pt of st.particles) {
      ctx.save();
      ctx.globalAlpha = pt.ttl / pt.maxTtl;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    fx?.drawRings(ctx);
    fx?.drawDebris(ctx);
    fx?.drawSparks(ctx);
    fx?.drawFlashes(ctx);
    for (const f of st.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.ttl / 0.2);
      fillText(f.text, f.x, f.y, { size: 14, color: f.color, align: "center" });
      ctx.restore();
    }
    fx?.update(st, engine.map);
    if (bloomOn && fx) {
      const g = bloom.begin(shakeX, shakeY);
      fx.drawGlow(g, st, pathPixels, engine.map.exits);
      bloom.composite(
        ctx,
        W,
        H,
        DPR,
        (mapOX + shakeX * mapScale) * DPR,
        (mapOY + mapPan + shakeY * mapScale) * DPR,
        W * mapScale * DPR,
        H * mapScale * DPR
      );
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.translate(mapOX + shakeX * mapScale, mapOY + mapPan + shakeY * mapScale);
      ctx.scale(mapScale, mapScale);
    }
    fx?.drawBossFlash(ctx, W, H);
    ctx.restore();
    ctx.restore();
  }
  var CODEX_TABS = [["story", "\u6545\u4E8B"], ["towers", "\u70AE\u5854"], ["enemies", "\u602A\u7269"]];
  function drawCodex4(time) {
    hooks = [];
    const m = SKIN_MODULES[skin.id];
    if (m?.drawCodex) {
      m.drawCodex(env, time);
      return;
    }
    drawSpaceBg(time);
    drawHeader("\u6307\u6325\u5B98\u56FE\u9274", { back: () => goto("home") });
    const segY = TOP_SAFE + 6;
    const segW = VW - MARGIN * 2;
    segControl(
      MARGIN,
      segY,
      segW,
      CODEX_TABS.map((t) => t[1]),
      CODEX_TABS.findIndex((t) => t[0] === codex.tab),
      "codex",
      (i) => {
        codex.tab = CODEX_TABS[i][0];
        codex.scroll = 0;
      }
    );
    const top = segY + 46;
    const bottom = VH - 22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, VW, bottom - top);
    ctx.clip();
    const y0 = top + 8 - codex.scroll;
    let endY;
    if (codex.tab === "story") endY = drawCodexStory(y0, time, top, bottom);
    else if (codex.tab === "towers") endY = drawCodexTowers(y0, time, top, bottom);
    else endY = drawCodexEnemies(y0, time, top, bottom);
    ctx.restore();
    codexMaxScroll2 = Math.max(0, endY - y0 - (bottom - top) + 20);
    codex.scroll = Math.max(0, Math.min(codexMaxScroll2, codex.scroll));
    const fadeH = 16;
    const gf = ctx.createLinearGradient(0, top, 0, top + fadeH);
    gf.addColorStop(0, "rgba(8,12,26,0.9)");
    gf.addColorStop(1, "rgba(8,12,26,0)");
    ctx.fillStyle = gf;
    ctx.fillRect(0, top, VW, fadeH);
    const gb = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
    gb.addColorStop(0, "rgba(10,15,36,0)");
    gb.addColorStop(1, "rgba(10,15,36,0.9)");
    ctx.fillStyle = gb;
    ctx.fillRect(0, bottom - fadeH, VW, fadeH);
    if (codexMaxScroll2 > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMaxScroll2)));
      const ty = top + (viewH - thumbH) * (codex.scroll / codexMaxScroll2);
      ctx.save();
      ctx.fillStyle = ac(0.25);
      rr(VW - 4, ty, 3, thumbH, 1.5);
      ctx.fill();
      ctx.restore();
    }
    if (showProfile) drawProfileOverlay();
    if (showSettings) drawSettingsOverlay();
  }
  function drawCodexStory(y0, time, top, bottom) {
    const x = MARGIN;
    const w = VW - MARGIN * 2;
    const textSize = 12;
    const textW = w - 32;
    let totalLines = 0;
    for (const p of STORY_PARAS) totalLines += wrapCount(p, textW, textSize) + 0.6;
    const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
    panel(x, y0, w, boxH, C.panelLine);
    fillText("\u4E16\u754C\u89C2\u6863\u6848", x + 16, y0 + 20, { size: 13, color: C.cyan });
    let ty = y0 + 44;
    for (const p of STORY_PARAS) ty = wrapBlock(p, x + 16, ty, textW, { size: textSize }) + textSize * 1.65 * 0.6;
    let y = y0 + boxH + 20;
    fillText("\u6218\u5F79\u7F16\u5E74\u53F2", x + 4, y + 8, { size: 14 });
    fillText("\u70B9\u51FB\u5DF2\u89E3\u9501\u7AE0\u8282\u76F4\u63A5\u51FA\u51FB", x + w - 4, y + 9, { size: 10, color: C.dim, align: "right", weight: "normal" });
    y += 28;
    const cleared = loadProgress().cleared;
    LEVELS.forEach((lv, i) => {
      const unlock = i === 0 || cleared.includes(LEVELS[i - 1].id);
      const done = cleared.includes(lv.id);
      const rowH = 60;
      if (y + rowH > top && y < bottom) {
        panel(x, y, w, rowH, unlock ? C.panelLine : "rgba(124,141,176,0.15)", 12);
        drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
        const tx = x + 94;
        ctx.save();
        if (!unlock) ctx.globalAlpha = 0.45;
        fillText(`CHAPTER ${String(lv.id).padStart(2, "0")}`, tx, y + 18, { size: 9, color: C.cyan, weight: "600" });
        fillText(lv.name, tx, y + 36, { size: 14 });
        fillText(lv.sub, tx, y + 52, { size: 10, color: C.sub, weight: "normal" });
        ctx.restore();
        if (done) chip(x + w - 12, y + 16, "\u5DF2\u901A\u5173", C.green);
        else if (!unlock) chip(x + w - 12, y + 16, "\u672A\u89E3\u9501", C.dim);
        if (unlock) hitBox({ x, y, w, h: rowH, label: "", cb: () => gotoBriefing(lv.id) });
        else hitBox({ x, y, w, h: rowH, label: "", cb: () => {
          showToast(`\u901A\u5173\u300C${LEVELS[i - 1].name}\u300D\u540E\u89E3\u9501`);
          buzz("light");
        } });
      }
      y += rowH + 10;
    });
    return y;
  }
  function drawCodexTowers(y0, time, top, bottom) {
    const x = MARGIN;
    const w = VW - MARGIN * 2;
    let y = y0;
    for (const def of TOWER_LIST) {
      const cardH = 134;
      const unlocked = towerUnlocked(def.type);
      if (y + cardH > top && y < bottom) {
        panel(x, y, w, cardH, unlocked ? `${def.color}55` : "rgba(124,141,176,0.15)");
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx.save();
        rr(ix, iy, ib, ib, 12);
        ctx.fillStyle = `${def.color}14`;
        ctx.fill();
        ctx.strokeStyle = `${def.color}55`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.clip();
        ctx.translate(ix + ib / 2, iy + ib / 2);
        ctx.globalAlpha = unlocked ? 1 : 0.35;
        const charge2 = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
        drawTower(ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge2, time, { ticks: false });
        ctx.restore();
        const tx = ix + ib + 14;
        ctx.save();
        if (!unlocked) ctx.globalAlpha = 0.55;
        fillText(def.name, tx, y + 20, { size: 15 });
        fillText(def.nameEn, tx, y + 37, { size: 9, color: C.dim, weight: "600" });
        fillText(def.role, tx, y + 53, { size: 11, color: C.sub, weight: "normal" });
        fillText(`\u4F24\u5BB3 ${def.levels.map((l) => l.damage).join(" \u2192 ")} \xB7 \u5C04\u7A0B ${def.levels.map((l) => l.range).join(" \u2192 ")}`, tx, y + 71, { size: 10, weight: "normal" });
        fillText(`\u5C04\u901F ${def.levels.map((l) => l.rate).join(" \u2192 ")}/s \xB7 \u9020\u4EF7 \u25C8${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: "normal" });
        fillText(`\u514B\u5236 ${def.strong}`, tx, y + 105, { size: 10, color: C.green, weight: "normal" });
        fillText(`\u77ED\u677F ${def.weak}`, tx, y + 121, { size: 10, color: C.sub, weight: "normal" });
        ctx.restore();
        chip(x + w - 12, y + 17, def.tag, def.color);
        if (!unlocked) {
          fillText(`\u901A\u5173\u7B2C ${TOWER_UNLOCK[def.type]} \u7AE0\u89E3\u9501`, x + w - 12, y + cardH - 12, { size: 10, color: C.gold, align: "right" });
        }
      }
      y += cardH + 12;
    }
    return y;
  }
  function drawCodexEnemies(y0, time, top, bottom) {
    const x = MARGIN;
    const w = VW - MARGIN * 2;
    let y = y0;
    for (const def of ENEMY_LIST) {
      const textW = w - 92 - 14;
      const descLines = wrapCount(def.desc, textW, 10);
      const cardH = Math.ceil(92 + descLines * 13.2 + 22);
      if (y + cardH > top && y < bottom) {
        panel(x, y, w, cardH, `${def.color}44`);
        const ib = 64;
        const ix = x + 14;
        const iy = y + (cardH - ib) / 2;
        ctx.save();
        rr(ix, iy, ib, ib, 12);
        ctx.fillStyle = `${def.color}12`;
        ctx.fill();
        ctx.strokeStyle = `${def.color}44`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.clip();
        ctx.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
        drawEnemy(ctx, def.type, Math.min(21, def.size), time, {});
        ctx.restore();
        const tx = ix + ib + 14;
        fillText(def.name, tx, y + 20, { size: 15 });
        fillText(def.nameEn, tx, y + 37, { size: 9, color: C.dim, weight: "600" });
        chip(x + w - 12, y + 17, ENEMY_CATEGORY[def.category] ?? def.category, def.color);
        fillText(`\u5A01\u80C1 ${"\u2605".repeat(def.threat)}`, tx, y + 54, { size: 10, color: C.gold });
        fillText(`\u751F\u547D ${def.hp} \xB7 \u901F\u5EA6 ${def.speed} \xB7 \u51FB\u6740 \u25C8${def.reward} \xB7 \u6F0F\u602A -${def.leak}`, tx, y + 70, { size: 10, color: C.sub, weight: "normal" });
        const dy = wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: "rgba(232,241,255,0.75)" });
        fillText(`\u5F31\u70B9\uFF1A${def.weakness}`, tx, dy + 2, { size: 10, color: C.cyan, weight: "normal" });
      }
      y += cardH + 12;
    }
    return y;
  }
  var last = Date.now();
  var RENDER_ERR = null;
  function frame() {
    const now = Date.now();
    try {
      const dt = Math.min((now - last) / 1e3, 0.05);
      last = now;
      if (app.screen === "battle" && app.engine) {
        app.engine.tick(dt);
        const evs = app.engine.drainEvents();
        if (online?.player === 0 && online.started && evs.length) snapEvents.push(...evs);
        for (const ev of evs) {
          if (ev.type === "leak") {
            sfx.play("leak");
            buzz("heavy");
            leakFlashAt = Date.now();
          } else if (ev.type === "waveStart") sfx.play("waveStart");
          else if (ev.type === "waveClear") sfx.play("waveClear");
          else if (ev.type === "bossDown") {
            sfx.play("boss");
            buzz("heavy");
          } else if (ev.type === "sfx") sfx.play(ev.name);
          else if (ev.type === "gameOver") {
            if (app.result) continue;
            sfx.play(ev.won ? "victory" : "defeat");
            buzz(ev.won ? "medium" : "heavy");
            if (online) {
              settleOnline(ev.won);
              continue;
            }
            app.result = { won: ev.won };
            const st0 = app.engine.state;
            const levelId = app.engine.level.id;
            const gained = calcScore(st0, app.difficulty, levelId, ev.won);
            const grade = battleGrade(st0, ev.won);
            lastSettlement = { score: gained, grade };
            const rankBefore = commanderRank();
            scoreProfile.points += gained;
            scoreProfile.spendable += gained;
            if (gained > scoreProfile.bestSingle) scoreProfile.bestSingle = gained;
            if (gained > (scoreProfile.perLevelBest[levelId] ?? 0)) scoreProfile.perLevelBest[levelId] = gained;
            scoreProfile.updatedAt = Date.now();
            saveScore();
            coopClearTouches();
            syncScoreToCloud();
            track("score_gain", { score: gained, grade, level_id: levelId, coop: app.coop ? 1 : 0 });
            track("game_end", {
              level_id: levelId,
              difficulty: app.difficulty,
              result: ev.won ? "win" : "lose",
              wave_reached: st0.wave,
              duration_sec: Math.round((Date.now() - battleStartAt) / 1e3),
              kills: st0.kills,
              leaks: st0.leaked,
              score: gained,
              grade,
              coop: app.coop ? 1 : 0
            });
            if (ev.won) recordLevelClear(levelId);
            const rankAfter = commanderRank();
            if (rankAfter !== rankBefore) showToast(`\u664B\u5347 \xB7 ${rankAfter}`);
            goto("result");
          }
        }
      }
      syncMusic();
      if (app.screen === "splash") drawSplash(now / 1e3);
      else if (app.screen === "home") drawHome4(now / 1e3);
      else if (app.screen === "briefing") drawBriefing4(now / 1e3);
      else if (app.screen === "battle" && app.engine) drawBattle();
      else if (app.screen === "codex") drawCodex4(now / 1e3);
      else if (app.screen === "result" && app.engine) drawResult4(now / 1e3);
      else if (app.screen === "lobby") drawLobby();
      if (app.pendingRoom && (app.screen === "home" || app.screen === "splash")) drawInviteBanner();
      const ft = (Date.now() - screenAt) / 240;
      if (ft < 1) {
        if (skin.transition === "wipe") {
          const bands = 3;
          const bh = VH / bands;
          for (let i = 0; i < bands; i++) {
            const p = Math.min(1, Math.max(0, ft * 1.7 - i * 0.22));
            if (p >= 1) continue;
            const e = 1 - (1 - p) ** 3;
            const x = -e * (VW + 96);
            rr(x, i * bh - 1, VW + 96, bh + 2, 26);
            ctx.fillStyle = skin.panelSolid;
            ctx.fill();
            ctx.strokeStyle = ac(0.55);
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else if (skin.transition === "glitch") {
          const a = 1 - ft;
          ctx.fillStyle = `rgba(2,4,10,${a.toFixed(3)})`;
          ctx.fillRect(0, 0, VW, VH);
          const frameSeed = Math.floor(ft * 14) * 31;
          for (let i = 0; i < 5; i++) {
            const gy = hash01(frameSeed + i * 7 + 3) * VH;
            const gh = 3 + hash01(frameSeed + i * 13 + 5) * 22;
            const gx = (hash01(frameSeed + i * 17 + 9) - 0.5) * 48 * a;
            ctx.fillStyle = ac(0.32 * a * (0.4 + hash01(frameSeed + i * 5 + 1) * 0.6));
            ctx.fillRect(gx, gy, VW, gh);
          }
        } else {
          ctx.fillStyle = `rgba(7,11,24,${(1 - ft).toFixed(3)})`;
          ctx.fillRect(0, 0, VW, VH);
        }
      }
      drawToast2();
    } catch (e) {
      RENDER_ERR = e;
      console.error("[SRD]", e?.stack ?? e);
    }
    if (RENDER_ERR) {
      const msg = String(RENDER_ERR?.message ?? RENDER_ERR);
      fillText("UI \u5F02\u5E38:", 10, 22, { size: 12, color: "#FF5A5A" });
      fillText(msg, 10, 40, { size: 10, color: "#FF9F43", weight: "normal" });
      const ln = String(RENDER_ERR?.stack ?? "").split("\n")[1] ?? "";
      fillText(ln, 10, 56, { size: 10, color: "#9AA7C2", weight: "normal" });
    }
    requestAnimationFrame(frame);
  }
  var tapConsumed = false;
  var env = {
    // 画布与布局
    ctx,
    VW,
    VH,
    DPR,
    TOP_SAFE,
    CAP_MID,
    CAP_LEFT,
    GAME_CENTER_PAD,
    MARGIN,
    RADIUS,
    BAR_H,
    mapScale,
    mapOX,
    mapOY,
    toMapX,
    toMapY,
    getMapPan: () => mapPan,
    mapPanMin,
    homeTop,
    homeBottom,
    totalScrollMax,
    // 配色
    C,
    get skin() {
      return skin;
    },
    ac,
    // 绘制助手
    fillText,
    rr,
    panel,
    wrapBlock,
    wrapCount,
    shade,
    btn,
    hitBox,
    chip,
    segControl,
    drawSwitch,
    drawAvatar,
    drawCardArt,
    drawSpaceBg,
    drawStars,
    RES_FONT,
    rng,
    hash01,
    drawTower,
    drawEnemy,
    // 状态访问
    app,
    codex,
    getScreenAt: () => screenAt,
    showProfile: () => showProfile,
    setShowProfile: (v) => {
      showProfile = v;
    },
    showSettings: () => showSettings,
    setShowSettings: (v) => {
      showSettings = v;
    },
    getPressedBtn: () => pressedBtn,
    getTechShownAt: () => techShownAt,
    setTechShownAt: (v) => {
      techShownAt = v;
    },
    get barScroll() {
      return barScroll;
    },
    set barScroll(v) {
      barScroll = v;
    },
    getEngine: () => app.engine,
    // 数据
    LEVELS,
    DIFF_LIST,
    DIFFICULTIES,
    TOWER_LIST,
    ENEMY_LIST,
    TOWERS,
    ENEMIES,
    TECHS,
    TOWER_ORDER,
    TOWER_UNLOCK,
    SELL_RATE,
    STORY_PARAS,
    CODEX_TABS,
    ENEMY_CATEGORY,
    SLOT_W,
    SLOT_GAP,
    stripMaxScroll,
    SKINS,
    CELL,
    COLS,
    ROWS,
    // 进度与解锁
    loadProgress,
    unlockedChapter,
    towerUnlocked,
    // 动作
    goto,
    gotoBriefing,
    stopNarration,
    startBattle,
    engineCmd,
    applySkin,
    authUser,
    openFeedback,
    toggleCoop,
    setMode,
    getOnlineInfo,
    // 主动拉起分享（判空包装 wx.shareAppMessage）
    shareAppMessage: (o) => {
      try {
        wx.shareAppMessage?.(o);
      } catch {
      }
    },
    commanderRank,
    displayNick,
    getProfile: () => profile,
    getScore: () => scoreProfile,
    getRankProgress: rankProgress,
    getLastSettlement: () => lastSettlement,
    // 反馈
    sfx,
    buzz,
    showToast,
    track,
    store,
    getToast: () => toast,
    // 设置项状态
    musicMuted: () => musicMuted,
    toggleMusicMuted,
    narrationMuted: () => narrationMuted,
    toggleNarrationMuted,
    vibrateMuted: () => vibrateMuted,
    toggleVibrateMuted,
    readQualityHigh: readWxQualityHigh,
    setQualityHigh: (v) => {
      setWxQualityHigh(v);
      qualityHigh = v;
    },
    // 触摸接管
    consumeTap: () => {
      tapConsumed = true;
    }
  };
  var coopBar = /* @__PURE__ */ new Map();
  var coopDrag = /* @__PURE__ */ new Map();
  var coopMap = /* @__PURE__ */ new Map();
  var coopMoved = /* @__PURE__ */ new Map();
  var coopTouchAt = /* @__PURE__ */ new Map();
  function coopClearTouches() {
    coopBar.clear();
    coopDrag.clear();
    coopMap.clear();
    coopMoved.clear();
    coopTouchAt.clear();
  }
  function makeBarTouch(engine, p) {
    const t = towerSlotAt(p);
    const unusable = !t ? null : !towerUnlocked(t) ? `\u901A\u5173\u7B2C ${TOWER_UNLOCK[t]} \u7AE0\u540E\u89E3\u9501\u300C${TOWERS[t].name}\u300D` : engine.state.gold < TOWERS[t].levels[0].cost ? "\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u5148\u6512\u4E00\u6512" : null;
    return { mode: "pending", type: unusable ? null : t, unusable, startX: p.x, startY: p.y, lastX: p.x };
  }
  function placeAtOnce(engine, p) {
    const st = engine.state;
    const cx = Math.floor(toMapX(p.x) / CELL);
    const cy = Math.floor(toMapY(p.y) / CELL);
    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && engine.map.isBuildable(cx, cy) && !st.towers.some((tw) => tw.col === cx && tw.row === cy)) {
      if (engine.dispatch({ type: "BUILD", col: cx, row: cy, tower: app.placing })) {
        sfx.play("build");
        buzz("light");
        track("tower_build", { tower_type: app.placing, level_id: app.levelId, wave: engine.state.wave });
      }
    }
    app.placing = null;
  }
  function coopTouchStart(e) {
    const engine = app.engine;
    if (!engine) return;
    for (const t of e.changedTouches ?? e.touches) {
      const id = touchId(t);
      const p = touchPoint(t);
      coopTouchAt.set(id, Date.now());
      coopMoved.set(id, 0);
      SKIN_MODULES[skin.id]?.handleTouch?.(env, "start", p);
      if (!pressedBtn) {
        for (let i = hooks.length - 1; i >= 0; i--) {
          const b = hooks[i];
          if (!b.disabled && hit(p, b)) {
            pressedBtn = b;
            break;
          }
        }
      }
      if (showSettings || showProfile || engine.state.phase === "tech") continue;
      if (hooks.some((b) => !b.disabled && hit(p, b))) continue;
      if (p.y >= VH - BAR_H) {
        if (!app.placing && app.selectedId == null) coopBar.set(id, makeBarTouch(engine, p));
        continue;
      }
      if (app.placing) {
        placeAtOnce(engine, p);
        continue;
      }
      coopMap.set(id, { startY: p.y, pan0: mapPan });
    }
  }
  function coopTouchMove(e) {
    for (const t of e.changedTouches ?? e.touches) {
      const id = touchId(t);
      const p = touchPoint(t);
      if (SKIN_MODULES[skin.id]?.handleTouch?.(env, "move", p)) continue;
      const bt = coopBar.get(id);
      if (bt) {
        const dx = p.x - bt.startX;
        const dy = p.y - bt.startY;
        if (bt.mode === "pending") {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2 && stripMaxScroll > 0) bt.mode = "scroll";
          else if (dx * dx + dy * dy > 144 && bt.type) bt.mode = "drag";
        }
        if (bt.mode === "scroll") {
          barScroll = Math.max(0, Math.min(stripMaxScroll, barScroll - (p.x - bt.lastX)));
          bt.lastX = p.x;
          coopMoved.set(id, (coopMoved.get(id) ?? 0) + Math.abs(dx));
        } else if (bt.mode === "drag") {
          coopDrag.set(id, p);
          coopMoved.set(id, (coopMoved.get(id) ?? 0) + Math.abs(dx) + Math.abs(dy));
        }
        continue;
      }
      const mt = coopMap.get(id);
      if (mt && mapPanMin < 0) {
        const dy = p.y - mt.startY;
        mapPan = Math.max(mapPanMin, Math.min(0, mt.pan0 + dy));
        coopMoved.set(id, (coopMoved.get(id) ?? 0) + Math.abs(dy));
      }
    }
  }
  function coopTouchEnd(e) {
    for (const t of e.changedTouches ?? e.touches) {
      const id = touchId(t);
      const p = touchPoint(t);
      const at = coopTouchAt.get(id) ?? 0;
      const moved = coopMoved.get(id) ?? 0;
      coopTouchAt.delete(id);
      coopMoved.delete(id);
      if (SKIN_MODULES[skin.id]?.handleTouch?.(env, "end", p)) continue;
      const bt = coopBar.get(id);
      if (bt) {
        coopBar.delete(id);
        coopDrag.delete(id);
        if (bt.mode === "scroll") continue;
        if (bt.mode === "drag") {
          if (bt.type && app.engine) {
            const st = app.engine.state;
            const cx = Math.floor(toMapX(p.x) / CELL);
            const cy = Math.floor(toMapY(p.y) / CELL);
            if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && app.engine.map.isBuildable(cx, cy) && !st.towers.some((tw) => tw.col === cx && tw.row === cy)) {
              if (app.engine.dispatch({ type: "BUILD", col: cx, row: cy, tower: bt.type })) {
                sfx.play("build");
                buzz("light");
                track("tower_build", { tower_type: bt.type, level_id: app.levelId, wave: st.wave });
              }
            }
          }
          continue;
        }
        if (bt.type) {
          app.placing = bt.type;
          app.selectedId = null;
        } else if (bt.unusable) {
          showToast(bt.unusable);
          buzz("light");
        }
        continue;
      }
      const mt = coopMap.get(id);
      if (mt) {
        coopMap.delete(id);
        if (moved > 8) continue;
        if (app.engine && !app.placing) {
          const cx = Math.floor(toMapX(p.x) / CELL);
          const cy = Math.floor(toMapY(p.y) / CELL);
          const tw = app.engine.state.towers.find((tw2) => tw2.col === cx && tw2.row === cy);
          app.selectedId = tw ? tw.id : null;
          if (tw) sfx.play("select");
        }
        continue;
      }
      if (Date.now() - at < 600) {
        for (let i = hooks.length - 1; i >= 0; i--) {
          const b = hooks[i];
          if (!b.disabled && hit(p, b)) {
            sfx.play("click");
            b.cb();
            break;
          }
        }
      }
    }
    pressedBtn = null;
  }
  var touchTime = 0;
  wx.onTouchStart((e) => {
    const p0 = e.touches[0];
    if (!p0) return;
    sfx.init();
    if (app.coop && app.screen === "battle" && app.engine) {
      coopTouchStart(e);
      return;
    }
    const p = touchPoint(p0);
    if (SKIN_MODULES[skin.id]?.handleTouch?.(env, "start", p)) return;
    touchTime = Date.now();
    pressedBtn = null;
    for (let i = hooks.length - 1; i >= 0; i--) {
      const b = hooks[i];
      if (!b.disabled && hit(p, b)) {
        pressedBtn = b;
        break;
      }
    }
    if (showSettings || showProfile) return;
    if (app.screen === "home" || app.screen === "codex") {
      app.dragY = p.y;
      app.dragAcc = 0;
      return;
    }
    if (app.screen === "battle") {
      battleMoved = 0;
      const engine = app.engine;
      if (!engine || engine.state.phase === "tech") return;
      if (pressedBtn) return;
      if (p.y >= VH - BAR_H) {
        if (!app.placing && app.selectedId == null) {
          const t = towerSlotAt(p);
          const unusable = !t ? null : !towerUnlocked(t) ? `\u901A\u5173\u7B2C ${TOWER_UNLOCK[t]} \u7AE0\u540E\u89E3\u9501\u300C${TOWERS[t].name}\u300D` : engine.state.gold < TOWERS[t].levels[0].cost ? "\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u5148\u6512\u4E00\u6512" : null;
          barTouch = { mode: "pending", type: unusable ? null : t, unusable, startX: p.x, startY: p.y, lastX: p.x };
        }
        return;
      }
      if (app.placing) {
        const st = engine.state;
        const cx = Math.floor(toMapX(p.x) / CELL);
        const cy = Math.floor(toMapY(p.y) / CELL);
        if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && engine.map.isBuildable(cx, cy) && !st.towers.some((tw) => tw.col === cx && tw.row === cy)) {
          if (engine.dispatch({ type: "BUILD", col: cx, row: cy, tower: app.placing })) {
            sfx.play("build");
            buzz("light");
            track("tower_build", { tower_type: app.placing, level_id: app.levelId, wave: engine.state.wave });
          }
        }
        app.placing = null;
        return;
      }
      mapTouch = { startY: p.y, pan0: mapPan };
    }
  });
  wx.onTouchMove((e) => {
    const p0 = e.touches[0];
    if (!p0) return;
    if (app.coop && app.screen === "battle" && app.engine) {
      coopTouchMove(e);
      return;
    }
    const p = touchPoint(p0);
    if (SKIN_MODULES[skin.id]?.handleTouch?.(env, "move", p)) return;
    if (app.screen === "home" || app.screen === "codex") {
      if (app.dragY == null) return;
      const max = app.screen === "home" ? totalScrollMax() : codexMaxScroll2;
      const next = Math.max(0, Math.min(max, (app.screen === "home" ? app.scroll : codex.scroll) + (app.dragY - p.y)));
      if (app.screen === "home") app.scroll = next;
      else codex.scroll = next;
      app.dragAcc = Math.abs(app.dragY - p.y) + (app.dragAcc ?? 0);
      app.dragY = p.y;
      return;
    }
    if (app.screen !== "battle") return;
    if (barTouch) {
      const dx = p.x - barTouch.startX;
      const dy = p.y - barTouch.startY;
      if (barTouch.mode === "pending") {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2 && stripMaxScroll > 0) barTouch.mode = "scroll";
        else if (dx * dx + dy * dy > 144 && barTouch.type) barTouch.mode = "drag";
      }
      if (barTouch.mode === "scroll") {
        barScroll = Math.max(0, Math.min(stripMaxScroll, barScroll - (p.x - barTouch.lastX)));
        barTouch.lastX = p.x;
        battleMoved += Math.abs(dx);
      } else if (barTouch.mode === "drag") {
        dragPos = p;
        battleMoved += Math.abs(dx) + Math.abs(dy);
      }
      return;
    }
    if (mapTouch) {
      if (mapPanMin >= 0) return;
      const dy = p.y - mapTouch.startY;
      mapPan = Math.max(mapPanMin, Math.min(0, mapTouch.pan0 + dy));
      battleMoved += Math.abs(dy);
    }
  });
  wx.onTouchEnd((e) => {
    pressedBtn = null;
    if (app.coop && app.screen === "battle" && app.engine) {
      coopTouchEnd(e);
      return;
    }
    const p0 = (e.changedTouches ?? e.touches)[0];
    if (!p0) return;
    const p = touchPoint(p0);
    tapConsumed = false;
    if (SKIN_MODULES[skin.id]?.handleTouch?.(env, "end", p)) {
      tapConsumed = false;
      return;
    }
    const isScrollPage = app.screen === "home" || app.screen === "codex";
    if (isScrollPage) {
      if (app.dragAcc > 8) {
        app.dragY = null;
        app.dragAcc = 0;
        return;
      }
      app.dragY = null;
    }
    if (app.screen === "battle") {
      if (barTouch) {
        const bt = barTouch;
        barTouch = null;
        dragPos = null;
        if (bt.mode === "scroll") return;
        if (bt.mode === "drag") {
          if (bt.type && app.engine) {
            const st = app.engine.state;
            const cx = Math.floor(toMapX(p.x) / CELL);
            const cy = Math.floor(toMapY(p.y) / CELL);
            if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && app.engine.map.isBuildable(cx, cy) && !st.towers.some((tw) => tw.col === cx && tw.row === cy)) {
              if (app.engine.dispatch({ type: "BUILD", col: cx, row: cy, tower: bt.type })) {
                sfx.play("build");
                buzz("light");
                track("tower_build", { tower_type: bt.type, level_id: app.levelId, wave: st.wave });
              }
            }
          }
          return;
        }
        if (bt.type) {
          app.placing = bt.type;
          app.selectedId = null;
        } else if (bt.unusable) {
          showToast(bt.unusable);
          buzz("light");
        }
        return;
      }
      if (mapTouch) {
        const moved = battleMoved > 8;
        mapTouch = null;
        if (moved) return;
        if (app.engine && !app.placing) {
          const cx = Math.floor(toMapX(p.x) / CELL);
          const cy = Math.floor(toMapY(p.y) / CELL);
          const tw = app.engine.state.towers.find((t) => t.col === cx && t.row === cy);
          app.selectedId = tw ? tw.id : null;
          if (tw) sfx.play("select");
          return;
        }
      }
    }
    const quick = Date.now() - touchTime < 600;
    if (!quick) return;
    if (tapConsumed) {
      tapConsumed = false;
      return;
    }
    for (let i = hooks.length - 1; i >= 0; i--) {
      const b = hooks[i];
      if (!b.disabled && hit(p, b)) {
        sfx.play("click");
        b.cb();
        return;
      }
    }
  });
  frame();
  try {
    globalThis.__SRD = app;
    globalThis.__SRD_HOOKS = { get: () => hooks };
    globalThis.__SRD_NET = {
      get session() {
        return online;
      },
      setMode,
      enterLobby,
      hostCreateRoom,
      joinRoom,
      startOnlineBattle
    };
  } catch {
  }
})();
