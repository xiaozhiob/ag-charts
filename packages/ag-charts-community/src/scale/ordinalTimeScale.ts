import { datesSortOrder } from '../util/date';
import type { TimeInterval } from '../util/time';
import { buildFormatter } from '../util/timeFormat';
import { dateToNumber, defaultTimeTickFormat } from '../util/timeFormatDefaults';
import { BandScale } from './bandScale';
import { ContinuousScale } from './continuousScale';
import { Invalidating } from './invalidating';
import { TimeScale } from './timeScale';

function compareDates(a: Date, b: Date) {
    return a.valueOf() - b.valueOf();
}

function deduplicateSortedArray(values: Date[]) {
    let v0 = NaN;
    const out: Date[] = [];
    for (const v of values) {
        const v1 = v.valueOf();
        if (v0 !== v1) out.push(v);
        v0 = v1;
    }
    return out;
}

function sortAndUnique(values: Date[]) {
    const sortedValues = values.slice().sort(compareDates);

    let v0 = NaN;
    for (const v of sortedValues) {
        const v1 = v.valueOf();
        if (v0 === v1) return deduplicateSortedArray(sortedValues);
        v0 = v1;
    }

    return sortedValues;
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
    protected sortedTimestamps: number[] = [];
    protected visibleRange: [number, number] = [0, 1];
    private isReversed = false;
    private precomputedSteps: Int32Array | undefined;

    setVisibleRange(visibleRange: [number, number]) {
        this.visibleRange = visibleRange;
    }

    private _values: Date[] | undefined = undefined;
    override set domain(values: Date[]) {
        if (values === this._values) return;

        this.invalid = true;

        const sortOrder = datesSortOrder(values);

        const domain = sortOrder == null ? sortAndUnique(values) : values;
        const isReversed = sortOrder === -1;

        const sortedTimestamps = domain.map<number>(dateToNumber);
        if (isReversed) sortedTimestamps.reverse();

        this._values = values;
        this._domain = domain;
        this.isReversed = isReversed;
        this.sortedTimestamps = sortedTimestamps;
        this.precomputedSteps = undefined;

        const computedStepCount = Math.ceil(sortedTimestamps.length / 16);
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

        const { domain, isReversed, interval } = this;
        const [t0, t1] = [domain[0].valueOf(), domain.at(-1)!.valueOf()];
        const start = Math.min(t0, t1);
        const stop = Math.max(t0, t1);

        if (interval == null) {
            return this.getDefaultTicks(this.maxTickCount, isReversed);
        }

        const [r0, r1] = this.range;
        const availableRange = Math.abs(r1 - r0);
        const ticks = TimeScale.getTicksForInterval({ start, stop, interval, availableRange }) ?? [];

        let lastIndex = -1;
        return ticks.filter((tick) => {
            const index = this.findInterval(tick.valueOf());
            const duplicated = index === lastIndex;
            lastIndex = index;

            return !duplicated;
        });
    }

    private getDefaultTicks(maxTickCount: number, isReversed?: boolean) {
        const { domain, visibleRange } = this;
        const ticks: Date[] = [];
        const count = domain.length;
        const tickEvery = Math.ceil((count * (visibleRange[1] - visibleRange[0])) / maxTickCount);
        const tickOffset = Math.floor(tickEvery / 2);

        for (const [index, value] of domain.entries()) {
            const tickIndex = isReversed ? count - 1 - index : index;
            if (tickEvery <= 0 || (tickIndex + tickOffset) % tickEvery === 0) {
                ticks.push(value);
            }
        }

        if (isReversed) {
            ticks.reverse();
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
        if (this.isReversed) {
            i = this.domain.length - i - 1;
        }
        return this.ordinalRange[i] ?? NaN;
    }

    private findInterval(target: number) {
        // Binary search for the target
        const { sortedTimestamps, precomputedSteps } = this;
        let low: number;
        let high: number;
        if (precomputedSteps == null) {
            low = 0;
            high = sortedTimestamps.length - 1;
        } else {
            const d0 = sortedTimestamps[0].valueOf();
            const d1 = sortedTimestamps[sortedTimestamps.length - 1].valueOf();
            const i = Math.min(
                (((target - d0) / (d1 - d0)) * precomputedSteps.length) | 0,
                (precomputedSteps.length - 1) | 0
            );
            low = precomputedSteps[i];
            high = i < precomputedSteps.length - 2 ? precomputedSteps[i + 1] : sortedTimestamps.length - 1;
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
