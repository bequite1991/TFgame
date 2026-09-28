(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // ../app/src/game/config.ts
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
    normal: { id: "normal", name: "\u666E\u901A", gold: 400, lives: 20, hpMul: 1, speedMul: 1, label: "\u6807\u51C6\u6218\u5F79" },
    hard: { id: "hard", name: "\u56F0\u96BE", gold: 320, lives: 15, hpMul: 1.15, speedMul: 1.05, label: "\u8001\u5175\u8BD5\u70BC" }
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

  // ../app/src/game/levels.ts
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
    return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
  }

  // ../app/src/game/engine.ts
  var uid = 1;
  function createEngine(difficulty, levelId = 1) {
    const diff = DIFFICULTIES[difficulty];
    const level = getLevel(levelId);
    const map = buildLevelMap(level.paths);
    const lowSpec = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
    const particleScale = lowSpec ? 0.5 : 1;
    const state = {
      phase: "prep",
      clock: 0,
      timeSec: 0,
      gold: diff.gold,
      lives: diff.lives,
      maxLives: diff.lives,
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
      const queue = [];
      let added = true;
      while (added) {
        added = false;
        for (const pool of pools) {
          const item = pool.shift();
          if (item) {
            queue.push(item);
            added = true;
          }
        }
      }
      return queue;
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
      state.gold += earned;
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
      state.gold += def.bonus;
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
    function dispatch(cmd) {
      if (state.phase === "tech") {
        if (cmd.type !== "PICK_TECH") return false;
        if (!state.techChoices?.includes(cmd.id)) return false;
        state.techs.push(cmd.id);
        state.techChoices = null;
        if (cmd.id === "supply") {
          state.gold += 200;
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
        if (state.gold < cost) return false;
        state.gold -= cost;
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
          invested: cost
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
        const cost = TOWERS[t.type].levels[t.level + 1].cost;
        if (state.gold < cost) return false;
        state.gold -= cost;
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
        const refund = Math.floor(t.invested * SELL_RATE);
        state.gold += refund;
        const c = towerCenter(t);
        addFloater(c.x, c.y - 20, `+${refund}`, "#FFC94D");
        addExplosion(c.x, c.y, "#7C8DB0", 8, 80);
        state.towers.splice(i, 1);
        notify();
        return true;
      }
      return false;
    }
    return {
      state,
      difficulty,
      map,
      level,
      tick,
      dispatch,
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

  // ../app/src/game/render.ts
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
  function drawTower(ctx2, type, level, size, aimAngle, charge, time, opts = {}) {
    const def = TOWERS[type];
    const r = size / 2;
    const breathe = 0.6 + 0.4 * Math.sin(time * 2.4);
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
      ctx2.shadowColor = def.color;
      ctx2.shadowBlur = 14;
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = def.color;
      ctx2.shadowBlur = 10 + 8 * breathe;
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
        ctx2.shadowColor = def.color;
        ctx2.shadowBlur = 8;
        ctx2.stroke();
        ctx2.shadowBlur = 0;
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
          ctx2.shadowColor = def.color;
          ctx2.shadowBlur = 10;
          ctx2.fill();
          ctx2.shadowBlur = 0;
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
          ctx2.shadowColor = "#FF5A5A";
          ctx2.shadowBlur = 6;
          ctx2.beginPath();
          ctx2.arc(ox, oy + r * 0.1, r * 0.035, 0, Math.PI * 2);
          ctx2.fill();
          ctx2.shadowBlur = 0;
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
        ctx2.shadowColor = def.color;
        ctx2.shadowBlur = 14;
        ctx2.fill();
        ctx2.shadowBlur = 0;
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
        ctx2.shadowColor = def.color;
        ctx2.shadowBlur = 8;
        ctx2.fillRect(-r * 0.1, -r * 0.76, r * 0.2, r * 0.06);
        ctx2.shadowBlur = 0;
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
          const lit = charge >= (i + 1) / coils - 1e-3;
          ctx2.beginPath();
          ctx2.ellipse(0, cy, r * 0.27, r * 0.06, 0, 0, Math.PI * 2);
          ctx2.strokeStyle = lit ? "#C4B0FF" : "rgba(139,92,246,0.5)";
          ctx2.lineWidth = 2;
          if (lit) {
            ctx2.shadowColor = def.color;
            ctx2.shadowBlur = 12;
          }
          ctx2.stroke();
          ctx2.shadowBlur = 0;
        }
        if (charge > 0.25) {
          const arcs = charge > 0.7 ? 2 : 1;
          for (let i = 0; i < arcs; i++) {
            const seed = time * 31 + i * 17;
            const y0 = -r * (0.15 + 0.5 * ((Math.sin(seed) + 1) / 2));
            ctx2.beginPath();
            ctx2.moveTo(-r * 0.17, y0);
            for (let k = 1; k <= 3; k++) {
              ctx2.lineTo(-r * 0.17 + r * 0.34 * k / 3, y0 + Math.sin(seed + k * 5.7) * r * 0.08);
            }
            ctx2.strokeStyle = "#D8CCFF";
            ctx2.globalAlpha = 0.5 + charge * 0.5;
            ctx2.lineWidth = 1;
            ctx2.shadowColor = def.color;
            ctx2.shadowBlur = 8;
            ctx2.stroke();
            ctx2.shadowBlur = 0;
            ctx2.globalAlpha = 1;
          }
        }
        const glow = charge > 0 ? 0.5 + 0.5 * Math.sin(time * 20) : 0.6;
        ctx2.fillStyle = def.color;
        ctx2.globalAlpha = glow;
        ctx2.shadowColor = def.color;
        ctx2.shadowBlur = charge > 0 ? 18 : 6;
        ctx2.fillRect(-r * 0.22, -r * 0.8, r * 0.35, r * 0.1);
        ctx2.shadowBlur = 0;
        ctx2.globalAlpha = 1;
      }
      ctx2.restore();
    }
    if (type !== "tesla" && type !== "plasma") {
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.13, 0, Math.PI * 2);
      ctx2.fillStyle = def.color;
      ctx2.shadowColor = def.color;
      ctx2.shadowBlur = 6 + 8 * breathe;
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.arc(r * 0.62, -r * 0.15, r * 0.09, 0, Math.PI * 2);
      ctx2.arc(r * 0.62, r * 0.15, r * 0.09, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 5;
      ctx2.beginPath();
      ctx2.arc(-r * 1.5, tailTipY, r * 0.07, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.arc(r * 0.9, bob - r * 0.06, r * 0.08, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.ellipse(r * 0.3, -r * 0.36, r * 0.12, r * 0.05, 0.5, 0, Math.PI * 2);
      ctx2.ellipse(r * 0.3, r * 0.36, r * 0.12, r * 0.05, -0.5, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
        ctx2.shadowColor = body;
        ctx2.shadowBlur = 8;
        ctx2.fill();
        ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 5;
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
      ctx2.shadowBlur = 0;
      ctx2.fillStyle = "#F2FFDB";
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 7;
      ctx2.beginPath();
      ctx2.ellipse(r * 0.42, 0, r * 0.14, r * 0.06, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
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
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 18;
      ctx2.fill();
      ctx2.shadowBlur = 0;
      ctx2.fillStyle = glow;
      ctx2.shadowColor = glow;
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.arc(r * 0.6, 0, r * 0.07, 0, Math.PI * 2);
      ctx2.arc(r * 0.45, -r * 0.3, r * 0.055, 0, Math.PI * 2);
      ctx2.arc(r * 0.45, r * 0.3, r * 0.055, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.shadowBlur = 0;
    }
    if (opts.burning) {
      ctx2.globalAlpha = alpha * 0.4;
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx2.strokeStyle = "#FF6B3D";
      ctx2.lineWidth = 2;
      ctx2.shadowColor = "#FF6B3D";
      ctx2.shadowBlur = 10;
      ctx2.stroke();
      ctx2.shadowBlur = 0;
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

  // ../app/src/game/fx.ts
  var import_meta = {};
  var BLOOM_SCALE = 0.25;
  var BLOOM_INTENSITY = 0.6;
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
      g.strokeStyle = "rgba(34,224,255,0.4)";
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
        g.globalAlpha = 0.45;
        g.fillStyle = "#22E0FF";
        g.beginPath();
        g.arc(ex.centerX, ex.centerY, 26, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (const t of s.towers) {
        const cx = (t.col + 0.5) * CELL;
        const cy = (t.row + 0.5) * CELL;
        g.globalAlpha = 0.3;
        g.fillStyle = TOWERS[t.type].color;
        g.beginPath();
        g.arc(cx, cy, CELL * 0.24, 0, Math.PI * 2);
        g.fill();
        if (t.charging) {
          const charge = 1 - t.chargeT / (TOWERS.railgun.charge ?? 1.2);
          g.globalAlpha = 0.35 + charge * 0.4;
          g.fillStyle = "#8B5CF6";
          g.beginPath();
          g.arc(cx, cy, 12 + charge * 18, 0, Math.PI * 2);
          g.fill();
        }
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
      g.fillStyle = "#FFFFFF";
      g.font = "700 14px Orbitron, sans-serif";
      g.textAlign = "center";
      for (const f of s.floaters) {
        g.globalAlpha = f.ttl / f.maxTtl * 0.6;
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, f.y);
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
  var MUTE_KEY = "srd.muted";
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
      const env = (g, peak, dur) => {
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
        env(g, sfxVol(sfx2), dur);
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
        env(g, peak, dur);
        src.connect(f).connect(g);
        src.start(t);
      };
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
    }
    playSafe(sfx2) {
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
    }
    playChord(f) {
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
    }
  };
  var sfx = new SfxEngine();

  // src/analytics.ts
  function track(eventId, data = {}) {
    try {
      const w = globalThis.wx;
      if (typeof w?.reportEvent === "function") w.reportEvent(eventId, data);
      else if (typeof w?.reportAnalytics === "function") w.reportAnalytics(eventId, data);
    } catch {
    }
  }

  // src/main.ts
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
  var profile = (() => {
    const raw = store.get("srd.profile");
    return { nick: raw?.nick ?? "", avatarUrl: raw?.avatarUrl ?? "", real: raw?.real === true };
  })();
  function commanderRank() {
    const n = loadProgress().cleared.length;
    if (n >= 13) return "\u4F20\u5947\u7EDF\u5E05";
    if (n >= 8) return "\u661F\u73AF\u5C06\u661F";
    if (n >= 4) return "\u6218\u5730\u6307\u6325\u5B98";
    if (n >= 1) return "\u89C1\u4E60\u6307\u6325\u5B98";
    return "\u65B0\u664B\u5B66\u5458";
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
  function authUser() {
    try {
      wx.getUserInfo?.({
        success: (r) => {
          profile = { nick: r.userInfo.nickName, avatarUrl: r.userInfo.avatarUrl, real: true };
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
  var BAR_H = 122;
  var capsule = wx.getMenuButtonBoundingClientRect?.();
  var TOP_SAFE = capsule ? Math.ceil(capsule.bottom) + 8 : 96;
  var CAP_MID = capsule ? (capsule.top + capsule.bottom) / 2 : 48;
  var CAP_LEFT = capsule ? capsule.left : VW - 94;
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
    panelBg: "rgba(15,23,46,0.92)",
    panelLine: "rgba(34,224,255,0.25)"
  };
  var MARGIN = 16;
  var RADIUS = 14;
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
  function drawToast() {
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
    ctx.fillStyle = "rgba(15,23,46,0.95)";
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
    g.addColorStop(0, "rgba(20,30,58,0.94)");
    g.addColorStop(1, "rgba(11,17,36,0.94)");
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
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.scale(0.93, 0.93);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      ctx.globalAlpha = 0.82;
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
      ctx.fillStyle = b.active ? `${c}30` : "rgba(15,23,46,0.92)";
      ctx.fill();
      ctx.strokeStyle = b.active ? c : `${c}77`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
    if (b.label) {
      const labelColor = b.primary && !b.disabled ? "#081226" : b.active ? c : b.disabled ? "#9AA7C2" : C.text;
      fillText(b.label, b.x + b.w / 2, b.y + (b.sub ? b.h / 2 - 9 : b.h / 2), {
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
  var segAnim = {};
  function segControl(x, y, w, items, activeIdx, key, onPick) {
    panel(x, y, w, 34, "rgba(255,201,77,0.25)", 17);
    const sw = w / items.length;
    const cur = segAnim[key] ?? activeIdx;
    const next = cur + (activeIdx - cur) * 0.28;
    segAnim[key] = Math.abs(activeIdx - next) < 0.01 ? activeIdx : next;
    ctx.save();
    rr(x + segAnim[key] * sw + 3, y + 3, sw - 6, 28, 14);
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
  function drawHeader(title, opts = {}) {
    const btnS = 36;
    const top = CAP_MID - btnS / 2;
    ctx.save();
    const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
    g.addColorStop(0, "rgba(10,16,34,0.92)");
    g.addColorStop(1, "rgba(10,16,34,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
    ctx.strokeStyle = "rgba(34,224,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TOP_SAFE - 0.5);
    ctx.lineTo(VW, TOP_SAFE - 0.5);
    ctx.stroke();
    ctx.restore();
    if (opts.back) {
      btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: "\u2039", cb: opts.back });
    } else {
      btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: "\u{1F4D6}", color: C.gold, cb: () => {
        codex.scroll = 0;
        goto("codex");
      } });
    }
    const muteX = CAP_LEFT - 8 - btnS;
    btn({ x: muteX, y: top, w: btnS, h: btnS, label: musicMuted ? "\u{1F507}" : "\u{1F50A}", cb: toggleMusicMuted });
    const ax = muteX - 8 - 15;
    drawAvatar(ax, CAP_MID, 15);
    hitBox({ x: ax - 17, y: top, w: 34, h: btnS, label: "", cb: () => {
      showProfile = true;
    } });
    const tx = MARGIN + btnS + 12;
    const maxW = ax - 17 - tx - 8;
    let tSize = 16;
    ctx.save();
    while (tSize > 11) {
      ctx.font = `bold ${tSize}px sans-serif`;
      if (ctx.measureText(title).width <= maxW) break;
      tSize--;
    }
    ctx.restore();
    fillText("TOWER LINE DEFENSE", tx, CAP_MID - 11, { size: 9, color: "rgba(34,224,255,0.7)", weight: "600" });
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
    ctx.fillStyle = "rgba(7,11,24,0.78)";
    ctx.fillRect(0, 0, VW, VH);
    const pw = VW - 72;
    const ph = 420;
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
    ctx.fillStyle = "rgba(34,224,255,0.12)";
    ctx.fill();
    if (cleared > 0) {
      rr(bx, by + 6, Math.max(10, bw * (cleared / LEVELS.length)), 10, 5);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, C.cyan);
      g.addColorStop(1, C.gold);
      ctx.fillStyle = g;
      ctx.fill();
    }
    const qHigh = readWxQualityHigh();
    btn({
      x: px + 24,
      y: py + 192,
      w: pw - 48,
      h: 40,
      label: qHigh ? "\u753B\u8D28\uFF1A\u9AD8\uFF08\u8F89\u5149\uFF09" : "\u753B\u8D28\uFF1A\u4F4E",
      color: qHigh ? C.cyan : C.sub,
      active: qHigh,
      cb: () => {
        setWxQualityHigh(!qHigh);
        qualityHigh = !qHigh;
        buzz("light");
      }
    });
    btn({
      x: px + 24,
      y: py + 240,
      w: pw - 48,
      h: 40,
      label: "\u{1F4AC} \u610F\u89C1\u53CD\u9988",
      color: C.gold,
      cb: () => openFeedback()
    });
    let y = py + 292;
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
    techPickedAt: 0
  };
  var screenAt = Date.now();
  function goto(s) {
    if (app.screen === s) return;
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
  var codexMaxScroll = 0;
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
  var musicMuted = store.get("srd.muted") === "1";
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
        const ac = wx.createInnerAudioContext();
        ac.loop = true;
        ac.autoplay = true;
        ac.obeyMuteSwitch = false;
        ac.volume = name === "battle" ? 0.5 : 0.45;
        ac.onError((e) => console.error("[SRD] BGM \u64AD\u653E\u5931\u8D25:", ac.src, e ?? ""));
        ac.onCanplay(() => {
          try {
            ac.play();
          } catch {
          }
        });
        ac.src = `assets/bgm/bgm-${name}.mp3`;
        bgmAc = { ac, name };
      } catch {
      }
    });
  }
  function syncMusic() {
    const want = musicMuted ? "" : app.screen === "splash" ? "" : app.screen === "battle" ? "battle" : "home";
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
    sfx.setMuted(musicMuted);
    store.set("srd.muted", musicMuted ? "1" : "0");
    if (musicMuted) stopMusic();
    musicTarget = "";
  }
  function buzz(type) {
    try {
      wx.vibrateShort?.({ type });
    } catch {
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
        const ac = wx.createInnerAudioContext();
        ac.autoplay = true;
        ac.obeyMuteSwitch = false;
        ac.onError((e) => console.error("[SRD] \u65C1\u767D\u64AD\u653E\u5931\u8D25:", ac.src, e ?? ""));
        ac.onCanplay(() => {
          try {
            ac.play();
          } catch {
          }
        });
        ac.src = `assets/audio/lv${String(levelId).padStart(2, "0")}.mp3`;
        narration = { ac, levelId };
      } catch {
      }
    });
  }
  function gotoBriefing(levelId) {
    app.levelId = levelId;
    track("chapter_select", { level_id: levelId });
    goto("briefing");
    startNarration(levelId);
  }
  function drawSplash(time) {
    hooks = [];
    drawSpaceBg(time);
    const t = (Date.now() - app.splashAt) / 1e3;
    const cx = VW / 2;
    const cy = VH * 0.36;
    const ringR = Math.min(1.6, Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5) * VW * 0.26 + 8);
    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.globalAlpha = Math.min(1, t) * 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ringR * 1.7, ringR * 0.42, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    const pg = ctx.createRadialGradient(cx - 12, cy - 12, 4, cx, cy, ringR);
    pg.addColorStop(0, "#1C3D66");
    pg.addColorStop(0.7, "#0D1836");
    pg.addColorStop(1, "#070B18");
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, Math.max(0, t - 0.35)) * (0.7 + 0.3 * Math.sin(t * 4));
    ctx.strokeStyle = C.cyan;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ringR * 1.6);
    ctx.lineTo(cx, cy + ringR * 0.9);
    ctx.stroke();
    ctx.restore();
    const fade = Math.min(1, Math.max(0, (t - 0.5) / 0.8));
    ctx.globalAlpha = fade;
    fillText("TOWER LINE DEFENSE", VW / 2, cy + ringR * 1.15, { size: 13, color: C.cyan, align: "center", weight: "600" });
    const titleSize = Math.min(30, VW * 0.082);
    fillText("\u9AD8 \u5854 \u9632 \u7EBF", VW / 2, cy + ringR * 1.15 + 34, { size: titleSize, align: "center" });
    fillText("TACTICAL TOWER DEFENSE", VW / 2, cy + ringR * 1.15 + 58, { size: 10, color: C.sub, align: "center" });
    ctx.globalAlpha = 1;
    if (t > 1) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
      fillText("\u2014 \u70B9\u51FB\u5F00\u59CB\u5DE1\u903B \u2014", VW / 2, cy + ringR * 1.15 + 92, {
        size: 13,
        color: `rgba(255,201,77,${pulse})`,
        align: "center"
      });
    }
    hitBox({ x: 0, y: 0, w: VW, h: VH, label: "", cb: () => goto("home") });
  }
  var CARD_H = 116;
  var CARD_GAP = 12;
  var homeTop = TOP_SAFE + 48;
  var homeBottom = VH - 26;
  var totalScrollMax = () => Math.max(0, LEVELS.length * (CARD_H + CARD_GAP) - (homeBottom - homeTop) + 8);
  function drawHome(time) {
    hooks = [];
    drawSpaceBg(time);
    drawHeader("\u9AD8\u5854\u9632\u7EBF \xB7 \u6218\u5F79\u9009\u62E9");
    const segW = VW - MARGIN * 2;
    const segY = TOP_SAFE + 4;
    segControl(MARGIN, segY, segW, DIFF_LIST.map((d) => DIFFICULTIES[d].name), DIFF_LIST.indexOf(app.difficulty), "diff", (i) => {
      app.difficulty = DIFF_LIST[i];
      track("difficulty_select", { difficulty: app.difficulty });
    });
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
      const y = homeTop + 8 + i * (CARD_H + CARD_GAP) - app.scroll;
      if (y + CARD_H < homeTop || y > homeBottom) return;
      panel(cardX, y, cardW, CARD_H, unlock ? C.panelLine : "rgba(124,141,176,0.15)");
      const artX = cardX + 8;
      const artY = y + 8;
      const artW = 82;
      const artH = CARD_H - 16;
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
          y: y + CARD_H - 50,
          w: 80,
          h: 38,
          label: done ? "\u91CD\u73A9" : "\u51FA\u51FB",
          color: done ? C.green : C.cyan,
          primary: !done,
          cb: () => gotoBriefing(lv.id)
        });
        hitBox({ x: cardX, y, w: cardW - 104, h: CARD_H, label: "", cb: () => gotoBriefing(lv.id) });
      } else {
        const lx = cardX + cardW - 52;
        const ly = y + CARD_H - 34;
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
          h: CARD_H,
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
      ctx.fillStyle = "rgba(34,224,255,0.25)";
      rr(VW - 4, ty, 3, thumbH, 1.5);
      ctx.fill();
      ctx.restore();
    }
    fillText("\u5FAE\u4FE1\u5C0F\u6E38\u620F \xB7 \u8BD5\u8FD0\u8425\u5305", VW / 2, VH - 12, { size: 10, color: "rgba(124,141,176,0.7)", align: "center" });
    if (showProfile) drawProfileOverlay();
  }
  function drawBriefing(time) {
    hooks = [];
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
      cb: () => {
        narrationMuted = !narrationMuted;
        store.set("srd.narrationMuted", narrationMuted ? "1" : "0");
        if (narrationMuted) stopNarration();
        else startNarration(app.levelId);
      }
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
    btn({ x: VW / 2 - 100, y: afterY + 42, w: 200, h: 54, label: "\u25B6 \u51FA \u51FB", primary: true, cb: startBattle });
    btn({ x: VW / 2 - 100, y: afterY + 118, w: 200, h: 46, label: "\u8FD4\u56DE\u9009\u5173", color: C.sub, cb: () => {
      stopNarration();
      goto("home");
    } });
  }
  var nebulaBg = new NebulaBg("assets/nebula-texture.jpg");
  var fx = null;
  var bloom = null;
  var pathPixels = [];
  var qualityHigh = readWxQualityHigh();
  var fxFrame = 0;
  var battleStartAt = 0;
  function startBattle() {
    stopNarration();
    app.engine = createEngine(app.difficulty, app.levelId);
    app.placing = null;
    app.selectedId = null;
    app.result = null;
    barScroll = 0;
    fx = new FxLayer();
    bloom = new BloomLayer(W, H);
    pathPixels = app.engine.map.paths.map((p) => p.pixels);
    battleStartAt = Date.now();
    track("game_start", { level_id: app.levelId, difficulty: app.difficulty });
    goto("battle");
  }
  function drawBattle() {
    hooks = [];
    ctx.fillStyle = "#070B18";
    ctx.fillRect(0, 0, VW, VH);
    const engine = app.engine;
    const st = engine.state;
    drawBattleScene();
    const hudY = TOP_SAFE;
    const btnSize = 40;
    const btnGap = 8;
    const btnsW = btnSize * 3 + btnGap * 2;
    const px = 12;
    const pw = VW - px - btnsW - 20;
    panel(px, hudY, pw, 44, C.panelLine, 12);
    fillText(`\u2764 ${st.lives}`, px + 16, hudY + 22, { size: 14, color: C.red, font: RES_FONT() });
    fillText(`\u25C8 ${st.gold}`, px + 92, hudY + 22, { size: 14, color: C.gold, font: RES_FONT() });
    fillText(`${st.wave}/${st.totalWaves} \u6CE2`, px + pw - 14, hudY + 22, { size: 12, color: C.cyan, align: "right", font: RES_FONT() });
    const bxs = VW - 12 - btnsW;
    btn({ x: bxs, y: hudY + 2, w: btnSize, h: btnSize, label: st.paused ? "\u25B6" : "\u23F8", cb: () => engineCmd({ type: "TOGGLE_PAUSE" }) });
    btn({ x: bxs + btnSize + btnGap, y: hudY + 2, w: btnSize, h: btnSize, label: st.speed === 2 ? "2x" : "1x", active: st.speed === 2, cb: () => engineCmd({ type: "SET_SPEED", speed: st.speed === 2 ? 1 : 2 }) });
    btn({ x: bxs + (btnSize + btnGap) * 2, y: hudY + 2, w: btnSize, h: btnSize, label: "\u2261", cb: () => {
      app.engine = null;
      goto("home");
    } });
    if (st.phase === "prep") {
      const by2 = hudY + 56;
      panel(VW / 2 - 118, by2, 236, 56, C.panelLine, 19);
      fillText(`\u7B2C ${st.wave} \u6CE2 \xB7 ${Math.max(0, Math.ceil(st.prepT))}s \u540E\u6765\u88AD`, VW / 2, by2 + 15, { size: 13, align: "center", font: RES_FONT() });
      const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
      const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
      const summary = [...new Set(groups.map((g) => `${ENEMIES[g.type].name}\xD7${g.count}`))].join(" ");
      const cCol = isBossWave ? C.pink : "#FF9F43";
      fillText(`${isBossWave ? "\u26A0 BOSS \u6CE2 \xB7 " : ""}${summary}`, VW / 2, by2 + 34, { size: 9, color: isBossWave ? C.pink : "#FF9F43", align: "center", weight: "normal" });
      fillText(isBossWave ? "\u5EFA\u8BAE\u7559\u597D\u91D1\u5E01\u4E0E\u7A7F\u7532\u706B\u529B" : "\u636E\u6B64\u63D0\u524D\u8C03\u6574\u5E03\u9632", VW / 2, by2 + 47, { size: 9, color: C.sub, align: "center", weight: "normal" });
      btn({ x: VW / 2 - 62, y: by2 + 66, w: 124, h: 36, label: "\u25B6 \u7ACB\u5373\u5F00\u6218", color: C.gold, primary: true, cb: () => engineCmd({ type: "SKIP_PREP" }) });
    }
    drawBottomBar(st);
    if (barTouch?.mode === "drag" && dragPos && barTouch.type) drawDragGhost(st, barTouch.type, dragPos);
    if (st.paused) {
      ctx.fillStyle = "rgba(7,11,24,0.6)";
      ctx.fillRect(0, 0, VW, VH);
      const pw2 = 220;
      const ph2 = 84;
      const px2 = VW / 2 - pw2 / 2;
      const py2 = (VH - BAR_H) / 2 - ph2 / 2;
      panel(px2, py2, pw2, ph2, "rgba(255,201,77,0.5)");
      fillText("\u5DF2\u6682\u505C", VW / 2, py2 + 30, { size: 16, color: C.gold, align: "center" });
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
      drawTechOverlay(st);
    } else {
      techShownAt = 0;
    }
  }
  function drawDragGhost(st, type, p) {
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
  function drawBottomBar(st) {
    ctx.fillStyle = "#0A0F20";
    ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
    ctx.strokeStyle = "rgba(34,224,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(0, VH - BAR_H + 0.5);
    ctx.lineTo(VW, VH - BAR_H + 0.5);
    ctx.stroke();
    if (st.phase === "tech") return;
    const sel = app.selectedId != null ? st.towers.find((t) => t.id === app.selectedId) : void 0;
    if (sel) {
      const def = TOWERS[sel.type];
      fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 20, { size: 14, color: def.color });
      const upCost = sel.level < 2 ? TOWERS[sel.type].levels[sel.level + 1].cost : -1;
      btn({
        x: MARGIN,
        y: VH - BAR_H + 42,
        w: VW / 2 - MARGIN - 6,
        h: 52,
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
        y: VH - BAR_H + 42,
        w: VW / 2 - MARGIN - 6,
        h: 52,
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
      fillText(`\u70B9\u51FB\u5730\u56FE\u4E0A\u7EFF\u8272\u683C\u5EFA\u9020\u300C${def.name}\u300D`, VW / 2, VH - BAR_H + 24, { size: 13, color: def.color, align: "center" });
      btn({ x: VW / 2 - 76, y: VH - BAR_H + 48, w: 152, h: 48, label: "\u53D6\u6D88\u653E\u7F6E", cb: () => {
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
      drawTower(ctx, type, 0, 30, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
      ctx.restore();
      fillText(def.name, bx + sw / 2, by + 56, { size: 12, color: disabled ? "#9AA7C2" : C.text, align: "center" });
      fillText(`\u25C8${cost}`, bx + sw / 2, by + 74, { size: 11, color: disabled ? "#C77A34" : C.gold, align: "center" });
      if (locked) {
        ctx.save();
        rr(bx, by, sw, slotH, 12);
        ctx.fillStyle = "rgba(7,11,24,0.55)";
        ctx.fill();
        ctx.strokeStyle = C.sub;
        ctx.lineWidth = 1.6;
        const lx = bx + sw / 2;
        const ly = by + 26;
        ctx.beginPath();
        ctx.rect(lx - 7, ly - 1, 14, 11);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly - 1, 5, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
        fillText(`\u7B2C${TOWER_UNLOCK[type]}\u7AE0`, bx + sw / 2, by + 74, { size: 10, color: C.sub, align: "center" });
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
  function drawTechOverlay(st) {
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
  function drawResult(time) {
    hooks = [];
    drawSpaceBg(time);
    const won = app.result.won;
    const st = app.engine.state;
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
    drawHeader("\u6218\u6597\u7ED3\u7B97", { back: () => goto("home") });
    const y0 = TOP_SAFE + 16;
    const bt = Math.min(1, t / 0.45);
    const bounce = 1 + 2.7 * (bt - 1) ** 3 + 1.7 * (bt - 1) ** 2;
    ctx.save();
    ctx.translate(VW / 2, y0);
    ctx.scale(bounce, bounce);
    fillText(won ? "\u2605 \u9632\u7EBF\u5B88\u4F4F\u4E86" : "\u2715 \u9632\u7EBF\u5931\u5B88", 0, 0, { size: 26, color: won ? C.green : C.pink, align: "center" });
    ctx.restore();
    fillText(
      won ? `\u7B2C ${app.levelId} \u7AE0 \xB7 ${LEVELS.find((l) => l.id === app.levelId)?.name ?? ""}` : `\u6491\u5230\u4E86\u7B2C ${st.wave} / ${st.totalWaves} \u6CE2`,
      VW / 2,
      y0 + 32,
      { size: 13, color: C.sub, align: "center", weight: "normal" }
    );
    const rows = [
      ["\u51FB\u6740", String(st.kills), st.kills],
      ["\u6F0F\u602A", String(st.leaked), st.leaked],
      ["\u5269\u4F59\u751F\u547D", `${st.lives} / ${st.maxLives}`, null],
      ["\u8D5A\u53D6\u91D1\u5E01", String(st.goldEarned), st.goldEarned],
      ["\u6218\u672F\u6A21\u5757", String(st.techs.length), st.techs.length]
    ];
    const px = 24;
    const pw = VW - 48;
    const py = y0 + 58;
    const rowH = 36;
    panel(px, py, pw, rows.length * rowH + 20, C.panelLine);
    rows.forEach(([k, v, num], i) => {
      const ry = py + 28 + i * rowH;
      fillText(k, px + 22, ry, { size: 13, color: C.sub, weight: "normal" });
      const shown = num === null ? v : String(Math.round(num * Math.min(1, Math.max(0, (t - 0.25 - i * 0.12) / 0.6))));
      fillText(shown, px + pw - 22, ry, { size: 16, align: "right", font: RES_FONT() });
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
    const grade = !won ? "D" : st.leaked === 0 ? "S" : st.leaked <= 2 ? "A" : "B";
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
    fillText(won ? "\u4E0B\u4E00\u7AE0\u89E3\u9501\u5DF2\u8BB0\u5F55" : "\u518D\u6311\u6218\u4E00\u6B21\u5C31\u80FD\u901A\u8FC7", gx + 44, gy3 + 18, { size: 10, color: C.sub, align: "center", weight: "normal" });
    ctx.restore();
    let y = py + rows.length * rowH + 40;
    const nextId = app.levelId + 1;
    const hasNext = LEVELS.some((l) => l.id === nextId);
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
  function drawCodex(time) {
    hooks = [];
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
    codexMaxScroll = Math.max(0, endY - y0 - (bottom - top) + 20);
    codex.scroll = Math.max(0, Math.min(codexMaxScroll, codex.scroll));
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
    if (codexMaxScroll > 0) {
      const viewH = bottom - top;
      const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMaxScroll)));
      const ty = top + (viewH - thumbH) * (codex.scroll / codexMaxScroll);
      ctx.save();
      ctx.fillStyle = "rgba(34,224,255,0.25)";
      rr(VW - 4, ty, 3, thumbH, 1.5);
      ctx.fill();
      ctx.restore();
    }
    if (showProfile) drawProfileOverlay();
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
        const charge = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
        drawTower(ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge, time, { ticks: false });
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
        for (const ev of app.engine.drainEvents()) {
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
            sfx.play(ev.won ? "victory" : "defeat");
            buzz(ev.won ? "medium" : "heavy");
            app.result = { won: ev.won };
            const st0 = app.engine.state;
            track("game_end", {
              level_id: app.engine.level.id,
              difficulty: app.difficulty,
              result: ev.won ? "win" : "lose",
              wave_reached: st0.wave,
              duration_sec: Math.round((Date.now() - battleStartAt) / 1e3),
              kills: st0.kills,
              leaks: st0.leaked
            });
            if (ev.won) recordLevelClear(app.engine.level.id);
            goto("result");
          }
        }
      }
      syncMusic();
      if (app.screen === "splash") drawSplash(now / 1e3);
      else if (app.screen === "home") drawHome(now / 1e3);
      else if (app.screen === "briefing") drawBriefing(now / 1e3);
      else if (app.screen === "battle" && app.engine) drawBattle();
      else if (app.screen === "codex") drawCodex(now / 1e3);
      else if (app.screen === "result" && app.engine) drawResult(now / 1e3);
      const ft = (Date.now() - screenAt) / 240;
      if (ft < 1) {
        ctx.fillStyle = `rgba(7,11,24,${(1 - ft).toFixed(3)})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      drawToast();
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
  var touchTime = 0;
  wx.onTouchStart((e) => {
    const p0 = e.touches[0];
    if (!p0) return;
    sfx.init();
    const p = touchPoint(p0);
    touchTime = Date.now();
    pressedBtn = null;
    for (let i = hooks.length - 1; i >= 0; i--) {
      const b = hooks[i];
      if (!b.disabled && hit(p, b)) {
        pressedBtn = b;
        break;
      }
    }
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
    const p = touchPoint(p0);
    if (app.screen === "home" || app.screen === "codex") {
      if (app.dragY == null) return;
      const max = app.screen === "home" ? totalScrollMax() : codexMaxScroll;
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
    const p0 = (e.changedTouches ?? e.touches)[0];
    if (!p0) return;
    const p = touchPoint(p0);
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
  } catch {
  }
})();
