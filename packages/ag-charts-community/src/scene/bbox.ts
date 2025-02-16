import type { BBoxContainsTester } from '../util/bboxinterface';
import { BBoxValues } from '../util/bboxinterface';
import { type Interpolating, interpolate } from '../util/interpolating';
import type { DistantObject, NearestResult } from '../util/nearest';
import { nearestSquared } from '../util/nearest';
import { clamp } from '../util/number';

// For small data structs like a bounding box, objects are superior to arrays
// in terms of performance (by 3-4% in Chrome 71, Safari 12 and by 20% in Firefox 64).
// They are also self descriptive and harder to abuse.
// For example, one has to do:
// `ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);`
// rather than become enticed by the much slower:
// `ctx.strokeRect(...bbox);`
// https://jsperf.com/array-vs-object-create-access
type Padding = {
    top: number;
    left: number;
    right: number;
    bottom: number;
};

type ShrinkOrGrowPosition = 'top' | 'left' | 'bottom' | 'right' | 'vertical' | 'horizontal';

export class BBox implements BBoxValues, BBoxContainsTester, DistantObject, Interpolating<BBox> {
    static readonly zero = Object.freeze(new BBox(0, 0, 0, 0)) as BBox;
    static readonly NaN = Object.freeze(new BBox(NaN, NaN, NaN, NaN)) as BBox;

    static fromDOMRect({ x, y, width, height }: DOMRect) {
        return new BBox(x, y, width, height);
    }

    static merge(boxes: Iterable<BBoxValues>) {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const box of boxes) {
            if (box.x < left) {
                left = box.x;
            }
            if (box.y < top) {
                top = box.y;
            }
            if (box.x + box.width > right) {
                right = box.x + box.width;
            }
            if (box.y + box.height > bottom) {
                bottom = box.y + box.height;
            }
        }
        return new BBox(left, top, right - left, bottom - top);
    }

    static nearestBox(x: number, y: number, boxes: BBox[]): NearestResult<BBox> {
        return nearestSquared(x, y, boxes);
    }

    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number
    ) {}

    toDOMRect(): DOMRect {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            top: this.y,
            left: this.x,
            right: this.x + this.width,
            bottom: this.y + this.height,
            toJSON() {
                return {};
            },
        };
    }

    clone() {
        const { x, y, width, height } = this;
        return new BBox(x, y, width, height);
    }

    equals(other: BBox) {
        return this.x === other.x && this.y === other.y && this.width === other.width && this.height === other.height;
    }

    containsPoint(x: number, y: number): boolean {
        return BBoxValues.containsPoint(this, x, y);
    }

    containsBBox(other: BBoxValues) {
        const [ax0, ax1] = [this.x, this.x + this.width];
        const [ay0, ay1] = [this.y, this.y + this.height];
        const [bx0, bx1] = [other.x, other.x + other.width];
        const [by0, by1] = [other.y, other.y + other.height];
        return (
            Math.min(ax0, bx0) === ax0 &&
            Math.max(ax1, bx1) === ax1 &&
            Math.min(ay0, by0) === ay0 &&
            Math.max(ay1, by1) === ay1
        );
    }

    intersection(other: BBox) {
        if (!this.collidesBBox(other)) return;

        const newX1 = clamp(other.x, this.x, other.x + other.width);
        const newY1 = clamp(other.y, this.y, other.y + other.height);
        const newX2 = clamp(other.x, this.x + this.width, other.x + other.width);
        const newY2 = clamp(other.y, this.y + this.height, other.y + other.height);

        return new BBox(newX1, newY1, newX2 - newX1, newY2 - newY1);
    }

    collidesBBox(other: BBox): boolean {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }

    computeCenter(): { x: number; y: number } {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    isFinite() {
        return (
            Number.isFinite(this.x) &&
            Number.isFinite(this.y) &&
            Number.isFinite(this.width) &&
            Number.isFinite(this.height)
        );
    }

    distanceSquared(x: number, y: number): number {
        if (this.containsPoint(x, y)) {
            return 0;
        }

        const dx = x - clamp(this.x, x, this.x + this.width);
        const dy = y - clamp(this.y, y, this.y + this.height);

        return dx * dx + dy * dy;
    }

    clip(clipRect: BBox | undefined): this {
        if (clipRect === undefined) return this;

        const x1 = Math.max(this.x, clipRect.x);
        const y1 = Math.max(this.y, clipRect.y);
        const x2 = Math.min(this.x + this.width, clipRect.x + clipRect.width);
        const y2 = Math.min(this.y + this.height, clipRect.y + clipRect.height);
        this.x = x1;
        this.y = y1;
        this.width = Math.max(0, x2 - x1);
        this.height = Math.max(0, y2 - y1);
        return this;
    }

    shrink(amounts: Partial<Padding>): this;
    shrink(amount: number, position?: ShrinkOrGrowPosition): this;
    shrink(amount: number | Partial<Padding>, position?: ShrinkOrGrowPosition) {
        if (typeof amount === 'number') {
            this.applyMargin(amount, position);
        } else {
            for (const [key, value] of Object.entries(amount)) {
                this.applyMargin(value, key as ShrinkOrGrowPosition);
            }
        }

        if (this.width < 0) {
            this.width = 0;
        }
        if (this.height < 0) {
            this.height = 0;
        }

        return this;
    }

    grow(amounts: Partial<Padding>): this;
    grow(amount: number, position?: ShrinkOrGrowPosition): this;
    grow(amount: number | Partial<Padding>, position?: ShrinkOrGrowPosition) {
        if (typeof amount === 'number') {
            this.applyMargin(-amount, position);
        } else {
            for (const [key, value] of Object.entries(amount)) {
                this.applyMargin(-value, key as ShrinkOrGrowPosition);
            }
        }

        return this;
    }

    private applyMargin(value: number, position?: ShrinkOrGrowPosition) {
        switch (position) {
            case 'top':
                this.y += value;
            // fallthrough
            case 'bottom':
                this.height -= value;
                break;

            case 'left':
                this.x += value;
            // fallthrough
            case 'right':
                this.width -= value;
                break;

            case 'vertical':
                this.y += value;
                this.height -= value * 2;
                break;

            case 'horizontal':
                this.x += value;
                this.width -= value * 2;
                break;

            case undefined:
                this.x += value;
                this.y += value;
                this.width -= value * 2;
                this.height -= value * 2;
                break;
        }
    }

    translate(x: number, y: number) {
        this.x += x;
        this.y += y;
        return this;
    }

    combine(other: BBox) {
        const { x, y, width, height } = this;
        this.x = Math.min(x, other.x);
        this.y = Math.min(y, other.y);
        this.width = Math.max(x + width, other.x + other.width) - this.x;
        this.height = Math.max(y + height, other.y + other.height) - this.y;
    }

    [interpolate](other: BBox, d: number) {
        return new BBox(
            this.x * (1 - d) + other.x * d,
            this.y * (1 - d) + other.y * d,
            this.width * (1 - d) + other.width * d,
            this.height * (1 - d) + other.height * d
        );
    }
}
