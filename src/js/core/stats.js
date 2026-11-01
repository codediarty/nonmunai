// 논문AI 통계 계산 모듈
// G*Power와 같은 방식(비중심 F·카이제곱 분포)으로 검정력과 표본 수를 계산합니다.
// 브라우저와 Node 양쪽에서 동작하도록 DOM 의존성이 없습니다.

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// 불완전 베타함수의 연분수 전개 (Numerical Recipes betacf)
function betacf(a, b, x) {
  const MAXIT = 400, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// 정규화된 불완전 베타함수 I_x(a, b)
export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// 정규화된 하부 불완전 감마함수 P(a, x)
export function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 1000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  // 연분수 (Q를 구한 뒤 1-Q)
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

export function fcdf(f, d1, d2) {
  if (f <= 0) return 0;
  return ibeta((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}

export function chi2cdf(x, k) {
  if (x <= 0) return 0;
  return gammaP(k / 2, x / 2);
}

function bisect(fn, target, lo, hi, iters = 200) {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function finv(p, d1, d2) {
  let hi = 10;
  while (fcdf(hi, d1, d2) < p && hi < 1e7) hi *= 2;
  return bisect((f) => fcdf(f, d1, d2), p, 0, hi);
}

export function chi2inv(p, k) {
  let hi = Math.max(10, k * 3);
  while (chi2cdf(hi, k) < p && hi < 1e7) hi *= 2;
  return bisect((x) => chi2cdf(x, k), p, 0, hi);
}

// 포아송 가중합: 비중심 분포 = Σ Pois(j; λ/2) × 중심 분포(j)
function poissonMixture(lambda, termFn) {
  const half = lambda / 2;
  if (half === 0) return termFn(0);
  const mode = Math.floor(half);
  const logW = (j) => -half + j * Math.log(half) - lgamma(j + 1);
  let total = 0;
  for (let j = mode; j < mode + 2000; j++) {
    const w = Math.exp(logW(j));
    total += w * termFn(j);
    if (w < 1e-14 && j > half) break;
  }
  for (let j = mode - 1; j >= 0; j--) {
    const w = Math.exp(logW(j));
    total += w * termFn(j);
    if (w < 1e-14) break;
  }
  return total;
}

export function ncfcdf(f, d1, d2, lambda) {
  if (f <= 0) return 0;
  const x = (d1 * f) / (d1 * f + d2);
  return poissonMixture(lambda, (j) => ibeta(x, d1 / 2 + j, d2 / 2));
}

export function ncchi2cdf(x, k, lambda) {
  if (x <= 0) return 0;
  return poissonMixture(lambda, (j) => gammaP(k / 2 + j, x / 2));
}

// 표준정규 분위수 (Acklam)
export function normInv(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    q = p - 0.5; r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// F 검정 기반 검정력 (회귀·분산분석·t검정 공통)
export function powerF({ df1, df2, lambda, alpha = 0.05 }) {
  if (df2 <= 0) return 0;
  const crit = finv(1 - alpha, df1, df2);
  return 1 - ncfcdf(crit, df1, df2, lambda);
}

function searchN(powerAt, { start = 4, target = 0.8, max = 100000, step = 1 }) {
  // 지수 탐색 후 이진 탐색으로 최소 N
  let lo = start, hi = start;
  while (powerAt(hi) < target) {
    lo = hi; hi = Math.ceil(hi * 1.6) + step;
    if (hi > max) return null;
  }
  while (hi - lo > step) {
    const mid = Math.floor((lo + hi) / 2 / step) * step;
    if (mid <= lo) break;
    if (powerAt(mid) >= target) hi = mid; else lo = mid;
  }
  // 경계 보정
  for (let n = lo; n <= hi; n += step) if (n >= start && powerAt(n) >= target) return n;
  return hi;
}

// 다중회귀 (R² 증가, 고정모형): G*Power "Linear multiple regression: Fixed model, R² deviation from zero"
export function nRegression({ f2 = 0.15, predictors = 1, alpha = 0.05, power = 0.8 }) {
  const k = predictors;
  const n = searchN((N) => powerF({ df1: k, df2: N - k - 1, lambda: f2 * N, alpha }), { start: k + 3, target: power });
  return { n, method: '다중회귀분석 (F 검정)', assumptions: `효과크기 f²=${f2}, 유의수준 α=${alpha}, 검정력 ${power}, 예측변수 ${k}개` };
}

// 독립표본 t검정 (양측, 두 집단 동일 크기)
export function nTTest({ d = 0.5, alpha = 0.05, power = 0.8 }) {
  const perGroup = searchN((n) => powerF({ df1: 1, df2: 2 * n - 2, lambda: (d * d * n) / 2, alpha }), { start: 3, target: power });
  return { n: perGroup * 2, perGroup, method: '독립표본 t검정 (양측)', assumptions: `효과크기 d=${d}, α=${alpha}, 검정력 ${power}` };
}

// 대응표본 t검정 (양측)
export function nPairedT({ dz = 0.5, alpha = 0.05, power = 0.8 }) {
  const n = searchN((N) => powerF({ df1: 1, df2: N - 1, lambda: dz * dz * N, alpha }), { start: 3, target: power });
  return { n, method: '대응표본 t검정 (양측)', assumptions: `효과크기 dz=${dz}, α=${alpha}, 검정력 ${power}` };
}

// 일원분산분석 (고정효과, 전체 효과)
export function nAnova({ f = 0.25, groups = 3, alpha = 0.05, power = 0.8 }) {
  const g = groups;
  const n = searchN((N) => powerF({ df1: g - 1, df2: N - g, lambda: f * f * N, alpha }), { start: g + 2, target: power });
  const total = Math.ceil(n / g) * g;
  return { n: total, perGroup: total / g, method: `일원분산분석 (${g}집단)`, assumptions: `효과크기 f=${f}, α=${alpha}, 검정력 ${power}` };
}

// 카이제곱 검정 (적합도·독립성)
export function nChiSquare({ w = 0.3, df = 1, alpha = 0.05, power = 0.8 }) {
  const crit = (N) => chi2inv(1 - alpha, df);
  const c = crit();
  const n = searchN((N) => 1 - ncchi2cdf(c, df, w * w * N), { start: 5, target: power });
  return { n, method: `카이제곱 검정 (자유도 ${df})`, assumptions: `효과크기 w=${w}, α=${alpha}, 검정력 ${power}` };
}

// 상관분석 검정력: 이변량 정규분포에서 표본상관 r의 정확 분포를 수치적분 (G*Power exact 방식)
function hyp2f1Half(c, z) {
  // ₂F₁(1/2, 1/2; c; z), 0 ≤ z < 1
  let term = 1, sum = 1;
  for (let k = 0; k < 5000; k++) {
    term *= ((0.5 + k) * (0.5 + k)) / ((c + k) * (k + 1)) * z;
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

function rDensity(r, rho, n) {
  // Hotelling 형태의 표본상관 밀도
  const logC = Math.log(n - 2) + lgamma(n - 1) - 0.5 * Math.log(2 * Math.PI) - lgamma(n - 0.5);
  const logTerm = ((n - 1) / 2) * Math.log(1 - rho * rho) + ((n - 4) / 2) * Math.log(1 - r * r) - (n - 1.5) * Math.log(1 - rho * r);
  return Math.exp(logC + logTerm) * hyp2f1Half(n - 0.5, (1 + rho * r) / 2);
}

function tinvTwoSided(alpha, df) {
  // t 분포 분위수: F(1, df)의 제곱근
  return Math.sqrt(finv(1 - alpha, 1, df));
}

export function powerCorrelation({ rho, n, alpha = 0.05 }) {
  const tc = tinvTwoSided(alpha, n - 2);
  const rc = tc / Math.sqrt(tc * tc + n - 2);
  const integrate = (a, b) => {
    const m = 1200;
    const h = (b - a) / m;
    let s = rDensity(a, rho, n) + rDensity(b - 1e-12, rho, n);
    for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * rDensity(a + i * h, rho, n);
    return (s * h) / 3;
  };
  return integrate(rc, 1 - 1e-9) + integrate(-1 + 1e-9, -rc);
}

export function nCorrelation({ r = 0.3, alpha = 0.05, power = 0.8 }) {
  const n = searchN((N) => powerCorrelation({ rho: r, n: N, alpha }), { start: 6, target: power });
  return { n, method: '상관분석 (양측, 이변량 정규 정확검정)', assumptions: `효과크기 r=${r}, α=${alpha}, 검정력 ${power}` };
}

// 기술 조사(비율 추정) 표본 수: 허용오차 e, 신뢰수준
export function nProportion({ e = 0.05, confidence = 0.95, p = 0.5, population = null }) {
  const z = normInv(1 - (1 - confidence) / 2);
  let n = (z * z * p * (1 - p)) / (e * e);
  if (population && population > 0) n = n / (1 + (n - 1) / population);
  return { n: Math.ceil(n), method: '비율 추정 조사', assumptions: `허용오차 ±${Math.round(e * 1000) / 10}%p, 신뢰수준 ${Math.round(confidence * 100)}%${population ? `, 모집단 ${population.toLocaleString('ko-KR')}명` : ''}` };
}

// 매개효과(부트스트래핑) 경험 기준: Fritz & MacKinnon(2007)
export const MEDIATION_RULE = {
  medium: { n: 78, note: '경로 a·b가 중간 효과(.39)일 때 퍼센타일 부트스트래핑 기준 약 78명 (Fritz & MacKinnon, 2007)' },
  small: { n: 558, note: '경로 a·b가 작은 효과(.14)일 때 약 558명 (Fritz & MacKinnon, 2007)' },
};

export function withDropout(n, rate = 0.15) {
  return Math.ceil(n / (1 - rate));
}

// 크론바흐 알파 (행: 응답자, 열: 문항), 결측 응답자는 제외
export function cronbachAlpha(rows) {
  const clean = rows.filter((r) => r.every((v) => typeof v === 'number' && Number.isFinite(v)));
  const k = clean[0] ? clean[0].length : 0;
  if (clean.length < 3 || k < 2) return null;
  const variance = (arr) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  };
  let itemVar = 0;
  for (let j = 0; j < k; j++) itemVar += variance(clean.map((r) => r[j]));
  const totalVar = variance(clean.map((r) => r.reduce((a, b) => a + b, 0)));
  if (totalVar === 0) return null;
  return { alpha: (k / (k - 1)) * (1 - itemVar / totalVar), k, n: clean.length };
}

export function describe(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = nums.length;
  if (!n) return { n: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const q = (p) => {
    const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  let m3 = 0, m4 = 0;
  for (const v of nums) { const d = v - mean; m3 += d ** 3; m4 += d ** 4; }
  const skew = sd > 0 && n > 2 ? (n / ((n - 1) * (n - 2))) * (m3 / sd ** 3) : 0;
  const kurt = sd > 0 && n > 3 ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * (m4 / sd ** 4) - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3)) : 0;
  return { n, mean, sd, min: sorted[0], max: sorted[n - 1], median: q(0.5), q1: q(0.25), q3: q(0.75), skew, kurt };
}
