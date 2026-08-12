/* ============================================================
 * Stickman: Warrior's Legacy
 * leaderboard.js — leaderboard system behind a clean async API
 *                  layer so a real online backend can be swapped
 *                  in later without touching the UI.
 *
 * NOTE: Without a backend, boards are local/demo data. Scores are
 * never presented as real online scores.
 * ============================================================ */
(function (SL) {
  "use strict";

  const BOARDS = ["global", "weekly", "friends", "class", "personal", "build", "synergy", "buildboss", "buildcurse"];

  /* which field each board ranks by */
  function statOf(board, e) {
    switch (board) {
      case "build": return e.buildPower || 0;
      case "synergy": return e.synergy || 0;
      case "buildboss": return (e.buildPower || 0) + (e.bosses ? 4000 : 0);
      case "buildcurse": return (e.buildPower || 0);
      default: return e.score || 0;
    }
  }

  function labelFor(board) {
    switch (board) {
      case "build": return "Build Power";
      case "synergy": return "Synergy";
      case "buildboss": return "Build + Boss";
      case "buildcurse": return "Cursed Build";
      default: return "Score";
    }
  }

  function weekKey() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / 86400000);
    return now.getFullYear() + "-W" + Math.ceil((days + start.getDay() + 1) / 7);
  }

  function seedEntries(rng, count, prefix) {
    const names = ["Blaze", "IronWill", "Shadowstep", "Luna", "Kratos", "Nyx", "Thorne", "Vex", "Ashra", "Zephyr", "Drakon", "Mira", "Rook", "Sable", "Kilo", "Fang", "Wisp", "Cinder", "Onyx", "Rune"];
    const classes = ["warrior", "assassin", "berserker", "guardian", "ranger", "shadowmage"];
    const out = [];
    let score = 320000;
    for (let i = 0; i < count; i++) {
      score = Math.max(2000, score * (0.78 + rng() * 0.25));
      out.push({
        name: prefix + names[Math.floor(rng() * names.length)] + (Math.floor(rng() * 900) + 100),
        score: Math.floor(score),
        cls: classes[Math.floor(rng() * classes.length)],
        date: Date.now() - Math.floor(rng() * 7) * 86400000,
        buildPower: Math.floor(300 + rng() * 2600),
        synergy: Math.floor(20 + rng() * 80),
        curses: rng() < 0.4 ? 1 + Math.floor(rng() * 3) : 0,
        bosses: Math.floor(rng() * 4),
      });
    }
    return out;
  }

  class Leaderboard {
    constructor() {
      this.api = null; // optional real backend adapter: {get(board, args), submit(entry)}
      this.cache = {};
      this.busy = false;
    }

    /* swap in a real backend later, e.g. SL.Leaderboard.connect(MyBackend) */
    connect(adapter) {
      this.api = adapter;
    }

    _localEntries(board, cls) {
      const save = SL.Save.get();
      if (board === "weekly") {
        const wk = weekKey();
        if (save.weeklyWeek !== wk) {
          const rng = SL.U.mulberry32(SL.U.hashCode(wk));
          save.weeklyScores = seedEntries(rng, 24, "");
          save.weeklyWeek = wk;
          SL.Save.save();
        }
        return save.weeklyScores.slice();
      }
      if (board === "personal") {
        const pb = save.personalBest;
        const me = this._meEntry();
        const entries = [];
        if (pb.score > 0) entries.push({ name: save.playerName, score: pb.score, cls: save.selectedWarrior, date: 0, me: true });
        if (me && me.score > 0) {
          const exists = entries.some((e) => e.score === me.score);
          if (!exists) entries.push(me);
        }
        return entries.sort((a, b) => b.score - a.score);
      }
      let entries = save.leaderboardLocal[board + (cls ? ":" + cls : "")];
      if (!entries) {
        const rng = SL.U.mulberry32(SL.U.hashCode(board + (cls || "") + "seed"));
        entries = seedEntries(rng, 18, "");
        if (cls) entries = entries.filter((e) => e.cls === cls);
        save.leaderboardLocal[board + (cls ? ":" + cls : "")] = entries;
        SL.Save.save();
      }
      entries = entries.slice();
      if (board === "buildcurse") entries = entries.filter((e) => e.curses > 0);
      entries.sort((a, b) => statOf(board, b) - statOf(board, a));
      return entries;
    }

    _meEntry() {
      const save = SL.Save.get();
      return { name: save.playerName, score: save.personalBest.score, cls: save.selectedWarrior, date: Date.now(), me: true };
    }

    get(board, opts) {
      opts = opts || {};
      const cls = opts.cls;
      return new Promise((resolve) => {
        if (this.api) {
          this.api.get(board, opts).then(resolve).catch(() => resolve(this._localEntries(board, cls)));
          return;
        }
        setTimeout(() => resolve(this._localEntries(board, cls)), 120);
      });
    }

    submit(entry) {
      const save = SL.Save.get();
      const now = Date.now();
      entry.date = now;

      // personal / global local storage
      const boards = entry.board ? [entry.board] : BOARDS;
      for (const b of boards) {
        if (b === "weekly") {
          const wk = weekKey();
          if (save.weeklyWeek !== wk) {
            save.weeklyScores = [];
            save.weeklyWeek = wk;
          }
          save.weeklyScores.push(entry);
          save.weeklyScores = save.weeklyScores.sort((a, b2) => b2.score - a.score).slice(0, 50);
        } else if (b === "personal") {
          if (entry.score > save.personalBest.score) save.personalBest.score = Math.floor(entry.score);
          if (entry.distance > save.personalBest.distance) save.personalBest.distance = Math.floor(entry.distance);
        } else {
          const key = b + (entry.cls ? ":" + entry.cls : "");
          const list = save.leaderboardLocal[key] || [];
          list.push({
            name: entry.name, score: entry.score, cls: entry.cls, date: now,
            buildPower: entry.buildPower || 0, synergy: entry.synergy || 0,
            bosses: entry.bosses || 0, curses: entry.curses || 0,
          });
          save.leaderboardLocal[key] = list.sort((a, b2) => statOf(b, b2) - statOf(b, a)).slice(0, 50);
        }
      }
      SL.Save.recordRun(entry);
      SL.Save.save();

      if (this.api) {
        this.api.submit(entry).catch(() => {});
      }
      return Promise.resolve(true);
    }

    async rankOf(board, score, cls) {
      const entries = await this.get(board, { cls });
      let rank = entries.length + 1;
      for (let i = 0; i < entries.length; i++) {
        if (score >= entries[i].score) { rank = i + 1; break; }
      }
      return { rank, total: entries.length };
    }
  }

  SL.Leaderboard = new Leaderboard();
  SL.Leaderboard.statOf = statOf;
  SL.Leaderboard.labelFor = labelFor;
  SL.Leaderboard.BOARDS = BOARDS;

})(window.SL = window.SL || {});
