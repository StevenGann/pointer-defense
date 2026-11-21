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
   * lends `targets` a buff, makes no clusters, and only the source needs a branch.
   */
  readonly mode: 'sync' | 'gift';
  /** For a `gift` row, the branch the source tower must hold. */
  readonly sourceBranch?: 'A' | 'B' | 'C';
  /** For a `gift` row, the kinds that receive the gift; `kinds[1]` alone when omitted. */
  readonly targets?: readonly TowerKind[];
}

/** The catalogue. `aa-sync` is the only row until the mechanism is playtested (docs/SYNERGIES.md §9). */
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
 * Two modes share this builder. A `sync` row joins peers of the same kind and clusters them; a
 * `gift` row is one-way, joins a branched source to its neighbours, and never clusters.
 */
export function buildSynergyLayout(towers: readonly Tower[]): SynergyLayout {
  const edges: SynergyEdge[] = [];
  const clusters: SynergyCluster[] = [];
  const clusterOf = new Map<number, SynergyCluster>();
  const spotterSources = new Map<number, Tower[]>();

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
        edges.push({ lead, follow, color: row.color, dash: row.dash, gap: row.gap, link: row.link });
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
    const sources = towers.filter(
      (t) => t.kind === row.kinds[0] && t.tier >= BRANCH_TIER && t.branch === row.sourceBranch,
    );
    for (const source of sources) {
      for (const target of towers) {
        if (target === source) continue;
        if (!targetKinds.has(target.kind)) continue;
        if (!orthogonal(source, target)) continue;
        // A Minesweeper lays mines instead of firing; a range gift to it would be a lie.
        if (target.kind === 'cannon' && target.branch === 'B') continue;
        edges.push({ lead: source, follow: target, color: row.color, dash: row.dash, gap: row.gap, link: row.link });
        const list = spotterSources.get(target.id);
        if (list === undefined) spotterSources.set(target.id, [source]);
        else list.push(source);
      }
    }
  }

  return { edges, clusters, clusterOf, spotterSources };
}

/**
 * The absolute range a `spotter` source hands over, before the fog multiplier: its live range,
 * capped at {@link SPOTTER_CAP} so a tier-20 Marksman cannot hand a Cannon 9.9 tiles.
 */
export function spotterGrant(source: Tower): number {
  return Math.min(effectiveStats(source).range, SPOTTER_CAP);
}
