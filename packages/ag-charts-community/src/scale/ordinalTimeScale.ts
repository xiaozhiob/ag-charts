import { unique } from '../util/array';
import type { TimeInterval } from '../util/time';
import { buildFormatter } from '../util/timeFormat';
import { dateToNumber, defaultTimeTickFormat } from '../util/timeFormatDefaults';
import { BandScale } from './bandScale';
import { ContinuousScale } from './continuousScale';
import { Invalidating } from './invalidating';
import { TimeScale } from './timeScale';

function compareNumbers(a: number, b: number) {
    return a - b;
}

export class OrdinalTimeScale extends BandScale<Date, TimeInterval | number> {
    override readonly type = 'ordinal-time';

    static override is(value: unknown): value is OrdinalTimeScale {
        return value instanceof OrdinalTimeScale;
    }

    @Invalidating
    tickCount = ContinuousScale.defaultTickCount;
    @Invalidating
    minTickCount = 0;
    @Invalidating
    maxTickCount = Infinity;

    @Invalidating
    override interval?: TimeInterval | number = undefined;

    protected override _domain: Date[] = [];
    protected timestamps: number[] = [];
    protected sortedTimestamps: number[] = [];
    protected visibleRange: [number, number] = [0, 1];

    private precomputedSteps: Int32Array | undefined;

    setVisibleRange(visibleRange: [number, number]) {
        this.visibleRange = visibleRange;
    }

    override set domain(values: Date[]) {
        if (values === this._domain) {
            return;
        }

        this.invalid = true;
        this.precomputedSteps = undefined;

        if (values.length === 0) {
            this._domain = [];
            return;
        }

        const timestamps = unique(values.map(dateToNumber));
        const sortedTimestamps = timestamps.slice().sort(compareNumbers);

        this._domain = values;
        this.timestamps = timestamps;
        this.sortedTimestamps = sortedTimestamps;

        const computedStepCount = Math.ceil(sortedTimestamps.length / 64);
        if (computedStepCount <= 1) return;

        this.refresh();
        const computedSteps = new Int32Array(computedStepCount);
        const d0 = sortedTimestamps[0].valueOf();
        const d1 = sortedTimestamps[sortedTimestamps.length - 1].valueOf();
        const dRange = d1 - d0;
        for (let i = 0; i < computedSteps.length; i += 1) {
            computedSteps[i] = this.findInterval(d0 + (i / computedStepCount) * dRange);
        }

        this.precomputedSteps = computedSteps;
    }
    override get domain(): Date[] {
        return this._domain;
    }

    override ticks(): Date[] {
        this.refresh();

        const [t0, t1] = [this.timestamps[0], this.timestamps.at(-1)!];
        const start = Math.min(t0, t1);
        const stop = Math.max(t0, t1);
        const isReversed = t0 > t1;

        let ticks;
        if (this.interval == null) {
            ticks = this.getDefaultTicks(this.maxTickCount, isReversed);
        } else {
            const [r0, r1] = this.range;
            const availableRange = Math.abs(r1 - r0);
            ticks = TimeScale.getTicksForInterval({ start, stop, interval: this.interval, availableRange }) ?? [];
        }

        // max one tick per band
        const tickPositions = new Set<number>();
        return ticks.filter((tick) => {
            const position = this.convert(tick);
            if (isNaN(position) || tickPositions.has(position)) {
                return false;
            }
            tickPositions.add(position);
            return true;
        });
    }

    private getDefaultTicks(maxTickCount: number, isReversed?: boolean) {
        const ticks: Date[] = [];
        const count = this.timestamps.length;
        const tickEvery = Math.ceil((count * (this.visibleRange[1] - this.visibleRange[0])) / maxTickCount);
        const tickOffset = Math.floor(tickEvery / 2);
        for (const [index, value] of this.timestamps.entries()) {
            if (tickEvery > 0 && (index + tickOffset) % tickEvery) continue;
            if (isReversed) {
                ticks.push(new Date(this.timestamps[count - index - 1]));
            } else {
                ticks.push(new Date(value));
            }
        }
        return ticks;
    }

    override convert(d: Date): number {
        this.refresh();
        const n = Number(d);
        if (n < this.sortedTimestamps[0]) {
            return NaN;
        }
        let i = this.findInterval(n);
        if (this.timestamps[0] !== this.sortedTimestamps[0]) {
            i = this.timestamps.length - i - 1;
        }
        return this.ordinalRange[i] ?? NaN;
    }

    private findInterval(target: number) {
        // Binary search for the target
        const { sortedTimestamps, precomputedSteps } = this;
        let low: number;
        let high: number;
        if (precomputedSteps != null) {
            const d0 = sortedTimestamps[0].valueOf();
            const d1 = sortedTimestamps[sortedTimestamps.length - 1].valueOf();
            const i = (((target - d0) / (d1 - d0)) * precomputedSteps.length) | 0;
            low = precomputedSteps[i];
            high = i < precomputedSteps.length - 1 ? precomputedSteps[i + 1] : sortedTimestamps.length - 1;
        } else {
            low = 0;
            high = sortedTimestamps.length - 1;
        }

        while (low <= high) {
            const mid = ((low + high) / 2) | 0;
            if (sortedTimestamps[mid] === target) {
                return mid;
            } else if (sortedTimestamps[mid] < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }

    /**
     * Returns a time format function suitable for displaying tick values.
     * @param specifier If the specifier string is provided, this method is equivalent to
     * the {@link TimeLocaleObject.format} method.
     * If no specifier is provided, this method returns the default time format function.
     */
    tickFormat({
        ticks,
        domain,
        specifier,
    }: {
        ticks?: any[];
        domain?: any[];
        specifier?: string;
    }): (date: Date) => string {
        return specifier == null ? defaultTimeTickFormat(ticks, domain) : buildFormatter(specifier);
    }

    override invert(position: number) {
        this.refresh();
        const index = this.ordinalRange.findIndex((p) => position <= p);
        return this.domain[index];
    }

    override invertNearest(y: number): Date {
        return new Date(super.invertNearest(y));
    }
}
