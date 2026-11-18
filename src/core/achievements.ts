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
  { id: 'weak-point-kills', name: 'Deadeye', description: 'Kill 50 enemies with weak-point hits in one run' },
  { id: 'crit-hits', name: 'Lucky Streak', description: 'Land 25 critical hits in one run' },
  { id: 'salvage-peak', name: 'Deep Pockets', description: 'Hold 1,000 salvage at once' },
  { id: 'no-sell', name: 'Pack Rat', description: 'Reach wave 20 without selling a tower' },
  { id: 'one-kind', name: 'One-Trick Pony', description: 'Clear a wave with a single tower kind on the board' },
  { id: 'maxed-branch', name: 'Maxed Out', description: 'Fully upgrade a branched tower' },
  { id: 'aa-flak', name: 'Flak Jacket', description: 'Branch an AA tower into Flak' },
  { id: 'early-call-streak', name: 'Speedrunner', description: 'Call three waves early in a row' },
  { id: 'flawless-wave', name: 'No Leaks', description: 'Clear a wave with zero leaks' },
  { id: 'milestone-boss-pointer', name: 'Milestone Hunter', description: 'Kill a milestone boss with the pointer' },
  { id: 'two-reboots', name: 'Second Boot', description: 'Reboot twice' },
  { id: 'specs-banked', name: 'Nest Egg', description: 'Start a run with banked specs' },
  { id: 'custom-map-cleared', name: 'Cartographer', description: 'Clear a wave on a custom map' },
  { id: 'all-help', name: 'Well Read', description: 'Unlock every page in the Help viewer' },
];

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}
