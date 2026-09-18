// md_math.h — 16.16 fixed-point math runtime (see md_math.c).
#ifndef MD_MATH_H
#define MD_MATH_H

long md_fmul(long a, long b);
long md_fdiv(long a, long b);
long md_fsin(long turns);
long md_fcos(long turns);
long md_fsqrt(long x);
long md_fatan2(long dx, long dy);
long md_rnd(long x);
void md_srand(long seed);
void md_time_tick(void);
long md_time(void);
unsigned int md_ticks(void);   // frame counter since boot (animation timing)
void md_time_reset(void);      // reset time + frame counter (run()/reset)

// helpers the emitter calls directly
int  md_rnd_int(int n);
int  md_absi(int v);
long md_absf(long v);
int  md_sgni(int v);
long md_sgnf(long v);
int  md_midi(int a, int b, int c);
long md_midf(long a, long b, long c);
long md_minf(long a, long b);
long md_maxf(long a, long b);
// Inline so literal divisors retain GCC's constant-division optimization.
static inline int md_ifdiv(int a, int b) {
    int q;
    if (b == 0) return a < 0 ? -32768 : 32767;
    q = a / b;
    if ((a % b != 0) && ((a < 0) != (b < 0))) q--;
    return q;
}
static inline int md_ifmod(int a, int b) {
    int r;
    if (b == 0) return 0;
    r = a % b;
    if (r != 0 && ((r < 0) != (b < 0))) r += b;
    return r;
}
long md_ffmod(long a, long b);
int md_ffdiv(long a, long b);

#endif
