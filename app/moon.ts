export type MoonPhase = "full" | "new";

const synodicMonth = 29.530588861;
const epoch = 2451550.09766;
const dayMilliseconds = 86400000;
const sin = (degrees: number) => Math.sin(degrees * Math.PI / 180);

export function moonPhaseInstant(lunation: number, phase: MoonPhase): Date {
  const k = lunation + (phase === "full" ? 0.5 : 0);
  const t = k / 1236.85;
  const e = 1 - 0.002516 * t - 0.0000074 * t ** 2;
  const m = 2.5534 + 29.1053567 * k - 0.0000014 * t ** 2 - 0.00000011 * t ** 3;
  const p = 201.5643 + 385.81693528 * k + 0.0107582 * t ** 2 + 0.00001238 * t ** 3 - 0.000000058 * t ** 4;
  const f = 160.7108 + 390.67050284 * k - 0.0016118 * t ** 2 - 0.00000227 * t ** 3 + 0.000000011 * t ** 4;
  const omega = 124.7746 - 1.56375588 * k + 0.0020672 * t ** 2 + 0.00000215 * t ** 3;
  const coefficients = phase === "new"
    ? [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208]
    : [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209];
  const argumentsInDegrees = [p, m, 2 * p, 2 * f, p - m, p + m, 2 * m];
  const eccentricities = [1, e, 1, 1, e, e, e * e];
  let correction = coefficients.reduce((sum, coefficient, index) => sum + coefficient * eccentricities[index] * sin(argumentsInDegrees[index]), 0);
  correction += -0.00111 * sin(p - 2 * f) - 0.00057 * sin(p + 2 * f)
    + 0.00056 * e * sin(2 * p + m) - 0.00042 * sin(3 * p)
    + 0.00042 * e * sin(m + 2 * f) + 0.00038 * e * sin(m - 2 * f)
    - 0.00024 * e * sin(2 * p - m) - 0.00017 * sin(omega)
    - 0.00007 * sin(p + 2 * m) + 0.00004 * sin(2 * p - 2 * f)
    + 0.00004 * sin(3 * m) + 0.00003 * sin(p + m - 2 * f)
    + 0.00003 * sin(2 * p + 2 * f) - 0.00003 * sin(p + m + 2 * f)
    + 0.00003 * sin(p - m + 2 * f) - 0.00002 * sin(p - m - 2 * f)
    - 0.00002 * sin(3 * p + m) + 0.00002 * sin(4 * p);
  const planetaryTerms = [
    [325, 299.77 - 0.009173 * t ** 2, 0.107408], [165, 251.88, 0.016321],
    [164, 251.83, 26.651886], [126, 349.42, 36.412478], [110, 84.66, 18.206239],
    [62, 141.74, 53.303771], [60, 207.14, 2.453732], [56, 154.84, 7.30686],
    [47, 34.52, 27.261239], [42, 207.19, 0.121824], [40, 291.34, 1.844379],
    [37, 161.72, 24.198154], [35, 239.56, 25.513099], [23, 331.55, 3.592518],
  ];
  correction += planetaryTerms.reduce((sum, [amplitude, angle, rate]) => sum + amplitude * 0.000001 * sin(angle + rate * k), 0);
  const jde = epoch + synodicMonth * k + 0.00015437 * t ** 2 - 0.00000015 * t ** 3 + 0.00000000073 * t ** 4 + correction;
  const yearOffset = (jde - 2451545) / 365.2425;
  const deltaT = 62.92 + 0.32217 * yearOffset + 0.005589 * yearOffset ** 2;
  return new Date((jde - 2440587.5) * dayMilliseconds - deltaT * 1000);
}

export function moonPhaseOn(date: Date): MoonPhase | undefined {
  if (!Number.isFinite(date.getTime())) return undefined;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const lunation = Math.floor((start.getTime() / dayMilliseconds + 2440587.5 - epoch) / synodicMonth);
  for (let candidate = lunation - 1; candidate <= lunation + 1; candidate++) {
    for (const phase of ["new", "full"] as const) {
      const instant = moonPhaseInstant(candidate, phase).getTime();
      if (instant >= start.getTime() && instant < end.getTime()) return phase;
    }
  }
  return undefined;
}
