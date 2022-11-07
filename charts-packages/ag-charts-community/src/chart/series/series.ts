import { Group } from '../../scene/group';
import { LegendDatum } from '../legend';
import { Observable, TypedEvent } from '../../util/observable';
import { ChartAxis, ChartAxisDirection } from '../chartAxis';
import { Chart } from '../chart';
import { createId } from '../../util/id';
import { isNumber } from '../../util/value';
import { TimeAxis } from '../axis/timeAxis';
import { Deprecated, createDeprecationWarning } from '../../util/deprecation';
import { BOOLEAN, OPT_BOOLEAN, OPT_NUMBER, OPT_COLOR_STRING, STRING, Validate } from '../../util/validation';
import { PointLabelDatum } from '../../util/labelPlacement';
import { Layers } from '../layers';
import { SizedPoint, Point } from '../../scene/point';
import { BBox } from '../../scene/bbox';

/**
 * Processed series datum used in node selections,
 * contains information used to render pie sectors, bars, markers, etc.
 */
export interface SeriesNodeDatum {
    // For example, in `sectorNode.datum.seriesDatum`:
    // `sectorNode` - represents a pie sector
    // `datum` - contains metadata derived from the immutable series datum and used
    //           to set the properties of the node, such as start/end angles
    // `datum` - raw series datum, an element from the `series.data` array
    readonly series: Series<any>;
    readonly itemId?: any;
    readonly datum: any;
    readonly point?: Readonly<SizedPoint>;
}

/** Modes of matching user interactions to rendered nodes (e.g. hover or click) */
export enum SeriesNodePickMode {
    /** Pick matches based upon pick coordinates being inside a matching shape/marker. */
    EXACT_SHAPE_MATCH,
    /** Pick matches by nearest category/X-axis value, then distance within that category/X-value. */
    NEAREST_BY_MAIN_AXIS_FIRST,
    /** Pick matches by nearest category value, then distance within that category. */
    NEAREST_BY_MAIN_CATEGORY_AXIS_FIRST,
    /** Pick matches based upon distance to ideal position */
    NEAREST_NODE,
}

export type SeriesNodePickMatch = {
    datum: SeriesNodeDatum;
    distance: number;
};

const warnDeprecated = createDeprecationWarning();
const warnSeriesDeprecated = () => warnDeprecated('series', 'Use seriesId to get the series ID');

export class SeriesNodeClickEvent<Datum extends { datum: any }> implements TypedEvent {
    readonly type = 'nodeClick';
    readonly datum: any;
    readonly event: MouseEvent;
    readonly seriesId: string;

    private readonly _series: Series;
    /** @deprecated */
    get series() {
        warnSeriesDeprecated();
        return this._series;
    }

    constructor(nativeEvent: MouseEvent, datum: Datum, series: Series) {
        this.event = nativeEvent;
        this.datum = datum.datum;
        this.seriesId = series.id;
        this._series = series;
    }
}

class SeriesItemHighlightStyle {
    @Validate(OPT_COLOR_STRING)
    fill?: string = 'yellow';

    @Validate(OPT_NUMBER(0, 1))
    fillOpacity?: number = undefined;

    @Validate(OPT_COLOR_STRING)
    stroke?: string = undefined;

    @Validate(OPT_NUMBER(0))
    strokeWidth?: number = undefined;
}

class SeriesHighlightStyle {
    @Validate(OPT_NUMBER(0))
    strokeWidth?: number = undefined;

    @Validate(OPT_NUMBER(0, 1))
    dimOpacity?: number = undefined;

    @Validate(OPT_BOOLEAN)
    enabled?: boolean = undefined;
}

export class HighlightStyle {
    /**
     * @deprecated Use item.fill instead.
     */
    @Deprecated('Use item.fill instead.')
    fill?: string = undefined;
    /**
     * @deprecated Use item.stroke instead.
     */
    @Deprecated('Use item.stroke instead.')
    stroke?: string = undefined;
    /**
     * @deprecated Use item.strokeWidth instead.
     */
    @Deprecated('Use item.strokeWidth instead.')
    strokeWidth?: number = undefined;
    readonly item = new SeriesItemHighlightStyle();
    readonly series = new SeriesHighlightStyle();
}

export class SeriesTooltip {
    @Validate(BOOLEAN)
    enabled = true;
}

export type SeriesNodeDataContext<S = SeriesNodeDatum, L = S> = {
    itemId: string;
    nodeData: S[];
    labelData: L[];
};

export abstract class Series<C extends SeriesNodeDataContext = SeriesNodeDataContext> extends Observable {
    protected static readonly highlightedZIndex = 1000000000000;

    @Validate(STRING)
    readonly id = createId(this);

    get type(): string {
        return (this.constructor as any).type || '';
    }

    // The group node that contains all the nodes used to render this series.
    readonly rootGroup: Group = new Group({ name: 'seriesRoot' });

    // The group node that contains the background graphics.
    readonly backgroundGroup: Group;

    // The group node that contains the series rendering in it's default (non-highlighted) state.
    readonly shapesGroup: Group;

    // The group node that contains all highlighted series items. This is a performance optimisation
    // for large-scale data-sets, where the only thing that routinely varies is the currently
    // highlighted node.
    readonly highlightGroup: Group;
    readonly highlightNode: Group;
    readonly highlightLabel: Group;

    // Lazily initialised labelGroup for label presentation.
    readonly labelGroup?: Group;

    // Package-level visibility, not meant to be set by the user.
    chart?: Chart;
    xAxis?: ChartAxis;
    yAxis?: ChartAxis;

    directions: ChartAxisDirection[] = [ChartAxisDirection.X, ChartAxisDirection.Y];
    directionKeys: { [key in ChartAxisDirection]?: string[] } = {};

    // Flag to determine if we should recalculate node data.
    protected nodeDataRefresh = true;

    abstract tooltip: SeriesTooltip;

    protected _data?: any[] = undefined;
    set data(input: any[] | undefined) {
        this._data = input;
        this.nodeDataRefresh = true;
    }
    get data() {
        return this._data;
    }

    @Validate(BOOLEAN)
    protected _visible = true;
    set visible(value: boolean) {
        this._visible = value;
        this.visibleChanged();
    }
    get visible() {
        return this._visible;
    }

    @Validate(BOOLEAN)
    showInLegend = true;

    pickModes: SeriesNodePickMode[];

    @Validate(STRING)
    cursor = 'default';

    constructor({
        useSeriesGroupLayer = true,
        useLabelLayer = false,
        pickModes = [SeriesNodePickMode.NEAREST_BY_MAIN_AXIS_FIRST],
    } = {}) {
        super();

        const { rootGroup } = this;

        this.backgroundGroup = rootGroup.appendChild(
            new Group({
                name: `${this.id}-background`,
                layer: useSeriesGroupLayer,
                zIndex: Layers.SERIES_BACKGROUND_ZINDEX,
            })
        );

        this.shapesGroup = rootGroup.appendChild(
            new Group({
                name: `${this.id}-series`,
                layer: useSeriesGroupLayer,
                zIndex: Layers.SERIES_LAYER_ZINDEX,
            })
        );

        this.highlightGroup = rootGroup.appendChild(
            new Group({
                name: `${this.id}-highlight`,
                layer: true,
                zIndex: Layers.SERIES_LAYER_ZINDEX,
                zIndexSubOrder: [this.id, 15000],
                optimiseDirtyTracking: true,
            })
        );
        this.highlightNode = this.highlightGroup.appendChild(new Group({ name: 'highlightNode' }));
        this.highlightLabel = this.highlightGroup.appendChild(new Group({ name: 'highlightLabel' }));
        this.highlightNode.zIndex = 0;
        this.highlightLabel.zIndex = 10;

        this.pickModes = pickModes;

        if (useLabelLayer) {
            this.labelGroup = rootGroup.appendChild(
                new Group({
                    name: `${this.id}-series-labels`,
                    layer: true,
                    zIndex: Layers.SERIES_LABEL_ZINDEX,
                })
            );
        }
    }

    destroy(): void {
        // Override point for sub-classes.
    }

    set grouped(g: boolean) {
        if (g === true) {
            throw new Error(`AG Charts - grouped: true is unsupported for series of type: ${this.type}`);
        }
    }

    setColors(_fills: string[], _strokes: string[]) {
        // Override point for subclasses.
    }

    // Returns the actual keys used (to fetch the values from `data` items) for the given direction.
    getKeys(direction: ChartAxisDirection): string[] {
        const { directionKeys } = this;
        const keys = directionKeys && directionKeys[direction];
        const values: string[] = [];

        if (keys) {
            keys.forEach((key) => {
                const value = (this as any)[key];

                if (value) {
                    if (Array.isArray(value)) {
                        values.push(...value);
                    } else {
                        values.push(value);
                    }
                }
            });
        }

        return values;
    }

    abstract getDomain(direction: ChartAxisDirection): any[];

    // Fetch required values from the `chart.data` or `series.data` objects and process them.
    abstract processData(): Promise<void>;

    // Using processed data, create data that backs visible nodes.
    abstract createNodeData(): Promise<C[]>;

    // Indicate that something external changed and we should recalculate nodeData.
    markNodeDataDirty() {
        this.nodeDataRefresh = true;
    }

    visibleChanged() {
        // Override point for this.visible change post-processing.
    }

    // Produce data joins and update selection's nodes using node data.
    abstract update(opts: { seriesRect?: BBox }): Promise<void>;

    protected getOpacity(datum?: { itemId?: any }): number {
        const {
            highlightStyle: {
                series: { dimOpacity = 1, enabled = true },
            },
        } = this;

        const defaultOpacity = 1;
        if (enabled === false || dimOpacity === defaultOpacity) {
            return defaultOpacity;
        }

        switch (this.isItemIdHighlighted(datum)) {
            case 'no-highlight':
            case 'highlighted':
                return defaultOpacity;
            case 'peer-highlighted':
            case 'other-highlighted':
                return dimOpacity;
        }
    }

    protected getStrokeWidth(defaultStrokeWidth: number, datum?: { itemId?: any }): number {
        const {
            highlightStyle: {
                series: { strokeWidth, enabled = true },
            },
        } = this;

        if (enabled === false || strokeWidth === undefined) {
            // No change in styling for highlight cases.
            return defaultStrokeWidth;
        }

        switch (this.isItemIdHighlighted(datum)) {
            case 'highlighted':
                return strokeWidth;
            case 'no-highlight':
            case 'other-highlighted':
            case 'peer-highlighted':
                return defaultStrokeWidth;
        }
    }

    protected isItemIdHighlighted(datum?: {
        itemId?: any;
    }): 'highlighted' | 'other-highlighted' | 'peer-highlighted' | 'no-highlight' {
        const {
            chart: {
                highlightedDatum: { series = undefined, itemId = undefined } = {},
                highlightedDatum = undefined,
            } = {},
        } = this;

        const highlighting = series != null;

        if (!highlighting) {
            // Highlighting not active.
            return 'no-highlight';
        }

        if (series !== this) {
            // Highlighting active, this series not highlighted.
            return 'other-highlighted';
        }

        if (itemId === undefined) {
            // Series doesn't use itemIds - so no further refinement needed, series is highlighted.
            return 'highlighted';
        }

        if (datum && highlightedDatum !== datum && itemId !== datum.itemId) {
            // A peer (in same Series instance) sub-series has highlight active, but this sub-series
            // does not.
            return 'peer-highlighted';
        }

        return 'highlighted';
    }

    abstract getTooltipHtml(seriesDatum: any): string;

    pickNode(
        point: Point,
        limitPickModes?: SeriesNodePickMode[]
    ): { pickMode: SeriesNodePickMode; match: SeriesNodeDatum; distance: number } | undefined {
        const { pickModes, visible, rootGroup } = this;

        if (!visible || !rootGroup.visible) {
            return;
        }

        for (const pickMode of pickModes) {
            if (limitPickModes && !limitPickModes.includes(pickMode)) {
                continue;
            }

            let match: SeriesNodePickMatch | undefined = undefined;

            switch (pickMode) {
                case SeriesNodePickMode.EXACT_SHAPE_MATCH:
                    match = this.pickNodeExactShape(point);
                    break;

                case SeriesNodePickMode.NEAREST_BY_MAIN_AXIS_FIRST:
                case SeriesNodePickMode.NEAREST_BY_MAIN_CATEGORY_AXIS_FIRST:
                    match = this.pickNodeMainAxisFirst(
                        point,
                        pickMode === SeriesNodePickMode.NEAREST_BY_MAIN_CATEGORY_AXIS_FIRST
                    );
                    break;

                case SeriesNodePickMode.NEAREST_NODE:
                    match = this.pickNodeClosestDatum(point);
                    break;
            }

            if (match) {
                return { pickMode, match: match.datum, distance: match.distance };
            }
        }
    }

    protected pickNodeExactShape(point: Point): SeriesNodePickMatch | undefined {
        const match = this.shapesGroup.pickNode(point.x, point.y);

        if (match) {
            return {
                datum: match.datum,
                distance: 0,
            };
        }
    }

    protected pickNodeClosestDatum(_point: Point): SeriesNodePickMatch | undefined {
        // Override point for sub-classes - but if this is invoked, the sub-class specified it wants
        // to use this feature.
        throw new Error('AG Charts - Series.pickNodeClosestDatum() not implemented');
    }

    protected pickNodeMainAxisFirst(_point: Point, _requireCategoryAxis: boolean): SeriesNodePickMatch | undefined {
        // Override point for sub-classes - but if this is invoked, the sub-class specified it wants
        // to use this feature.
        throw new Error('AG Charts - Series.pickNodeMainAxisFirst() not implemented');
    }

    abstract getLabelData(): PointLabelDatum[];

    fireNodeClickEvent(_event: MouseEvent, _datum: C['nodeData'][number]): void {
        const eventObject = this.getNodeClickEvent(_event, _datum);
        this.fireEvent(eventObject);
    }

    protected getNodeClickEvent(event: MouseEvent, datum: SeriesNodeDatum): SeriesNodeClickEvent<any> {
        return new SeriesNodeClickEvent(event, datum, this);
    }

    /**
     * @private
     * Returns an array with the items of this series
     * that should be shown in the legend. It's up to the series to determine
     * what is considered an item. An item could be the series itself or some
     * part of the series.
     */
    abstract getLegendData(): LegendDatum[];

    toggleSeriesItem(_itemId: any, enabled: boolean): void {
        this.visible = enabled;
        this.nodeDataRefresh = true;
    }

    isEnabled() {
        return this.visible;
    }

    readonly highlightStyle = new HighlightStyle();

    protected fixNumericExtent(extent?: [number | Date, number | Date], axis?: ChartAxis): number[] {
        if (extent === undefined) {
            // Don't return a range, there is no range.
            return [];
        }

        let [min, max] = extent;
        min = +min;
        max = +max;

        if (min === 0 && max === 0) {
            // domain has zero length and the single valid value is 0. Use the default of [0, 1].
            return [0, 1];
        }

        if (min === Infinity && max === -Infinity) {
            // There's no data in the domain.
            return [];
        }
        if (min === Infinity) {
            min = 0;
        }
        if (max === -Infinity) {
            max = 0;
        }

        if (min === max) {
            // domain has zero length, there is only a single valid value in data

            if (axis instanceof TimeAxis) {
                // numbers in domain correspond to Unix timestamps
                // automatically expand domain by 1 in each direction
                min -= 1;
                max += 1;
            } else {
                const padding = Math.abs(min * 0.01);
                min -= padding;
                max += padding;
            }
        }

        if (!(isNumber(min) && isNumber(max))) {
            return [];
        }

        return [min, max];
    }
}
