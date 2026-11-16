/**
 * Salvage and kill attribution.
 *
 * The design's one rule: every kill pays salvage, and it pays more if the player landed the blow.
 * That is what stops the hybrid from collapsing into either half — towers keep you alive, clicks
 * make you rich. So the economy must know *who* dealt the killing blow, not just that something
 * died. Only the final hit counts (not damage share): it is simple to read and it rewards the
 * player for finishing what the towers softened, which is the attention trade the game is about.
 */

export type DamageSource = 'tower' | 'pointer';

/** Multiplier applied to a kill's base value when the pointer landed the killing blow. */
export const POINTER_KILL_BONUS = 1.5;

/** Multiplier applied when the pointer landed the killing blow on the enemy's weak point. */
export const WEAK_POINT_KILL_BONUS = 2;

export const STARTING_SALVAGE = 60;

/** Flat bonus paid when a wave is cleared, scaled by wave number. */
export function waveClearBonus(wave: number): number {
  return 10 + 5 * wave;
}

export interface Economy {
  salvage: number;
  /** Lifetime salvage earned this run (never decreases). */
  earned: number;
  kills: Record<DamageSource, number>;
  /** Salvage earned from kills, by source, for the "where did my money come from" readout. */
  earnedBySource: Record<DamageSource, number>;
}

export function createEconomy(startingSalvage: number = STARTING_SALVAGE): Economy {
  return {
    salvage: startingSalvage,
    earned: 0,
    kills: { tower: 0, pointer: 0 },
    earnedBySource: { tower: 0, pointer: 0 },
  };
}

/** Salvage a kill pays. Rounded so the HUD never shows fractions. */
export function killReward(baseValue: number, source: DamageSource): number {
  return Math.round(source === 'pointer' ? baseValue * POINTER_KILL_BONUS : baseValue);
}

export function recordKill(eco: Economy, baseValue: number, source: DamageSource): number {
  return recordKillAt(eco, baseValue, source, source === 'pointer' ? POINTER_KILL_BONUS : 1);
}

/** Record a kill paid at an explicit multiplier (used for the 2x weak-point bonus). */
export function recordKillAt(
  eco: Economy,
  baseValue: number,
  source: DamageSource,
  multiplier: number,
): number {
  const reward = Math.round(baseValue * multiplier);
  eco.salvage += reward;
  eco.earned += reward;
  eco.kills[source] += 1;
  eco.earnedBySource[source] += reward;
  return reward;
}

export function earn(eco: Economy, amount: number): void {
  eco.salvage += amount;
  eco.earned += amount;
}

export function canAfford(eco: Economy, cost: number): boolean {
  return eco.salvage >= cost;
}

/** Deduct `cost` if affordable. Returns whether the purchase happened. */
export function spend(eco: Economy, cost: number): boolean {
  if (!canAfford(eco, cost)) return false;
  eco.salvage -= cost;
  return true;
}
