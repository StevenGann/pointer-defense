/**
 * Achievement definitions. Pure data — the unlock checks live in state.ts, which is where the run
 * state that the conditions read from is owned. Keeping the list here (and not importing state)
 * avoids a circular import between the two modules.
 */

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-blood', name: 'First Blood', description: 'First kill of any run' },
  { id: 'long-road', name: 'Long Road', description: 'Route length 50 or more' },
  { id: 'clean-wave', name: 'Clean Wave', description: 'Clear a wave at 40+ with no leaks' },
  { id: 'sharpshooter', name: 'Sharpshooter', description: '100 weak-point hits in one run' },
  { id: 'five-tier-five', name: 'Five Tier Fives', description: 'Five tier-5 towers standing at once' },
  { id: 'beacon-field', name: 'Beacon Field', description: 'Ten beacons standing at once' },
  { id: 'boss-by-pointer', name: 'Boss by Pointer', description: 'Kill a boss with the pointer alone' },
  { id: 'ad-collector', name: 'Ad Collector', description: 'Dismiss ten ads in one run' },
  { id: 'endless-150', name: 'Endless', description: 'Reach endless wave 150' },
  { id: 'reboot-50', name: 'Reboot', description: 'Reboot with 50 or more total specs' },
];

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}
