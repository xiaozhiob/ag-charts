import type { Point } from '../../../integrated-charts-scene';
import type { ModuleContext } from '../../../module/moduleContext';
import { ColorScale } from '../../../scale/colorScale';
import type { PointLabelDatum } from '../../../util/labelPlacement';
import { OPT_COLOR_STRING_ARRAY, OPT_STRING, Validate } from '../../../util/validation';
import { Series, SeriesNodePickMode } from '../series';
import type { ISeries, SeriesNodeDatum } from '../seriesTypes';

export class HierarchyNode implements SeriesNodeDatum {
    static Walk = {
        PreOrder: 0,
        PostOrder: 1,
    };

    readonly midPoint: Point;

    constructor(
        public series: ISeries<any>,
        public index: number,
        public datum: Record<string, any> | undefined,
        public size: number,
        public color: string | undefined,
        public depth: number | undefined,
        public parent: HierarchyNode | undefined,
        public children: HierarchyNode[]
    ) {
        this.midPoint = { x: 0, y: 0 };
    }

    walk(callback: (node: HierarchyNode) => void, order = HierarchyNode.Walk.PreOrder) {
        if (order === HierarchyNode.Walk.PreOrder) {
            callback(this);
        }

        this.children.forEach((child) => {
            child.walk(callback, order);
        });

        if (order === HierarchyNode.Walk.PostOrder) {
            callback(this);
        }
    }

    *[Symbol.iterator](): Iterator<HierarchyNode> {
        yield this;

        for (const child of this.children) {
            yield* child;
        }
    }
}

export abstract class HierarchySeries<S extends SeriesNodeDatum> extends Series<S> {
    @Validate(OPT_STRING)
    childrenKey?: string = 'children';

    @Validate(OPT_STRING)
    labelKey?: string;

    @Validate(OPT_STRING)
    sizeKey?: string;

    @Validate(OPT_STRING)
    colorKey?: string;

    @Validate(OPT_COLOR_STRING_ARRAY)
    colorRange?: string[] = undefined;

    rootNode = new HierarchyNode(this, 0, undefined, 0, undefined, 0, undefined, []);

    maxDepth: number = 0;
    sumSize: number = 0;
    minColor: number = 0;
    maxColor: number = 0;

    constructor(moduleCtx: ModuleContext) {
        super({ moduleCtx, pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH] });
    }

    getLabelData(): PointLabelDatum[] {
        return [];
    }

    override async processData(): Promise<void> {
        const { childrenKey, sizeKey, colorKey, colorRange } = this;

        let index = 0;
        const getIndex = () => {
            index += 1;
            return index;
        };

        let maxDepth = 0;
        let sumSize = 0;
        let minColor = Infinity;
        let maxColor = -Infinity;
        const colors: (number | undefined)[] = new Array((this.data?.length ?? 0) + 1).fill(undefined);

        const createNode = (datum: any, parent: HierarchyNode): HierarchyNode => {
            const index = getIndex();
            const depth = parent.depth != null ? parent.depth + 1 : 0;

            const size = Math.max((sizeKey != null ? datum[sizeKey] : undefined) ?? 0, 0);
            maxDepth = Math.max(maxDepth, depth);
            sumSize += size;

            const color = colorKey != null ? datum[colorKey] : undefined;
            if (typeof color === 'number') {
                colors[index] = color;
                minColor = Math.min(minColor, color);
                maxColor = Math.max(maxColor, color);
            }

            const node = new HierarchyNode(this, index, datum, size, undefined, depth, parent, []);

            appendChildren(node, childrenKey != null ? datum[childrenKey] : undefined);

            return node;
        };

        const appendChildren = (node: HierarchyNode, data: S[] | undefined) => {
            data?.forEach((datum) => {
                node.children.push(createNode(datum, node));
            });
        };

        const rootNode = new HierarchyNode(this, 0, undefined, 0, undefined, undefined, undefined, []);
        appendChildren(rootNode, this.data);

        if (colorRange != null) {
            const colorScale = new ColorScale();
            colorScale.domain = [minColor, maxColor];
            colorScale.range = colorRange;
            colorScale.update();

            rootNode.walk((node) => {
                const color = colors[node.index];
                if (color != null) {
                    node.color = colorScale.convert(color);
                }
            });
        }

        this.rootNode = rootNode;
        this.maxDepth = maxDepth;
        this.sumSize = sumSize;
        this.minColor = minColor;
        this.maxColor = maxColor;
    }

    getDatumIdFromData(node: HierarchyNode) {
        const { labelKey } = this;

        if (labelKey != null) {
            return node.datum?.[labelKey];
        }
    }

    getDatumId(node: HierarchyNode) {
        return this.getDatumIdFromData(node);
    }
}
