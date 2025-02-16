import type { AnimationValue } from '../../../motion/animation';
import { resetMotion } from '../../../motion/resetMotion';
import { ContinuousScale } from '../../../scale/continuousScale';
import { LogScale } from '../../../scale/logScale';
import { BBox } from '../../../scene/bbox';
import { Group, TranslatableGroup } from '../../../scene/group';
import type { Node, NodeWithOpacity } from '../../../scene/node';
import type { Point } from '../../../scene/point';
import { Selection } from '../../../scene/selection';
import { Path } from '../../../scene/shape/path';
import { Text } from '../../../scene/shape/text';
import type { PointLabelDatum } from '../../../scene/util/labelPlacement';
import { QuadtreeNearest } from '../../../scene/util/quadtree';
import { Debug } from '../../../util/debug';
import { StateMachine } from '../../../util/stateMachine';
import { BOOLEAN, STRING, Validate } from '../../../util/validation';
import { CategoryAxis } from '../../axis/categoryAxis';
import type { ChartAnimationPhase } from '../../chartAnimationPhase';
import { ChartAxisDirection } from '../../chartAxisDirection';
import type { Marker } from '../../marker/marker';
import { getMarker } from '../../marker/util';
import { DataModelSeries } from '../dataModelSeries';
import type {
    SeriesConstructorOpts,
    SeriesDirectionKeysMapping,
    SeriesNodeDataContext,
    SeriesNodeEventTypes,
    SeriesNodePickMatch,
} from '../series';
import { SeriesNodeEvent } from '../series';
import { SeriesProperties } from '../seriesProperties';
import type { ISeries, SeriesNodeDatum } from '../seriesTypes';
import type { Scaling } from './scaling';

export interface CartesianSeriesNodeDatum extends SeriesNodeDatum {
    readonly xKey: string;
    readonly yKey?: string;
    readonly xValue?: any;
    readonly yValue?: any;
}

type CartesianSeriesOpts<
    TNode extends Node,
    TProps extends CartesianSeriesProperties<any>,
    TDatum extends CartesianSeriesNodeDatum,
    TLabel extends SeriesNodeDatum,
> = {
    pathsPerSeries: string[];
    pathsZIndexSubOrderOffset: number[];
    hasMarkers: boolean;
    hasHighlightedLabels: boolean;
    directionKeys: SeriesDirectionKeysMapping<TProps>;
    directionNames: SeriesDirectionKeysMapping<TProps>;
    datumSelectionGarbageCollection: boolean;
    markerSelectionGarbageCollection: boolean;
    animationAlwaysUpdateSelections: boolean;
    animationResetFns?: {
        path?: (path: Path) => Partial<Path>;
        datum?: (node: TNode, datum: TDatum) => AnimationValue & Partial<TNode>;
        label?: (node: Text, datum: TLabel) => AnimationValue & Partial<Text>;
        marker?: (node: Marker, datum: TDatum) => AnimationValue & Partial<Marker>;
    };
};

export const DEFAULT_CARTESIAN_DIRECTION_KEYS = {
    [ChartAxisDirection.X]: ['xKey' as const],
    [ChartAxisDirection.Y]: ['yKey' as const],
};

export const DEFAULT_CARTESIAN_DIRECTION_NAMES = {
    [ChartAxisDirection.X]: ['xName' as const],
    [ChartAxisDirection.Y]: ['yName' as const],
};

export class CartesianSeriesNodeEvent<TEvent extends string = SeriesNodeEventTypes> extends SeriesNodeEvent<
    SeriesNodeDatum,
    TEvent
> {
    readonly xKey?: string;
    readonly yKey?: string;
    constructor(
        type: TEvent,
        nativeEvent: Event,
        datum: SeriesNodeDatum,
        series: ISeries<SeriesNodeDatum, { xKey?: string; yKey?: string }>
    ) {
        super(type, nativeEvent, datum, series);
        this.xKey = series.properties.xKey;
        this.yKey = series.properties.yKey;
    }
}

type CartesianAnimationState = 'empty' | 'ready' | 'waiting' | 'clearing' | 'disabled';
type CartesianAnimationEvent<
    TNode extends Node,
    TDatum extends CartesianSeriesNodeDatum,
    TLabel extends SeriesNodeDatum = TDatum,
    TContext extends CartesianSeriesNodeDataContext<TDatum, TLabel> = CartesianSeriesNodeDataContext<TDatum, TLabel>,
> = {
    update: CartesianAnimationData<TNode, TDatum, TLabel, TContext>;
    updateData: undefined;
    highlight: Selection<TNode, TDatum>;
    highlightMarkers: Selection<Marker, TDatum>;
    resize: CartesianAnimationData<TNode, TDatum, TLabel, TContext>;
    clear: CartesianAnimationData<TNode, TDatum, TLabel, TContext>;
    reset: undefined;
    skip: undefined;
    disable: undefined;
};

export interface CartesianAnimationData<
    TNode extends Node,
    TDatum extends CartesianSeriesNodeDatum,
    TLabel extends SeriesNodeDatum = TDatum,
    TContext extends CartesianSeriesNodeDataContext<TDatum, TLabel> = CartesianSeriesNodeDataContext<TDatum, TLabel>,
> {
    datumSelection: Selection<TNode, TDatum>;
    markerSelection: Selection<Marker, TDatum>;
    labelSelection: Selection<Text, TLabel>;
    annotationSelections: Selection<NodeWithOpacity, TDatum>[];
    contextData: TContext;
    previousContextData?: TContext;
    paths: Path[];
    seriesRect?: BBox;
    duration?: number;
}

export abstract class CartesianSeriesProperties<T extends object> extends SeriesProperties<T> {
    @Validate(STRING, { optional: true })
    legendItemName?: string;

    @Validate(BOOLEAN, { optional: true })
    pickOutsideVisibleMinorAxis = false;
}

export interface CartesianSeriesNodeDataContext<
    TDatum extends CartesianSeriesNodeDatum = CartesianSeriesNodeDatum,
    TLabel extends SeriesNodeDatum = TDatum,
> extends SeriesNodeDataContext<TDatum, TLabel> {
    scales: { [key in ChartAxisDirection]?: Scaling };
    animationValid?: boolean;
    visible: boolean;
}

export const RENDER_TO_OFFSCREEN_CANVAS_THRESHOLD = 20;

export abstract class CartesianSeries<
    TNode extends Node,
    TProps extends CartesianSeriesProperties<any>,
    TDatum extends CartesianSeriesNodeDatum,
    TLabel extends SeriesNodeDatum = TDatum,
    TContext extends CartesianSeriesNodeDataContext<TDatum, TLabel> = CartesianSeriesNodeDataContext<TDatum, TLabel>,
> extends DataModelSeries<TDatum, TProps, TLabel, TContext> {
    private _contextNodeData?: TContext;
    get contextNodeData() {
        return this._contextNodeData;
    }

    public override getNodeData(): TDatum[] | undefined {
        return this.contextNodeData?.nodeData;
    }

    protected override readonly NodeEvent = CartesianSeriesNodeEvent;

    private readonly paths: Path[];
    protected readonly dataNodeGroup = this.contentGroup.appendChild(
        new Group({ name: `${this.id}-series-dataNodes`, zIndex: 0 })
    );
    protected readonly markerGroup = this.contentGroup.appendChild(
        new Group({ name: `${this.id}-series-markers`, zIndex: 1 })
    );
    override readonly labelGroup = this.contentGroup.appendChild(
        new TranslatableGroup({ name: `${this.id}-series-labels` })
    );
    private datumSelection: Selection<TNode, TDatum>;
    private markerSelection: Selection<Marker, TDatum>;
    private labelSelection: Selection<Text, TLabel> = Selection.select(this.labelGroup, Text);

    private highlightSelection = Selection.select(this.highlightNode, () =>
        this.opts.hasMarkers ? this.markerFactory() : this.nodeFactory()
    ) as Selection<TNode, TDatum>;
    private highlightLabelSelection = Selection.select<Text, TLabel>(this.highlightLabel, Text);

    public annotationSelections: Set<Selection<NodeWithOpacity, TDatum>> = new Set();

    private minRectsCache: {
        dirtyNodeData: boolean;
        sizeCache?: string;
        minRect?: BBox;
        minVisibleRect?: BBox;
    } = {
        dirtyNodeData: true,
    };

    private readonly opts: CartesianSeriesOpts<TNode, TProps, TDatum, TLabel>;
    private readonly debug = Debug.create();

    protected quadtree?: QuadtreeNearest<TDatum>;

    protected animationState: StateMachine<
        CartesianAnimationState,
        CartesianAnimationEvent<TNode, TDatum, TLabel, TContext>
    >;

    protected constructor({
        pathsPerSeries = ['path'],
        hasMarkers = false,
        hasHighlightedLabels = false,
        pathsZIndexSubOrderOffset = [],
        datumSelectionGarbageCollection = true,
        markerSelectionGarbageCollection = true,
        animationAlwaysUpdateSelections = false,
        animationResetFns,
        directionKeys,
        directionNames,
        ...otherOpts
    }: Partial<CartesianSeriesOpts<TNode, TProps, TDatum, TLabel>> &
        Pick<CartesianSeriesOpts<TNode, TProps, TDatum, TLabel>, 'directionKeys' | 'directionNames'> &
        SeriesConstructorOpts<TProps>) {
        super({
            directionKeys,
            directionNames,
            canHaveAxes: true,
            ...otherOpts,
        });

        if (!directionKeys || !directionNames) throw new Error(`Unable to initialise series type ${this.type}`);

        this.opts = {
            pathsPerSeries,
            hasMarkers,
            hasHighlightedLabels,
            pathsZIndexSubOrderOffset,
            directionKeys,
            directionNames,
            animationResetFns,
            animationAlwaysUpdateSelections,
            datumSelectionGarbageCollection,
            markerSelectionGarbageCollection,
        };

        this.paths = pathsPerSeries.map((path) => {
            return new Path({ name: `${this.id}-${path}` });
        });

        this.datumSelection = Selection.select(
            this.dataNodeGroup,
            () => this.nodeFactory(),
            datumSelectionGarbageCollection
        );
        this.markerSelection = Selection.select(
            this.markerGroup,
            () => this.markerFactory(),
            markerSelectionGarbageCollection
        );

        this.animationState = new StateMachine<
            CartesianAnimationState,
            CartesianAnimationEvent<TNode, TDatum, TLabel, TContext>
        >(
            'empty',
            {
                empty: {
                    update: {
                        target: 'ready',
                        action: (data) => this.animateEmptyUpdateReady(data),
                    },
                    reset: 'empty',
                    skip: 'ready',
                    disable: 'disabled',
                },
                ready: {
                    updateData: 'waiting',
                    clear: 'clearing',
                    highlight: (data) => this.animateReadyHighlight(data),
                    highlightMarkers: (data) => this.animateReadyHighlightMarkers(data),
                    resize: (data) => this.animateReadyResize(data),
                    reset: 'empty',
                    skip: 'ready',
                    disable: 'disabled',
                },
                waiting: {
                    update: {
                        target: 'ready',
                        action: (data) => {
                            if (this.ctx.animationManager.isSkipped()) {
                                this.resetAllAnimation(data);
                            } else {
                                this.animateWaitingUpdateReady(data);
                            }
                        },
                    },
                    reset: 'empty',
                    skip: 'ready',
                    disable: 'disabled',
                },
                disabled: {
                    update: (data) => this.resetAllAnimation(data),
                    reset: 'empty',
                },
                clearing: {
                    update: {
                        target: 'empty',
                        action: (data) => this.animateClearingUpdateEmpty(data),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
            },
            () => this.checkProcessedDataAnimatable()
        );
    }

    override attachSeries(seriesContentNode: Node, seriesNode: Node, annotationNode: Node | undefined): void {
        super.attachSeries(seriesContentNode, seriesNode, annotationNode);

        this.attachPaths(this.paths, seriesNode, annotationNode);
    }

    override detachSeries(
        seriesContentNode: Node | undefined,
        seriesNode: Node,
        annotationNode: Node | undefined
    ): void {
        super.detachSeries(seriesContentNode, seriesNode, annotationNode);

        this.detachPaths(this.paths, seriesNode, annotationNode);
    }

    protected attachPaths(paths: Path[], _seriesNode: Node, _annotationNode: Node | undefined) {
        for (const path of paths) {
            this.contentGroup.appendChild(path);
        }
    }

    protected detachPaths(paths: Path[], _seriesNode: Node, _annotationNode: Node | undefined) {
        for (const path of paths) {
            this.contentGroup.removeChild(path);
        }
    }

    override renderToOffscreenCanvas(): boolean {
        const nodeData = this.getNodeData();
        return nodeData != null && nodeData.length > RENDER_TO_OFFSCREEN_CANVAS_THRESHOLD;
    }

    override resetAnimation(phase: ChartAnimationPhase): void {
        if (phase === 'initial') {
            this.animationState.transition('reset');
        } else if (phase === 'ready') {
            this.animationState.transition('skip');
        } else if (phase === 'disabled') {
            this.animationState.transition('disable');
        }
    }

    override addChartEventListeners(): void {
        this.destroyFns.push(
            this.ctx.chartEventManager.addListener('legend-item-click', (event) => this.onLegendItemClick(event)),
            this.ctx.chartEventManager.addListener('legend-item-double-click', (event) =>
                this.onLegendItemDoubleClick(event)
            )
        );
    }

    override destroy() {
        super.destroy();

        this._contextNodeData = undefined;
    }

    update({ seriesRect }: { seriesRect?: BBox }) {
        const { visible, _contextNodeData: previousContextData } = this;
        const series = this.ctx.highlightManager?.getActiveHighlight()?.series;
        const seriesHighlighted = series === this;

        const resize = this.checkResize(seriesRect);
        const highlightItems = this.updateHighlightSelection(seriesHighlighted);

        this.updateSelections(visible);
        this.updateNodes(highlightItems, seriesHighlighted, visible);

        const animationData = this.getAnimationData(seriesRect, previousContextData);
        if (!animationData) return;

        if (resize) {
            this.animationState.transition('resize', animationData);
        }
        this.animationState.transition('update', animationData);
    }

    protected updateSelections(anySeriesItemEnabled: boolean) {
        const animationSkipUpdate = !this.opts.animationAlwaysUpdateSelections && this.ctx.animationManager.isSkipped();
        if (!anySeriesItemEnabled && animationSkipUpdate) {
            return;
        }
        if (!this.nodeDataRefresh && !this.isPathOrSelectionDirty()) {
            return;
        }
        if (this.nodeDataRefresh) {
            this.nodeDataRefresh = false;

            this.debug(`CartesianSeries.updateSelections() - calling createNodeData() for`, this.id);

            this.markQuadtreeDirty();
            this._contextNodeData = this.createNodeData();
            const animationValid = this.isProcessedDataAnimatable();
            if (this._contextNodeData) {
                this._contextNodeData.animationValid ??= animationValid;
            }
            this.minRectsCache.dirtyNodeData = true;

            const { dataModel, processedData } = this;
            if (dataModel !== undefined && processedData !== undefined) {
                this.dispatch('data-update', { dataModel, processedData });
            }
        }

        this.updateSeriesSelections();
    }

    private updateSeriesSelections(seriesHighlighted?: boolean) {
        const { datumSelection, labelSelection, markerSelection, paths } = this;
        const contextData = this._contextNodeData;
        if (!contextData) return;

        const { nodeData, labelData, itemId } = contextData;

        this.updatePaths({ seriesHighlighted, itemId, contextData, paths });
        this.datumSelection = this.updateDatumSelection({ nodeData, datumSelection });
        this.labelSelection = this.updateLabelSelection({ labelData, labelSelection });
        if (this.opts.hasMarkers) {
            this.markerSelection = this.updateMarkerSelection({ nodeData, markerSelection });
        }
    }

    protected abstract nodeFactory(): TNode;

    protected markerFactory(): Marker {
        const MarkerShape = getMarker();
        return new MarkerShape();
    }

    protected updateNodes(
        highlightedItems: TDatum[] | undefined,
        seriesHighlighted: boolean,
        anySeriesItemEnabled: boolean
    ) {
        const {
            highlightSelection,
            highlightLabelSelection,
            opts: { hasMarkers, hasHighlightedLabels },
        } = this;

        const animationEnabled = !this.ctx.animationManager.isSkipped();
        const visible = this.visible && this._contextNodeData != null && anySeriesItemEnabled;
        this.contentGroup.visible = animationEnabled || visible;
        this.highlightGroup.visible = (animationEnabled || visible) && seriesHighlighted;

        const opacity = this.getOpacity();
        if (hasMarkers) {
            this.updateMarkerNodes({
                markerSelection: highlightSelection as any,
                isHighlight: true,
            });
            this.animationState.transition('highlightMarkers', highlightSelection as any);
        } else {
            this.updateDatumNodes({
                datumSelection: highlightSelection,
                isHighlight: true,
            });
            this.animationState.transition('highlight', highlightSelection);
        }

        if (hasHighlightedLabels) {
            this.updateLabelNodes({ labelSelection: highlightLabelSelection });
        }

        const { dataNodeGroup, markerGroup, datumSelection, labelSelection, markerSelection, paths, labelGroup } = this;
        const { itemId } = this.contextNodeData ?? {};

        dataNodeGroup.opacity = opacity;
        dataNodeGroup.visible = animationEnabled || visible;
        labelGroup.visible = visible;

        if (hasMarkers) {
            markerGroup.opacity = opacity;
            markerGroup.visible = visible;
        }

        if (labelGroup) {
            labelGroup.opacity = opacity;
        }

        this.updatePathNodes({
            seriesHighlighted,
            itemId,
            paths,
            opacity: opacity,
            visible: visible,
            animationEnabled,
        });

        if (!dataNodeGroup.visible) {
            return;
        }

        this.updateDatumNodes({ datumSelection, highlightedItems, isHighlight: false });
        this.updateLabelNodes({ labelSelection });
        if (hasMarkers) {
            this.updateMarkerNodes({ markerSelection, isHighlight: false });
        }
    }

    protected getHighlightLabelData(labelData: TLabel[], highlightedItem: TDatum): TLabel[] | undefined {
        const labelItems = labelData.filter(
            (ld) => ld.datum === highlightedItem.datum && ld.itemId === highlightedItem.itemId
        );
        return labelItems.length === 0 ? undefined : labelItems;
    }

    protected getHighlightData(_nodeData: TDatum[], highlightedItem: TDatum): TDatum[] | undefined {
        return highlightedItem ? [highlightedItem] : undefined;
    }

    protected updateHighlightSelection(seriesHighlighted: boolean) {
        const { highlightSelection, highlightLabelSelection, _contextNodeData: contextNodeData } = this;
        if (!contextNodeData) return;

        const highlightedDatum = this.ctx.highlightManager?.getActiveHighlight();
        const item = seriesHighlighted && highlightedDatum?.datum ? (highlightedDatum as TDatum) : undefined;

        let labelItems: TLabel[] | undefined;
        let highlightItems: TDatum[] | undefined;
        if (item != null) {
            const labelsEnabled = this.isLabelEnabled();
            const { labelData, nodeData } = contextNodeData;
            highlightItems = this.getHighlightData(nodeData, item);
            labelItems = labelsEnabled ? this.getHighlightLabelData(labelData, item) : undefined;
        }

        this.highlightSelection = this.updateHighlightSelectionItem({
            items: highlightItems,
            highlightSelection,
        });
        this.highlightLabelSelection = this.updateHighlightSelectionLabel({
            items: labelItems,
            highlightLabelSelection,
        });

        return highlightItems;
    }

    protected markQuadtreeDirty() {
        this.quadtree = undefined;
    }

    protected *datumNodesIter(): Iterable<TNode> {
        for (const { node } of this.datumSelection) {
            if (node.datum.missing === true) continue;

            yield node;
        }
    }

    public getQuadTree(): QuadtreeNearest<TDatum> {
        if (this.quadtree === undefined) {
            const { width, height } = this.ctx.scene.canvas;
            const canvasRect = new BBox(0, 0, width, height);
            this.quadtree = new QuadtreeNearest<TDatum>(100, 10, canvasRect);
            this.initQuadTree(this.quadtree);
        }
        return this.quadtree;
    }

    protected initQuadTree(_quadtree: QuadtreeNearest<TDatum>) {
        // Override point for subclasses
    }

    protected override pickNodeExactShape(point: Point): SeriesNodePickMatch | undefined {
        const result = super.pickNodeExactShape(point);

        if (result) {
            return result;
        }

        const { x, y } = point;
        const {
            opts: { hasMarkers },
        } = this;

        let match: Node | undefined;
        const { dataNodeGroup, markerGroup } = this;
        match = dataNodeGroup.pickNode(x, y);

        if (!match && hasMarkers) {
            match = markerGroup?.pickNode(x, y);
        }

        if (match && match.datum.missing !== true) {
            return { datum: match.datum, distance: 0 };
        }

        for (const mod of this.moduleMap.modules()) {
            const { datum } = mod.pickNodeExact(point) ?? {};
            if (datum == null) continue;
            if (datum?.missing === true) continue;

            return { datum, distance: 0 };
        }
    }

    protected override pickNodeClosestDatum(point: Point): SeriesNodePickMatch | undefined {
        const { x, y } = point;
        const { axes, _contextNodeData: contextNodeData } = this;
        if (!contextNodeData) return;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        const hitPoint = { x, y };

        let minDistance = Infinity;
        let closestDatum: SeriesNodeDatum | undefined;

        for (const datum of contextNodeData.nodeData) {
            const { point: { x: datumX = NaN, y: datumY = NaN } = {} } = datum;
            if (isNaN(datumX) || isNaN(datumY)) {
                continue;
            }

            const isInRange = xAxis?.inRange(datumX) && yAxis?.inRange(datumY);
            if (!isInRange) {
                continue;
            }

            // No need to use Math.sqrt() since x < y implies Math.sqrt(x) < Math.sqrt(y) for
            // values > 1
            const distance = Math.max((hitPoint.x - datumX) ** 2 + (hitPoint.y - datumY) ** 2, 0);
            if (distance < minDistance) {
                minDistance = distance;
                closestDatum = datum;
            }
        }
        for (const mod of this.moduleMap.modules()) {
            const modPick = mod.pickNodeNearest(point);
            if (modPick !== undefined && modPick.distanceSquared < minDistance) {
                minDistance = modPick.distanceSquared;
                closestDatum = modPick.datum;
                break;
            }
        }

        if (closestDatum) {
            const distance = Math.max(Math.sqrt(minDistance) - (closestDatum.point?.size ?? 0), 0);
            return { datum: closestDatum, distance };
        }
    }

    protected override pickNodeMainAxisFirst(
        point: Point,
        requireCategoryAxis: boolean
    ): SeriesNodePickMatch | undefined {
        const { x, y } = point;
        const { axes, _contextNodeData: contextNodeData } = this;
        const { pickOutsideVisibleMinorAxis } = this.properties;
        if (!contextNodeData) return;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        // Prefer to start search with any available category axis.
        const directions = [xAxis, yAxis].filter(CategoryAxis.is).map((a) => a.direction);
        if (requireCategoryAxis && directions.length === 0) return;

        // Default to X-axis unless we found a suitable category axis.
        const [majorDirection = ChartAxisDirection.X] = directions;

        const hitPointCoords = [x, y];
        if (majorDirection !== ChartAxisDirection.X) hitPointCoords.reverse();

        const minDistance = [Infinity, Infinity];
        let closestDatum: SeriesNodeDatum | undefined;

        for (const datum of contextNodeData.nodeData) {
            const { x: datumX = NaN, y: datumY = NaN } = datum.point ?? datum.midPoint ?? {};
            if (isNaN(datumX) || isNaN(datumY) || datum.missing === true) continue;

            const visible = [xAxis?.inRange(datumX), yAxis?.inRange(datumY)];
            if (majorDirection !== ChartAxisDirection.X) {
                visible.reverse();
            }
            if (!visible[0] || (!pickOutsideVisibleMinorAxis && !visible[1])) continue;

            const datumPoint = [datumX, datumY];
            if (majorDirection !== ChartAxisDirection.X) {
                datumPoint.reverse();
            }

            // Compare distances from most significant dimension to least.
            let newMinDistance = true;
            for (let i = 0; i < datumPoint.length; i++) {
                const dist = Math.abs(datumPoint[i] - hitPointCoords[i]);
                if (dist > minDistance[i]) {
                    newMinDistance = false;
                    break;
                } else if (dist < minDistance[i]) {
                    minDistance[i] = dist;
                    minDistance.fill(Infinity, i + 1, minDistance.length);
                }
            }

            if (newMinDistance) {
                closestDatum = datum;
            }
        }

        if (closestDatum) {
            let closestDistanceSquared = Math.max(
                minDistance[0] ** 2 + minDistance[1] ** 2 - (closestDatum.point?.size ?? 0),
                0
            );

            for (const mod of this.moduleMap.modules()) {
                const modPick = mod.pickNodeMainAxisFirst(point);
                if (modPick !== undefined && modPick.distanceSquared < closestDistanceSquared) {
                    closestDatum = modPick.datum;
                    closestDistanceSquared = modPick.distanceSquared;
                    break;
                }
            }

            return { datum: closestDatum, distance: Math.sqrt(closestDistanceSquared) };
        }
    }

    protected isPathOrSelectionDirty(): boolean {
        // Override point to allow more sophisticated dirty selection detection.
        return false;
    }

    getLabelData(): PointLabelDatum[] {
        return [];
    }

    shouldFlipXY(): boolean {
        return false;
    }

    /**
     * Get the minimum bounding box that contains any adjacent two nodes. The axes are treated independently, so this
     * may not represent the same two points for both directions. The dimensions represent the greatest distance
     * between any two adjacent nodes.
     */
    override getMinRects(width: number, height: number) {
        const { dirtyNodeData, sizeCache, minRect, minVisibleRect } = this.minRectsCache;

        const newSizeCache = JSON.stringify({ width, height });
        const dirtySize = newSizeCache !== sizeCache;

        if (!dirtySize && !dirtyNodeData && minRect && minVisibleRect) {
            return { minRect, minVisibleRect };
        }

        const rects = this.computeMinRects(width, height);

        this.minRectsCache = {
            dirtyNodeData: false,
            sizeCache: newSizeCache,
            minRect: rects?.minRect,
            minVisibleRect: rects?.minVisibleRect,
        };

        return rects;
    }

    private computeMinRects(width: number, height: number) {
        const context = this._contextNodeData;

        if (!context?.nodeData.length) {
            return;
        }

        const { nodeData } = context;

        // Get the sorted midpoints for both directions
        const minRectXs = Array(nodeData.length);
        const minRectYs = Array(nodeData.length);

        for (const [i, { midPoint }] of nodeData.entries()) {
            minRectXs[i] = midPoint?.x ?? 0;
            minRectYs[i] = midPoint?.y ?? 0;
        }

        minRectXs.sort((a, b) => a - b);
        minRectYs.sort((a, b) => a - b);

        // Take the visible slice from the sorted data as the points >= 0 and <= width/height
        let zeroX, widthX, zeroY, heightY;
        let maxWidth = 0;
        let maxHeight = 0;

        for (let i = 1; i < nodeData.length; i++) {
            if (minRectXs[i] >= 0) zeroX ??= i;
            if (minRectXs[i] > width) widthX ??= i;
            if (minRectYs[i] >= 0) zeroY ??= i;
            if (minRectYs[i] > height) heightY ??= i;

            // Find the max distance between adjacent points in both directions
            maxWidth = Math.max(maxWidth, minRectXs[i] - minRectXs[i - 1]);
            maxHeight = Math.max(maxHeight, minRectYs[i] - minRectYs[i - 1]);
        }

        widthX ??= nodeData.length;
        heightY ??= nodeData.length;

        const minVisibleRectXs = zeroX != null && widthX != null ? minRectXs.slice(zeroX, widthX) : [];
        const minVisibleRectYs = zeroY != null && heightY != null ? minRectYs.slice(zeroY, heightY) : [];

        // Find the max visible distance between adjacent points in both directions
        let maxVisibleWidth = 0;
        let maxVisibleHeight = 0;

        for (let i = 1; i < Math.max(minVisibleRectXs.length, minVisibleRectYs.length); i++) {
            const x1 = minVisibleRectXs[i];
            const x2 = minVisibleRectXs[i - 1];
            const y1 = minVisibleRectYs[i];
            const y2 = minVisibleRectYs[i - 1];

            if (x1 != null && x2 != null) {
                maxVisibleWidth = Math.max(maxVisibleWidth, x1 - x2);
            }

            if (y1 != null && y2 != null) {
                maxVisibleHeight = Math.max(maxVisibleHeight, y1 - y2);
            }
        }

        const minRect = new BBox(0, 0, maxWidth, maxHeight);
        const minVisibleRect = new BBox(0, 0, maxVisibleWidth, maxVisibleHeight);

        return { minRect, minVisibleRect };
    }

    protected updateHighlightSelectionItem(opts: {
        items?: TDatum[];
        highlightSelection: Selection<TNode, TDatum>;
    }): Selection<TNode, TDatum> {
        const {
            opts: { hasMarkers },
        } = this;

        const { items, highlightSelection } = opts;
        const nodeData = items ?? [];

        if (hasMarkers) {
            const markerSelection = highlightSelection as any;
            return this.updateMarkerSelection({ nodeData, markerSelection }) as any;
        } else {
            return this.updateDatumSelection({
                nodeData,
                datumSelection: highlightSelection,
            });
        }
    }

    protected updateHighlightSelectionLabel(opts: {
        items?: TLabel[];
        highlightLabelSelection: Selection<Text, TLabel>;
    }) {
        return this.updateLabelSelection({
            labelData: opts.items ?? [],
            labelSelection: opts.highlightLabelSelection,
        });
    }

    protected updateDatumSelection(opts: {
        nodeData: TDatum[];
        datumSelection: Selection<TNode, TDatum>;
    }): Selection<TNode, TDatum> {
        // Override point for sub-classes.
        return opts.datumSelection;
    }
    protected updateDatumNodes(_opts: {
        datumSelection: Selection<TNode, TDatum>;
        highlightedItems?: TDatum[];
        isHighlight: boolean;
    }): void {
        // Override point for sub-classes.
    }

    protected updateMarkerSelection(opts: {
        nodeData: TDatum[];
        markerSelection: Selection<Marker, TDatum>;
    }): Selection<Marker, TDatum> {
        // Override point for sub-classes.
        return opts.markerSelection;
    }
    protected updateMarkerNodes(_opts: { markerSelection: Selection<Marker, TDatum>; isHighlight: boolean }): void {
        // Override point for sub-classes.
    }

    protected updatePaths(opts: {
        seriesHighlighted?: boolean;
        itemId?: string;
        contextData: TContext;
        paths: Path[];
    }): void {
        // Override point for sub-classes.
        opts.paths.forEach((p) => (p.visible = false));
    }

    protected updatePathNodes(opts: {
        seriesHighlighted?: boolean;
        itemId?: string;
        paths: Path[];
        opacity: number;
        visible: boolean;
        animationEnabled: boolean;
    }): void {
        const { paths, opacity, visible } = opts;
        for (const path of paths) {
            path.opacity = opacity;
            path.visible = visible;
        }
    }

    protected resetPathAnimation(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        const { path } = this.opts?.animationResetFns ?? {};

        if (path) {
            data.paths.forEach((paths) => {
                resetMotion([paths], path);
            });
        }
    }

    protected resetDatumAnimation(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        const { datum } = this.opts?.animationResetFns ?? {};

        if (datum) {
            resetMotion([data.datumSelection], datum);
        }
    }

    protected resetLabelAnimation(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        const { label } = this.opts?.animationResetFns ?? {};

        if (label) {
            resetMotion([data.labelSelection], label);
        }
    }

    protected resetMarkerAnimation(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        const { marker } = this.opts?.animationResetFns ?? {};

        if (marker && this.opts.hasMarkers) {
            resetMotion([data.markerSelection], marker);
        }
    }

    protected resetAllAnimation(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        // Stop any running animations by prefix convention.
        this.ctx.animationManager.stopByAnimationGroupId(this.id);

        this.resetPathAnimation(data);
        this.resetDatumAnimation(data);
        this.resetLabelAnimation(data);
        this.resetMarkerAnimation(data);

        if (data.contextData?.animationValid === false) {
            this.ctx.animationManager.skipCurrentBatch();
        }
    }

    protected animateEmptyUpdateReady(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation(data);
    }

    protected animateWaitingUpdateReady(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation(data);
    }

    protected animateReadyHighlight(data: Selection<TNode, TDatum>) {
        const { datum } = this.opts?.animationResetFns ?? {};
        if (datum) {
            resetMotion([data], datum);
        }
    }

    protected animateReadyHighlightMarkers(data: Selection<Marker, TDatum>) {
        const { marker } = this.opts?.animationResetFns ?? {};
        if (marker) {
            resetMotion([data], marker);
        }
    }

    protected animateReadyResize(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        this.resetAllAnimation(data);
    }

    protected animateClearingUpdateEmpty(data: CartesianAnimationData<TNode, TDatum, TLabel, TContext>) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation(data);
    }

    protected animationTransitionClear() {
        const animationData = this.getAnimationData();
        if (!animationData) return;

        this.animationState.transition('clear', animationData);
    }

    private getAnimationData(seriesRect?: BBox, previousContextData?: TContext) {
        const { _contextNodeData: contextData } = this;
        if (!contextData) return;

        const animationData: CartesianAnimationData<TNode, TDatum, TLabel, TContext> = {
            datumSelection: this.datumSelection,
            markerSelection: this.markerSelection,
            labelSelection: this.labelSelection,
            annotationSelections: [...this.annotationSelections],
            contextData,
            previousContextData,
            paths: this.paths,
            seriesRect,
        };

        return animationData;
    }

    protected abstract updateLabelSelection(opts: {
        labelData: TLabel[];
        labelSelection: Selection<Text, TLabel>;
    }): Selection<Text, TLabel>;

    protected abstract updateLabelNodes(opts: { labelSelection: Selection<Text, TLabel> }): void;

    protected abstract isLabelEnabled(): boolean;

    protected calculateScaling() {
        const result: { [key in ChartAxisDirection]?: Scaling } = {};

        for (const direction of Object.values(ChartAxisDirection)) {
            const axis = this.axes[direction];
            if (!axis) continue;

            if (axis.scale instanceof LogScale) {
                const { range, domain } = axis.scale;

                result[direction] = {
                    type: 'log',
                    convert: (d) => axis.scale.convert(d),
                    domain: [domain[0], domain[1]],
                    range: [range[0], range[1]],
                };
            } else if (axis.scale instanceof ContinuousScale) {
                const { range } = axis.scale;
                const domain = axis.scale.getDomain();

                result[direction] = {
                    type: 'continuous',
                    domain: [domain[0], domain[1]],
                    range: [range[0], range[1]],
                };
            } else if (axis.scale) {
                const { domain } = axis.scale;

                result[direction] = {
                    type: 'category',
                    domain,
                    range: domain.map((d) => axis.scale.convert(d)),
                };
            }
        }

        return result;
    }
}
