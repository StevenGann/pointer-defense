/**
 * What Escape does during a run, as a pure function of which modals are open. The keyboard handler
 * in mouse.ts dispatches on this, so the smoke harness can check the chain without a DOM.
 *
 * Order: an open menu or dialog first, then Help, the achievements grid, Restore, Global Upgrades;
 * only with none of them open does Esc fall through to the selection / exit-run step.
 */
export type EscapeTarget = 'menuOrDialog' | 'help' | 'achievements' | 'restore' | 'upgrades' | 'run';

export interface EscapeFlags {
  menuOrDialog: boolean;
  help: boolean;
  achievements: boolean;
  restore: boolean;
  upgrades: boolean;
}

export function escapeTarget(open: EscapeFlags): EscapeTarget {
  if (open.menuOrDialog) return 'menuOrDialog';
  if (open.help) return 'help';
  if (open.achievements) return 'achievements';
  if (open.restore) return 'restore';
  if (open.upgrades) return 'upgrades';
  return 'run';
}
