import { Logger } from '../util/logger';
import { clamp } from '../util/number';
import { dateToNumber } from '../util/timeFormatDefaults';
import { Invalidating } from './invalidating';
import type { Scale } from './scale';

/**
 * Maps a discrete domain to a continuous numeric range.
 */
export class BandScale<D, I = number> implements Scale<D, number, I> {
    static is(value: unknown): value is BandScale<any, any> {
        return value instanceof BandScale;
    }

    readonly type: 'band' | 'ordinal-time' = 'band';

    protected invalid = true;

    @Invalidating
    range: number[] = [0, 1];

    @Invalidating
    round = false;

    @Invalidating
    interval?: I = undefined;

    protected refresh() {
        if (!this.invalid) return;

        this.invalid = false;
        this.update();

        if (this.invalid) {
            Logger.warnOnce('Expected update to not invalidate scale');
        }
    }

    /**
     * Maps datum to its index in the {@link domain} array.
     * Used to check for duplicate data (not allowed).
     */
    protected index = new Map<D, number>();

    /**
     * Contains unique data only.
     */
    protected _domain: D[] = [];
    set domain(values: D[]) {
        this.index = new Map<D, number>();
        this.invalid = true;
        this._domain = [];

        // In case one wants to have duplicate domain values, for example, two 'Italy' categories,
        // one should use objects rather than strings for domain values like so:
        // { toString: () => 'Italy' }
        // { toString: () => 'Italy' }
        for (const value of values) {
            const key = dateToNumber(value) as D;
            if (this.getIndex(key) === undefined) {
                this.index.set(key, this._domain.push(value) - 1);
            }
        }
    }
    get domain(): D[] {
        return this._domain;
    }

    getDomain() {
        return this._domain;
    }

    ticks(): D[] {
        this.refresh();
        return this._domain;
    }

    convert(d: D): number {
        this.refresh();
        const i = this.getIndex(d);
        if (i == null || i < 0 || i >= this.domain.length) {
            return NaN;
        }
        return this.ordinalRange(i);
    }

    protected invertNearestIndex(position: number) {
        this.refresh();

        const { domain } = this;

        if (domain.length === 0) return -1;

        let low = 0;
        let high = domain.length - 1;
        let closestDistance = Infinity;
        let closestIndex = 0;

        while (low <= high) {
            const mid = ((high + low) / 2) | 0;
            const p = this.ordinalRange(mid);
            const distance = Math.abs(p - position);

            if (distance === 0) return mid;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = mid;
            }

            if (p < position) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return closestIndex;
    }

    invert(position: number) {
        this.refresh();

        const index = this.invertNearestIndex(position);
        const p = this.ordinalRange(index);

        return position === p ? this.domain[index] : undefined!;
    }

    invertNearest(position: number) {
        const index = this.invertNearestIndex(position);

        return this.domain[index];
    }

    private _bandwidth: number = 1;
    get bandwidth(): number {
        this.refresh();
        return this._bandwidth;
    }

    private _step: number = 1;
    get step(): number {
        this.refresh();
        return this._step;
    }

    private _inset: number = 1;
    get inset(): number {
        this.refresh();
        return this._inset;
    }

    private _rawBandwidth: number = 1;
    get rawBandwidth(): number {
        this.refresh();
        return this._rawBandwidth;
    }

    set padding(value: number) {
        value = clamp(0, value, 1);
        this._paddingInner = value;
        this._paddingOuter = value;
    }
    get padding(): number {
        return this._paddingInner;
    }

    /**
     * The ratio of the range that is reserved for space between bands.
     */
    private _paddingInner = 0;
    set paddingInner(value: number) {
        this._paddingInner = clamp(0, value, 1);
    }
    get paddingInner(): number {
        return this._paddingInner;
    }

    /**
     * The ratio of the range that is reserved for space before the first
     * and after the last band.
     */
    private _paddingOuter = 0;
    set paddingOuter(value: number) {
        this._paddingOuter = clamp(0, value, 1);
    }
    get paddingOuter(): number {
        return this._paddingOuter;
    }

    update() {
        const count = this._domain.length;

        if (count === 0) return;

        const [r0, r1] = this.range;
        let { _paddingInner: paddingInner } = this;
        const { _paddingOuter: paddingOuter, round } = this;
        const rangeDistance = r1 - r0;

        let rawStep: number;

        if (count === 1) {
            paddingInner = 0;
            rawStep = rangeDistance * (1 - paddingOuter * 2);
        } else {
            rawStep = rangeDistance / Math.max(1, count - paddingInner + paddingOuter * 2);
        }

        const step = round ? Math.floor(rawStep) : rawStep;
        let inset = r0 + (rangeDistance - step * (count - paddingInner)) / 2;
        let bandwidth = step * (1 - paddingInner);

        if (round) {
            inset = Math.round(inset);
            bandwidth = Math.round(bandwidth);
        }

        this._step = step;
        this._inset = inset;
        this._bandwidth = bandwidth;
        this._rawBandwidth = rawStep * (1 - paddingInner);
    }

    protected ordinalRange(i: number) {
        const { _inset: inset, _step: step } = this;
        return inset + step * i;
    }

    private getIndex(value: D) {
        return this.index.get(value instanceof Date ? (value.getTime() as D) : value);
    }
}
