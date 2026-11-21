import type { Catalogue } from '../index.ts';

/**
 * Help-page prose (docs/HELP-PROSE.md).
 *
 * Every sentence the Help viewer prints is a key here, namespaced by page: `help.<page-id>.<n>` for
 * body lines (counting from 1 within a page, skipping the generated Markdown tables),
 * `help.page.<page-id>.title` for page titles, `help.category.<id>` for chapter names, and
 * `help.table.<name>` for the table headers. Numbers travel as `{placeholders}`; the call sites in
 * `src/content/help.ts` compute them exactly as they always did. Tower and enemy names keep going
 * through `towerName()` / `enemyName()`, not here.
 */
export const help = {
  // Chapter names.
  'help.category.getting-started': 'Getting started',
  'help.category.mechanics': 'Mechanics',
  'help.category.enemies': 'Enemies',
  'help.category.bosses': 'Bosses',
  'help.category.towers': 'Towers',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'Tier',
  'help.table.cost': 'Cost',
  'help.table.wave': 'Wave',
  'help.table.hp': 'HP',
  'help.table.heal': 'Heal',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'Getting started',
  'help.page.mechanics-pointer.title': 'The pointer ladder',
  'help.page.mechanics-salvage.title': 'Salvage and specs',
  'help.page.mechanics-walls.title': 'Walls and pathing',
  'help.page.mechanics-early-call.title': 'Calling waves early',
  'help.page.mechanics-auto-start.title': 'Auto-start',
  'help.page.mechanics-modifiers.title': 'Modifiers',
  'help.page.mechanics-endless.title': 'Endless',
  'help.page.mechanics-licences.title': 'Tower licences',
  'help.page.mechanics-maps.title': 'Maps',
  'help.page.mechanics-global-upgrades.title': 'Global upgrades',
  'help.page.mechanics-daily.title': 'Daily challenge',
  'help.page.mechanics-achievements.title': 'Achievements',
  'help.page.mechanics-editor.title': 'The editor',
  'help.page.bosses-in-general.title': 'Bosses',

  // Getting started.
  'help.getting-started.1': 'A run is a series of waves. Between waves you build; during a wave the enemies walk the route and you click them.',
  'help.getting-started.2': 'Build phase: place towers and shape the maze. Press Start Wave (or Enter) when you are ready.',
  'help.getting-started.3': 'Waves: enemies cross from the entrance to the exit. Anything that gets through costs integrity.',
  'help.getting-started.4': 'Integrity: you start with {integrity}. When it reaches zero the run is over.',
  'help.getting-started.5': 'The pointer: click enemies to shoot them. A hit on the leading edge deals double damage.',
  'help.getting-started.6': 'Combat towers upgrade through {maxTier} tiers; walls, Repair and the Cursor stop earlier on their own ladders.',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': 'A bare click deals {click} damage; the Reticle deals {reticle} and holds for {hold} damage per second.',
  'help.mechanics-pointer.2': 'Overclock levels multiply click damage by {growth} each, {milestones}, capped at {maxLevel}; one unlocks every {divisor} waves.',
  'help.mechanics-pointer.3': 'A click crits for {crit}× — {base} base, +{marked} on a marked enemy, +{weak} on the weak point. The mark adds {mark} damage.',
  'help.mechanics-pointer.4': 'Clicks ignore armour and wear shields down, so the pointer is the answer to enemies your towers cannot touch.',
  'help.mechanics-pointer.5': 'Upgrade the pointer from the right-hand panel during a run.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': "Salvage is the run's currency: kills pay it, and you spend it on towers, upgrades and the pointer.",
  'help.mechanics-salvage.2': "Specs are permanent. A reboot banks Restore Points from the run's lifetime salvage, and they carry into the next run.",
  'help.mechanics-salvage.3': 'Each spec has an effect: CPU {cpu} tower damage, GPU {gpu} pointer damage, RAM +{ram} starting salvage, Disk {disk} starting integrity (caps {caps}).',
  'help.mechanics-salvage.4': 'A spec level costs {cost0} Restore Points at level 0, {cost1} at level 1, {cost2} at level 2, {cost3} at level 3, and keeps climbing.',
  'help.mechanics-salvage.5': 'A reboot banks {gain20k} Restore Points at 20,000 lifetime salvage and {gain60k} at 60,000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'Walls block the route, so enemies walk around them. A longer route means more time under your towers.',
  'help.mechanics-walls.2': 'The board refuses a wall (or tower) that would seal the route and leave no path to the exit.',
  'help.mechanics-walls.3': 'Some enemies ignore walls: flyers fly straight over, and breachers chew through them.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': 'You can call the next wave while one is still running. The earlier you call, the bigger the salvage bonus.',
  'help.mechanics-early-call.2': 'A full-early call pays {bonus} salvage at wave 2, decaying toward a floor of {floor} the later you wait.',
  'help.mechanics-early-call.3': 'Two waves can run at once, so an early call is risk for reward.',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'Turn on Auto and the next wave starts 1.5 s after the board clears.',
  'help.mechanics-auto-start.2': 'It waits while a tower is mid-repair, then fires.',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': 'From later in a run, waves carry modifiers that change the rules.',
  'help.mechanics-modifiers.2': '- No-Build — the board is frozen: no placing, upgrading, selling, repairing or retargeting.',
  'help.mechanics-modifiers.3': '- Fog — tower range is reduced.',
  'help.mechanics-modifiers.4': '- Fast Forward — enemies move faster.',
  'help.mechanics-modifiers.5': '- Blackout — your salvage readout is hidden.',
  'help.mechanics-modifiers.6': '- Rush — spawns come closer together.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'After wave {final} you can choose Endless and keep going.',
  'help.mechanics-endless.2': 'Endless waves keep getting harder. There is no final wave.',

  // Mechanics: tower licences (docs/PRESTIGE.md).
  'help.mechanics-licences.1': 'Eight permanent unlocks, one per tower that normally arrives later in a run, bought with Restore Points in the Restore window.',
  'help.mechanics-licences.2': 'A licence puts that tower in the build palette from wave 1 of every later run. Owned once, it stays owned.',
  'help.mechanics-licences.3': 'Each is priced by how late the tower normally arrives, from {low} to {high} Restore Points; the price is on the row.',
  'help.mechanics-licences.4': 'A Daily run inherits your licences, like the rest of the Restore tree.',

  // Mechanics: maps and the gallery (docs/MAP-SELECT.md).
  'help.mechanics-maps.1': '{maps} maps ship with the game, from wide-open fields to gated corridors.',
  'help.mechanics-maps.2': 'Play opens the map gallery, one card per map; choose one to start it.',
  'help.mechanics-maps.3': 'When the cards do not fit, the gallery scrolls. The last map you chose is remembered and selected next time.',

  // Mechanics: global upgrades (docs/GLOBAL-UPGRADES.md).
  'help.mechanics-global-upgrades.1': 'Global upgrades live in the right-hand panel and are bought with salvage during a run.',
  'help.mechanics-global-upgrades.2': 'Each is bought once and lasts for the rest of that run only.',
  'help.mechanics-global-upgrades.3': 'A new run or a reboot clears them — nothing carries over.',

  // Mechanics: the daily challenge (docs/DAILY.md).
  'help.mechanics-daily.1': 'One seeded run per local day: the date is the seed, so everyone playing on the same date gets the same board.',
  'help.mechanics-daily.2': 'You get one attempt, and it runs {waves} waves.',
  'help.mechanics-daily.3': 'The result is recorded in your run history, but it is not a scored record — a daily never counts as a win or a loss.',

  // Mechanics: achievements (docs/ACHIEVEMENTS.md).
  'help.mechanics-achievements.1': 'There are {count} achievements, kept on your profile: once earned, they stay earned.',
  'help.mechanics-achievements.2': 'They unlock as their conditions are met. The Achievements window lists them, and a locked one says what it needs.',
  'help.mechanics-achievements.3': 'Shadow achievements stay hidden until they are earned.',

  // Mechanics: the editor (docs/design.md §20).
  'help.mechanics-editor.1': 'The editor lets you draw a map: paint walls and shutters, and place the start and exit.',
  'help.mechanics-editor.2': 'Test it inside the editor, then play it — or copy its code to share.',
  'help.mechanics-editor.3': 'A map must leave a route from start to exit, or the editor refuses to play it.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'Synergies',
  'help.synergy.1': 'Two adjacent towers of the right kinds link into a synergy. Adjacent means side by side — north, south, east or west, never diagonal. A chevroned line points from the tower that lends to the tower that receives.',
  'help.synergy.2': '**Synchronized Fire** — adjacent AA towers fire as one: the faster one leads and the others fire with it. A plain AA fires every {interval} ticks.',
  'help.synergy.3': 'A follower holds its shot until its leader fires that tick. It waits at most {window} ticks for the leader, and never more than {cap} ticks in all.',
  'help.synergy.4': 'A synchronized shot is exactly as strong as an unsynchronized one — no damage or rate bonus — it just lands with the rest.',

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} HP · {speed} tiles/s.',
  'help.enemy-grunt.2': 'The basic creep and the unit everything else is measured against. Anything kills it — it is the enemy you build and shoot while learning the board.',
  'help.enemy-runner.1': '{hp} HP · {speed} tiles/s.',
  'help.enemy-runner.2': 'Fast and small, so towers get fewer shots at it and splash usually misses. Click it, or pin a Taser on a corner it has to round.',
  'help.enemy-shielded.1': '{hp} HP · {speed} tiles/s · {armour} armour · {shield} shield.',
  'help.enemy-shielded.2': 'Its shield absorbs all tower damage until the pointer breaks it. Click the shield down, then let your towers finish it.',
  'help.enemy-flyer.1': '{hp} HP · {speed} tiles/s.',
  'help.enemy-flyer.2': 'Flies straight over the maze, so walls do not slow it. Only a Mesh wall stops it; the AA tower is the answer.',
  'help.enemy-armoured.1': '{hp} HP · {speed} tiles/s · {armour} armour.',
  'help.enemy-armoured.2': 'Its armour soaks tower damage (flat subtraction, floored at 1). A Taser ignores armour, and your clicks ignore it too.',
  'help.enemy-saboteur.1': '{hp} HP · {speed} tiles/s.',
  'help.enemy-saboteur.2': 'A fast enemy with moderate health. Treat it like a tougher Runner and click it before it crosses the board.',
  'help.enemy-breacher.1': '{hp} HP · {speed} tiles/s · chews walls.',
  'help.enemy-breacher.2': 'Heads for your walls and chews through them, while a small turret shoots the nearest tower. A wall disarms it while it chews; kill it before the wall falls.',
  'help.enemy-popup.1': '{hp} HP · {speed} tiles/s · a window, not a leak.',
  'help.enemy-popup.2': 'A walking window that shields every enemy underneath it from your towers. Click its close box to remove it — that is the only way.',

  // Bosses in general.
  'help.bosses-in-general.1': 'A boss is a bigger, nastier version of an ordinary enemy. It announces itself with a name bar across the top of the field.',
  'help.bosses-in-general.2': 'Bosses are slow and tough, leak for more integrity, and pay far more salvage than the enemy they are based on.',
  'help.bosses-in-general.3': 'The pointer is the reliable answer: clicks ignore armour and shields, and a boss is slow enough to click many times.',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-grunt-boss.2': 'A wall of hit points — the baseline every other boss is read against. It has no trick; it just takes a long time to bring down.',
  'help.boss-grunt-boss.3': "Focus fire with the pointer and keep it inside your towers' range for as long as you can.",
  'help.boss-runner-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-runner-boss.2': 'Anything near it keeps pace: enemies within {radius} tiles move at its speed or their own, whichever is faster.',
  'help.boss-runner-boss.3': 'Kill it early, before it herds a wave across your board.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-shielded-boss.2': 'Three layers of shielding, one stripped per pointer hit. Towers cannot hurt it until the last layer is gone.',
  'help.boss-shielded-boss.3': 'Click it to strip the layers, then let your towers finish it.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-flyer-boss.2': 'Hatches flyers as it flies — {brood} every {interval} s, and {death} more when it dies.',
  'help.boss-flyer-boss.3': 'AA towers for the brood, and click the carrier itself down before it reaches the exit.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-armoured-boss.2': 'Plated and slow to chill: extra armour reduction, and slows only work {resist} as well on it.',
  'help.boss-armoured-boss.3': 'Armour-ignoring towers and your pointer are the reliable damage.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-saboteur-boss.2': 'Shorts out towers as it passes: any tower within {radius} tiles goes offline for {duration} s, then returns on its own.',
  'help.boss-saboteur-boss.3': 'Spread your towers, or kill it before it reaches the line.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} tiles/s · {integrity} integrity if it leaks.',
  'help.boss-breacher-boss.2': 'Eats through your towers: it chews walls and drives other towers offline, and mounts a turret.',
  'help.boss-breacher-boss.3': 'A wall maze slows it one tile at a time; keep a Repair tower behind the line.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-gun.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-gun.3': '- **{name}** — {cost}: longer reach, harder hits.',
  'help.tower-gun.4': '- **{name}** — {cost}: fires twice as fast.',
  'help.tower-gun.5': 'The cheap single-target backbone. Put it on a long stretch of route so it shoots for the longest time.',

  'help.tower-cannon.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-cannon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cannon.3': '- **{name}** — {cost}: a bigger splash.',
  'help.tower-cannon.4': '- **{name}** — {cost}: lays a mine every {interval} s, arms in {arm} s, {cap} live cap, {damage} damage in a {blast} blast, expires in {expire} s.',
  'help.tower-cannon.5': 'A slow, heavy hitter with splash. Best where the maze doubles back, so the splash catches a cluster.',

  'help.tower-taser.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-taser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-taser.3': '- **{name}** — {cost}: chains to {chain} targets.',
  'help.tower-taser.4': '- **{name}** — {cost}: extra damage to shields.',
  'help.tower-taser.5': 'Short range and very fast, and it ignores armour. Park it on the inside of a hairpin to punish tough enemies up close.',

  'help.tower-frost.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-frost.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-frost.3': '- **{name}** — {cost}: a stronger slow.',
  'help.tower-frost.4': '- **{name}** — {cost}: no slow, real damage.',
  'help.tower-frost.5': 'Slows whatever it hits to {slow} speed for {duration} s. Put it in front of your damage so enemies spend longer in range.',

  'help.tower-laser.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-laser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-laser.3': '- **{name}** — {cost}: pierces deeper, more damage.',
  'help.tower-laser.4': '- **{name}** — {cost}: splits into three beams.',
  'help.tower-laser.5': 'Pierces a straight line of enemies. Aim it down a corridor you deliberately left open.',

  'help.tower-aa.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-aa.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-aa.3': '- **{name}** — {cost}: shells splash and hit ground too.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} homing missiles per salvo, each {pct} of a hit.',
  'help.tower-aa.5': 'The dedicated anti-air tower. It only shoots flyers, hits them for {mult}× damage, and holds fire on ground-only waves.',

  'help.tower-beacon.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-beacon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} damage to towers in radius.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} damage to towers, +{pointerDamage} pointer damage, +{pointerRange} pointer range.',
  'help.tower-beacon.5': 'Boosts the damage of every tower in its radius. Place it over a dense cluster.',

  'help.tower-repair.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-repair.2': 'Heals damaged towers in its radius. Keep it near a cluster you want to survive.',

  'help.tower-wall.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-wall.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, blocks flyers.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, a gate you open and close.',
  'help.tower-wall.6': 'Blocks the route and has hit points. Use walls to make enemies walk a longer maze.',

  'help.tower-cursor.1': 'Cost {cost} · unlocks wave {unlock}.',
  'help.tower-cursor.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} clicks/s, radius {radius} tiles.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} clicks/s, radius {radius} tiles.',
  'help.tower-cursor.5': '- **{name}** — {cost}: repairs towers below {pct} when its radius is clear.',
  'help.tower-cursor.6': 'A second cursor that clicks enemies for {pct} of your click damage. Feed it by upgrading the pointer.',
} as const satisfies Catalogue;
