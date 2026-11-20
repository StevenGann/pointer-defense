import { effectiveStats, type Tower, type TowerKind } from './towers.ts';

/**
 * Tower synergies (docs/SYNERGIES.md).
 *
 * A synergy is derived state: nothing here is stored in a save or touched by the RNG, and it is
 * recomputed from tower positions whenever the roster changes. The catalogue is a table so a second
 * synergy is a row plus its own effect, not a fork of the adjacency/lead machinery.
 */

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
}

/** The catalogue. `aa-sync` is the only row until the mechanism is playtested (docs/SYNERGIES.md §9). */
export const SYNERGIES: readonly SynergyRow[] = [
  { id: 'aa-sync', kinds: ['aa', 'aa'], color: 0xffe14d, dash: 4, gap: 3 },
];

/** One adjacency between two towers that satisfies a synergy row. Edges are what get drawn. */
export interface SynergyEdge {
  readonly lead: Tower;
  readonly follow: Tower;
  readonly color: number;
  readonly dash: number;
  readonly gap: number;
}

/** A connected group of synergetic towers, its members sorted so every leader precedes its followers. */
export interface SynergyCluster {
  /** Member towers in lead order (shorter interval, then northmost, then westmost). */
  readonly members: readonly Tower[];
  /** `leaders[i]` holds the member indices that lead `members[i]` (they precede it in the order). */
  readonly leaders: readonly (readonly number[])[];
}

export interface SynergyLayout {
  readonly edges: readonly SynergyEdge[];
  readonly clusters: readonly SynergyCluster[];
  /** Tower id -> the cluster it belongs to (absent for a lone or non-AA tower). */
  readonly clusterOf: ReadonlyMap<number, SynergyCluster>;
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
 * Build the edges and clusters for the current roster. Pure and deterministic: AA towers are walked
 * in array order, and each cluster's members are sorted by {@link leads}. Callers memoise the result
 * on the tower-revision counter rather than running this O(n²) scan every tick.
 */
export function buildSynergyLayout(towers: readonly Tower[]): SynergyLayout {
  const aaTowers = towers.filter((t) => t.kind === 'aa');
  const n = aaTowers.length;
  const edges: SynergyEdge[] = [];
  const adj: number[][] = aaTowers.map(() => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = aaTowers[i];
      const b = aaTowers[j];
      if (!orthogonal(a, b)) continue;
      const row = SYNERGIES[0]; // aa-sync is the only row today
      const lead = leads(a, b) ? a : b;
      const follow = lead === a ? b : a;
      edges.push({ lead, follow, color: row.color, dash: row.dash, gap: row.gap });
      adj[i].push(j);
      adj[j].push(i);
    }
  }

  const clusters: SynergyCluster[] = [];
  const clusterOf = new Map<number, SynergyCluster>();
  const visited = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    // Connected component of the AA adjacency graph, in deterministic BFS order.
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

    comp.sort((x, y) => (leads(aaTowers[x], aaTowers[y]) ? -1 : 1));
    const members = comp.map((idx) => aaTowers[idx]);
    const pos = new Map<number, number>();
    members.forEach((t, idx) => pos.set(t.id, idx));

    // Leaders of a member are its neighbours that precede it in the sorted order.
    const leaders: number[][] = members.map(() => []);
    for (const idx of comp) {
      const p = pos.get(aaTowers[idx].id)!;
      for (const nb of adj[idx]) {
        const np = pos.get(aaTowers[nb].id)!;
        if (np < p) leaders[p].push(np);
      }
    }

    const cluster: SynergyCluster = { members, leaders };
    clusters.push(cluster);
    for (const t of members) clusterOf.set(t.id, cluster);
  }

  return { edges, clusters, clusterOf };
}
