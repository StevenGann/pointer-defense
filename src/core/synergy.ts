import { effectiveStats, type Tower, type TowerKind } from './towers.ts';

/**
 * Tower synergies (docs/SYNERGIES.md).
 *
 * A synergy is derived state: nothing here is stored in a save or touched by the RNG, and it is
 * recomputed from tower positions whenever the roster changes. The catalogue is a table so a second
 * synergy is a row plus its own effect, not a fork of the adjacency/lead machinery.
 */

/** The hard ceiling on any range a `spotter` row hands over (docs/SYNERGIES.md §9). */
export const SPOTTER_CAP = 5.5;
/** How many tiers a tower must reach before its branch exists. */
const BRANCH_TIER = 3;
/** The smallest connected group of towers that counts as a cluster. A lone tower is never a cluster. */
export const AA_MIN_CLUSTER = 2;
/** How far ahead (in ticks) a follower will wait for a leader's shot before firing on its own. */
export const AA_HOLD_WINDOW = 33;
/** The backstop: the longest a follower may hold, ever, before it fires regardless. */
export const AA_HOLD_CAP = 66;

/** Chill: the fixed slow factor an AA applies to a flyer it hits (docs/SYNERGIES-BATCH-2.md §1). */
export const CHILL_SLOW_FACTOR = 0.6;
/** Chill: how long that slow lasts, in ticks (1.0 s). */
export const CHILL_SLOW_TICKS = 60;

/** Shatter: ticks between a shell's impact and its scheduled second burst (§3). */
export const SHATTER_BURST_DELAY_TICKS = 24;
/** Shatter: the second burst's splash radius, in tiles. */
export const SHATTER_BURST_SPLASH = 0.6;
/** Shatter: the second burst's damage as a fraction of the shell's damage. */
export const SHATTER_BURST_DAMAGE_MULT = 0.4;

/** Buttress: the most walls one hit is split across (§4). */
export const BUTTRESS_GROUP_CAP = 4;

/** True for a Bulwark wall — the tier-3 branch-A wall that Buttress joins (§4). */
export function isBulwark(t: Tower): boolean {
  return t.kind === 'wall' && t.tier >= BRANCH_TIER && t.branch === 'A';
}

export interface SynergyRow {
  readonly id: string;
  /** The two kinds an edge joins; the same kind with itself is allowed. */
  readonly kinds: readonly [TowerKind, TowerKind];
  /** The line colour drawn for the edge. */
  readonly color: number;
  /** Dash pattern: on / off pixels. Distinct per synergy, so colour is never the only signal. */
  readonly dash: number;
  readonly gap: number;
  /** The white art asset drawn for the edge's line (`ui/<link>`), distinct per synergy so shape,
   *  not colour alone, tells two rows apart under deuteranopia (docs/SYNERGIES.md §5). */
  readonly link: string;
  /**
   * `sync` joins peers and forms clusters (the firing beat). `gift` is one-way: each source tower
   * lends `targets` a buff, makes no clusters, and only the source needs a branch. `peer` joins two
   * towers doing one thing, draws a plain (non-directional) link and never forms a cluster.
   */
  readonly mode: 'sync' | 'gift' | 'peer';
  /** For a `gift` row, the branch the source tower must hold. */
  readonly sourceBranch?: 'A' | 'B' | 'C';
  /** For a `gift` row, the kinds that receive the gift; `kinds[1]` alone when omitted. */
  readonly targets?: readonly TowerKind[];
  /** The mark drawn at the link midpoint (docs/SYNERGIES-BATCH-2.md §0). Colour alone cannot carry
   *  four more rows under deuteranopia, so rows that need a second signal carry one. */
  readonly mark?: 'snow' | 'bolt' | 'crack' | 'brace';
  /** For a `peer` row, the branch both ends must hold (tier ≥ BRANCH_TIER). */
  readonly peerBranch?: 'A' | 'B' | 'C';
  /** For a `peer` row, which end leads the edge: `first` = kinds[0], `northwest` = northmost then westmost. */
  readonly peerLead?: 'first' | 'northwest';
}

/** The catalogue (docs/SYNERGIES.md §3 and docs/SYNERGIES-BATCH-2.md §0). */
export const SYNERGIES: readonly SynergyRow[] = [
  { id: 'aa-sync', kinds: ['aa', 'aa'], color: 0xffe14d, dash: 4, gap: 3, link: 'synergy-link', mode: 'sync' },
  // Marksman optics: a Gun on branch A lends its range to adjacent AA and Cannon towers.
  {
    id: 'spotter',
    kinds: ['gun', 'aa'],
    targets: ['aa', 'cannon'],
    color: 0x64d8ff,
    dash: 9,
    gap: 4,
    link: 'synergy-link-spotter',
    mode: 'gift',
    sourceBranch: 'A',
  },
  // Chill: a Frost lends its chill to an adjacent AA (docs/SYNERGIES-BATCH-2.md §1).
  { id: 'chill', kinds: ['frost', 'aa'], color: 0x8fd8ff, dash: 5, gap: 5, link: 'synergy-link-spotter', mode: 'gift', mark: 'snow' },
  // Interlock: a Laser lends its targeting to an adjacent Taser (§2).
  { id: 'interlock', kinds: ['laser', 'taser'], color: 0xc77dff, dash: 7, gap: 5, link: 'synergy-link-spotter', mode: 'gift', mark: 'bolt' },
  // Shatter: a Cannon beside a Frost bursts slowed enemies a beat after the shell lands (§3).
  { id: 'shatter', kinds: ['cannon', 'frost'], color: 0x4dd6c1, dash: 3, gap: 5, link: 'synergy-link', mode: 'peer', peerLead: 'first', mark: 'crack' },
  // Buttress: adjacent Bulwark walls share incoming hits (§4).
  { id: 'buttress', kinds: ['wall', 'wall'], color: 0x9aa7c7, dash: 10, gap: 4, link: 'synergy-link', mode: 'peer', peerBranch: 'A', peerLead: 'northwest', mark: 'brace' },
];

/** One adjacency between two towers that satisfies a synergy row. Edges are what get drawn. */
export interface SynergyEdge {
  readonly lead: Tower;
  readonly follow: Tower;
  readonly color: number;
  readonly dash: number;
  readonly gap: number;
  /** The row's link art name, so the view can pick the texture per edge rather than per synergy id. */
  readonly link: string;
  /** The row's mark, drawn at the link midpoint with `Graphics` (undefined for rows without one). */
  readonly mark?: 'snow' | 'bolt' | 'crack' | 'brace';
}

/** A connected group of synergetic towers, its members sorted so every leader precedes its followers. */
export interface SynergyCluster {
  /** Member towers in lead order (shorter interval, then northmost, then westmost). */
  readonly members: readonly Tower[];
  /** The line colour of the row that created the cluster, used for its halo. */
  readonly color: number;
  /** `leaders[i]` holds the member indices that lead `members[i]` (they precede it in the order). */
  readonly leaders: readonly (readonly number[])[];
}

export interface SynergyLayout {
  readonly edges: readonly SynergyEdge[];
  readonly clusters: readonly SynergyCluster[];
  /** Tower id -> the cluster it belongs to (absent for a lone or non-AA tower). */
  readonly clusterOf: ReadonlyMap<number, SynergyCluster>;
  /**
   * Beneficiary tower id -> the Marksman towers that may spot it. A list rather than a number:
   * whether a source is live depends on the clock (offline, EMP) while this layout is memoised on
   * the roster, so the grant is resolved at the moment it is read.
   */
  readonly spotterSources: ReadonlyMap<number, readonly Tower[]>;
  /** AA tower id -> the Frost towers that may chill it (docs/SYNERGIES-BATCH-2.md §1). */
  readonly chillSources: ReadonlyMap<number, readonly Tower[]>;
  /** Taser tower id -> the Laser towers it may borrow a target from (§2). */
  readonly interlockSources: ReadonlyMap<number, readonly Tower[]>;
  /** Cannon tower ids with an adjacent Frost, whose shells may Shatter (§3). */
  readonly shatterCannons: ReadonlySet<number>;
}

/**
 * The §4.3 comparison, and the whole lead rule for `aa-sync`: shorter fire interval leads; equal
 * intervals fall back to the smaller row, then the smaller column. It is a strict total order on
 * towers, so sorting a cluster by it puts every leader before its followers and no cycle is possible.
 */
export function leads(a: Tower, b: Tower): boolean {
  const ia = effectiveStats(a).fireInterval;
  const ib = effectiveStats(b).fireInterval;
  if (ia !== ib) return ia < ib;
  if (a.row !== b.row) return a.row < b.row;
  return a.col < b.col;
}

/** Orthogonal adjacency only: north, south, east, west — never diagonal (docs/SYNERGIES.md §1). */
function orthogonal(a: Tower, b: Tower): boolean {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

/**
 * Build the edges, clusters and spotter sources for the current roster. Pure and deterministic:
 * towers are walked in array order, and each cluster's members are sorted by {@link leads}. Callers
 * memoise the result on the tower-revision counter rather than running this O(n²) scan every tick.
 *
 * Three modes share this builder. A `sync` row joins peers of the same kind and clusters them; a
 * `gift` row is one-way, joins a source to its neighbours, and never clusters; a `peer` row joins
 * two towers doing one thing, draws a plain edge and never clusters.
 */
export function buildSynergyLayout(towers: readonly Tower[]): SynergyLayout {
  const edges: SynergyEdge[] = [];
  const clusters: SynergyCluster[] = [];
  const clusterOf = new Map<number, SynergyCluster>();
  const spotterSources = new Map<number, Tower[]>();
  const chillSources = new Map<number, Tower[]>();
  const interlockSources = new Map<number, Tower[]>();
  const shatterCannons = new Set<number>();

  for (const row of SYNERGIES) {
    if (row.mode !== 'sync') continue;

    const kindTowers = towers.filter((t) => t.kind === row.kinds[0]);
    const n = kindTowers.length;
    const adj: number[][] = kindTowers.map(() => []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = kindTowers[i];
        const b = kindTowers[j];
        if (!orthogonal(a, b)) continue;
        const lead = leads(a, b) ? a : b;
        const follow = lead === a ? b : a;
        edges.push({ lead, follow, color: row.color, dash: row.dash, gap: row.gap, link: row.link, mark: row.mark });
        adj[i].push(j);
        adj[j].push(i);
      }
    }

    const visited = new Array<boolean>(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      // Connected component of the adjacency graph, in deterministic BFS order.
      const comp: number[] = [];
      const stack: number[] = [i];
      visited[i] = true;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        comp.push(cur);
        for (const nb of adj[cur]) {
          if (!visited[nb]) {
            visited[nb] = true;
            stack.push(nb);
          }
        }
      }
      if (comp.length < AA_MIN_CLUSTER) continue;

      comp.sort((x, y) => (leads(kindTowers[x], kindTowers[y]) ? -1 : 1));
      const members = comp.map((idx) => kindTowers[idx]);
      const pos = new Map<number, number>();
      members.forEach((t, idx) => pos.set(t.id, idx));

      // Leaders of a member are its neighbours that precede it in the sorted order.
      const leaders: number[][] = members.map(() => []);
      for (const idx of comp) {
        const p = pos.get(kindTowers[idx].id)!;
        for (const nb of adj[idx]) {
          const np = pos.get(kindTowers[nb].id)!;
          if (np < p) leaders[p].push(np);
        }
      }

      const cluster: SynergyCluster = { members, leaders, color: row.color };
      clusters.push(cluster);
      for (const t of members) clusterOf.set(t.id, cluster);
    }
  }

  for (const row of SYNERGIES) {
    if (row.mode !== 'gift') continue;

    const targetKinds = new Set(row.targets ?? [row.kinds[1]]);
    // A gift source must be the right kind; only rows with a `sourceBranch` gate on the branch (a
    // Marksman at tier ≥ 3). Chill and Interlock lend from any Frost/Laser, any tier, any branch.
    const sources = towers.filter(
      (t) => t.kind === row.kinds[0] && (row.sourceBranch === undefined || (t.tier >= BRANCH_TIER && t.branch === row.sourceBranch)),
    );
    const record = (targetId: number, source: Tower): void => {
      const map = row.id === 'chill' ? chillSources : row.id === 'interlock' ? interlockSources : spotterSources;
      const list = map.get(targetId);
      if (list === undefined) map.set(targetId, [source]);
      else list.push(source);
    };
    for (const source of sources) {
      for (const target of towers) {
        if (target === source) continue;
        if (!targetKinds.has(target.kind)) continue;
        if (!orthogonal(source, target)) continue;
        // A Minesweeper lays mines instead of firing; a range gift to it would be a lie.
        if (target.kind === 'cannon' && target.branch === 'B') continue;
        edges.push({ lead: source, follow: target, color: row.color, dash: row.dash, gap: row.gap, link: row.link, mark: row.mark });
        record(target.id, source);
      }
    }
  }

  for (const row of SYNERGIES) {
    if (row.mode !== 'peer') continue;

    const aKind = row.kinds[0];
    const bKind = row.kinds[1];
    const members = towers.filter((t) => {
      if (t.kind !== aKind && t.kind !== bKind) return false;
      if (row.peerBranch === undefined) return true;
      return t.tier >= BRANCH_TIER && t.branch === row.peerBranch;
    });
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (!orthogonal(a, b)) continue;
        // A cross-kind peer (Cannon ↔ Frost) needs one of each; a same-kind peer pairs freely.
        if (aKind !== bKind && a.kind === b.kind) continue;

        let lead: Tower;
        let follow: Tower;
        if (row.peerLead === 'northwest') {
          if (a.row !== b.row) {
            lead = a.row < b.row ? a : b;
            follow = lead === a ? b : a;
          } else {
            lead = a.col < b.col ? a : b;
            follow = lead === a ? b : a;
          }
        } else {
          lead = a.kind === aKind ? a : b;
          follow = lead === a ? b : a;
        }
        edges.push({ lead, follow, color: row.color, dash: row.dash, gap: row.gap, link: row.link, mark: row.mark });
        if (row.id === 'shatter') shatterCannons.add(lead.id);
      }
    }
  }

  return { edges, clusters, clusterOf, spotterSources, chillSources, interlockSources, shatterCannons };
}

/**
 * The absolute range a `spotter` source hands over, before the fog multiplier: its live range,
 * capped at {@link SPOTTER_CAP} so a tier-20 Marksman cannot hand a Cannon 9.9 tiles.
 */
export function spotterGrant(source: Tower): number {
  return Math.min(effectiveStats(source).range, SPOTTER_CAP);
}
