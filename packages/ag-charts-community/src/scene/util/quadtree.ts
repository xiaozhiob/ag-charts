import { type DistantObject, type NearestResult, nearestSquared } from '../../util/nearest';
import { BBox } from '../bbox';

type QuadtreeNearestResult<V> = NearestResult<QuadtreeElem<HitTesterNearest, V>>;

type HitTesterExact = {
    getCachedBBox(): BBox;
    containsPoint(x: number, y: number): boolean;
};

type HitTesterNearest = DistantObject & {
    readonly midPoint: { x: number; y: number };
};

type HitTester = HitTesterExact | HitTesterNearest;

type QuadtreeElem<H extends HitTester, V> = {
    hitTester: H;
    value: V;
};

export class QuadtreeNearest<V> {
    private readonly root: QuadtreeNodeNearest<V>;

    constructor(capacity: number, maxdepth: number, boundary?: BBox) {
        this.root = new QuadtreeNodeNearest<V>(capacity, maxdepth, boundary);
    }

    clear(boundary: BBox) {
        this.root.clear(boundary);
    }

    addValue(hitTester: HitTesterNearest, value: V): void {
        const elem = {
            hitTester,
            value,
            distanceSquared: (x: number, y: number): number => {
                return hitTester.distanceSquared(x, y);
            },
        };
        this.root.addElem(elem);
    }

    find(x: number, y: number): QuadtreeNearestResult<V> {
        const arg = { best: { nearest: undefined, distanceSquared: Infinity } };
        this.root.find(x, y, arg);
        return arg.best;
    }
}

class QuadtreeSubdivisions<E extends QuadtreeElem<HitTester, unknown>, FindArg> {
    constructor(
        private readonly nw: QuadtreeNode<E, FindArg>,
        private readonly ne: QuadtreeNode<E, FindArg>,
        private readonly sw: QuadtreeNode<E, FindArg>,
        private readonly se: QuadtreeNode<E, FindArg>
    ) {}

    addElem(elem: E) {
        this.nw.addElem(elem);
        this.ne.addElem(elem);
        this.sw.addElem(elem);
        this.se.addElem(elem);
    }

    find(x: number, y: number, arg: FindArg): void {
        this.nw.find(x, y, arg);
        this.ne.find(x, y, arg);
        this.sw.find(x, y, arg);
        this.se.find(x, y, arg);
    }
}

abstract class QuadtreeNode<E extends QuadtreeElem<HitTester, unknown>, FindArg> {
    protected boundary: BBox;
    protected readonly elems: Array<E>;

    private subdivisions?: QuadtreeSubdivisions<E, FindArg>;

    constructor(
        private readonly capacity: number,
        private readonly maxdepth: number,
        boundary?: BBox
    ) {
        this.boundary = boundary ?? BBox.NaN;
        this.elems = [];
        this.subdivisions = undefined;
    }

    clear(boundary: BBox) {
        this.elems.length = 0;
        this.boundary = boundary;
        this.subdivisions = undefined;
    }

    addElem(e: E) {
        if (this.addCondition(e)) {
            if (this.subdivisions === undefined) {
                if (this.maxdepth === 0 || this.elems.length < this.capacity) {
                    this.elems.push(e);
                } else {
                    this.subdivide(e);
                }
            } else {
                this.subdivisions.addElem(e);
            }
        }
    }

    protected abstract addCondition(e: E): boolean;

    find(x: number, y: number, arg: FindArg): void {
        if (this.findCondition(x, y, arg)) {
            if (this.subdivisions === undefined) {
                this.findAction(x, y, arg);
            } else {
                this.subdivisions.find(x, y, arg);
            }
        }
    }

    protected abstract findCondition(x: number, y: number, arg: FindArg): boolean;
    protected abstract findAction(x: number, y: number, arg: FindArg): void;

    private subdivide(newElem: E): void {
        this.subdivisions = this.makeSubdivisions();

        for (const e of this.elems) {
            this.subdivisions.addElem(e);
        }
        this.subdivisions.addElem(newElem);
        this.elems.length = 0;
    }

    private makeSubdivisions(): QuadtreeSubdivisions<E, FindArg> {
        const { x, y, width, height } = this.boundary;
        const { capacity } = this;
        const depth = this.maxdepth - 1;
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const nwBoundary = new BBox(x, y, halfWidth, halfHeight);
        const neBoundary = new BBox(x + halfWidth, y, halfWidth, halfHeight);
        const swBoundary = new BBox(x, y + halfHeight, halfWidth, halfHeight);
        const seBoundary = new BBox(x + halfWidth, y + halfHeight, halfWidth, halfHeight);

        return new QuadtreeSubdivisions<E, FindArg>(
            this.child(capacity, depth, nwBoundary),
            this.child(capacity, depth, neBoundary),
            this.child(capacity, depth, swBoundary),
            this.child(capacity, depth, seBoundary)
        );
    }

    protected abstract child(capacity: number, depth: number, childBoundary: BBox): QuadtreeNode<E, FindArg>;
}

type FindArgNearest<V> = { best: QuadtreeNearestResult<V> };

type ElemNearest<V> = QuadtreeElem<HitTesterNearest, V> & DistantObject;

class QuadtreeNodeNearest<V> extends QuadtreeNode<ElemNearest<V>, FindArgNearest<V>> {
    override addCondition(e: ElemNearest<V>): boolean {
        const { x, y } = e.hitTester.midPoint;
        return this.boundary.containsPoint(x, y);
    }
    override findCondition(x: number, y: number, arg: FindArgNearest<V>): boolean {
        const { best } = arg;
        return best.distanceSquared !== 0 && this.boundary.distanceSquared(x, y) < best.distanceSquared;
    }
    override findAction(x: number, y: number, arg: FindArgNearest<V>): void {
        const other = nearestSquared(x, y, this.elems, arg.best.distanceSquared);
        if (other.nearest !== undefined && other.distanceSquared < arg.best.distanceSquared) {
            arg.best = other;
        }
    }
    override child(capacity: number, depth: number, boundary: BBox) {
        return new QuadtreeNodeNearest<V>(capacity, depth, boundary);
    }
}
