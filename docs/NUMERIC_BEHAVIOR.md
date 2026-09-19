# Numeric behavior

Genesis Lua uses signed 16.16 fixed-point values and may store integral values
in 32-bit C integers. Fixed-point resolution is 1/65536, with range -32768
through 32767.99998474121. This is not a promise of PICO-8 numeric compatibility.

## Supported behavior

| Operation | Behavior |
|---|---|
| `flr`, `ceil` | Round down/up to an integer |
| `abs` | Fixed-point result; -32768 saturates to the positive range limit |
| `sgn` | Returns -1, 0 or 1; `sgn(0)` is **0** |
| `min`, `max`, `mid` | Minimum, maximum, median; integer/fractional values supported |
| `sqrt` | Nonpositive inputs return zero; positive results are fixed-point approximations |
| `sin`, `cos` | Turns; quarter-turn sine is -1; runtime uses a 256-entry table |
| `atan2(dx,dy)` | Approximate screen-space angle in turns; `(0,0)` returns 0.75 |
| Integer floor division (`\`) | Rounds toward negative infinity |
| Fractional floor division (`\`) | Floors the raw-value quotient directly, retaining tiny negative remainders |
| `%` | Floor remainder, with divisor's sign when nonzero; runtime zero divisor returns zero |
| Runtime fixed division by zero | Negative numerator returns -32768; otherwise the positive range limit |
| `rnd(n)` | For positive n, result is at least zero and below n; nonpositive n returns zero |
| `srand(seed)` | Restarts a repeatable 16-bit generator; not PICO-8's sequence |

## Limits to design around

`min(x)` and `max(x)` default their second argument to zero. Integer function-call
arguments use runtime helpers so each argument is evaluated once. ROM tests
cover this path with a counter, including the omitted second argument.

Runtime `ceil` can produce the integer 32768 for inputs above 32767. It now
avoids raw fixed-point overflow during rounding. This result cannot be represented
as signed 16.16: keep it in integer operations, or clamp it before assigning it
to a fixed-point array or passing it to a fixed-point API. Folded global
initializers outside the fixed-point range now produce a compiler error, including
`local n=ceil(32767.5)`. Scalar globals, non-byte array fills and numeric table
initializers are checked. This does not add runtime overflow checks.

- Keep intermediate arithmetic inside the fixed-point range. General overflow,
  integer/fixed conversions outside that range and excessive shift counts do not
  have a supported wraparound or saturation contract.
- Fractions are quantized. Constant folding and runtime arithmetic can differ
  in their rounding or approximation; do not assume exact equality for calculated
  fractions or trigonometric results. Use a tolerance appropriate to the calculation.
- Runtime zero-divisor handling is a fallback, not a way to produce infinity.
  Avoid zero divisors in source expressions, including folded constants; do not
  use runtime fallback behavior as a constant-expression contract.
- The simulation clock is fixed point too; long-running games should maintain
  bounded counters instead of assuming an unlimited `time()` value.

## Evidence

Genesis owns constant folding for `sgn`, so folded `sgn(0)` and runtime
`sgn(0)` both return zero. Older builds folded the constant to one; rebuild
ROMs that use this expression in global initializers to apply the correction.

ROM tests cover abs boundary/constant agreement, rounding, fractional signs,
min/max/mid, roots, angle quadrants including -32768, signed division/remainders,
zero divisors and RNG range/reseeding. This is targeted coverage, not exhaustive
proof over all numeric inputs. The scoped release audit is complete with the
limits above; newly discovered in-range correctness bugs still require fixes.
