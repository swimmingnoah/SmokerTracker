import { describe, it, expect } from 'vitest';
import { computeFinishEstimate } from './planUtils';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 4, 30, 12, 0, 0); // fixed reference instant

describe('computeFinishEstimate', () => {
	it('returns null when there is no usable average', () => {
		expect(computeFinishEstimate(null, HOUR, NOW)).toBeNull();
		expect(computeFinishEstimate(0, HOUR, NOW)).toBeNull();
		expect(computeFinishEstimate(NaN, HOUR, NOW)).toBeNull();
		expect(computeFinishEstimate(-2, HOUR, NOW)).toBeNull();
	});

	it('computes a half-done cook: ~50% progress, half remaining, future finish', () => {
		// average 10h, 5h net elapsed
		const r = computeFinishEstimate(10, 5 * HOUR, NOW);
		expect(r.overrun).toBe(false);
		expect(r.progressPct).toBeCloseTo(50, 5);
		expect(r.remainingMs).toBe(5 * HOUR);
		expect(r.finishDate.getTime()).toBe(NOW + 5 * HOUR);
	});

	it('flags overrun when net cook time has passed the average', () => {
		// average 8h, 9h net elapsed
		const r = computeFinishEstimate(8, 9 * HOUR, NOW);
		expect(r.overrun).toBe(true);
		expect(r.remainingMs).toBe(0);
		expect(r.progressPct).toBe(100);
		// finishDate collapses to now when nothing remains
		expect(r.finishDate.getTime()).toBe(NOW);
	});

	it('treats exactly-at-average as overrun / 100%', () => {
		const r = computeFinishEstimate(6, 6 * HOUR, NOW);
		expect(r.overrun).toBe(true);
		expect(r.progressPct).toBe(100);
		expect(r.remainingMs).toBe(0);
	});

	it('clamps negative/invalid elapsed without producing NaN', () => {
		const r = computeFinishEstimate(4, -100, NOW);
		expect(r.progressPct).toBe(0);
		expect(r.remainingMs).toBe(4 * HOUR);
		expect(Number.isNaN(r.progressPct)).toBe(false);
	});

	it('defaults now to Date.now() when omitted', () => {
		const before = Date.now();
		const r = computeFinishEstimate(2, 1 * HOUR);
		const after = Date.now();
		// finish = now + 1h remaining; bracket against the call window
		expect(r.finishDate.getTime()).toBeGreaterThanOrEqual(before + HOUR);
		expect(r.finishDate.getTime()).toBeLessThanOrEqual(after + HOUR);
	});
});
