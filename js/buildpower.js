/* ============================================================
 * Stickman: Warrior's Legacy
 * buildpower.js — Build Power engine.
 *
 * Measures how powerful, synergistic, complete and specialized a
 * build is. Fully data-driven: new upgrades, tags, synergies,
 * evolutions, archetypes, curses and compatibility rules can be
 * added below without touching the compute pipeline.
 *
 * BuildPower = (Base + Level + Synergy + Evolution + Specialization
 *   + Diversity + CurseRisk + Completion) x EfficiencyMultiplier
 * ============================================================ */
(function (SL) {
  "use strict";
  const U = SL.U;

  /* ---------------- data-driven definitions ---------------- */

  /* base power per rarity (individual upgrades may override via `power`) */
  const POWER_BY_RARITY = { common: 18, rare: 44, epic: 90, legendary: 180, cursed: 110 };

  /* archetypes the game can detect from owned upgrade tags */
  const ARCHETYPES = [
    { id: "inferno", name: "INFERNO", icon: "\u{1F525}", color: "#ff7b2e", tags: ["fire", "burn"] },
    { id: "storm", name: "STORM", icon: "\u26A1", color: "#ffd75e", tags: ["lightning"] },
    { id: "berserker", name: "BERSERKER", icon: "\u{1FA78}", color: "#ff5252", tags: ["dmg", "crit"] },
    { id: "assassin", name: "ASSASSIN", icon: "\u{1F5E1}", color: "#c86bff", tags: ["crit", "multi"] },
    { id: "immortal", name: "IMMORTAL", icon: "\u{1F6E1}", color: "#3fe0b0", tags: ["hp", "shield", "heal"] },
    { id: "commander", name: "COMMANDER", icon: "\u{1F465}", color: "#57c8ff", tags: ["clone"] },
    { id: "phantom", name: "PHANTOM", icon: "\u{1F4A8}", color: "#9f7bff", tags: ["dash", "move", "speed"] },
    { id: "necromancer", name: "NECROMANCER", icon: "\u{1F480}", color: "#a06bff", tags: ["poison"] },
    { id: "ranger", name: "RANGER", icon: "\u{1F3F9}", color: "#7dff6a", tags: ["projectile"] },
    { id: "demolition", name: "DEMOLITIONIST", icon: "\u{1F4A5}", color: "#ffb02e", tags: ["aoe", "pierce"] },
  ];

  /* elemental affinity groups -> "Fire Synergy +80" style bonuses */
  const ELEMENTS = [
    { id: "fire", name: "Fire", tags: ["fire", "burn"] },
    { id: "storm", name: "Lightning", tags: ["lightning"] },
    { id: "frost", name: "Frost", tags: ["frost"] },
    { id: "venom", name: "Venom", tags: ["poison"] },
  ];
  const AFFINITY_POWER = { 2: 60, 3: 150, 4: 260, 5: 400 };
  const AFFINITY_STRENGTH = { 2: 45, 3: 70, 4: 88, 5: 98 };

  /* synergy power / strength per recipe id (defaults if omitted) */
  const SYNERGY_BUILD = {
    syn_fire_dash: { power: 110, strength: 75 },
    syn_light_clone: { power: 200, strength: 92 },
    syn_crit_rage: { power: 120, strength: 70 },
    syn_pierce_exp: { power: 180, strength: 88 },
    syn_ls_burn: { power: 140, strength: 78 },
    syn_frost_light: { power: 170, strength: 85 },
    syn_quick_ds: { power: 100, strength: 68 },
    syn_clone_ds: { power: 190, strength: 90 },
    syn_whirl_iron: { power: 130, strength: 72 },
    syn_gold_xp: { power: 80, strength: 55 },
    syn_leap_slam: { power: 150, strength: 80 },
    syn_home_bolt: { power: 120, strength: 74 },
    syn_ult_quick: { power: 100, strength: 66 },
    syn_thorns_aegis: { power: 130, strength: 76 },
    syn_adre_combo: { power: 120, strength: 72 },
    syn_blade_pierce: { power: 190, strength: 90 },
  };

  /* evolutions — unlocked by owning their required upgrades */
  const EVOLUTIONS = [
    { id: "evolve_inferno", name: "Inferno Heart", icon: "\u{1F525}", tags: ["fire"],
      requires: ["burn", "explosive"],
      desc: "Your flames become unquenchable. +40% damage, stronger burn.",
      apply: (r) => { r.dmgMul += 0.4; r.burnLevel = Math.max(r.burnLevel || 0, 3); },
      power: 350, strength: 90 },
    { id: "evolve_storm", name: "Storm Core", icon: "\u26A1", tags: ["lightning"],
      requires: ["lightning", "extrabolt"],
      desc: "A storm burns within you. +2 lightning levels, +15% attack speed.",
      apply: (r) => { r.lightningLevel = Math.max(r.lightningLevel || 0, 3); r.attackSpeedMul += 0.15; },
      power: 350, strength: 90 },
    { id: "evolve_phantom", name: "Phantom Heart", icon: "\u{1F4A8}", tags: ["dash"],
      requires: ["dash", "leaping"],
      desc: "You are half shadow. -40% dash cooldown, +1 jump, +15% speed.",
      apply: (r) => { r.dashCdMul *= 0.6; r.jumpMul += 0.5; r.speedMul += 0.15; },
      power: 330, strength: 85 },
  ];
  const EVO_BY_ID = {};
  EVOLUTIONS.forEach((e) => { EVO_BY_ID[e.id] = e; });

  /* build breakpoints — optional milestones that fire once per run */
  const BREAKPOINTS = [
    {
      at: 500, id: "bp500", title: "BUILD BREAKTHROUGH", sub: "A legendary event stirs in the distance.",
      fire(game) {
        SL.Audio.play("levelup");
        SL.Particles.ring(game.player.x, game.player.y - 40, "#ffd27a", 90, 0.8);
        game.coinsEarned += 50; game.gemsEarned += 3; game.xpEarned += 40;
        game.spawnPickup("coin", game.scrollX + game.viewW * 0.4, game.groundY - 50);
        game.spawnPickup("gem", game.scrollX + game.viewW * 0.6, game.groundY - 50);
      },
    },
    {
      at: 1000, id: "bp1000", title: "ELITE ENCOUNTER", sub: "Power draws the strongest enemies to you.",
      fire(game) {
        SL.Audio.play("bossWarn");
        game.screenShake(5, 0.4);
        game.spawnEnemy("grunt", game.scrollX + game.viewW * 0.5, true);
        game.spawnEnemy("grunt", game.scrollX + game.viewW * 0.7, true);
        game.coinsEarned += 60; game.gemsEarned += 4;
      },
    },
    {
      at: 1500, id: "bp1500", title: "LEGENDARY CHEST", sub: "Your build summons a legendary reward.",
      fire(game) {
        SL.Audio.play("gem");
        SL.Particles.burst(game.player.x, game.player.y - 40, "#ffb02e", 24, 260, 3, 0.7, 0);
        game.coinsEarned += 150; game.gemsEarned += 8; game.xpEarned += 120;
        for (let i = 0; i < 4; i++) game.spawnPickup("coin", game.scrollX + game.viewW * 0.3 + i * 40, game.groundY - 50);
        for (let i = 0; i < 2; i++) game.spawnPickup("gem", game.scrollX + game.viewW * 0.3 + i * 40, game.groundY - 90);
      },
    },
    {
      at: 2000, id: "bp2000", title: "MYTHIC CHALLENGE", sub: "The realm acknowledges your might. +25% damage for the run.",
      fire(game) {
        SL.Audio.play("levelup");
        game.screenShake(6, 0.5);
        game.run.dmgMul += 0.25;
        game.run.armor += 6;
        SL.Particles.ring(game.player.x, game.player.y - 40, "#c86bff", 120, 1);
      },
    },
    {
      at: 3000, id: "bp3000", title: "SPECIAL BOSS", sub: "A forgotten warden has awakened to test your legend.",
      fire(game) {
        SL.Audio.play("bossWarn");
        game.screenShake(8, 0.6);
        game.spawnEnemy("tank", game.scrollX + game.viewW * 0.55, true);
        game.run.dmgMul += 0.25;
        game.coinsEarned += 250; game.gemsEarned += 12; game.xpEarned += 200;
        SL.Particles.ring(game.player.x, game.player.y - 40, "#ff5252", 140, 1.1);
      },
    },
  ];

  /* build categories used for the diversity score */
  const CATEGORIES = [
    { id: "dmg", tags: ["dmg"] },
    { id: "crit", tags: ["crit"] },
    { id: "survive", tags: ["hp", "shield", "heal"] },
    { id: "mobility", tags: ["speed", "dash", "move"] },
    { id: "cd", tags: ["cd", "ult"] },
    { id: "element", tags: ["fire", "lightning", "frost", "poison"] },
    { id: "utility", tags: ["aoe", "multi", "pierce", "clone", "projectile"] },
  ];

  /* specialization mastery curve: share -> bonus power (diminishing) */
  const SPEC_CURVE = [[0.2, 20], [0.4, 60], [0.6, 130], [0.8, 250], [1.0, 400]];

  /* ---------------- tier table ---------------- */
  const TIERS = [
    { at: 2500, name: "MYTHIC" },
    { at: 1500, name: "LEGENDARY" },
    { at: 1000, name: "ELITE" },
    { at: 700, name: "POWERFUL" },
    { at: 400, name: "STRONG" },
    { at: 200, name: "DEVELOPING" },
  ];

  function tierInfo(total) {
    let current = { at: 0, name: "WEAK" };
    let idx = -1;
    for (let i = 0; i < TIERS.length; i++) {
      if (total >= TIERS[i].at) { current = TIERS[i]; idx = i; break; }
    }
    let next = null;
    if (idx === -1) next = TIERS[TIERS.length - 1];
    else if (idx > 0) next = TIERS[idx - 1];
    return { current, next };
  }

  function curveValue(points, x) {
    if (x <= points[0][0]) return points[0][1] * Math.max(0, x / points[0][0]);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      if (x >= x0 && x <= x1) return U.lerp(y0, y1, (x - x0) / (x1 - x0));
    }
    return points[points.length - 1][1];
  }

  function affinityPower(n) { return AFFINITY_POWER[Math.min(5, n)] || 0; }
  function affinityStrength(n) { return AFFINITY_STRENGTH[Math.min(5, n)] || 0; }

  function rarityWeight(rarity) {
    return { common: 1, rare: 1.5, epic: 2.2, legendary: 3, cursed: 2.6 }[rarity] || 1;
  }

  /* ---------------- efficiency (0-100) ---------------- */
  function efficiencyOf(run) {
    const dmg = run.dmgMul || 1;
    const asp = run.attackSpeedMul || 1;
    const cc = run.critChance || 0;
    const cm = run.critMul || 1.6;
    const ls = run.lifesteal || 0;
    const ele = run.burn || run.lightning || run.poison || run.frost;
    const multi = (run.lightStrikes || 1) > 1;
    const tank = (run.maxHpFlat || 0) + (run.maxHpMul || 1) * 8 + (run.armor || 0);
    let s = 50;
    if (dmg >= 1.5) s += 8;
    if (asp >= 1.3) s += 8;
    if (cc >= 0.2) s += 6;
    if (cc >= 0.2 && cm < 1.7) s -= 6;
    if (asp >= 1.5 && dmg < 1.25) s -= 10;
    if (ls > 0 && dmg < 1.2) s -= 5;
    if (ls > 0 && dmg >= 1.5) s += 6;
    if (ele && asp >= 1.2) s += 8;
    if (multi && (cc >= 0.2 || dmg >= 1.5)) s += 6;
    if (tank >= 5 && (run.regen || 0) > 0) s += 6;
    if ((run.rangeMul || 1) >= 1.5 && dmg >= 1.3) s += 4;
    if ((run.boltCount || 0) >= 5 && run.homing) s += 4;
    return U.clamp(Math.round(s), 40, 100);
  }

  /* ---------------- main compute ---------------- */
  function compute(game) {
    const run = game.run || {};
    const owned = run.upgradeLevels || {};
    const defs = SL.Upgrades;
    if (!defs || !defs.BY_ID) return emptyInfo();

    /* per-upgrade tallies */
    let basePower = 0, levelPower = 0;
    let curseCount = 0, cursePower = 0, synCount = 0;
    let evolutionCount = 0, evolutionPower = 0;
    let completionPower = 0, distinct = 0;
    const curseNames = [];
    const tagCounts = {};
    const elementCounts = {};
    const ownedTagged = {};

    for (const id in owned) {
      const lvl = owned[id];
      if (!lvl) continue;
      const def = defs.BY_ID[id];
      if (!def) continue;
      distinct++;
      const bp = def.power || POWER_BY_RARITY[def.rarity] || 20;
      basePower += bp;
      levelPower += Math.round(bp * 0.25 * Math.pow(lvl - 1, 0.82));
      if (def.rarity === "cursed") {
        curseCount++;
        cursePower += def.cursePower || 140;
        curseNames.push(def.name);
      }
      const w = rarityWeight(def.rarity);
      for (const tag of def.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + w;
        (ownedTagged[tag] = ownedTagged[tag] || []).push(def);
      }
      for (const el of ELEMENTS) {
        if (def.tags.some((t) => el.tags.indexOf(t) !== -1)) {
          elementCounts[el.id] = (elementCounts[el.id] || 0) + 1;
          break;
        }
      }
      if (lvl >= def.max) completionPower += 30;
    }
    cursePower += Math.max(0, curseCount - 1) * 40;

    /* ---- signature abilities (100 Slashes / Shadow Break / Fracture Strike) ----
     * Build Power rewards builds whose upgrade tags resonate with a signature
     * ability's tags (melee/multi-hit/ultimate, dash/shadow/critical, area/ability). */
    const sigDetails = [];
    let sigPower = 0;
    if (SL.Sig && SL.Sig.ABILITIES) {
      for (const sid of (run.sigAbilities || [])) {
        const sig = SL.Sig.ABILITIES[sid];
        if (!sig) continue;
        let fit = 0, matching = 0;
        for (const t of sig.tags) {
          const n = tagCounts[t] || 0;
          if (n > 0) { matching++; fit += Math.min(60, n * 24); }
        }
        if (matching > 0) {
          const bonus = 35 + fit;
          sigPower += bonus;
          sigDetails.push({ name: sig.name, id: sid, tags: sig.tags, fit: Math.round(fit), power: bonus });
        }
      }
    }

    /* ---- synergies + elemental affinity ---- */
    const synDetails = [];
    let synergyPower = 0, synW = 0, synS = 0;
    for (const synId in (run.synergiesActive || {})) {
      if (!run.synergiesActive[synId]) continue;
      const syn = defs.SYN_BY_ID[synId];
      if (!syn) continue;
      const cfg = SYNERGY_BUILD[synId] || { power: 80, strength: 60 };
      synCount++;
      synergyPower += cfg.power;
      synDetails.push({ name: syn.name, kind: "recipe", power: cfg.power, strength: cfg.strength });
      synS += cfg.strength * cfg.power; synW += cfg.power;
    }
    for (const el of ELEMENTS) {
      const n = elementCounts[el.id] || 0;
      if (n >= 2) {
        const ap = affinityPower(n), ast = affinityStrength(n);
        synergyPower += ap;
        synDetails.push({ name: el.name + " affinity", kind: "element", power: ap, strength: ast, count: n });
        synS += ast * ap; synW += ap;
      }
    }
    const synergyStrength = synW ? Math.round(synS / synW) : 0;

    /* ---- evolutions ---- */
    const evoDetails = [];
    for (const id in (run.evolutions || {})) {
      const evo = EVO_BY_ID[id];
      if (!evo) continue;
      evolutionCount++;
      let fit = 0;
      for (const tag of evo.tags) {
        const n = (ownedTagged[tag] || []).length;
        fit += Math.min(80, n * 30);
      }
      fit = Math.min(120, fit);
      evolutionPower += evo.power + fit;
      evoDetails.push({ name: evo.name, power: evo.power, fit, strength: evo.strength });
    }
    completionPower += evolutionCount * 40;

    /* ---- specialization / archetype ---- */
    let totalWeight = 0;
    for (const k in tagCounts) totalWeight += tagCounts[k];
    const archScores = ARCHETYPES
      .map((a) => {
        let s = 0;
        for (const t of a.tags) s += tagCounts[t] || 0;
        return { arch: a, score: s };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    let specPower = 0, specShare = 0, identity = "VERSATILE WARRIOR", archId = null, archName = "BALANCED", archIcon = "\u2694";
    if (totalWeight > 0 && archScores.length) {
      const top = archScores[0];
      specShare = top.score / totalWeight;
      specPower = Math.round(curveValue(SPEC_CURVE, specShare));
      archId = top.arch.id;
      archName = top.arch.name;
      archIcon = top.arch.icon;
      const second = archScores[1];
      const names = [top.arch.name];
      if (second && second.score / totalWeight >= 0.22) names.push(second.arch.name);
      identity = (names.length > 1 && names[0] === names[1] ? names[0] : names.join(" ")) + " WARRIOR";
    }

    /* ---- diversity ---- */
    let catCount = 0;
    for (const c of CATEGORIES) {
      for (const t of c.tags) {
        if (tagCounts[t]) { catCount++; break; }
      }
    }
    const diversityScore = Math.min(100, Math.round(catCount * 15 + (catCount >= 3 ? 10 : 0)));

    /* ---- efficiency + totals ---- */
    const efficiency = efficiencyOf(run);
    const subtotal = basePower + levelPower + synergyPower + sigPower + evolutionPower + specPower + diversityScore + cursePower + completionPower;
    const mult = 0.8 + 0.006 * efficiency;
    const total = Math.round(subtotal * mult);

    const tiers = tierInfo(total);
    const currentAt = tiers.current.at, nextAt = tiers.next ? tiers.next.at : null;
    const progress = nextAt ? Math.min(1, (total - currentAt) / (nextAt - currentAt)) : 1;

    return {
      total, subtotal, mult,
      basePower: Math.round(basePower),
      levelPower: Math.round(levelPower),
      synergyPower: Math.round(synergyPower),
      sigPower: Math.round(sigPower),
      evolutionPower: Math.round(evolutionPower),
      specPower,
      diversityScore,
      cursePower: Math.round(cursePower),
      completionPower: Math.round(completionPower),
      efficiency,
      efficiencyBonus: Math.round(subtotal * (mult - 1)),
      synergyStrength,
      synDetails,
      sigDetails,
      evoDetails,
      curseCount, curseNames,
      evolutionCount,
      identity, archId, archName, archIcon, specShare: Math.round(specShare * 100),
      catCount, distinct,
      synCount,
      rank: tiers.current.name,
      nextRank: tiers.next ? tiers.next.name : null,
      nextAt,
      progress,
    };
  }

  function emptyInfo() {
    return {
      total: 0, subtotal: 0, mult: 1,
      basePower: 0, levelPower: 0, synergyPower: 0, evolutionPower: 0,
      specPower: 0, diversityScore: 0, cursePower: 0, completionPower: 0,
      efficiency: 50, efficiencyBonus: 0, synergyStrength: 0, synDetails: [], evoDetails: [],
      sigPower: 0, sigDetails: [],
      curseCount: 0, curseNames: [], evolutionCount: 0,
      identity: "VERSATILE WARRIOR", archId: null, archName: "BALANCED", archIcon: "\u2694", specShare: 0,
      catCount: 0, distinct: 0, synCount: 0,
      rank: "WEAK", nextRank: "DEVELOPING", nextAt: 200, progress: 0,
    };
  }

  /* evolutions the player qualifies for right now */
  function pendingEvolutions(run) {
    const owned = run.upgradeLevels || {};
    const have = (id) => (owned[id] || 0) > 0;
    return EVOLUTIONS.filter((e) => !(run.evolutions || {})[e.id] && e.requires.every(have));
  }

  function applyEvolution(run, id) {
    const evo = EVO_BY_ID[id];
    if (!evo) return null;
    if (!run.evolutions) run.evolutions = {};
    run.evolutions[id] = true;
    evo.apply(run);
    return evo;
  }

  function canApplyEvolution(run, id) {
    const evo = EVO_BY_ID[id];
    if (!evo || (run.evolutions || {})[id]) return false;
    const owned = run.upgradeLevels || {};
    return evo.requires.every((rid) => (owned[rid] || 0) > 0);
  }

  /* ---------------- recompute + side effects ---------------- */
  function recompute(game, reason, msg) {
    if (!game || !game.run) return null;
    const prev = game.buildInfo || null;
    const prevTotal = game.buildPower || 0;
    const info = compute(game);
    game.buildInfo = info;
    game.buildPower = info.total;

    // track build peaks for challenges
    if (!game.buildPeaks) game.buildPeaks = { bp: 0, noCurse: 0, twoCat: 0, threeSyn: 0, curse: 0 };
    const p = game.buildPeaks;
    p.bp = Math.max(p.bp, info.total);
    if (info.curseCount === 0) p.noCurse = Math.max(p.noCurse, info.total);
    if (info.catCount <= 2) p.twoCat = Math.max(p.twoCat, info.total);
    if (info.synCount >= 3) p.threeSyn = Math.max(p.threeSyn, info.total);
    if (info.curseCount > 0) p.curse = Math.max(p.curse, info.total);

    // breakpoints (once each)
    if (game.bpFired === undefined) game.bpFired = {};
    for (const bp of BREAKPOINTS) {
      if (info.total >= bp.at && !game.bpFired[bp.id]) {
        game.bpFired[bp.id] = true;
        if (game.state === "playing") {
          bp.fire(game);
          if (SL.UI && SL.UI.toast) SL.UI.toast(bp.title + " \u2014 " + bp.sub, "breakpoint");
        }
      }
    }

    // HUD + animation
    if (SL.UI) {
      if (SL.UI.updateBuildHUD) SL.UI.updateBuildHUD(info);
      if (prev && prevTotal !== info.total && reason && SL.UI.buildPowerAnim) {
        let r = reason;
        if (prev.rank !== "MYTHIC" && info.rank === "MYTHIC") r = "mythic";
        SL.UI.buildPowerAnim(prevTotal, info.total, r, msg);
      }
    }
    return info;
  }

  /* finalize build records into persistent save on run end */
  function recordEndRun(game) {
    const save = SL.Save.get();
    const info = game.buildInfo || compute(game);
    const pb = save.personalBest;
    pb.buildPower = Math.max(pb.buildPower || 0, info.total);
    pb.synergy = Math.max(pb.synergy || 0, info.synergyStrength);
    pb.specialization = Math.max(pb.specialization || 0, info.specShare);
    pb.evolutions = Math.max(pb.evolutions || 0, info.evolutionCount);
    pb.curses = Math.max(pb.curses || 0, info.curseCount);
    SL.Save.save();
    return info;
  }

  SL.BuildPower = {
    compute, recompute, recordEndRun,
    tierInfo, pendingEvolutions, applyEvolution, canApplyEvolution,
    EVOLUTIONS, EVO_BY_ID, ARCHETYPES, BREAKPOINTS,
  };

})(window.SL = window.SL || {});
