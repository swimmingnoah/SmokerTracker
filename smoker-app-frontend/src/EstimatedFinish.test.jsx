import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EstimatedFinish from './EstimatedFinish';

const HOUR = 60 * 60 * 1000;

describe('EstimatedFinish', () => {
	it('shows the average baseline and a future finish for a half-done cook', () => {
		render(
			<EstimatedFinish
				estimatedDurationHours={10}
				sampleCount={4}
				elapsedMs={5 * HOUR}
				meatType="Brisket"
			/>
		);
		expect(screen.getByText(/Avg Brisket: 10h 0m · 4 cooks/)).toBeInTheDocument();
		expect(screen.getByText(/Est\. done ~/)).toBeInTheDocument();
		expect(screen.getByText(/left/)).toBeInTheDocument();
		expect(screen.getByText('50% of average')).toBeInTheDocument();
	});

	it('signals overrun when elapsed has passed the average', () => {
		render(
			<EstimatedFinish
				estimatedDurationHours={8}
				sampleCount={2}
				elapsedMs={9 * HOUR}
				meatType="Pork"
			/>
		);
		expect(screen.getByText('Est. done — running long')).toBeInTheDocument();
		expect(screen.getByText('100% of average')).toBeInTheDocument();
	});

	it('shows a no-history message when there is no average', () => {
		render(
			<EstimatedFinish
				estimatedDurationHours={null}
				sampleCount={0}
				elapsedMs={2 * HOUR}
				meatType="Chicken"
			/>
		);
		expect(
			screen.getByText(/Not enough Chicken cooks yet to estimate/)
		).toBeInTheDocument();
	});

	it('uses a singular "cook" label for a single sample', () => {
		render(
			<EstimatedFinish
				estimatedDurationHours={6}
				sampleCount={1}
				elapsedMs={1 * HOUR}
				meatType="Ribs"
			/>
		);
		expect(screen.getByText(/· 1 cook$/)).toBeInTheDocument();
	});
});
