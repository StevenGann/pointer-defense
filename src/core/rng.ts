/**
 * A small seeded 32-bit PRNG (mulberry32). The state is a single unsigned integer kept in RunState,
 * so a run reproduces exactly and the sim never touches Math.random. Each call returns the next
 * float in [0, 1) together with the state to carry forward, which keeps the functions pure.
 */

export function rngNext(rng: number): { value: number; next: number } {
  const a = (rng + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: a };
}

