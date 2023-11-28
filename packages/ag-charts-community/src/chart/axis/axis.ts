import type { AxisContext, ModuleContext, ModuleContextWithParent } from '../../module/moduleContext';
import { ModuleMap } from '../../module/moduleMap';
import type { AxisOptionModule } from '../../module/optionModules';
import type { FromToDiff } from '../../motion/fromToMotion';
import { fromToMotion } from '../../motion/fromToMotion';
import { resetMotion } from '../../motion/resetMotion';
import { StateMachine } from '../../motion/states';
import type {
    AgAxisCaptionFormatterParams,
    CssColor,
    FontFamily,
    FontSize,
    FontStyle,
    FontWeight,
} from '../../options/agChartOptions';
import { ContinuousScale } from '../../scale/continuousScale';
import { LogScale } from '../../scale/logScale';
import type { Scale } from '../../scale/scale';
import { TimeScale } from '../../scale/timeScale';
import { BBox } from '../../scene/bbox';
import { Group } from '../../scene/group';
import { Matrix } from '../../scene/matrix';
import type { Node } from '../../scene/node';
import { Selection } from '../../scene/selection';
import { Line } from '../../scene/shape/line';
import type { TextSizeProperties } from '../../scene/shape/text';
import { Text, measureText, splitText } from '../../scene/shape/text';
import { jsonDiff } from '../../sparklines-util';
import { normalizeAngle360, toRadians } from '../../util/angle';
import { extent } from '../../util/array';
import { areArrayNumbersEqual } from '../../util/equal';
import { createId } from '../../util/id';
import type { PointLabelDatum } from '../../util/labelPlacement';
import { axisLabelsOverlap } from '../../util/labelPlacement';
import { Logger } from '../../util/logger';
import { clamp, round } from '../../util/number';
import { BOOLEAN, STRING_ARRAY, Validate } from '../../util/validation';
import { Caption } from '../caption';
import type { ChartAxis, ChartAxisLabel, ChartAxisLabelFlipFlag } from '../chartAxis';
import { ChartAxisDirection } from '../chartAxisDirection';
import { CartesianCrossLine } from '../crossline/cartesianCrossLine';
import type { CrossLine } from '../crossline/crossLine';
import type { AnimationManager } from '../interaction/animationManager';
import type { InteractionEvent } from '../interaction/interactionManager';
import { calculateLabelBBox, calculateLabelRotation, getLabelSpacing, getTextAlign, getTextBaseline } from '../label';
import { Layers } from '../layers';
import type { AxisLayout } from '../layout/layoutService';
import type { ISeries } from '../series/seriesTypes';
import { AxisGridLine } from './axisGridLine';
import { AxisLabel } from './axisLabel';
import { AxisLine } from './axisLine';
import type { TickCount, TickInterval } from './axisTick';
import { AxisTick } from './axisTick';
import type { AxisTitle } from './axisTitle';
import type { AxisLineDatum } from './axisUtil';
import {
    prepareAxisAnimationContext,
    prepareAxisAnimationFunctions,
    resetAxisGroupFn,
    resetAxisLabelSelectionFn,
    resetAxisLineSelectionFn,
    resetAxisSelectionFn,
} from './axisUtil';

export enum Tags {
    TickLine,
    TickLabel,
    GridLine,
    GridArc,
    AxisLine,
}

type TickStrategyParams = {
    index: number;
    tickData: TickData;
    textProps: TextSizeProperties;
    labelOverlap: boolean;
    terminate: boolean;
    primaryTickCount?: number;
};

type TickStrategyResult = {
    index: number;
    tickData: TickData;
    autoRotation: number;
    terminate: boolean;
};

type TickStrategy = (params: TickStrategyParams) => TickStrategyResult;

enum TickGenerationType {
    CREATE,
    CREATE_SECONDARY,
    FILTER,
    VALUES,
}

export type TickDatum = {
    tickLabel: string;
    tick: any;
    tickId: string;
    translationY: number;
};

export type LabelNodeDatum = {
    tickId: string;
    fill?: CssColor;
    fontFamily?: FontFamily;
    fontSize?: FontSize;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    rotation: number;
    rotationCenterX: number;
    text: string;
    textAlign?: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    visible: boolean;
    x: number;
    y: number;
    translationY: number;
};

type TickData = { rawTicks: any[]; ticks: TickDatum[]; labelCount: number };

interface TickGenerationParams {
    primaryTickCount?: number;
    parallelFlipRotation: number;
    regularFlipRotation: number;
    labelX: number;
    sideFlag: ChartAxisLabelFlipFlag;
}

interface TickGenerationResult {
    tickData: TickData;
    primaryTickCount?: number;
    combinedRotation: number;
    textBaseline: CanvasTextBaseline;
    textAlign: CanvasTextAlign;
}

type AxisAnimationState = 'empty' | 'ready';
type AxisAnimationEvent = 'update' | 'resize';

export type AxisModuleMap = ModuleMap<AxisOptionModule, ModuleContextWithParent<AxisContext>>;

/**
 * A general purpose linear axis with no notion of orientation.
 * The axis is always rendered vertically, with horizontal labels positioned to the left
 * of the axis line by default. The axis can be {@link rotation | rotated} by an arbitrary angle,
 * so that it can be used as a top, right, bottom, left, radial or any other kind
 * of linear axis.
 * The generic `D` parameter is the type of the domain of the axis' scale.
 * The output range of the axis' scale is always numeric (screen coordinates).
 */
export abstract class Axis<S extends Scale<D, number, TickInterval<S>> = Scale<any, number, any>, D = any>
    implements ChartAxis
{
    static readonly defaultTickMinSpacing = 50;

    readonly id = createId(this);

    @Validate(BOOLEAN)
    nice: boolean = true;

    dataDomain: { domain: D[]; clipped: boolean } = { domain: [], clipped: false };

    @Validate(STRING_ARRAY)
    keys: string[] = [];

    get type(): string {
        return (this.constructor as any).type ?? '';
    }

    abstract get direction(): ChartAxisDirection;

    boundSeries: ISeries<unknown>[] = [];
    linkedTo?: Axis<any, any>;
    includeInvisibleDomains: boolean = false;

    readonly axisGroup = new Group({ name: `${this.id}-axis`, zIndex: Layers.AXIS_ZINDEX });

    protected lineNode = this.axisGroup.appendChild(new Line());
    protected readonly tickLineGroup = this.axisGroup.appendChild(
        new Group({ name: `${this.id}-Axis-tick-lines`, zIndex: Layers.AXIS_ZINDEX })
    );
    protected readonly tickLabelGroup = this.axisGroup.appendChild(
        new Group({ name: `${this.id}-Axis-tick-labels`, zIndex: Layers.AXIS_ZINDEX })
    );
    protected readonly crossLineGroup = new Group({ name: `${this.id}-CrossLines` });

    readonly gridGroup = new Group({ name: `${this.id}-Axis-grid` });
    protected readonly gridLineGroup = this.gridGroup.appendChild(
        new Group({
            name: `${this.id}-gridLines`,
            zIndex: Layers.AXIS_GRID_ZINDEX,
        })
    );

    protected tickLineGroupSelection = Selection.select(this.tickLineGroup, Line, false);
    protected tickLabelGroupSelection = Selection.select<Text, LabelNodeDatum>(this.tickLabelGroup, Text, false);
    protected gridLineGroupSelection = Selection.select(this.gridLineGroup, Line, false);

    protected abstract assignCrossLineArrayConstructor(crossLines: CrossLine[]): void;

    private _crossLines?: CrossLine[];
    set crossLines(value: CrossLine[] | undefined) {
        this._crossLines?.forEach((crossLine) => this.detachCrossLine(crossLine));

        if (value) {
            this.assignCrossLineArrayConstructor(value);
        }

        this._crossLines = value;

        this._crossLines?.forEach((crossLine) => {
            this.attachCrossLine(crossLine);
            this.initCrossLine(crossLine);
        });
    }
    get crossLines(): CrossLine[] | undefined {
        return this._crossLines;
    }

    readonly line = new AxisLine();
    readonly tick: AxisTick<S> = this.createTick();
    readonly gridLine = new AxisGridLine();
    readonly label = this.createLabel();

    protected defaultTickMinSpacing: number = Axis.defaultTickMinSpacing;

    readonly translation = { x: 0, y: 0 };
    rotation: number = 0; // axis rotation angle in degrees

    protected readonly layout: Pick<AxisLayout, 'label'> = {
        label: {
            fractionDigits: 0,
            padding: this.label.padding,
            format: this.label.format,
        },
    };

    protected axisContext?: AxisContext;

    protected animationManager: AnimationManager;
    private animationState: StateMachine<AxisAnimationState, AxisAnimationEvent>;

    private destroyFns: Function[] = [];

    private minRect?: BBox;

    constructor(
        protected readonly moduleCtx: ModuleContext,
        readonly scale: S
    ) {
        this.refreshScale();

        this._titleCaption.node.rotation = -Math.PI / 2;
        this.axisGroup.appendChild(this._titleCaption.node);

        this.destroyFns.push(moduleCtx.interactionManager.addListener('hover', (e) => this.checkAxisHover(e)));

        this.animationManager = moduleCtx.animationManager;
        this.animationState = new StateMachine<AxisAnimationState, AxisAnimationEvent>('empty', {
            empty: {
                update: {
                    target: 'ready',
                    action: () => this.resetSelectionNodes(),
                },
            },
            ready: {
                update: (data: FromToDiff) => this.animateReadyUpdate(data),
                resize: () => this.resetSelectionNodes(),
            },
        });

        this._crossLines = [];
        this.assignCrossLineArrayConstructor(this._crossLines);

        let previousSize: { width: number; height: number } | undefined = undefined;
        this.destroyFns.push(
            moduleCtx.layoutService.addListener('layout-complete', (e) => {
                // Fire resize animation action if chart canvas size changes.
                if (previousSize != null && jsonDiff(e.chart, previousSize) != null) {
                    this.animationState.transition('resize');
                }
                previousSize = { ...e.chart };
            })
        );

        this.destroyFns.push(
            moduleCtx.updateService.addListener('update-complete', (e) => {
                this.minRect = e.minRect;
            })
        );
    }

    private attachCrossLine(crossLine: CrossLine) {
        this.crossLineGroup.appendChild(crossLine.group);
    }

    private detachCrossLine(crossLine: CrossLine) {
        this.crossLineGroup.removeChild(crossLine.group);
    }

    destroy() {
        this.moduleMap.destroy();
        this.destroyFns.forEach((f) => f());
    }

    protected refreshScale() {
        this.range = this.scale.range.slice();
        this.crossLines?.forEach((crossLine) => {
            this.initCrossLine(crossLine);
        });
    }

    protected updateRange() {
        const { range: rr, visibleRange: vr, scale } = this;
        const span = (rr[1] - rr[0]) / (vr[1] - vr[0]);
        const shift = span * vr[0];
        const start = rr[0] - shift;

        scale.range = [start, start + span];
        this.crossLines?.forEach((crossLine) => {
            crossLine.clippedRange = [rr[0], rr[1]];
        });
    }

    setCrossLinesVisible(visible: boolean) {
        this.crossLineGroup.visible = visible;
    }

    attachAxis(axisNode: Node, gridNode: Node) {
        gridNode.appendChild(this.gridGroup);
        axisNode.appendChild(this.axisGroup);
        axisNode.appendChild(this.crossLineGroup);
    }

    detachAxis(axisNode: Node, gridNode: Node) {
        gridNode.removeChild(this.gridGroup);
        axisNode.removeChild(this.axisGroup);
        axisNode.removeChild(this.crossLineGroup);
    }

    range: number[] = [0, 1];
    visibleRange: number[] = [0, 1];

    /**
     * Checks if a point or an object is in range.
     * @param x A point (or object's starting point).
     * @param width Object's width.
     * @param tolerance Expands the range on both ends by this amount.
     */
    inRange(x: number, width = 0, tolerance = 0): boolean {
        const min = Math.min(...this.range);
        const max = Math.max(...this.range);
        return x + width >= min - tolerance && x <= max + tolerance;
    }

    protected labelFormatter?: (datum: any) => string;
    protected onLabelFormatChange(ticks: any[], format?: string) {
        const { scale, fractionDigits } = this;
        const logScale = scale instanceof LogScale;

        const defaultLabelFormatter =
            !logScale && fractionDigits > 0
                ? (x: any) => (typeof x === 'number' ? x.toFixed(fractionDigits) : String(x))
                : (x: any) => String(x);

        if (format && scale && scale.tickFormat) {
            try {
                this.labelFormatter = scale.tickFormat({ ticks, specifier: format });
            } catch (e) {
                this.labelFormatter = defaultLabelFormatter;
                Logger.warnOnce(`the axis label format string ${format} is invalid. No formatting will be applied`);
            }
        } else {
            this.labelFormatter = defaultLabelFormatter;
        }
    }

    public title?: AxisTitle = undefined;
    protected _titleCaption = new Caption();

    private setDomain() {
        const {
            scale,
            dataDomain: { domain },
            tick: { values: tickValues },
        } = this;
        if (tickValues && ContinuousScale.is(scale)) {
            const [tickMin, tickMax] = extent(tickValues) ?? [Infinity, -Infinity];
            const min = Math.min(scale.fromDomain(domain[0]), tickMin);
            const max = Math.max(scale.fromDomain(domain[1]), tickMax);
            scale.domain = [scale.toDomain(min), scale.toDomain(max)];
        } else {
            scale.domain = domain;
        }
    }

    private setTickInterval(interval?: TickInterval<S>) {
        this.scale.interval = this.tick.interval ?? interval;
    }

    private setTickCount(count?: TickCount<S> | number, minTickCount?: number, maxTickCount?: number) {
        const { scale } = this;
        if (!(count && ContinuousScale.is(scale))) {
            return;
        }

        if (typeof count === 'number') {
            scale.tickCount = count;
            scale.minTickCount = minTickCount ?? 0;
            scale.maxTickCount = maxTickCount ?? Infinity;
            return;
        }

        if (scale instanceof TimeScale) {
            this.setTickInterval(count);
        }
    }

    /**
     * The length of the grid. The grid is only visible in case of a non-zero value.
     * In case {@link radialGrid} is `true`, the value is interpreted as an angle
     * (in degrees).
     */
    protected _gridLength: number = 0;
    set gridLength(value: number) {
        // Was visible and now invisible, or was invisible and now visible.
        if ((this._gridLength && !value) || (!this._gridLength && value)) {
            this.gridLineGroupSelection.clear();
        }

        this._gridLength = value;

        this.crossLines?.forEach((crossLine) => {
            this.initCrossLine(crossLine);
        });
    }
    get gridLength(): number {
        return this._gridLength;
    }

    private fractionDigits = 0;

    /**
     * The distance between the grid ticks and the axis ticks.
     */
    gridPadding = 0;

    /**
     * Is used to avoid collisions between axis labels and series.
     */
    seriesAreaPadding = 0;

    protected createTick(): AxisTick<S> {
        return new AxisTick();
    }

    protected createLabel(): ChartAxisLabel {
        return new AxisLabel();
    }

    private checkAxisHover(event: InteractionEvent<'hover'>) {
        const bbox = this.computeBBox();
        const isInAxis = bbox.containsPoint(event.offsetX, event.offsetY);

        if (!isInAxis) return;

        this.moduleCtx.chartEventManager.axisHover(this.id, this.direction);
    }

    /**
     * Creates/removes/updates the scene graph nodes that constitute the axis.
     */
    update(primaryTickCount?: number): number | undefined {
        if (!this.tickGenerationResult) {
            return;
        }
        const { rotation, parallelFlipRotation, regularFlipRotation } = this.calculateRotations();
        const sideFlag = this.label.getSideFlag();
        this.updatePosition();

        const lineData = this.getAxisLineCoordinates();
        const { tickData, combinedRotation, textBaseline, textAlign, ...ticksResult } = this.tickGenerationResult;
        const previousTicks = this.tickLabelGroupSelection.nodes().map((node) => node.datum.tickId);
        this.updateSelections(lineData, tickData.ticks, { combinedRotation, textAlign, textBaseline });

        if (this.animationManager.isSkipped()) {
            this.resetSelectionNodes();
        } else {
            const diff = this.calculateUpdateDiff(previousTicks, tickData);
            this.animationState.transition('update', diff);
        }

        this.updateAxisLine();
        this.updateLabels();
        this.updateVisibility();
        this.updateGridLines(sideFlag);
        this.updateTickLines();
        this.updateTitle({ anyTickVisible: tickData.ticks.length > 0 });
        this.updateCrossLines({ rotation, parallelFlipRotation, regularFlipRotation });
        this.updateLayoutState();

        primaryTickCount = ticksResult.primaryTickCount;
        return primaryTickCount;
    }

    private getAxisLineCoordinates(): AxisLineDatum {
        const {
            range: [start, end],
        } = this;
        const x = 0;
        const y1 = Math.min(start, end);
        const y2 = Math.max(start, end);
        return { x, y1, y2 };
    }

    private getTickLineCoordinates(datum: TickDatum) {
        const { tick, label } = this;
        const sideFlag = label.getSideFlag();
        const x = sideFlag * tick.size;
        const x1 = Math.min(0, x);
        const x2 = x1 + Math.abs(x);
        const y = Math.round(datum.translationY);
        return { x1, x2, y };
    }

    private getTickLabelProps(
        datum: TickDatum,
        params: {
            combinedRotation: number;
            textBaseline: CanvasTextBaseline;
            textAlign: CanvasTextAlign;
        }
    ): LabelNodeDatum {
        const { label } = this;
        const { combinedRotation, textBaseline, textAlign } = params;
        const text = datum.tickLabel;
        const sideFlag = label.getSideFlag();
        const tickSize = this.tick.size;
        const labelX = sideFlag * (tickSize + label.padding + this.seriesAreaPadding);
        const visible = text !== '' && text != undefined;
        return {
            tickId: datum.tickId,
            translationY: datum.translationY,
            fill: label.color,
            fontFamily: label.fontFamily,
            fontSize: label.fontSize,
            fontStyle: label.fontStyle,
            fontWeight: label.fontWeight,
            rotation: combinedRotation,
            rotationCenterX: labelX,
            text,
            textAlign,
            textBaseline,
            visible,
            x: labelX,
            y: 0,
        };
    }

    private setTitleProps(
        caption: Caption,
        params: {
            tickSpace: number;
        }
    ) {
        const { title } = this;
        if (!title) {
            caption.enabled = false;
            return;
        }

        caption.color = title.color;
        caption.fontFamily = title.fontFamily;
        caption.fontSize = title.fontSize;
        caption.fontStyle = title.fontStyle;
        caption.fontWeight = title.fontWeight;
        caption.enabled = title.enabled;
        caption.wrapping = title.wrapping;

        if (title.enabled) {
            const titleNode = caption.node;
            const { tickSpace } = params;
            const padding = (title.spacing ?? 0) + tickSpace;
            const sideFlag = this.label.getSideFlag();

            const parallelFlipRotation = normalizeAngle360(this.rotation);
            const titleRotationFlag =
                sideFlag === -1 && parallelFlipRotation > Math.PI && parallelFlipRotation < Math.PI * 2 ? -1 : 1;
            const rotation = (titleRotationFlag * sideFlag * Math.PI) / 2;
            const textBaseline = titleRotationFlag === 1 ? 'bottom' : 'top';

            const { range } = this;
            const x = Math.floor((titleRotationFlag * sideFlag * (range[0] + range[1])) / 2);
            const y = sideFlag === -1 ? Math.floor(titleRotationFlag * -padding) : Math.floor(-padding);

            const { callbackCache } = this.moduleCtx;
            const { formatter = (params) => params.defaultValue } = title;
            const text = callbackCache.call(formatter, this.getTitleFormatterParams());

            titleNode.setProperties({
                rotation,
                text,
                textBaseline,
                visible: true,
                x,
                y,
            });
        }
    }

    private tickGenerationResult: TickGenerationResult | undefined = undefined;

    calculateLayout(primaryTickCount?: number): { primaryTickCount: number | undefined; bbox: BBox } {
        const { rotation, parallelFlipRotation, regularFlipRotation } = this.calculateRotations();
        const sideFlag = this.label.getSideFlag();
        const labelX = sideFlag * (this.tick.size + this.label.padding + this.seriesAreaPadding);

        this.updateScale();

        this.tickGenerationResult = this.generateTicks({
            primaryTickCount,
            parallelFlipRotation,
            regularFlipRotation,
            labelX,
            sideFlag,
        });
        const { tickData, combinedRotation, textBaseline, textAlign, ...ticksResult } = this.tickGenerationResult;

        const boxes: BBox[] = [];

        const { x, y1, y2 } = this.getAxisLineCoordinates();
        const lineBox = new BBox(x, y1, 0, y2 - y1);
        boxes.push(lineBox);

        const { tick } = this;
        if (tick.enabled) {
            tickData.ticks.forEach((datum) => {
                const { x1, x2, y } = this.getTickLineCoordinates(datum);
                const tickLineBox = new BBox(x1, y, x2 - x1, 0);
                boxes.push(tickLineBox);
            });
        }

        const { label } = this;
        if (label.enabled) {
            const tempText = new Text();
            tickData.ticks.forEach((datum) => {
                const labelProps = this.getTickLabelProps(datum, {
                    combinedRotation,
                    textAlign,
                    textBaseline,
                });
                if (!labelProps.visible) {
                    return;
                }

                tempText.setProperties({
                    ...labelProps,
                    translationY: Math.round(datum.translationY),
                });

                const box = tempText.computeTransformedBBox();
                if (box) {
                    boxes.push(box);
                }
            });
        }

        const getTransformBox = (bbox: BBox) => {
            const matrix = new Matrix();
            const {
                rotation: axisRotation,
                translationX,
                translationY,
                rotationCenterX,
                rotationCenterY,
            } = this.getAxisTransform();
            Matrix.updateTransformMatrix(matrix, 1, 1, axisRotation, translationX, translationY, {
                scalingCenterX: 0,
                scalingCenterY: 0,
                rotationCenterX,
                rotationCenterY,
            });
            return matrix.transformBBox(bbox);
        };

        const { title } = this;
        if (title?.enabled) {
            const caption = new Caption();
            let tickSpace = 0;
            if (tickData.ticks.length > 0) {
                const contentBox = BBox.merge(boxes);
                const tickWidth = contentBox.width;
                if (isFinite(tickWidth)) {
                    tickSpace += tickWidth;
                }
            }
            this.setTitleProps(caption, { tickSpace });
            const titleNode = caption.node;
            const titleBox = titleNode.computeTransformedBBox()!;
            if (titleBox) {
                boxes.push(titleBox);
            }
        }

        const bbox = BBox.merge(boxes);
        const transformedBBox = getTransformBox(bbox);

        const anySeriesActive = this.isAnySeriesActive();
        this.crossLines?.forEach((crossLine) => {
            crossLine.sideFlag = -sideFlag as ChartAxisLabelFlipFlag;
            crossLine.direction = rotation === -Math.PI / 2 ? ChartAxisDirection.X : ChartAxisDirection.Y;
            if (crossLine instanceof CartesianCrossLine) {
                crossLine.label.parallel = crossLine.label.parallel ?? this.label.parallel;
            }
            crossLine.parallelFlipRotation = parallelFlipRotation;
            crossLine.regularFlipRotation = regularFlipRotation;
            crossLine.calculateLayout(anySeriesActive);
        });

        this.updateLayoutState();

        primaryTickCount = ticksResult.primaryTickCount;
        return { primaryTickCount, bbox: transformedBBox };
    }

    private updateLayoutState() {
        this.layout.label = {
            fractionDigits: this.fractionDigits,
            padding: this.label.padding,
            format: this.label.format,
        };
    }

    updateScale() {
        this.updateRange();
        this.calculateDomain();
        this.setDomain();
        this.setTickInterval(this.tick.interval);

        const { scale, nice } = this;
        if (!ContinuousScale.is(scale)) {
            return;
        }

        scale.nice = nice;
        scale.update();
    }

    private calculateRotations() {
        const rotation = toRadians(this.rotation);
        // When labels are parallel to the axis line, the `parallelFlipFlag` is used to
        // flip the labels to avoid upside-down text, when the axis is rotated
        // such that it is in the right hemisphere, i.e. the angle of rotation
        // is in the [0, π] interval.
        // The rotation angle is normalized, so that we have an easier time checking
        // if it's in the said interval. Since the axis is always rendered vertically
        // and then rotated, zero rotation means 12 (not 3) o-clock.
        // -1 = flip
        //  1 = don't flip (default)
        const parallelFlipRotation = normalizeAngle360(rotation);
        const regularFlipRotation = normalizeAngle360(rotation - Math.PI / 2);
        return { rotation, parallelFlipRotation, regularFlipRotation };
    }

    private generateTicks({
        primaryTickCount,
        parallelFlipRotation,
        regularFlipRotation,
        labelX,
        sideFlag,
    }: TickGenerationParams): TickGenerationResult {
        const {
            scale,
            tick,
            label: { parallel, rotation, fontFamily, fontSize, fontStyle, fontWeight },
        } = this;

        const secondaryAxis = primaryTickCount !== undefined;

        const { defaultRotation, configuredRotation, parallelFlipFlag, regularFlipFlag } = calculateLabelRotation({
            rotation,
            parallel,
            regularFlipRotation,
            parallelFlipRotation,
        });

        const initialRotation = configuredRotation + defaultRotation;
        const labelMatrix = new Matrix();

        const { maxTickCount } = this.estimateTickCount({
            minSpacing: tick.minSpacing,
            maxSpacing: tick.maxSpacing ?? NaN,
        });

        const continuous = ContinuousScale.is(scale);
        const maxIterations = !continuous || isNaN(maxTickCount) ? 10 : maxTickCount;

        let textAlign = getTextAlign(parallel, configuredRotation, 0, sideFlag, regularFlipFlag);
        const textBaseline = getTextBaseline(parallel, configuredRotation, sideFlag, parallelFlipFlag);

        const textProps: TextSizeProperties = {
            fontFamily,
            fontSize,
            fontStyle,
            fontWeight,
            textBaseline,
            textAlign,
        };

        let tickData: TickData = {
            rawTicks: [],
            ticks: [],
            labelCount: 0,
        };

        let index = 0;
        let autoRotation = 0;
        let labelOverlap = true;
        let terminate = false;
        while (labelOverlap && index <= maxIterations) {
            if (terminate) {
                break;
            }
            autoRotation = 0;
            textAlign = getTextAlign(parallel, configuredRotation, 0, sideFlag, regularFlipFlag);

            const tickStrategies = this.getTickStrategies({ secondaryAxis, index });

            for (const strategy of tickStrategies) {
                ({ tickData, index, autoRotation, terminate } = strategy({
                    index,
                    tickData,
                    textProps,
                    labelOverlap,
                    terminate,
                    primaryTickCount,
                }));

                const rotated = configuredRotation !== 0 || autoRotation !== 0;
                const rotation = initialRotation + autoRotation;
                textAlign = getTextAlign(parallel, configuredRotation, autoRotation, sideFlag, regularFlipFlag);
                labelOverlap = this.checkLabelOverlap(rotation, rotated, labelMatrix, tickData.ticks, labelX, {
                    ...textProps,
                    textAlign,
                });
            }
        }

        const combinedRotation = defaultRotation + configuredRotation + autoRotation;

        if (!secondaryAxis && tickData.rawTicks.length > 0) {
            primaryTickCount = tickData.rawTicks.length;
        }

        return { tickData, primaryTickCount, combinedRotation, textBaseline, textAlign };
    }

    private getTickStrategies({ index, secondaryAxis }: { index: number; secondaryAxis: boolean }): TickStrategy[] {
        const { scale, label, tick } = this;
        const continuous = ContinuousScale.is(scale);
        const avoidLabelCollisions = label.enabled && label.avoidCollisions;
        const filterTicks = !continuous && index !== 0 && avoidLabelCollisions;
        const autoRotate = label.autoRotate === true && label.rotation === undefined;

        const strategies: TickStrategy[] = [];
        let tickGenerationType: TickGenerationType;
        if (this.tick.values) {
            tickGenerationType = TickGenerationType.VALUES;
        } else if (secondaryAxis) {
            tickGenerationType = TickGenerationType.CREATE_SECONDARY;
        } else if (filterTicks) {
            tickGenerationType = TickGenerationType.FILTER;
        } else {
            tickGenerationType = TickGenerationType.CREATE;
        }

        const tickGenerationStrategy = ({ index, tickData, primaryTickCount, terminate }: TickStrategyParams) =>
            this.createTickData(tickGenerationType, index, tickData, terminate, primaryTickCount);

        strategies.push(tickGenerationStrategy);

        if (!continuous && !isNaN(tick.minSpacing)) {
            const tickFilterStrategy = ({ index, tickData, primaryTickCount, terminate }: TickStrategyParams) =>
                this.createTickData(TickGenerationType.FILTER, index, tickData, terminate, primaryTickCount);
            strategies.push(tickFilterStrategy);
        }

        if (!avoidLabelCollisions) {
            return strategies;
        }

        if (label.autoWrap) {
            const autoWrapStrategy = ({ index, tickData, textProps }: TickStrategyParams) =>
                this.wrapLabels(tickData, index, textProps);

            strategies.push(autoWrapStrategy);
        } else if (autoRotate) {
            const autoRotateStrategy = ({ index, tickData, labelOverlap, terminate }: TickStrategyParams) => ({
                index,
                tickData,
                autoRotation: this.getAutoRotation(labelOverlap),
                terminate,
            });

            strategies.push(autoRotateStrategy);
        }

        return strategies;
    }

    createTickData(
        tickGenerationType: TickGenerationType,
        index: number,
        tickData: TickData,
        terminate: boolean,
        primaryTickCount?: number
    ): TickStrategyResult {
        const { scale, tick } = this;
        const { maxTickCount, minTickCount, defaultTickCount } = this.estimateTickCount({
            minSpacing: tick.minSpacing,
            maxSpacing: tick.maxSpacing ?? NaN,
        });

        const continuous = ContinuousScale.is(scale);
        const maxIterations = !continuous || isNaN(maxTickCount) ? 10 : maxTickCount;

        let tickCount = continuous ? Math.max(defaultTickCount - index, minTickCount) : maxTickCount;

        const regenerateTicks =
            tick.interval === undefined &&
            tick.values === undefined &&
            tickCount > minTickCount &&
            (continuous || tickGenerationType === TickGenerationType.FILTER);

        let unchanged = true;
        while (unchanged && index <= maxIterations) {
            const prevTicks = tickData.rawTicks;
            tickCount = continuous ? Math.max(defaultTickCount - index, minTickCount) : maxTickCount;

            const { rawTicks, ticks, labelCount } = this.getTicks({
                tickGenerationType,
                previousTicks: prevTicks,
                tickCount,
                minTickCount,
                maxTickCount,
                primaryTickCount,
            });

            tickData.rawTicks = rawTicks;
            tickData.ticks = ticks;
            tickData.labelCount = labelCount;

            unchanged = regenerateTicks ? areArrayNumbersEqual(rawTicks, prevTicks) : false;
            index++;
        }

        const shouldTerminate = tick.interval !== undefined || tick.values !== undefined;

        terminate ||= shouldTerminate;

        return { tickData, index, autoRotation: 0, terminate };
    }

    private checkLabelOverlap(
        rotation: number,
        rotated: boolean,
        labelMatrix: Matrix,
        tickData: TickDatum[],
        labelX: number,
        textProps: TextSizeProperties
    ): boolean {
        Matrix.updateTransformMatrix(labelMatrix, 1, 1, rotation, 0, 0);

        const labelData: PointLabelDatum[] = this.createLabelData(tickData, labelX, textProps, labelMatrix);
        const labelSpacing = getLabelSpacing(this.label.minSpacing, rotated);

        return axisLabelsOverlap(labelData, labelSpacing);
    }

    private createLabelData(
        tickData: TickDatum[],
        labelX: number,
        textProps: TextSizeProperties,
        labelMatrix: Matrix
    ): PointLabelDatum[] {
        const labelData: PointLabelDatum[] = [];
        for (const tickDatum of tickData) {
            const { tickLabel, translationY } = tickDatum;
            if (tickLabel === '' || tickLabel == undefined) {
                // skip user hidden ticks
                continue;
            }

            const lines = splitText(tickLabel);

            const { width, height } = measureText(lines, labelX, translationY, textProps);

            const bbox = new BBox(labelX, translationY, width, height);

            const labelDatum = calculateLabelBBox(tickLabel, bbox, labelX, translationY, labelMatrix);

            labelData.push(labelDatum);
        }
        return labelData;
    }

    private getAutoRotation(labelOverlap: boolean): number {
        return labelOverlap ? normalizeAngle360(toRadians(this.label.autoRotateAngle ?? 0)) : 0;
    }

    private getTicks({
        tickGenerationType,
        previousTicks,
        tickCount,
        minTickCount,
        maxTickCount,
        primaryTickCount,
    }: {
        tickGenerationType: TickGenerationType;
        previousTicks: TickDatum[];
        tickCount: number;
        minTickCount: number;
        maxTickCount: number;
        primaryTickCount?: number;
    }) {
        const { range, scale, visibleRange } = this;

        let rawTicks: any[] = [];

        switch (tickGenerationType) {
            case TickGenerationType.VALUES:
                rawTicks = this.tick.values!;
                break;
            case TickGenerationType.CREATE_SECONDARY:
                // `updateSecondaryAxisTicks` mutates `scale.domain` based on `primaryTickCount`
                rawTicks = this.updateSecondaryAxisTicks(primaryTickCount);
                break;
            case TickGenerationType.FILTER:
                rawTicks = this.filterTicks(previousTicks, tickCount);
                break;
            default:
                rawTicks = this.createTicks(tickCount, minTickCount, maxTickCount);
                break;
        }

        // When the scale domain or the ticks change, the label format may change
        this.onLabelFormatChange(rawTicks, this.label.format);
        // `ticks instanceof NumericTicks` doesn't work here, so we feature detect.
        this.fractionDigits = (rawTicks as any).fractionDigits >= 0 ? (rawTicks as any).fractionDigits : 0;

        const halfBandwidth = (scale.bandwidth ?? 0) / 2;
        const ticks: TickDatum[] = [];

        let labelCount = 0;
        const tickIdCounts = new Map<string, number>();

        // Only get the ticks within a sliding window of the visible range to improve performance
        const start = Math.max(0, Math.floor(visibleRange[0] * rawTicks.length));
        const end = Math.min(rawTicks.length, Math.ceil(visibleRange[1] * rawTicks.length));

        for (let i = start; i < end; i++) {
            const rawTick = rawTicks[i];
            const translationY = scale.convert(rawTick) + halfBandwidth;

            // Do not render ticks outside the range with a small tolerance. A clip rect would trim long labels, so
            // instead hide ticks based on their translation.
            if (range.length > 0 && !this.inRange(translationY, 0, 0.001)) continue;

            const tickLabel = this.formatTick(rawTick, i);

            // Create a tick id from the label, or as an increment of the last label if this tick label is blank
            let tickId = tickLabel;
            if (tickIdCounts.has(tickId)) {
                const count = tickIdCounts.get(tickId)!;
                tickIdCounts.set(tickId, count + 1);
                tickId = `${tickId}_${count}`;
            } else {
                tickIdCounts.set(tickId, 1);
            }

            ticks.push({ tick: rawTick, tickId, tickLabel, translationY });

            if (tickLabel === '' || tickLabel == undefined) {
                continue;
            }
            labelCount++;
        }

        return { rawTicks, ticks, labelCount };
    }

    private filterTicks(ticks: any, tickCount: number): any[] {
        const tickSpacing = !isNaN(this.tick.minSpacing) || !isNaN(this.tick.maxSpacing ?? NaN);
        const keepEvery = tickSpacing ? Math.ceil(ticks.length / tickCount) : 2;
        return ticks.filter((_: any, i: number) => i % keepEvery === 0);
    }

    private createTicks(tickCount: number, minTickCount: number, maxTickCount: number) {
        this.setTickCount(tickCount, minTickCount, maxTickCount);
        return this.scale.ticks?.() ?? [];
    }

    protected estimateTickCount({ minSpacing, maxSpacing }: { minSpacing: number; maxSpacing: number }): {
        minTickCount: number;
        maxTickCount: number;
        defaultTickCount: number;
    } {
        const { minRect } = this;

        const rangeWithBleed = this.calculateRangeWithBleed();
        const defaultMinSpacing = Math.max(
            this.defaultTickMinSpacing,
            rangeWithBleed / ContinuousScale.defaultMaxTickCount
        );
        let clampMaxTickCount = !isNaN(maxSpacing);

        if (isNaN(minSpacing)) {
            minSpacing = defaultMinSpacing;
        }

        if (isNaN(maxSpacing)) {
            maxSpacing = rangeWithBleed;
        }

        if (minSpacing > maxSpacing) {
            if (minSpacing === defaultMinSpacing) {
                minSpacing = maxSpacing;
            } else {
                maxSpacing = minSpacing;
            }
        }

        // Clamps the min spacing between ticks to be no more than the min distance between datums
        const minRectDistance = minRect
            ? this.direction === ChartAxisDirection.X
                ? minRect.width
                : minRect.height
            : 1;
        clampMaxTickCount &&= minRectDistance < defaultMinSpacing;

        const maxTickCount = clamp(
            1,
            Math.floor(rangeWithBleed / minSpacing),
            clampMaxTickCount ? Math.floor(rangeWithBleed / minRectDistance) : Infinity
        );
        const minTickCount = Math.min(maxTickCount, Math.ceil(rangeWithBleed / maxSpacing));
        const defaultTickCount = clamp(minTickCount, ContinuousScale.defaultTickCount, maxTickCount);

        return { minTickCount, maxTickCount, defaultTickCount };
    }

    private updateVisibility() {
        if (this.moduleCtx.animationManager.isSkipped()) {
            this.resetSelectionNodes();
        }

        this.tickLineGroup.visible = this.tick.enabled;
        this.gridLineGroup.visible = this.gridLine.enabled;
        this.tickLabelGroup.visible = this.label.enabled;
    }

    protected updateCrossLines({
        rotation,
        parallelFlipRotation,
        regularFlipRotation,
    }: {
        rotation: number;
        parallelFlipRotation: number;
        regularFlipRotation: number;
    }) {
        const sideFlag = this.label.getSideFlag();
        const anySeriesActive = this.isAnySeriesActive();
        this.crossLines?.forEach((crossLine) => {
            crossLine.sideFlag = -sideFlag as ChartAxisLabelFlipFlag;
            crossLine.direction = rotation === -Math.PI / 2 ? ChartAxisDirection.X : ChartAxisDirection.Y;
            if (crossLine instanceof CartesianCrossLine) {
                crossLine.label.parallel = crossLine.label.parallel ?? this.label.parallel;
            }
            crossLine.parallelFlipRotation = parallelFlipRotation;
            crossLine.regularFlipRotation = regularFlipRotation;
            crossLine.update(anySeriesActive);
        });
    }

    protected updateTickLines() {
        const { tick, label } = this;
        const sideFlag = label.getSideFlag();
        this.tickLineGroupSelection.each((line) => {
            line.strokeWidth = tick.width;
            line.stroke = tick.color;
            line.x1 = sideFlag * tick.size;
            line.x2 = 0;
            line.y1 = 0;
            line.y2 = 0;
        });
    }

    protected calculateAvailableRange(): number {
        const { range } = this;

        const min = Math.min(...range);
        const max = Math.max(...range);

        return max - min;
    }

    /**
     * Calculates the available range with an additional "bleed" beyond the canvas that encompasses the full axis when
     * the visible range is only a portion of the axis.
     */
    protected calculateRangeWithBleed() {
        const { visibleRange } = this;
        const visibleScale = 1 / (visibleRange[1] - visibleRange[0]);

        return round(this.calculateAvailableRange() * visibleScale, 2);
    }

    protected calculateDomain() {
        if (this.linkedTo) {
            this.dataDomain = this.linkedTo.dataDomain;
        } else {
            const visibleSeries = this.boundSeries.filter((s) => this.includeInvisibleDomains || s.isEnabled());
            const domains = visibleSeries.flatMap((series) => series.getDomain(this.direction));
            this.dataDomain = this.normaliseDataDomain(domains);
        }
    }

    protected getAxisTransform() {
        return {
            rotation: toRadians(this.rotation),
            rotationCenterX: 0,
            rotationCenterY: 0,
            translationX: this.translation.x,
            translationY: this.translation.y,
        };
    }

    updatePosition() {
        const { crossLineGroup, axisGroup, gridGroup, translation, gridLineGroupSelection, gridPadding, gridLength } =
            this;
        const { rotation } = this.calculateRotations();
        const sideFlag = this.label.getSideFlag();
        const translationX = Math.floor(translation.x);
        const translationY = Math.floor(translation.y);

        crossLineGroup.setProperties({ rotation, translationX, translationY });

        axisGroup.datum = this.getAxisTransform();

        gridGroup.setProperties({ rotation, translationX, translationY });

        gridLineGroupSelection.each((line) => {
            line.x1 = gridPadding;
            line.x2 = -sideFlag * gridLength + gridPadding;
            line.y = 0;
        });
    }

    updateSecondaryAxisTicks(_primaryTickCount: number | undefined): any[] {
        throw new Error('AG Charts - unexpected call to updateSecondaryAxisTicks() - check axes configuration.');
    }

    protected updateSelections(
        lineData: AxisLineDatum,
        data: TickDatum[],
        params: {
            combinedRotation: number;
            textBaseline: CanvasTextBaseline;
            textAlign: CanvasTextAlign;
        }
    ) {
        this.lineNode.datum = lineData;
        this.gridLineGroupSelection.update(
            this.gridLength ? data : [],
            (group) => group.append(new Line({ tag: Tags.GridLine })),
            (datum: TickDatum) => datum.tickId
        );
        this.tickLineGroupSelection.update(
            data,
            (group) => group.appendChild(new Line({ tag: Tags.TickLine })),
            (datum: TickDatum) => datum.tickId
        );
        this.tickLabelGroupSelection.update(
            data.map((d) => this.getTickLabelProps(d, params)),
            (group) => group.appendChild(new Text({ tag: Tags.TickLabel })),
            (datum) => datum.tickId
        );
    }

    protected updateAxisLine() {
        const { line } = this;
        // Without this the layout isn't consistent when enabling/disabling the line, padding configurations are not respected.
        const strokeWidth = line.enabled ? line.width : 0;
        this.lineNode.setProperties({
            stroke: line.color,
            strokeWidth,
        });
    }

    protected updateGridLines(sideFlag: ChartAxisLabelFlipFlag) {
        const {
            gridLine: { style, width },
            gridPadding,
            gridLength,
        } = this;

        if (gridLength === 0 || style.length === 0) {
            return;
        }
        this.gridLineGroupSelection.each((line, _, index) => {
            const { stroke, lineDash } = style[index % style.length];
            line.setProperties({
                x1: gridPadding,
                x2: -sideFlag * gridLength + gridPadding,
                y: 0,
                fill: undefined,
                stroke,
                strokeWidth: width,
                lineDash,
            });
        });
    }

    protected updateLabels() {
        const { label } = this;
        if (!label.enabled) {
            return;
        }

        // Apply label option values
        this.tickLabelGroupSelection.each((node, datum) => {
            node.setProperties(datum, [
                'fill',
                'fontFamily',
                'fontSize',
                'fontStyle',
                'fontWeight',
                'text',
                'textAlign',
                'textBaseline',
            ]);
        });
    }

    private wrapLabels(tickData: TickData, index: number, labelProps: TextSizeProperties): TickStrategyResult {
        const { parallel, maxWidth, maxHeight } = this.label;

        let defaultMaxWidth = this.maxThickness;
        let defaultMaxHeight = Math.round(this.calculateAvailableRange() / tickData.labelCount);

        if (parallel) {
            [defaultMaxWidth, defaultMaxHeight] = [defaultMaxHeight, defaultMaxWidth];
        }

        tickData.ticks.forEach((tickDatum) => {
            tickDatum.tickLabel = Text.wrap(
                tickDatum.tickLabel,
                maxWidth ?? defaultMaxWidth,
                maxHeight ?? defaultMaxHeight,
                labelProps,
                'hyphenate'
            );
        });

        return { tickData, index, autoRotation: 0, terminate: true };
    }

    protected updateTitle(params: { anyTickVisible: boolean }): void {
        const { rotation, title, _titleCaption, lineNode, tickLineGroup, tickLabelGroup } = this;

        if (!title) {
            _titleCaption.enabled = false;
            return;
        }

        let tickSpace = 0;
        const { anyTickVisible } = params;
        if (title.enabled && anyTickVisible) {
            const tickBBox = Group.computeBBox([tickLineGroup, tickLabelGroup, lineNode]);
            const tickWidth = rotation === 0 ? tickBBox.width : tickBBox.height;
            if (Math.abs(tickWidth) < Infinity) {
                tickSpace += tickWidth;
            }
        }
        this.setTitleProps(_titleCaption, { tickSpace });
    }

    // For formatting (nice rounded) tick values.
    formatTick(datum: any, index: number): string {
        const {
            label,
            labelFormatter,
            fractionDigits,
            moduleCtx: { callbackCache },
        } = this;

        if (label.formatter) {
            const value = fractionDigits > 0 ? datum : String(datum);
            return (
                callbackCache.call(label.formatter, {
                    value,
                    index,
                    fractionDigits,
                    formatter: labelFormatter,
                }) ?? value
            );
        } else if (labelFormatter) {
            return callbackCache.call(labelFormatter, datum) ?? String(datum);
        }
        // The axis is using a logScale or the`datum` is an integer, a string or an object
        return String(datum);
    }

    // For formatting arbitrary values between the ticks.
    formatDatum(datum: any): string {
        return String(datum);
    }

    maxThickness: number = Infinity;

    computeBBox(): BBox {
        return this.axisGroup.computeBBox();
    }

    initCrossLine(crossLine: CrossLine) {
        crossLine.scale = this.scale;
        crossLine.gridLength = this.gridLength;
    }

    isAnySeriesActive() {
        return this.boundSeries.some((s) => this.includeInvisibleDomains || s.isEnabled());
    }

    clipTickLines(x: number, y: number, width: number, height: number) {
        this.tickLineGroup.setClipRectInGroupCoordinateSpace(new BBox(x, y, width, height));
    }

    clipGrid(x: number, y: number, width: number, height: number) {
        this.gridGroup.setClipRectInGroupCoordinateSpace(new BBox(x, y, width, height));
    }

    calculatePadding(min: number, _max: number): [number, number] {
        return [Math.abs(min * 0.01), Math.abs(min * 0.01)];
    }

    protected getTitleFormatterParams() {
        const boundSeries = this.boundSeries.reduce<AgAxisCaptionFormatterParams['boundSeries']>((acc, next) => {
            const keys = next.getKeys(this.direction);
            const names = next.getNames(this.direction);
            for (let idx = 0; idx < keys.length; idx++) {
                acc.push({ key: keys[idx], name: names[idx] });
            }
            return acc;
        }, []);
        return {
            direction: this.direction,
            boundSeries,
            defaultValue: this.title?.text,
        };
    }

    normaliseDataDomain(d: D[]): { domain: D[]; clipped: boolean } {
        return { domain: d, clipped: false };
    }

    getLayoutState(): AxisLayout {
        return {
            rect: this.computeBBox(),
            gridPadding: this.gridPadding,
            seriesAreaPadding: this.seriesAreaPadding,
            tickSize: this.tick.size,
            ...this.layout,
        };
    }

    private readonly moduleMap: AxisModuleMap = new ModuleMap(this);

    getModuleMap(): AxisModuleMap {
        return this.moduleMap;
    }

    public createModuleContext(): ModuleContextWithParent<AxisContext> {
        this.axisContext ??= this.createAxisContext();
        return { ...this.moduleCtx, parent: this.axisContext };
    }

    protected createAxisContext(): AxisContext {
        return {
            axisId: this.id,
            direction: this.direction,
            continuous: ContinuousScale.is(this.scale),
            keys: () => this.boundSeries.flatMap((s) => s.getKeys(this.direction)),
            scaleValueFormatter: (specifier: string) => this.scale.tickFormat?.({ specifier }),
            scaleBandwidth: () => this.scale.bandwidth ?? 0,
            scaleConvert: (val) => this.scale.convert(val),
            scaleInvert: (val) => this.scale.invert?.(val),
        };
    }

    animateReadyUpdate(diff: FromToDiff) {
        const { animationManager } = this.moduleCtx;
        const selectionCtx = prepareAxisAnimationContext(this);
        const fns = prepareAxisAnimationFunctions(selectionCtx);

        fromToMotion(this.id, 'axis-group', animationManager, [this.axisGroup], fns.group);
        fromToMotion(this.id, 'line', animationManager, [this.lineNode], fns.line);
        fromToMotion(
            this.id,
            'line-paths',
            animationManager,
            [this.gridLineGroupSelection, this.tickLineGroupSelection],
            fns.tick,
            (_, d) => d.tickId,
            diff
        );
        fromToMotion(
            this.id,
            'tick-labels',
            animationManager,
            [this.tickLabelGroupSelection],
            fns.label,
            (_, d) => d.tickId,
            diff
        );
    }

    protected resetSelectionNodes() {
        const { gridLineGroupSelection, tickLineGroupSelection, tickLabelGroupSelection, lineNode } = this;

        const selectionCtx = prepareAxisAnimationContext(this);
        resetMotion([this.axisGroup], resetAxisGroupFn());
        resetMotion([gridLineGroupSelection, tickLineGroupSelection], resetAxisSelectionFn(selectionCtx));
        resetMotion([tickLabelGroupSelection], resetAxisLabelSelectionFn());
        resetMotion([lineNode], resetAxisLineSelectionFn());
    }

    private calculateUpdateDiff(previous: string[], tickData: TickData) {
        const added = new Set<string>();
        const removed = new Set<string>();
        const tickMap: Record<string, TickData['ticks'][number]> = {};

        const tickCount = Math.max(previous.length, tickData.ticks.length);

        for (let i = 0; i < tickCount; i++) {
            const tickDatum = tickData.ticks[i];
            const prev = previous[i];
            const tick = tickDatum?.tickId;

            tickMap[tick ?? prev] = tickDatum;

            if (prev === tick) {
                continue;
            }

            if (removed.has(tick)) {
                removed.delete(tick);
            } else if (tick) {
                added.add(tick);
            }

            if (added.has(prev)) {
                added.delete(prev);
            } else if (prev) {
                removed.add(prev);
            }
        }

        return {
            changed: added.size > 0 || removed.size > 0,
            added: [...added.values()],
            removed: [...removed.values()],
        };
    }
}
