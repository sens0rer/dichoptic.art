// Okhsl: a perceptual HSL built on Oklab (Björn Ottosson, https://bottosson.github.io/posts/colorpicker/,
// reference code MIT licensed). Every (h, s, l) in [0, 1]^3 is a colour sRGB can show, hue and
// lightness are perceptually even, and s is relative to the most saturated colour at that hue and
// lightness. Ported from the reference implementation.

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

export interface Colour {
	// Okhsl, each in [0, 1]
	h: number;
	s: number;
	l: number;
	hex: string;
	// Oklab, for perceptual distances in analysis
	lab: Lab;
	// Further colours, when she gave the part more than one (two-tone letters and the like).
	more?: Colour[];
}

const cbrt = Math.cbrt;

export function linearSrgbToOklab([r, g, b]: Rgb): Lab {
	const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	];
}

export function oklabToLinearSrgb([L, a, b]: Lab): Rgb {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	];
}

const toSrgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

// Largest saturation (C/L) inside sRGB for the hue (a, b), a and b normalised so a² + b² = 1.
function maxSaturation(a: number, b: number) {
	let k0, k1, k2, k3, k4, wl, wm, ws;
	if (-1.88170328 * a - 0.80936493 * b > 1) {
		[k0, k1, k2, k3, k4] = [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245];
		[wl, wm, ws] = [4.0767416621, -3.3077115913, 0.2309699292];
	} else if (1.81444104 * a - 1.19445276 * b > 1) {
		[k0, k1, k2, k3, k4] = [0.73956515, -0.45954404, 0.08285427, 0.1254107, 0.14503204];
		[wl, wm, ws] = [-1.2684380046, 2.6097574011, -0.3413193965];
	} else {
		[k0, k1, k2, k3, k4] = [1.35733652, -0.00915799, -1.1513021, -0.50559606, 0.00692167];
		[wl, wm, ws] = [-0.0041960863, -0.7034186147, 1.707614701];
	}
	let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
	const kl = 0.3963377774 * a + 0.2158037573 * b;
	const km = -0.1055613458 * a - 0.0638541728 * b;
	const ks = -0.0894841775 * a - 1.291485548 * b;
	// One Halley step refines the polynomial estimate.
	const l_ = 1 + S * kl;
	const m_ = 1 + S * km;
	const s_ = 1 + S * ks;
	const f = wl * l_ ** 3 + wm * m_ ** 3 + ws * s_ ** 3;
	const f1 = wl * 3 * kl * l_ * l_ + wm * 3 * km * m_ * m_ + ws * 3 * ks * s_ * s_;
	const f2 = wl * 6 * kl * kl * l_ + wm * 6 * km * km * m_ + ws * 6 * ks * ks * s_;
	S -= (f * f1) / (f1 * f1 - 0.5 * f * f2);
	return S;
}

// The most chromatic colour of a hue: [L, C].
function findCusp(a: number, b: number): [number, number] {
	const S = maxSaturation(a, b);
	const rgb = oklabToLinearSrgb([1, S * a, S * b]);
	const L = cbrt(1 / Math.max(...rgb));
	return [L, L * S];
}

// Where the line from (L0, 0) to (L1, C1) leaves the sRGB gamut, as a fraction t of that line.
function gamutIntersection(a: number, b: number, L1: number, C1: number, L0: number, cusp: [number, number]) {
	const [Lc, Cc] = cusp;
	if ((L1 - L0) * Cc - (Lc - L0) * C1 <= 0) return (Cc * L0) / (C1 * Lc + Cc * (L0 - L1));
	let t = (Cc * (L0 - 1)) / (C1 * (Lc - 1) + Cc * (L0 - L1));
	const dL = L1 - L0;
	const dC = C1;
	const kl = 0.3963377774 * a + 0.2158037573 * b;
	const km = -0.1055613458 * a - 0.0638541728 * b;
	const ks = -0.0894841775 * a - 1.291485548 * b;
	const ldt = dL + dC * kl;
	const mdt = dL + dC * km;
	const sdt = dL + dC * ks;
	const L = L0 * (1 - t) + t * L1;
	const C = t * C1;
	const l_ = L + C * kl;
	const m_ = L + C * km;
	const s_ = L + C * ks;
	const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
	const [l1, m1, s1] = [3 * ldt * l_ * l_, 3 * mdt * m_ * m_, 3 * sdt * s_ * s_];
	const [l2, m2, s2] = [6 * ldt * ldt * l_, 6 * mdt * mdt * m_, 6 * sdt * sdt * s_];
	const step = (wl: number, wm: number, ws: number) => {
		const f = wl * l + wm * m + ws * s - 1;
		const f1 = wl * l1 + wm * m1 + ws * s1;
		const f2 = wl * l2 + wm * m2 + ws * s2;
		const u = f1 / (f1 * f1 - 0.5 * f * f2);
		return u >= 0 ? -f * u : Number.MAX_VALUE;
	};
	t += Math.min(
		step(4.0767416621, -3.3077115913, 0.2309699292),
		step(-1.2684380046, 2.6097574011, -0.3413193965),
		step(-0.0041960863, -0.7034186147, 1.707614701)
	);
	return t;
}

// Okhsl's lightness is Oklab L through a "toe" that makes it match perceived lightness better.
const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);
const toe = (x: number) => 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) ** 2 + 4 * K2 * K3 * x));
const toeInv = (x: number) => (x * x + K1 * x) / (K3 * (x + K2));

function stMid(a: number, b: number): [number, number] {
	const S =
		0.11516993 +
		1 /
			(7.4477897 +
				4.1590124 * b +
				a * (-2.19557347 + 1.75198401 * b + a * (-2.13704948 - 10.02301043 * b + a * (-4.24894561 + 5.38770819 * b + 4.69891013 * a))));
	const T =
		0.11239642 +
		1 /
			(1.6132032 -
				0.68124379 * b +
				a * (0.40370612 + 0.90148123 * b + a * (-0.27087943 + 0.6122399 * b + a * (0.00299215 - 0.45399568 * b - 0.14661872 * a))));
	return [S, T];
}

// Three reference chromas at lightness L for the hue: low, mid and the gamut edge.
function chromas(L: number, a: number, b: number): [number, number, number] {
	const cusp = findCusp(a, b);
	const Cmax = gamutIntersection(a, b, L, 1, L, cusp);
	const stMax = [cusp[1] / cusp[0], cusp[1] / (1 - cusp[0])];
	const k = Cmax / Math.min(L * stMax[0], (1 - L) * stMax[1]);
	const [sm, tm] = stMid(a, b);
	const Ca = L * sm;
	const Cb = (1 - L) * tm;
	const Cmid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / Ca ** 4 + 1 / Cb ** 4)));
	const Ca0 = L * 0.4;
	const Cb0 = (1 - L) * 0.8;
	const C0 = Math.sqrt(1 / (1 / Ca0 ** 2 + 1 / Cb0 ** 2));
	return [C0, Cmid, Cmax];
}

const MID = 0.8;
const MID_INV = 1.25;

// Okhsl (each 0..1) to sRGB (each 0..1).
export function okhslToSrgb(h: number, s: number, l: number): Rgb {
	if (l >= 1) return [1, 1, 1];
	if (l <= 0) return [0, 0, 0];
	const a = Math.cos(2 * Math.PI * h);
	const b = Math.sin(2 * Math.PI * h);
	const L = toeInv(l);
	const [C0, Cmid, Cmax] = chromas(L, a, b);
	let C;
	if (s < MID) {
		const t = MID_INV * s;
		const k1 = MID * C0;
		const k2 = 1 - k1 / Cmid;
		C = (t * k1) / (1 - k2 * t);
	} else {
		const t = (s - MID) / (1 - MID);
		const k1 = ((1 - MID) * Cmid * Cmid * MID_INV * MID_INV) / C0;
		const k2 = 1 - k1 / (Cmax - Cmid);
		C = Cmid + (t * k1) / (1 - k2 * t);
	}
	const rgb = oklabToLinearSrgb([L, C * a, C * b]);
	return rgb.map((x) => Math.min(1, Math.max(0, toSrgb(x)))) as Rgb;
}

// sRGB (each 0..1) to Okhsl (each 0..1).
export function srgbToOkhsl(rgb: Rgb): [number, number, number] {
	const [L, A, B] = linearSrgbToOklab(rgb.map(toLinear) as Rgb);
	const C = Math.hypot(A, B);
	const l = toe(L);
	if (C < 1e-7 || L <= 0 || L >= 1) return [0, 0, Math.min(1, Math.max(0, l))];
	const a = A / C;
	const b = B / C;
	const h = 0.5 + (0.5 * Math.atan2(-B, -A)) / Math.PI;
	const [C0, Cmid, Cmax] = chromas(L, a, b);
	let s;
	if (C < Cmid) {
		const k1 = MID * C0;
		const k2 = 1 - k1 / Cmid;
		s = (C / (k1 + k2 * C)) * MID;
	} else {
		const k1 = ((1 - MID) * Cmid * Cmid * MID_INV * MID_INV) / C0;
		const k2 = 1 - k1 / (Cmax - Cmid);
		const t = (C - Cmid) / (k1 + k2 * (C - Cmid));
		s = MID + (1 - MID) * t;
	}
	return [h, s, l];
}

export const hex = (rgb: Rgb) =>
	'#' + rgb.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

export function colour(h: number, s: number, l: number): Colour {
	const rgb = okhslToSrgb(h, s, l);
	return { h, s, l, hex: hex(rgb), lab: linearSrgbToOklab(rgb.map(toLinear) as Rgb) };
}

export const css = (h: number, s: number, l: number) => hex(okhslToSrgb(h, s, l));

// The most saturated colour sRGB can show for a hue (the gamut's cusp), for drawing the hue ring.
export function vivid(h: number) {
	const a = Math.cos(2 * Math.PI * h);
	const b = Math.sin(2 * Math.PI * h);
	const [L, C] = findCusp(a, b);
	return hex(oklabToLinearSrgb([L, C * a, C * b]).map((x) => Math.min(1, Math.max(0, toSrgb(x)))) as Rgb);
}
