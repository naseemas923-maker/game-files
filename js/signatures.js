/* ============================================================
 * Stickman: Warrior's Legacy
 * signatures.js — config for the three universal SIGNATURE
 * abilities: 100 SLASHES, SHADOW BREAK and FRACTURE STRIKE.
 *
 * Every value is configurable here (damage, hit count, cooldown,
 * range, knockback, duration, slow-motion, camera zoom, camera
 * shake, hit-stop, particle counts). Tweak to re-balance.
 * ============================================================ */
(function (SL) {
  "use strict";

  /* `key` maps to an Input action. `cdMulKey` selects which run
   * multiplier shrinks the cooldown. Tags are consumed by the
   * Build Power system for synergy/archetype scoring. */
  const ABILITIES = {
    hundredSlashes: {
      id: "hundredSlashes", name: "100 Slashes", key: "ability1",
      icon: "\u2727", color: "#8fd8ff", cdMulKey: "cdMul",
      tags: ["dmg", "multi", "range"],
      cd: 45, dur: 1.5, slowmo: 0.55, slowmoScale: 0.45,
      zoom: 1.07, shake: 6, hitStop: 0.12,
      // phase timings (seconds into dur)
      dashStart: 0.16, dashDur: 0.95, stepDur: 0.075, steps: 12,
      dashRange: 280, slashRadius: 82,
      perSlashDmg: 0.55, perSlashKnock: 150, perSlashParticles: 6,
      finalAt: 1.3, finalDmg: 7.0, finalRadius: 160, finalKnock: 520,
      // windup + finisher camera
      windZoom: 1.06,
    },
    shadowBreak: {
      id: "shadowBreak", name: "Shadow Break", key: "ability2",
      icon: "\u263d", color: "#c86bff", cdMulKey: "cdMul",
      tags: ["dash", "crit", "cd"],
      cd: 18, dur: 0.62, slowmo: 0.5, slowmoScale: 0.42,
      zoom: 1.12, shake: 8, hitStop: 0.1,
      // phase timings
      teleAt: 0.18, appearAt: 0.34,
      range: 300, dmg: 8.5, knock: 460, splash: 96, splashDmgMul: 0.4,
      teleParticles: 10, crossParticles: 8,
    },
    fractureStrike: {
      id: "fractureStrike", name: "Fracture Strike", key: "ability3",
      icon: "\u25c6", color: "#ffd75e", cdMulKey: "cdMul",
      tags: ["aoe", "dmg", "cd"],
      cd: 25, dur: 0.95, slowmo: 0.5, slowmoScale: 0.45,
      zoom: 1.09, shake: 11, hitStop: 0.1,
      slamAt: 0.42, radius: 205, dmg: 5.2, knock: 430, launch: 460, stun: 1.1,
      crackDur: 1.5, crackParticles: 18,
    },
  };

  /* key action -> label used by the remap UI / controls modal */
  const KEYS = {
    ability1: { name: "100 Slashes", def: "KeyQ" },
    ability2: { name: "Shadow Break", def: "KeyE" },
    ability3: { name: "Fracture Strike", def: "KeyR" },
    special: { name: "Class Ability", def: "KeyF" },
    ultimate: { name: "Class Ultimate", def: "KeyG" },
    attack: { name: "Light Attack", def: "KeyJ" },
    heavy: { name: "Heavy Attack", def: "KeyK" },
    dash: { name: "Dash", def: "ShiftLeft" },
    jump: { name: "Jump", def: "Space" },
  };

  SL.Sig = { ABILITIES, KEYS };

})(window.SL = window.SL || {});
