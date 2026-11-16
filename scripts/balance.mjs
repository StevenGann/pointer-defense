// Headless balance harness: a deterministic, scripted player that plays the whole game with no
// rendering, importing src/core directly (Node 22.18+/23.6+ strips TypeScript types natively).
//
// The player is "competent but not expert": it builds a serpentine wall maze (forcing the route to
// lengthen, which is the mazing mechanic), covers the route with a sensible tower mix, upgrades
// cheaply, and clicks the front-most enemy at a fixed rate with a configurable weak-point accuracy.
// It never sells. It may reboot once at a configurable wave and replay with the banked specs.
//
// Exit code 0 when the session reaches --to, 1 when the run ends early (integrity hit 0).

import {
  createRunState,
  placeTower,
  startWave,
  tick,
  pointerDown,
  pointerUp,
  currentPath,
  upgradeTower,
  restartWindows,
} from '../src/core/state.ts';
import { TOWER_STATS, upgradeCost } from '../src/core/towers.ts';
import { radiusOf } from '../src/core/enemies.ts';
import { buildField, isSealed, pathTiles } from '../src/core/pathfield.ts';
import { COLS, ROWS, SPAWN, EXIT, tileAt } from '../src/core/grid.ts';
import { defaultProfile, SPEC_CAPS } from '../src/core/save.ts';
import { TICK_HZ } from '../src/core/time.ts';

// --- CLI flags --------------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(name);
}

const to = Math.max(1, parseInt(flag('--to', '100'), 10) || 100);
const rebootAtRaw = parseInt(flag('--reboot-at', '60'), 10);
const rebootAt = Number.isFinite(rebootAtRaw) ? rebootAtRaw : 60; // 0 disables rebooting
const accuracy = Math.min(1, Math.max(0, parseFloat(flag('--accuracy', '0.35')) || 0));
const cps = Math.max(0.1, parseFloat(flag('--cps', '3')) || 3);
const quiet = hasFlag('--quiet');

// --- Deterministic PRNG (mulberry32), independent of the sim's own stream ----------------------
function makeRng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
const rng = makeRng(0x9e3779b9 ^ (Math.round(accuracy * 1000) << 8) ^ Math.round(cps * 10));

// --- The maze ---------------------------------------------------------------------------------
// A fixed serpentine of three partial walls (top-anchored, bottom-anchored, top-anchored). Single
// towers cannot maze an open board; only contiguous walls force the route around their end. This
// plan lengthens the route from 22 to 40 tiles and never seals at any prefix. Each wall is built
// from the spawn/exit row outward so every early tower both blocks the route and covers it.
function wallOutward(col, rows) {
  const sorted = [...rows].sort((a, b) => Math.abs(a - 6) - Math.abs(b - 6) || a - b);
  return sorted.map((row) => ({ col, row }));
}
const WALL_PLAN = [
  ...wallOutward(6, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 1, gap at bottom
  ...wallOutward(10, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // wall 2, gap at top
  ...wallOutward(14, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 3, gap at bottom
];

/** Cap on towers: the maze walls plus a full ring of route coverage, a competent-not-expert board. */
const MAX_TOWERS = 45;

// --- Build policy -----------------------------------------------------------------------------

const idx = (c, r) => r * COLS + c;

function neighbours(c, r) {
  const out = [];
  if (c > 0) out.push([c - 1, r]);
  if (c < COLS - 1) out.push([c + 1, r]);
  if (r > 0) out.push([c, r - 1]);
  if (r < ROWS - 1) out.push([c, r + 1]);
  return out;
}

function adjacentToPath(path, c, r) {
  return neighbours(c, r).some(([nc, nr]) => path.some((t) => t.col === nc && t.row === nr));
}

function coverCount(path, c, r, range) {
  let n = 0;
  for (const t of path) {
    const dx = t.col + 0.5 - (c + 0.5);
    const dy = t.row + 0.5 - (r + 0.5);
    if (dx * dx + dy * dy <= range * range) n++;
  }
  return n;
}

/** Choose a coverage placement beside the route (never on it), scoring route coverage first. */
function chooseCoverageTile(s) {
  const path = currentPath(s);
  const cornerSet = new Set();
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.col - a.col !== c.col - b.col || b.row - a.row !== c.row - b.row) {
      cornerSet.add(idx(b.col, b.row));
    }
  }
  let best = null;
  let bestScore = -Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(s.grid, c, r) !== 'buildable') continue;
      const i = idx(c, r);
      if (s.blocked.has(i)) continue;
      if (!adjacentToPath(path, c, r)) continue;
      const blocked = new Set(s.blocked);
      blocked.add(i);
      if (isSealed(s.grid, blocked, SPAWN, EXIT)) continue;
      // Coverage must not re-route: the maze's route length is decided by the wall plan alone.
      if (pathTiles(buildField(s.grid, blocked), SPAWN).length !== path.length) continue;
      const cover = coverCount(path, c, r, TOWER_STATS.gun.range);
      const corner = neighbours(c, r).some(([nc, nr]) => cornerSet.has(idx(nc, nr)));
      const score = cover * 10 + (corner ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { col: c, row: r, corner };
      }
    }
  }
  return best;
}

function countTowers(s, kind) {
  let n = 0;
  for (const t of s.towers) if (t.kind === kind) n++;
  return n;
}

function frostTarget(wave) {
  return wave >= 12 ? Math.min(4, 1 + Math.floor((wave - 12) / 10)) : 0;
}
function beaconTarget(wave) {
  return wave >= 16 ? Math.min(3, 1 + Math.floor((wave - 16) / 20)) : 0;
}

/** Pick the tower kind for a placement, per the build policy. */
function chooseKind(s, wave, corner) {
  if (countTowers(s, 'frost') < frostTarget(wave)) return 'frost';
  if (countTowers(s, 'beacon') < beaconTarget(wave)) return 'beacon';
  if (corner && s.economy.salvage >= TOWER_STATS.cannon.cost) return 'cannon';
  return 'gun';
}

/** Upgrade any tower whose next step is cheaper than a new tower of the same kind. */
function upgradePass(s) {
  for (let guard = 0; guard < 400; guard++) {
    let done = true;
    for (const t of s.towers) {
      const cost = upgradeCost(t);
      if (cost === null || cost >= TOWER_STATS[t.kind].cost) continue;
      if (s.economy.salvage < cost) continue;
      if (upgradeTower(s, t.col, t.row)) {
        done = false;
        break;
      }
    }
    if (done) break;
  }
}

/** Build-phase policy: finish the maze, upgrade cheaply, then place coverage towers. */
function buildPhase(s, wave, wallIdx) {
  let nextWall = wallIdx;
  while (nextWall < WALL_PLAN.length && s.towers.length < MAX_TOWERS && s.economy.salvage >= TOWER_STATS.gun.cost) {
    const t = WALL_PLAN[nextWall];
    if (!placeTower(s, 'gun', t.col, t.row)) break;
    nextWall++;
  }
  upgradePass(s);
  for (let guard = 0; guard < 400; guard++) {
    if (s.towers.length >= MAX_TOWERS) break;
    const tile = chooseCoverageTile(s);
    if (!tile) break;
    const kind = chooseKind(s, wave, tile.corner);
    if (s.economy.salvage < TOWER_STATS[kind].cost) break;
    placeTower(s, kind, tile.col, tile.row);
  }
  return nextWall;
}

// --- Click policy -----------------------------------------------------------------------------

function frontMostEnemy(s) {
  let best = null;
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

function doClick(s) {
  const target = frontMostEnemy(s);
  if (!target) return;
  const r = radiusOf(target);
  const h = target.heading;
  const weak = rng() < accuracy;
  const ang = weak ? h : h + Math.PI / 2;
  pointerDown(s, target.x + 0.5 * r * Math.cos(ang), target.y + 0.5 * r * Math.sin(ang));
  pointerUp(s);
}

// --- Spec allocation --------------------------------------------------------------------------

/** Spend banked specs into levels: tower damage first, a little integrity, then the rest. */
function allocateSpecs(profile) {
  const buy = (kind, max) => {
    while (profile.unspentSpecs > 0 && profile.specs[kind] < max && profile.specs[kind] < SPEC_CAPS[kind]) {
      profile.specs[kind] += 1;
      profile.unspentSpecs -= 1;
    }
  };
  buy('cpu', 6);
  buy('disk', 6);
  buy('cpu', SPEC_CAPS.cpu);
  buy('gpu', SPEC_CAPS.gpu);
  buy('ram', SPEC_CAPS.ram);
}

// --- Wave / session loop ----------------------------------------------------------------------

function playWave(s, wave, leakList) {
  if (!startWave(s)) return { status: 'ended' };
  const clickInterval = Math.max(1, Math.round(TICK_HZ / cps));
  const dmgStart = { tower: s.economy.damage.tower, pointer: s.economy.damage.pointer };
  let clicks = 0;
  let guard = 0;
  while (s.phase === 'wave') {
    if (s.enemies.length > 0 && clicks % clickInterval === 0) doClick(s);
    tick(s);
    clicks++;
    if (++guard > TICK_HZ * 300) break; // safety; a wave never lasts 5 minutes
  }
  const towerDmg = s.economy.damage.tower - dmgStart.tower;
  const clickDmg = s.economy.damage.pointer - dmgStart.pointer;
  const total = towerDmg + clickDmg;
  const towerPct = total > 0 ? Math.round((towerDmg / total) * 100) : 0;
  leakList.push({ wave, leaks: s.leaksThisWave });
  if (!quiet) {
    const w = String(wave).padStart(2, '0');
    console.log(
      `w ${w} leaks ${s.leaksThisWave} hp ${s.integrity} sal ${s.economy.salvage} ` +
        `towers ${s.towers.length} route ${currentPath(s).length} ` +
        `towerDmg ${towerPct}% clickDmg ${100 - towerPct}%`,
    );
  }
  if (s.phase === 'halted') return { status: 'died' };
  if (s.phase === 'victory' || wave >= to) return { status: 'reached' };
  return { status: 'cleared' };
}

/** Play one full run from a fresh state; returns the outcome. */
function playRun(profile, rebootAtWave, label) {
  const s = createRunState(profile);
  const leakList = [];
  let wallIdx = 0;
  if (!quiet) console.log(`--- ${label} ---`);
  for (let wave = 1; ; wave++) {
    wallIdx = buildPhase(s, wave, wallIdx);
    const result = playWave(s, wave, leakList);
    if (result.status === 'died') {
      return { reached: false, wave, integrity: s.integrity, earned: s.economy.earned, state: s, leakList };
    }
    if (result.status === 'reached') {
      return { reached: true, wave, integrity: s.integrity, earned: s.economy.earned, state: s, leakList };
    }
    if (rebootAtWave > 0 && wave >= rebootAtWave) {
      return {
        reached: false,
        reboot: true,
        wave,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
      };
    }
  }
}

// --- Session ----------------------------------------------------------------------------------

let profile = defaultProfile();
let totalSpecs = 0;
let reboots = 0;
let final = null;

for (let run = 1; ; run++) {
  const result = playRun(profile, run === 1 ? rebootAt : 0, `run ${run}`);
  reboots = run - 1;
  if (result.reached || !result.reboot) {
    final = result;
    break;
  }
  const { gained, profile: nextProfile } = restartWindows(result.state, profile);
  totalSpecs += gained;
  allocateSpecs(nextProfile);
  profile = nextProfile;
  if (!quiet) console.log(`reboot at wave ${result.wave} -> ${gained} specs`);
}

// --- Summary ----------------------------------------------------------------------------------

const leakSummary = final.leakList
  .filter((l) => l.leaks > 0)
  .map((l) => `${l.wave}:${l.leaks}`)
  .join(' ');

console.log(`waves cleared: ${final.reached ? final.wave : final.wave - 1}`);
console.log(`integrity: ${final.integrity}`);
console.log(`total salvage: ${final.earned}`);
console.log(`specs earned: ${totalSpecs}`);
console.log(`leaks per wave: ${leakSummary || 'none'}`);
console.log(`reboots: ${reboots}`);

process.exit(final.reached ? 0 : 1);
