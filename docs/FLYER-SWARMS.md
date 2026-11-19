# Flyer swarms

Flyers are the only enemy a Gun can barely touch (0.1x) and only AA answers properly, yet a wave
sends 3-8 of them spread over twenty seconds. They arrive one at a time, on their own, and each one
is a free kill. Their threat is supposed to be that a group of them saturates the air defence at
once, and the schedule never does that.

## Goal

Waves carrying flyers should carry two to four times as many, and they should arrive as a formation
rather than a queue.

## Counts

Multiply the flyer count of every wave that has flyers by a band factor:

- waves 1-20: **2x**
- waves 21-50: **3x**
- waves 51+: **4x**

This applies to the hand-written tutorial waves 6-10 as well, even though those are otherwise kept
verbatim: wave 6 goes from 3 flyers to 6, wave 10 from 8 to 16.

The wave enemy cap (`WAVE_ENEMY_CAP`, 110) still holds for the whole wave. When the multiplied flyers
would push a wave past it, the chaff group (grunt or runner) is trimmed, never the flyers. A wave is
air-heavy or it is not; it does not lose the thing the change is for.

## Packing

A flyer group stops being one spawn stream and becomes a series of flights:

- at most **6 flyers per flight**
- **0.15 s** between members of a flight
- **0.9 s** between flights
- the first flight starts where the group's `delay` puts it

A 24-flyer group is therefore four flights, fully airborne in about 5 s, instead of a 36 s trickle.
Groups are still produced inside `buildSchedule`, so everything downstream — the wave HUD count, the
endless schedules, the seeded determinism — keeps working unchanged.

## Smoke assertions

1. Record the current build's flyer count for every wave 6..100 into the test as a constant table
   (run `buildSchedule(w).filter(kind === 'flyer')` on the branch point before changing anything).
   Then assert, for every wave in that table, that the new count equals `round(old * factor)` for the
   wave's band, unless the wave hit the cap, in which case assert the flyer count is unchanged by the
   trim and the total equals the cap.
2. No wave exceeds `WAVE_ENEMY_CAP`, and a capped wave still carries all of its multiplied flyers.
3. Within one flyer group, the longest gap between consecutive spawns is at most 0.9 s plus the
   intra-flight interval, and no flight exceeds six members.
4. Waves with no flyers produce byte-identical schedules to the current build.
5. The same wave still produces an identical schedule across runs.
