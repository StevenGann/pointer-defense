/**
 * What Escape does during a run, as a pure function of which modals are open. The keyboard handler
 * in mouse.ts dispatches on this, so the smoke harness can check the chain without a DOM.
 *
 * Order: an open menu or dialog first, then Help, Records, the achievements grid, Restore, Global
 * Upgrades; only with none of them open does Esc fall through to the selection / exit-run step.
 */
export type EscapeTarget = 'menuOrDialog' | 'help' | 'records' | 'achievements' | 'restore' | 'upgrades' | 'run';

export interface EscapeFlags {
  menuOrDialog: boolean;
  help: boolean;
  records: boolean;
  achievements: boolean;
  restore: boolean;
  upgrades: boolean;
}

export function escapeTarget(open: EscapeFlags): EscapeTarget {
  if (open.menuOrDialog) return 'menuOrDialog';
  if (open.help) return 'help';
  if (open.records) return 'records';
  if (open.achievements) return 'achievements';
  if (open.restore) return 'restore';
  if (open.upgrades) return 'upgrades';
  return 'run';
}

export interface EscapeAction {
  target: EscapeTarget;
  /** Whether Esc clears the selection (an armed build kind or a selected placed tower). */
  clearSelection: boolean;
  /** Whether Esc exits the run (only when nothing is selected and no modal is open). */
  exitRun: boolean;
}

/**
 * What Esc does this press, folding the selection into the decision. Closing a modal never touches
 * the selection — Esc keeps its existing jobs first — and only with nothing else open does Esc clear
 * a selected tower and, with nothing selected, exit the run.
 */
export function escapeAction(open: EscapeFlags, hasSelection: boolean): EscapeAction {
  const target = escapeTarget(open);
  if (target !== 'run') return { target, clearSelection: false, exitRun: false };
  return { target: 'run', clearSelection: hasSelection, exitRun: !hasSelection };
}
