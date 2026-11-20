# Flyer counts taper after wave 50

Testers find the flyer volume overwhelming by wave 85: 56 flyers in a 110-enemy wave, more than half
the wave immune to the maze. The 51+ multiplier of 4x is the culprit.

Waves up to 50 stay exactly as they are — the 2x band (1-20) and the 3x band (21-50) are tuned and
loved. Only the top band changes, and it stops being a band: the multiplier ramps down linearly from
3x at wave 51 to 2x at wave 85, then holds at 2x.

```
          /‾‾‾ 3x
   2x ___/
         |    \
         |     \___ 2x from wave 85
   w15   w50    w85
```

| wave | multiplier before | after | flyers before | after |
|---|---|---|---|---|
| 10 | 2x | 2x | 16 | 16 |
| 25 | 3x | 3x | 21 | 21 |
| 50 | 3x | 3x | 33 | 33 |
| 60 | 4x | 2.71x | 40 | ~27 |
| 75 | 4x | 2.29x | 49 | ~33 |
| 85 | 4x | 2x | 56 | 28 |
| 100 | 4x | 2x | 56 | 28 |

Rounding follows the existing rule (round half up, never below the base count). Flight packing is
unchanged: six per flight, 0.15 s apart, 0.9 s between flights. The 110-enemy wave cap keeps its
existing priority, so flyers are still never cut.

## Tests

1. Waves 10, 25 and 50 produce byte-identical schedules to before.
2. Wave 85 produces 28 flyers, not 56.
3. The multiplier is 3.0 at wave 51, 2.0 at wave 85, 2.0 at wave 100, and never increases after
   wave 50.
4. No wave's flyer count exceeds the previous wave's by more than the band curves allow (the count is
   non-decreasing across 51-85 in steps of at most one flight).
5. Flight packing is unchanged (six per flight, 0.15 s spacing).
