import type { AgPieSeriesStyle } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import { fromToMotion } from '../../../motion/fromToMotion';
import { LinearScale } from '../../../scale/linearScale';
import { BBox } from '../../../scene/bbox';
import { Group, TranslatableGroup } from '../../../scene/group';
import { Node, PointerEvents } from '../../../scene/node';
import type { Point } from '../../../scene/point';
import { Selection } from '../../../scene/selection';
import { Line } from '../../../scene/shape/line';
import { Sector } from '../../../scene/shape/sector';
import { Text } from '../../../scene/shape/text';
import { boxCollidesSector, isPointInSector } from '../../../scene/util/sector';
import { normalizeAngle180, toRadians } from '../../../util/angle';
import { formatValue } from '../../../util/format.util';
import { jsonDiff } from '../../../util/json';
import { Logger } from '../../../util/logger';
import { mod } from '../../../util/number';
import { mergeDefaults } from '../../../util/object';
import { sanitizeHtml } from '../../../util/sanitize';
import type { Has } from '../../../util/types';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { ChartUpdateType } from '../../chartUpdateType';
import type { DataController } from '../../data/dataController';
import { DataModel, type ProcessedData, getMissCount } from '../../data/dataModel';
import {
    accumulativeValueProperty,
    animationValidation,
    createDatumId,
    diff,
    keyProperty,
    normalisePropertyTo,
    rangedValueProperty,
    valueProperty,
} from '../../data/processors';
import type { CategoryLegendDatum, ChartLegendType } from '../../legend/legendDatum';
import { Circle } from '../../marker/circle';
import { EMPTY_TOOLTIP_CONTENT, type TooltipContent } from '../../tooltip/tooltip';
import { SeriesNodeEvent, type SeriesNodeEventTypes, type SeriesNodePickMatch, SeriesNodePickMode } from '../series';
import { resetLabelFn, seriesLabelFadeInAnimation, seriesLabelFadeOutAnimation } from '../seriesLabelUtil';
import type { SeriesNodeDatum } from '../seriesTypes';
import type { PieTitle } from './pieSeriesProperties';
import { PieSeriesProperties } from './pieSeriesProperties';
import { pickByMatchingAngle, preparePieSeriesAnimationFunctions, resetPieSelectionsFn } from './pieUtil';
import { type PolarAnimationData, PolarSeries } from './polarSeries';
import { PolarZIndexMap } from './polarZIndexMap';

class PieSeriesNodeEvent<TEvent extends string = SeriesNodeEventTypes> extends SeriesNodeEvent<PieNodeDatum, TEvent> {
    readonly angleKey: string;
    readonly radiusKey?: string;
    readonly calloutLabelKey?: string;
    readonly sectorLabelKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: PieNodeDatum, series: PieSeries) {
        super(type, nativeEvent, datum, series);
        this.angleKey = series.properties.angleKey;
        this.radiusKey = series.properties.radiusKey;
        this.calloutLabelKey = series.properties.calloutLabelKey;
        this.sectorLabelKey = series.properties.sectorLabelKey;
    }
}

interface PieCalloutLabelDatum {
    readonly text: string;
    readonly textAlign: CanvasTextAlign;
    readonly textBaseline: CanvasTextBaseline;
    hidden: boolean;
    collisionTextAlign?: CanvasTextAlign;
    collisionOffsetY: number;
    box?: BBox;
}

interface PieNodeDatum extends SeriesNodeDatum {
    readonly index: number;
    readonly radius: number; // in the [0, 1] range
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly angleValue: number;
    readonly radiusValue?: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly midAngle: number;
    readonly midCos: number;
    readonly midSin: number;

    readonly calloutLabel?: PieCalloutLabelDatum;

    readonly sectorLabel?: {
        readonly text: string;
    };

    readonly sectorFormat: { [key in keyof Required<AgPieSeriesStyle>]: AgPieSeriesStyle[key] };
    readonly legendItem?: { key: string; text: string };
    readonly legendItemValue?: string;
    enabled: boolean;
}

enum PieNodeTag {
    Callout,
    Label,
}

export class PieSeries extends PolarSeries<PieNodeDatum, PieSeriesProperties, Sector> {
    static readonly className = 'PieSeries';
    static readonly type = 'pie' as const;

    override properties = new PieSeriesProperties();

    private phantomNodeData: PieNodeDatum[] | undefined = undefined;
    private get calloutNodeData() {
        return this.phantomNodeData ?? this.nodeData;
    }

    readonly backgroundGroup = new TranslatableGroup({
        name: `${this.id}-background`,
        zIndex: PolarZIndexMap.BACKGROUND,
    });

    private readonly previousRadiusScale: LinearScale = new LinearScale();
    private readonly radiusScale: LinearScale = new LinearScale();
    protected phantomGroup = this.backgroundGroup.appendChild(new Group({ name: 'phantom' }));
    private readonly phantomSelection: Selection<Sector, PieNodeDatum> = Selection.select(
        this.phantomGroup,
        () => this.nodeFactory(),
        false
    );
    private readonly calloutLabelGroup = this.contentGroup.appendChild(new Group({ name: 'pieCalloutLabels' }));
    private readonly calloutLabelSelection: Selection<Group, PieNodeDatum> = new Selection(
        this.calloutLabelGroup,
        Group
    );

    // AG-6193 If the sum of all datums is 0, then we'll draw 1 or 2 rings to represent the empty series.
    readonly zerosumRingsGroup = this.backgroundGroup.appendChild(new Group({ name: `${this.id}-zerosumRings` }));
    readonly zerosumOuterRing = this.zerosumRingsGroup.appendChild(new Circle());

    private readonly angleScale: LinearScale;

    private oldTitle?: PieTitle;

    override surroundingRadius?: number = undefined;

    constructor(moduleCtx: ModuleContext) {
        super({
            moduleCtx,
            pickModes: [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            useLabelLayer: true,
            animationResetFns: { item: resetPieSelectionsFn, label: resetLabelFn },
        });

        this.angleScale = new LinearScale();
        // Each sector is a ratio of the whole, where all ratios add up to 1.
        this.angleScale.domain = [0, 1];
        // Add 90 deg to start the first pie at 12 o'clock.
        this.angleScale.range = [-Math.PI, Math.PI].map((angle) => angle + Math.PI / 2);

        this.phantomGroup.opacity = 0.2;
    }

    override attachSeries(seriesContentNode: Node, seriesNode: Node, annotationNode: Node | undefined): void {
        super.attachSeries(seriesContentNode, seriesNode, annotationNode);

        seriesContentNode.appendChild(this.backgroundGroup);
    }

    override detachSeries(
        seriesContentNode: Node | undefined,
        seriesNode: Node,
        annotationNode: Node | undefined
    ): void {
        super.detachSeries(seriesContentNode, seriesNode, annotationNode);

        seriesContentNode?.removeChild(this.backgroundGroup);
    }

    override setSeriesIndex(index: number) {
        if (!super.setSeriesIndex(index)) return false;

        this.backgroundGroup.zIndex = [PolarZIndexMap.BACKGROUND, index];

        return true;
    }

    protected override nodeFactory(): Sector {
        const sector = new Sector();
        sector.miterLimit = 1e9;
        return sector;
    }

    override getSeriesDomain(direction: ChartAxisDirection): any[] {
        if (direction === ChartAxisDirection.X) {
            return this.angleScale.domain;
        } else {
            return this.radiusScale.domain;
        }
    }

    override async processData(dataController: DataController) {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const {
            visible,
            id: seriesId,
            ctx: { legendManager },
        } = this;
        const { angleKey, angleFilterKey, radiusKey, calloutLabelKey, sectorLabelKey, legendItemKey } = this.properties;

        const validSector = (_value: unknown, _datum: unknown, index: number) => {
            return visible && legendManager.getItemEnabled({ seriesId, itemId: index });
        };

        const animationEnabled = !this.ctx.animationManager.isSkipped();
        const extraKeyProps = [];
        const extraProps = [];

        // Order here should match `getDatumIdFromData()`.
        if (legendItemKey) {
            extraKeyProps.push(keyProperty(legendItemKey, 'band', { id: `legendItemKey` }));
        } else if (calloutLabelKey) {
            extraKeyProps.push(keyProperty(calloutLabelKey, 'band', { id: `calloutLabelKey` }));
        } else if (sectorLabelKey) {
            extraKeyProps.push(keyProperty(sectorLabelKey, 'band', { id: `sectorLabelKey` }));
        }

        const radiusScaleType = this.radiusScale.type;
        const angleScaleType = this.angleScale.type;

        if (radiusKey) {
            extraProps.push(
                rangedValueProperty(radiusKey, {
                    id: 'radiusValue',
                    min: this.properties.radiusMin ?? 0,
                    max: this.properties.radiusMax,
                }),
                valueProperty(radiusKey, radiusScaleType, { id: `radiusRaw` }), // Raw value pass-through.
                normalisePropertyTo('radiusValue', [0, 1], 1, this.properties.radiusMin ?? 0, this.properties.radiusMax)
            );
        }
        if (calloutLabelKey) {
            extraProps.push(valueProperty(calloutLabelKey, 'band', { id: `calloutLabelValue` }));
        }
        if (sectorLabelKey) {
            extraProps.push(valueProperty(sectorLabelKey, 'band', { id: `sectorLabelValue` }));
        }
        if (legendItemKey) {
            extraProps.push(valueProperty(legendItemKey, 'band', { id: `legendItemValue` }));
        }
        if (angleFilterKey) {
            extraProps.push(
                accumulativeValueProperty(angleFilterKey, angleScaleType, {
                    id: `angleFilterValue`,
                    onlyPositive: true,
                    validation: validSector,
                    invalidValue: 0,
                }),
                valueProperty(angleFilterKey, angleScaleType, { id: `angleFilterRaw` }),
                normalisePropertyTo('angleFilterValue', [0, 1], 0, 0)
            );
        }
        if (
            animationEnabled &&
            this.processedData?.reduced?.animationValidation?.uniqueKeys &&
            extraKeyProps.length > 0
        ) {
            extraProps.push(diff(this.id, this.processedData));
        }
        extraProps.push(animationValidation());

        await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                ...extraKeyProps,
                accumulativeValueProperty(angleKey, angleScaleType, {
                    id: `angleValue`,
                    onlyPositive: true,
                    validation: validSector,
                    invalidValue: 0,
                }),
                valueProperty(angleKey, angleScaleType, { id: `angleRaw` }), // Raw value pass-through.
                normalisePropertyTo('angleValue', [0, 1], 0, 0),
                ...extraProps,
            ],
        });

        // AG-9879 Warning about missing data.
        for (const valueDef of this.processedData?.defs?.values ?? []) {
            // The 'angleRaw' is an undocumented property for the internal implementation, so ignore this.
            // If any 'angleRaw' values are missing, then we'll also be missing 'angleValue' values and
            // will log a warning anyway.
            const { id, missing, property } = valueDef;
            const missCount = getMissCount(this, missing);
            if (id !== 'angleRaw' && missCount > 0) {
                Logger.warnOnce(
                    `no value was found for the key '${String(property)}' on ${missCount} data element${
                        missCount > 1 ? 's' : ''
                    }`
                );
            }
        }

        this.animationState.transition('updateData');
    }

    maybeRefreshNodeData() {
        if (!this.nodeDataRefresh) return;
        const { nodeData = [], phantomNodeData } = this.createNodeData() ?? {};
        this.nodeData = nodeData;
        this.phantomNodeData = phantomNodeData;
        this.nodeDataRefresh = false;
    }

    private getProcessedDataValues(dataModel: DataModel<any>, processedData: ProcessedData<any>) {
        const angleValues = dataModel.resolveColumnById<number>(this, `angleValue`, processedData);
        const angleRawValues = dataModel.resolveColumnById<number>(this, `angleRaw`, processedData);
        const angleFilterValues =
            this.properties.angleFilterKey != null
                ? dataModel.resolveColumnById<number>(this, `angleFilterValue`, processedData)
                : undefined;
        const angleFilterRawValues =
            this.properties.angleFilterKey != null
                ? dataModel.resolveColumnById<number>(this, `angleFilterRaw`, processedData)
                : undefined;
        const radiusValues = this.properties.radiusKey
            ? dataModel.resolveColumnById<number>(this, `radiusValue`, processedData)
            : undefined;
        const radiusRawValues = this.properties.radiusKey
            ? dataModel.resolveColumnById<number>(this, `radiusRaw`, processedData)
            : undefined;
        const calloutLabelValues = this.properties.calloutLabelKey
            ? dataModel.resolveColumnById<string>(this, `calloutLabelValue`, processedData)
            : undefined;
        const sectorLabelValues = this.properties.sectorLabelKey
            ? dataModel.resolveColumnById<string>(this, `sectorLabelValue`, processedData)
            : undefined;
        const legendItemValues = this.properties.legendItemKey
            ? dataModel.resolveColumnById<string>(this, `legendItemValue`, processedData)
            : undefined;

        return {
            angleValues,
            angleRawValues,
            angleFilterValues,
            angleFilterRawValues,
            radiusValues,
            radiusRawValues,
            calloutLabelValues,
            sectorLabelValues,
            legendItemValues,
        };
    }

    override createNodeData() {
        const {
            id: seriesId,
            processedData,
            dataModel,
            angleScale,
            ctx: { legendManager },
            visible,
        } = this;
        const { rotation } = this.properties;

        if (!processedData?.rawData.length || !dataModel || processedData.type !== 'ungrouped') return;

        const {
            angleValues,
            angleRawValues,
            angleFilterValues,
            angleFilterRawValues,
            radiusValues,
            radiusRawValues,
            calloutLabelValues,
            sectorLabelValues,
            legendItemValues,
        } = this.getProcessedDataValues(dataModel, processedData);

        const useFilterAngles =
            angleFilterRawValues?.some((filterRawValue, index) => {
                return filterRawValue > angleRawValues[index];
            }) ?? false;

        let currentStart = 0;
        let sum = 0;
        const nodes: PieNodeDatum[] = [];
        const phantomNodes: PieNodeDatum[] | undefined = angleFilterRawValues != null ? [] : undefined;
        processedData.rawData.forEach((datum, datumIndex) => {
            const currentValue = useFilterAngles ? angleFilterValues![datumIndex] : angleValues[datumIndex];
            const crossFilterScale =
                angleFilterRawValues != null && !useFilterAngles
                    ? Math.sqrt(angleFilterRawValues[datumIndex] / angleRawValues[datumIndex])
                    : 1;

            const startAngle = angleScale.convert(currentStart) + toRadians(rotation);
            currentStart = currentValue;
            sum += currentValue;
            const endAngle = angleScale.convert(currentStart) + toRadians(rotation);
            const span = Math.abs(endAngle - startAngle);
            const midAngle = startAngle + span / 2;

            const angleValue = angleRawValues[datumIndex];
            const radiusRaw = radiusValues?.[datumIndex] ?? 1;
            const radius = radiusRaw * crossFilterScale;
            const radiusValue = radiusRawValues?.[datumIndex];
            const legendItemValue = legendItemValues?.[datumIndex];

            const nodeLabels = this.getLabels(
                datum,
                midAngle,
                span,
                true,
                calloutLabelValues?.[datumIndex],
                sectorLabelValues?.[datumIndex],
                legendItemValue
            );
            const sectorFormat = this.getSectorFormat(datum, datumIndex, false);

            const node = {
                itemId: datumIndex,
                series: this,
                datum,
                index: datumIndex,
                angleValue,
                midAngle,
                midCos: Math.cos(midAngle),
                midSin: Math.sin(midAngle),
                startAngle,
                endAngle,
                radius,
                innerRadius: Math.max(this.radiusScale.convert(0), 0),
                outerRadius: Math.max(this.radiusScale.convert(radius), 0),
                sectorFormat,
                radiusValue,
                legendItemValue,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId: datumIndex }),
                ...nodeLabels,
            };
            nodes.push(node);

            if (phantomNodes != null) {
                phantomNodes.push({
                    ...node,
                    radius: 1,
                    innerRadius: Math.max(this.radiusScale.convert(0), 0),
                    outerRadius: Math.max(this.radiusScale.convert(1), 0),
                });
            }
        });

        this.zerosumOuterRing.visible = sum === 0;

        return {
            itemId: seriesId,
            nodeData: nodes,
            labelData: nodes,
            phantomNodeData: phantomNodes,
        };
    }

    private getLabels(
        datum: any,
        midAngle: number,
        span: number,
        skipDisabled: boolean,
        calloutLabelValue?: string,
        sectorLabelValue?: string,
        legendItemValue?: string
    ) {
        const { calloutLabel, sectorLabel, legendItemKey } = this.properties;

        const calloutLabelKey = !skipDisabled || calloutLabel.enabled ? this.properties.calloutLabelKey : undefined;
        const sectorLabelKey = !skipDisabled || sectorLabel.enabled ? this.properties.sectorLabelKey : undefined;

        if (!calloutLabelKey && !sectorLabelKey && !legendItemKey) {
            return {};
        }

        const labelFormatterParams = {
            datum,
            angleKey: this.properties.angleKey,
            angleName: this.properties.angleName,
            radiusKey: this.properties.radiusKey,
            radiusName: this.properties.radiusName,
            calloutLabelKey: this.properties.calloutLabelKey,
            calloutLabelName: this.properties.calloutLabelName,
            sectorLabelKey: this.properties.sectorLabelKey,
            sectorLabelName: this.properties.sectorLabelName,
            legendItemKey: this.properties.legendItemKey,
        };

        const result: {
            calloutLabel?: PieCalloutLabelDatum;
            sectorLabel?: { text: string };
            legendItem?: { key: string; text: string };
        } = {};

        if (calloutLabelKey && span > toRadians(calloutLabel.minAngle)) {
            result.calloutLabel = {
                ...this.getTextAlignment(midAngle),
                text: this.getLabelText(calloutLabel, {
                    ...labelFormatterParams,
                    value: calloutLabelValue,
                }),
                hidden: false,
                collisionTextAlign: undefined,
                collisionOffsetY: 0,
                box: undefined,
            };
        }

        if (sectorLabelKey) {
            result.sectorLabel = {
                text: this.getLabelText(sectorLabel, {
                    ...labelFormatterParams,
                    value: sectorLabelValue,
                }),
            };
        }

        if (legendItemKey != null && legendItemValue != null) {
            result.legendItem = { key: legendItemKey, text: legendItemValue };
        }

        return result;
    }

    private getTextAlignment(midAngle: number) {
        const quadrantTextOpts: { textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline }[] = [
            { textAlign: 'center', textBaseline: 'bottom' },
            { textAlign: 'left', textBaseline: 'middle' },
            { textAlign: 'center', textBaseline: 'hanging' },
            { textAlign: 'right', textBaseline: 'middle' },
        ];

        const midAngle180 = normalizeAngle180(midAngle);

        // Split the circle into quadrants like so: ⊗
        const quadrantStart = -0.75 * Math.PI; // same as `normalizeAngle180(toRadians(-135))`
        const quadrantOffset = midAngle180 - quadrantStart;
        const quadrant = Math.floor(quadrantOffset / (Math.PI / 2));
        const quadrantIndex = mod(quadrant, quadrantTextOpts.length);

        return quadrantTextOpts[quadrantIndex];
    }

    private getSectorFormat(datum: any, formatIndex: number, highlighted: boolean) {
        const { angleKey, radiusKey, calloutLabelKey, sectorLabelKey, legendItemKey, fills, strokes, itemStyler } =
            this.properties;

        const defaultStroke: string | undefined = strokes[formatIndex % strokes.length];
        const { fill, fillOpacity, stroke, strokeWidth, strokeOpacity, lineDash, lineDashOffset, cornerRadius } =
            mergeDefaults(
                highlighted && this.properties.highlightStyle.item,
                {
                    fill: fills.length > 0 ? fills[formatIndex % fills.length] : undefined,
                    stroke: defaultStroke,
                    strokeWidth: this.getStrokeWidth(this.properties.strokeWidth),
                    strokeOpacity: this.getOpacity(),
                },
                this.properties
            );

        let format: AgPieSeriesStyle | undefined;
        if (itemStyler) {
            format = this.cachedDatumCallback(
                createDatumId(this.getDatumId(datum), highlighted ? 'highlight' : 'hide'),
                () =>
                    itemStyler({
                        datum,
                        angleKey,
                        radiusKey,
                        calloutLabelKey,
                        sectorLabelKey,
                        legendItemKey,
                        fill: fill!,
                        strokeOpacity,
                        stroke,
                        strokeWidth,
                        fillOpacity,
                        lineDash,
                        lineDashOffset,
                        cornerRadius,
                        highlighted,
                        seriesId: this.id,
                    })
            );
        }

        return {
            fill: format?.fill ?? fill,
            fillOpacity: format?.fillOpacity ?? fillOpacity,
            stroke: format?.stroke ?? stroke,
            strokeWidth: format?.strokeWidth ?? strokeWidth,
            strokeOpacity: format?.strokeOpacity ?? strokeOpacity,
            lineDash: format?.lineDash ?? lineDash,
            lineDashOffset: format?.lineDashOffset ?? lineDashOffset,
            cornerRadius: format?.cornerRadius ?? cornerRadius,
        };
    }

    getOuterRadius() {
        return Math.max(this.radius * this.properties.outerRadiusRatio + this.properties.outerRadiusOffset, 0);
    }

    updateRadiusScale(resize: boolean) {
        const newRange = [0, this.getOuterRadius()];
        this.radiusScale.range = newRange;

        if (resize) {
            this.previousRadiusScale.range = newRange;
        }

        const setRadii = (d: PieNodeDatum): PieNodeDatum => ({
            ...d,
            innerRadius: Math.max(this.radiusScale.convert(0), 0),
            outerRadius: Math.max(this.radiusScale.convert(d.radius), 0),
        });

        this.nodeData = this.nodeData.map(setRadii);
        this.phantomNodeData = this.phantomNodeData?.map(setRadii);
    }

    private getTitleTranslationY() {
        const outerRadius = Math.max(0, this.radiusScale.range[1]);
        if (outerRadius === 0) {
            return NaN;
        }
        const spacing = this.properties.title?.spacing ?? 0;
        const titleOffset = 2 + spacing;
        const dy = Math.max(0, -outerRadius);
        return -outerRadius - titleOffset - dy;
    }

    update({ seriesRect }: { seriesRect: BBox }) {
        const { title } = this.properties;

        const newNodeDataDependencies = {
            seriesRectWidth: seriesRect?.width,
            seriesRectHeight: seriesRect?.height,
        };
        const resize = jsonDiff(this.nodeDataDependencies, newNodeDataDependencies) != null;
        if (resize) {
            this._nodeDataDependencies = newNodeDataDependencies;
        }

        this.maybeRefreshNodeData();
        this.updateTitleNodes();
        this.updateRadiusScale(resize);

        this.contentGroup.translationX = this.centerX;
        this.contentGroup.translationY = this.centerY;
        this.highlightGroup.translationX = this.centerX;
        this.highlightGroup.translationY = this.centerY;
        this.backgroundGroup.translationX = this.centerX;
        this.backgroundGroup.translationY = this.centerY;
        if (this.labelGroup) {
            this.labelGroup.translationX = this.centerX;
            this.labelGroup.translationY = this.centerY;
        }

        if (title) {
            const dy = this.getTitleTranslationY();
            title.node.y = isFinite(dy) ? dy : 0;

            const titleBox = title.node.getBBox();
            title.node.visible = title.enabled && isFinite(dy) && !this.bboxIntersectsSurroundingSeries(titleBox);
        }

        this.zerosumOuterRing.fillOpacity = 0;
        this.zerosumOuterRing.stroke = this.properties.calloutLabel.color;
        this.zerosumOuterRing.strokeWidth = 1;
        this.zerosumOuterRing.strokeOpacity = 1;

        this.updateNodeMidPoint();

        this.updateSelections();
        this.updateNodes(seriesRect);
    }

    private updateTitleNodes() {
        const { oldTitle } = this;
        const { title } = this.properties;

        if (oldTitle !== title) {
            if (oldTitle) {
                this.labelGroup?.removeChild(oldTitle.node);
            }

            if (title) {
                title.node.textBaseline = 'bottom';
                this.labelGroup?.appendChild(title.node);
            }

            this.oldTitle = title;
        }
    }

    private updateNodeMidPoint() {
        const setMidPoint = (d: PieNodeDatum) => {
            const radius = d.innerRadius + (d.outerRadius - d.innerRadius) / 2;
            d.midPoint = {
                x: d.midCos * Math.max(0, radius),
                y: d.midSin * Math.max(0, radius),
            };
        };
        this.nodeData.forEach(setMidPoint);
        this.phantomNodeData?.forEach(setMidPoint);
    }

    private updateSelections() {
        this.updateGroupSelection();
    }

    private updateGroupSelection() {
        const {
            itemSelection,
            highlightSelection,
            phantomSelection,
            highlightLabelSelection,
            calloutLabelSelection,
            labelSelection,
        } = this;
        const highlightedNodeData = this.nodeData.map((datum) => ({
            ...datum,
            // Allow mutable sectorFormat, so formatted sector styles can be updated and varied
            // between normal and highlighted cases.
            sectorFormat: { ...datum.sectorFormat },
        }));

        const update = (selection: typeof this.itemSelection, nodeData: PieNodeDatum[]) => {
            selection.update(nodeData, undefined, (datum) => this.getDatumId(datum));
            if (this.ctx.animationManager.isSkipped()) {
                selection.cleanup();
            }
        };

        update(itemSelection, this.nodeData);
        update(highlightSelection, highlightedNodeData);
        update(phantomSelection, this.phantomNodeData ?? []);

        calloutLabelSelection.update(this.calloutNodeData, (group) => {
            const line = new Line();
            line.tag = PieNodeTag.Callout;
            line.pointerEvents = PointerEvents.None;
            group.appendChild(line);

            const text = new Text();
            text.tag = PieNodeTag.Label;
            text.pointerEvents = PointerEvents.None;
            group.appendChild(text);
        });

        labelSelection.update(this.nodeData);
        highlightLabelSelection.update(highlightedNodeData);
    }

    private updateNodes(seriesRect: BBox) {
        const highlightedDatum = this.ctx.highlightManager.getActiveHighlight();
        const { visible } = this;
        this.backgroundGroup.visible = visible;
        this.contentGroup.visible = visible;
        this.highlightGroup.visible = visible && highlightedDatum?.series === this;
        this.highlightLabel.visible = visible && highlightedDatum?.series === this;
        if (this.labelGroup) {
            this.labelGroup.visible = visible;
        }

        this.contentGroup.opacity = this.getOpacity();

        const animationDisabled = this.ctx.animationManager.isSkipped();
        const updateSectorFn = (sector: Sector, datum: PieNodeDatum, _index: number, isDatumHighlighted: boolean) => {
            const format = this.getSectorFormat(datum.datum, datum.itemId, isDatumHighlighted);

            datum.sectorFormat.fill = format.fill;
            datum.sectorFormat.stroke = format.stroke;

            if (animationDisabled) {
                sector.startAngle = datum.startAngle;
                sector.endAngle = datum.endAngle;
                sector.innerRadius = datum.innerRadius;
                sector.outerRadius = datum.outerRadius;
            }
            if (isDatumHighlighted || animationDisabled) {
                sector.fill = format.fill;
                sector.stroke = format.stroke;
            }

            sector.strokeWidth = format.strokeWidth;
            sector.fillOpacity = format.fillOpacity;
            sector.strokeOpacity = format.strokeOpacity;
            sector.lineDash = format.lineDash;
            sector.lineDashOffset = format.lineDashOffset;
            sector.cornerRadius = format.cornerRadius;
            sector.fillShadow = this.properties.shadow;
            const inset = Math.max(
                (this.properties.sectorSpacing + (format.stroke != null ? format.strokeWidth : 0)) / 2,
                0
            );
            sector.inset = inset;
            sector.lineJoin = this.properties.sectorSpacing >= 0 || inset > 0 ? 'miter' : 'round';
        };

        this.itemSelection.each((node, datum, index) => updateSectorFn(node, datum, index, false));
        this.highlightSelection.each((node, datum, index) => {
            updateSectorFn(node, datum, index, true);

            node.visible = datum.itemId === highlightedDatum?.itemId;
        });
        this.phantomSelection.each((node, datum, index) => updateSectorFn(node, datum, index, false));

        this.updateCalloutLineNodes();
        this.updateCalloutLabelNodes(seriesRect);
        this.updateSectorLabelNodes();
        this.updateZerosumRings();

        this.animationState.transition('update');
    }

    updateCalloutLineNodes() {
        const { calloutLine } = this.properties;
        const calloutLength = calloutLine.length;
        const calloutStrokeWidth = calloutLine.strokeWidth;
        const calloutColors = calloutLine.colors ?? this.properties.strokes;
        const { offset } = this.properties.calloutLabel;

        this.calloutLabelSelection.selectByTag<Line>(PieNodeTag.Callout).forEach((line, index) => {
            const datum = line.datum as PieNodeDatum;
            const { calloutLabel: label, outerRadius } = datum;

            if (label?.text && !label.hidden && outerRadius !== 0) {
                line.visible = true;
                line.strokeWidth = calloutStrokeWidth;
                line.stroke = calloutColors[index % calloutColors.length];
                line.fill = undefined;

                const x1 = datum.midCos * outerRadius;
                const y1 = datum.midSin * outerRadius;
                let x2 = datum.midCos * (outerRadius + calloutLength);
                let y2 = datum.midSin * (outerRadius + calloutLength);

                const isMoved = label.collisionTextAlign ?? label.collisionOffsetY !== 0;
                if (isMoved && label.box != null) {
                    // Get the closest point to the text bounding box
                    const box = label.box;
                    let cx = x2;
                    let cy = y2;
                    if (x2 < box.x) {
                        cx = box.x;
                    } else if (x2 > box.x + box.width) {
                        cx = box.x + box.width;
                    }
                    if (y2 < box.y) {
                        cy = box.y;
                    } else if (y2 > box.y + box.height) {
                        cy = box.y + box.height;
                    }
                    // Apply label offset
                    const dx = cx - x2;
                    const dy = cy - y2;
                    const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                    const paddedLength = length - offset;
                    if (paddedLength > 0) {
                        x2 = x2 + (dx * paddedLength) / length;
                        y2 = y2 + (dy * paddedLength) / length;
                    }
                }

                line.x1 = x1;
                line.y1 = y1;
                line.x2 = x2;
                line.y2 = y2;
            } else {
                line.visible = false;
            }
        });
    }

    private getLabelOverflow(text: string, box: BBox, seriesRect: BBox) {
        const seriesLeft = seriesRect.x - this.centerX;
        const seriesRight = seriesRect.x + seriesRect.width - this.centerX;
        const seriesTop = seriesRect.y - this.centerY;
        const seriesBottom = seriesRect.y + seriesRect.height - this.centerY;
        const errPx = 1; // Prevents errors related to floating point calculations
        let visibleTextPart = 1;
        if (box.x + errPx < seriesLeft) {
            visibleTextPart = (box.x + box.width - seriesLeft) / box.width;
        } else if (box.x + box.width - errPx > seriesRight) {
            visibleTextPart = (seriesRight - box.x) / box.width;
        }

        const hasVerticalOverflow = box.y + errPx < seriesTop || box.y + box.height - errPx > seriesBottom;
        const textLength = visibleTextPart === 1 ? text.length : Math.floor(text.length * visibleTextPart) - 1;
        const hasSurroundingSeriesOverflow = this.bboxIntersectsSurroundingSeries(box);
        return { textLength, hasVerticalOverflow, hasSurroundingSeriesOverflow };
    }

    private bboxIntersectsSurroundingSeries(box: BBox) {
        const { surroundingRadius } = this;
        if (surroundingRadius == null) {
            return false;
        }
        const corners = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x + box.width, y: box.y + box.height },
            { x: box.x, y: box.y + box.height },
        ];
        const sur2 = surroundingRadius ** 2;
        return corners.some((corner) => corner.x ** 2 + corner.y ** 2 > sur2);
    }

    private computeCalloutLabelCollisionOffsets() {
        const { radiusScale } = this;
        const { calloutLabel, calloutLine } = this.properties;
        const { offset, minSpacing } = calloutLabel;
        const innerRadius = radiusScale.convert(0);

        const shouldSkip = (datum: PieNodeDatum) => {
            const label = datum.calloutLabel;
            return !label || datum.outerRadius === 0;
        };

        const fullData = this.calloutNodeData;
        const data = fullData.filter((t): t is Has<'calloutLabel', PieNodeDatum> => !shouldSkip(t));
        data.forEach((datum) => {
            const label = datum.calloutLabel;
            if (label == null) return;

            label.hidden = false;
            label.collisionTextAlign = undefined;
            label.collisionOffsetY = 0;
        });

        if (data.length <= 1) {
            return;
        }

        const leftLabels = data.filter((d) => d.midCos < 0).sort((a, b) => a.midSin - b.midSin);
        const rightLabels = data.filter((d) => d.midCos >= 0).sort((a, b) => a.midSin - b.midSin);
        const topLabels = data
            .filter((d) => d.midSin < 0 && d.calloutLabel?.textAlign === 'center')
            .sort((a, b) => a.midCos - b.midCos);
        const bottomLabels = data
            .filter((d) => d.midSin >= 0 && d.calloutLabel?.textAlign === 'center')
            .sort((a, b) => a.midCos - b.midCos);

        const getTextBBox = (datum: (typeof data)[number]) => {
            const label = datum.calloutLabel;
            if (label == null) return BBox.zero.clone();

            const labelRadius = datum.outerRadius + calloutLine.length + offset;
            const x = datum.midCos * labelRadius;
            const y = datum.midSin * labelRadius + label.collisionOffsetY;

            const textAlign = label.collisionTextAlign ?? label.textAlign;
            const textBaseline = label.textBaseline;
            return Text.computeBBox(label.text, x, y, {
                font: this.properties.calloutLabel,
                textAlign,
                textBaseline,
            });
        };

        const avoidNeighbourYCollision = (
            label: (typeof data)[number],
            next: (typeof data)[number],
            direction: 'to-top' | 'to-bottom'
        ) => {
            const box = getTextBBox(label).grow(minSpacing / 2);
            const other = getTextBBox(next).grow(minSpacing / 2);
            // The full collision is not detected, because sometimes
            // the next label can appear behind the label with offset
            const collidesOrBehind =
                box.x < other.x + other.width &&
                box.x + box.width > other.x &&
                (direction === 'to-top' ? box.y < other.y + other.height : box.y + box.height > other.y);
            if (collidesOrBehind) {
                const dy = direction === 'to-top' ? box.y - other.y - other.height : box.y + box.height - other.y;
                next.calloutLabel.collisionOffsetY = dy;
            }
        };

        const avoidYCollisions = (labels: typeof data) => {
            const midLabel = labels.slice().sort((a, b) => Math.abs(a.midSin) - Math.abs(b.midSin))[0];
            const midIndex = labels.indexOf(midLabel);
            for (let i = midIndex - 1; i >= 0; i--) {
                const prev = labels[i + 1];
                const next = labels[i];
                avoidNeighbourYCollision(prev, next, 'to-top');
            }
            for (let i = midIndex + 1; i < labels.length; i++) {
                const prev = labels[i - 1];
                const next = labels[i];
                avoidNeighbourYCollision(prev, next, 'to-bottom');
            }
        };

        const avoidXCollisions = (labels: typeof data) => {
            const labelsCollideLabelsByY = data.some((datum) => datum.calloutLabel.collisionOffsetY !== 0);

            const boxes = labels.map((label) => getTextBBox(label));
            const paddedBoxes = boxes.map((box) => box.clone().grow(minSpacing / 2));

            let labelsCollideLabelsByX = false;
            for (let i = 0; i < paddedBoxes.length && !labelsCollideLabelsByX; i++) {
                const box = paddedBoxes[i];
                for (let j = i + 1; j < labels.length; j++) {
                    const other = paddedBoxes[j];
                    if (box.collidesBBox(other)) {
                        labelsCollideLabelsByX = true;
                        break;
                    }
                }
            }

            const sectors = fullData.map((datum) => {
                const { startAngle, endAngle, outerRadius } = datum;
                return { startAngle, endAngle, innerRadius, outerRadius };
            });
            const labelsCollideSectors = boxes.some((box) => {
                return sectors.some((sector) => boxCollidesSector(box, sector));
            });

            if (!labelsCollideLabelsByX && !labelsCollideLabelsByY && !labelsCollideSectors) {
                return;
            }

            labels
                .filter((d) => d.calloutLabel.textAlign === 'center')
                .forEach((d) => {
                    const label = d.calloutLabel;
                    if (d.midCos < 0) {
                        label.collisionTextAlign = 'right';
                    } else if (d.midCos > 0) {
                        label.collisionTextAlign = 'left';
                    } else {
                        label.collisionTextAlign = 'center';
                    }
                });
        };

        avoidYCollisions(leftLabels);
        avoidYCollisions(rightLabels);
        avoidXCollisions(topLabels);
        avoidXCollisions(bottomLabels);
    }

    private updateCalloutLabelNodes(seriesRect: BBox) {
        const { radiusScale } = this;
        const { calloutLabel, calloutLine } = this.properties;
        const calloutLength = calloutLine.length;
        const { offset, color } = calloutLabel;

        const tempTextNode = new Text();

        this.calloutLabelSelection.selectByTag<Text>(PieNodeTag.Label).forEach((text) => {
            const { datum } = text;
            const label = datum.calloutLabel;
            const radius = radiusScale.convert(datum.radius);
            const outerRadius = Math.max(0, radius);

            if (!label?.text || outerRadius === 0 || label.hidden) {
                text.visible = false;
                return;
            }

            const labelRadius = outerRadius + calloutLength + offset;
            const x = datum.midCos * labelRadius;
            const y = datum.midSin * labelRadius + label.collisionOffsetY;

            // Detect text overflow
            const align = {
                textAlign: label.collisionTextAlign ?? label.textAlign,
                textBaseline: label.textBaseline,
            };
            tempTextNode.text = label.text;
            tempTextNode.x = x;
            tempTextNode.y = y;
            tempTextNode.setFont(this.properties.calloutLabel);
            tempTextNode.setAlign(align);
            const box = tempTextNode.getBBox();

            let displayText = label.text;
            let visible = true;
            if (calloutLabel.avoidCollisions) {
                const { textLength, hasVerticalOverflow } = this.getLabelOverflow(label.text, box, seriesRect);
                displayText = label.text.length === textLength ? label.text : `${label.text.substring(0, textLength)}…`;
                visible = !hasVerticalOverflow;
            }

            text.text = displayText;
            text.x = x;
            text.y = y;
            text.setFont(this.properties.calloutLabel);
            text.setAlign(align);
            text.fill = color;
            text.visible = visible;
        });
    }

    override computeLabelsBBox(options: { hideWhenNecessary: boolean }, seriesRect: BBox) {
        const { calloutLabel, calloutLine } = this.properties;
        const calloutLength = calloutLine.length;
        const { offset, maxCollisionOffset, minSpacing } = calloutLabel;

        if (!calloutLabel.avoidCollisions) {
            return null;
        }

        this.maybeRefreshNodeData();

        this.updateRadiusScale(false);
        this.computeCalloutLabelCollisionOffsets();

        const textBoxes: BBox[] = [];
        const text = new Text();

        let titleBox: BBox;
        const { title } = this.properties;
        if (title?.text && title.enabled) {
            const dy = this.getTitleTranslationY();
            if (isFinite(dy)) {
                text.text = title.text;
                text.x = 0;
                text.y = dy;
                text.setFont(title);
                text.setAlign({
                    textBaseline: 'bottom',
                    textAlign: 'center',
                });
                titleBox = text.getBBox();
                textBoxes.push(titleBox);
            }
        }

        this.calloutNodeData.forEach((datum) => {
            const label = datum.calloutLabel;
            if (!label || datum.outerRadius === 0) {
                return null;
            }

            const labelRadius = datum.outerRadius + calloutLength + offset;
            const x = datum.midCos * labelRadius;
            const y = datum.midSin * labelRadius + label.collisionOffsetY;
            text.text = label.text;
            text.x = x;
            text.y = y;
            text.setFont(this.properties.calloutLabel);
            text.setAlign({
                textAlign: label.collisionTextAlign ?? label.textAlign,
                textBaseline: label.textBaseline,
            });
            const box = text.getBBox();
            label.box = box;

            // Hide labels that where pushed too far by the collision avoidance algorithm
            if (Math.abs(label.collisionOffsetY) > maxCollisionOffset) {
                label.hidden = true;
                return;
            }

            // Hide labels intersecting or above the title
            if (titleBox) {
                const seriesTop = seriesRect.y - this.centerY;
                const titleCleanArea = new BBox(
                    titleBox.x - minSpacing,
                    seriesTop,
                    titleBox.width + 2 * minSpacing,
                    titleBox.y + titleBox.height + minSpacing - seriesTop
                );
                if (box.collidesBBox(titleCleanArea)) {
                    label.hidden = true;
                    return;
                }
            }

            if (options.hideWhenNecessary) {
                const { textLength, hasVerticalOverflow, hasSurroundingSeriesOverflow } = this.getLabelOverflow(
                    label.text,
                    box,
                    seriesRect
                );
                const isTooShort = label.text.length > 2 && textLength < 2;

                if (hasVerticalOverflow || isTooShort || hasSurroundingSeriesOverflow) {
                    label.hidden = true;
                    return;
                }
            }

            label.hidden = false;
            textBoxes.push(box);
        });
        if (textBoxes.length === 0) {
            return null;
        }
        return BBox.merge(textBoxes);
    }

    private updateSectorLabelNodes() {
        const { radiusScale } = this;
        const innerRadius = radiusScale.convert(0);
        const { fontSize, fontStyle, fontWeight, fontFamily, positionOffset, positionRatio, color } =
            this.properties.sectorLabel;

        const isDonut = innerRadius > 0;
        const singleVisibleSector = this.ctx.legendManager.getData(this.id)?.filter((d) => d.enabled).length === 1;

        const updateSectorLabel = (text: Text, datum: PieNodeDatum) => {
            const { sectorLabel, outerRadius, startAngle, endAngle } = datum;

            let isTextVisible = false;
            if (sectorLabel && outerRadius !== 0) {
                const labelRadius = innerRadius * (1 - positionRatio) + outerRadius * positionRatio + positionOffset;

                text.fill = color;
                text.fontStyle = fontStyle;
                text.fontWeight = fontWeight;
                text.fontSize = fontSize;
                text.fontFamily = fontFamily;
                text.text = sectorLabel.text;
                const shouldPutTextInCenter = !isDonut && singleVisibleSector;
                if (shouldPutTextInCenter) {
                    text.x = 0;
                    text.y = 0;
                } else {
                    text.x = datum.midCos * labelRadius;
                    text.y = datum.midSin * labelRadius;
                }
                text.textAlign = 'center';
                text.textBaseline = 'middle';

                const bbox = text.getBBox();
                const corners = [
                    [bbox.x, bbox.y],
                    [bbox.x + bbox.width, bbox.y],
                    [bbox.x + bbox.width, bbox.y + bbox.height],
                    [bbox.x, bbox.y + bbox.height],
                ];
                const sectorBounds = { startAngle, endAngle, innerRadius, outerRadius };
                if (corners.every(([x, y]) => isPointInSector(x, y, sectorBounds))) {
                    isTextVisible = true;
                }
            }
            text.visible = isTextVisible;
        };

        this.labelSelection.each(updateSectorLabel);
        this.highlightLabelSelection.each(updateSectorLabel);
    }

    private updateZerosumRings() {
        // The Circle `size` is the diameter
        this.zerosumOuterRing.size = this.getOuterRadius() * 2;
    }

    protected override readonly NodeEvent = PieSeriesNodeEvent;

    private getDatumLegendName(nodeDatum: PieNodeDatum) {
        const { angleKey, calloutLabelKey, sectorLabelKey, legendItemKey } = this.properties;
        const { sectorLabel, calloutLabel, legendItem } = nodeDatum;

        if (legendItemKey && legendItem !== undefined) {
            return legendItem.text;
        } else if (calloutLabelKey && calloutLabelKey !== angleKey && calloutLabel?.text !== undefined) {
            return calloutLabel.text;
        } else if (sectorLabelKey && sectorLabelKey !== angleKey && sectorLabel?.text !== undefined) {
            return sectorLabel.text;
        }
    }

    protected override pickNodeClosestDatum(point: Point): SeriesNodePickMatch | undefined {
        return pickByMatchingAngle(this, point);
    }

    getTooltipHtml(nodeDatum: PieNodeDatum): TooltipContent {
        if (!this.properties.isValid()) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const {
            datum,
            angleValue,
            sectorFormat: { fill: color },
            itemId,
        } = nodeDatum;

        const title = sanitizeHtml(this.properties.title?.text);
        const content = formatValue(angleValue);
        const labelText = this.getDatumLegendName(nodeDatum);

        return this.properties.tooltip.toTooltipHtml(
            {
                title: title ?? labelText,
                content: title && labelText ? `${labelText}: ${content}` : content,
                backgroundColor: color,
            },
            {
                datum,
                itemId,
                title,
                color,
                seriesId: this.id,
                angleKey: this.properties.angleKey,
                angleName: this.properties.angleName,
                radiusKey: this.properties.radiusKey,
                radiusName: this.properties.radiusName,
                calloutLabelKey: this.properties.calloutLabelKey,
                calloutLabelName: this.properties.calloutLabelName,
                sectorLabelKey: this.properties.sectorLabelKey,
                sectorLabelName: this.properties.sectorLabelName,
                legendItemKey: this.properties.legendItemKey,
            }
        );
    }

    getLegendData(legendType: ChartLegendType): CategoryLegendDatum[] {
        const {
            id: seriesId,
            visible,
            processedData,
            dataModel,
            ctx: { legendManager },
        } = this;

        if (!dataModel || !processedData || legendType !== 'category') {
            return [];
        }

        const { angleKey, calloutLabelKey, sectorLabelKey, legendItemKey, showInLegend } = this.properties;

        if (
            !legendItemKey &&
            (!calloutLabelKey || calloutLabelKey === angleKey) &&
            (!sectorLabelKey || sectorLabelKey === angleKey)
        ) {
            return [];
        }

        const { calloutLabelValues, sectorLabelValues, legendItemValues, angleRawValues } = this.getProcessedDataValues(
            dataModel,
            processedData
        );

        const titleText = this.properties.title?.showInLegend && this.properties.title.text;
        const legendData: CategoryLegendDatum[] = [];

        const hideZeros = this.properties.hideZeroValueSectorsInLegend;
        for (let datumIndex = 0; datumIndex < processedData.rawData.length; datumIndex++) {
            const datum = processedData.rawData[datumIndex];
            const angleRawValue = angleRawValues[datumIndex];

            if (hideZeros && angleRawValue === 0) {
                continue;
            }

            const labelParts = [];
            if (titleText) {
                labelParts.push(titleText);
            }
            const labels = this.getLabels(
                datum,
                2 * Math.PI,
                2 * Math.PI,
                false,
                calloutLabelValues?.[datumIndex],
                sectorLabelValues?.[datumIndex],
                legendItemValues?.[datumIndex]
            );

            if (legendItemKey && labels.legendItem !== undefined) {
                labelParts.push(labels.legendItem.text);
            } else if (calloutLabelKey && calloutLabelKey !== angleKey && labels.calloutLabel?.text !== undefined) {
                labelParts.push(labels.calloutLabel?.text);
            } else if (sectorLabelKey && sectorLabelKey !== angleKey && labels.sectorLabel?.text !== undefined) {
                labelParts.push(labels.sectorLabel?.text);
            }

            if (labelParts.length === 0) continue;

            const sectorFormat = this.getSectorFormat(datum, datumIndex, false);

            legendData.push({
                legendType: 'category',
                id: seriesId,
                datum,
                itemId: datumIndex,
                seriesId,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId: datumIndex }),
                label: {
                    text: labelParts.join(' - '),
                },
                symbols: [
                    {
                        marker: {
                            fill: sectorFormat.fill,
                            stroke: sectorFormat.stroke,
                            fillOpacity: this.properties.fillOpacity,
                            strokeOpacity: this.properties.strokeOpacity,
                            strokeWidth: this.properties.strokeWidth,
                        },
                    },
                ],
                legendItemName: legendItemKey != null ? datum[legendItemKey] : undefined,
                hideInLegend: !showInLegend,
            });
        }

        return legendData;
    }

    // Used for grid
    setLegendState(enabledItems: boolean[]) {
        const {
            id: seriesId,
            ctx: { legendManager, updateService },
        } = this;
        enabledItems.forEach((enabled, itemId) => legendManager.toggleItem({ enabled, seriesId, itemId }));
        legendManager.update();
        updateService.update(ChartUpdateType.SERIES_UPDATE);
    }

    override animateEmptyUpdateReady(_data?: PolarAnimationData) {
        const { animationManager } = this.ctx;

        const fns = preparePieSeriesAnimationFunctions(
            true,
            this.properties.rotation,
            this.radiusScale,
            this.previousRadiusScale
        );
        fromToMotion(
            this.id,
            'nodes',
            animationManager,
            [this.itemSelection, this.highlightSelection, this.phantomSelection],
            fns.nodes,
            (_, datum) => this.getDatumId(datum)
        );

        seriesLabelFadeInAnimation(this, 'callout', animationManager, this.calloutLabelSelection);
        seriesLabelFadeInAnimation(this, 'sector', animationManager, this.labelSelection);
        seriesLabelFadeInAnimation(this, 'highlight', animationManager, this.highlightLabelSelection);

        this.previousRadiusScale.range = this.radiusScale.range;
    }

    override animateWaitingUpdateReady() {
        const { itemSelection, highlightSelection, phantomSelection, processedData, radiusScale, previousRadiusScale } =
            this;
        const { animationManager } = this.ctx;
        const dataDiff = processedData?.reduced?.diff;

        this.ctx.animationManager.stopByAnimationGroupId(this.id);

        const supportedDiff = (dataDiff?.moved.size ?? 0) === 0;
        const hasKeys = (processedData?.defs.keys.length ?? 0) > 0;
        const hasUniqueKeys = processedData?.reduced?.animationValidation?.uniqueKeys ?? true;
        if (!supportedDiff || !hasKeys || !hasUniqueKeys) {
            this.ctx.animationManager.skipCurrentBatch();
        }

        const fns = preparePieSeriesAnimationFunctions(
            false,
            this.properties.rotation,
            radiusScale,
            previousRadiusScale
        );
        fromToMotion(
            this.id,
            'nodes',
            animationManager,
            [itemSelection, highlightSelection, phantomSelection],
            fns.nodes,
            (_, datum) => this.getDatumId(datum),
            dataDiff
        );

        seriesLabelFadeInAnimation(this, 'callout', this.ctx.animationManager, this.calloutLabelSelection);
        seriesLabelFadeInAnimation(this, 'sector', this.ctx.animationManager, this.labelSelection);
        seriesLabelFadeInAnimation(this, 'highlight', this.ctx.animationManager, this.highlightLabelSelection);

        this.previousRadiusScale.range = this.radiusScale.range;
    }

    override animateClearingUpdateEmpty() {
        const { itemSelection, highlightSelection, phantomSelection, radiusScale, previousRadiusScale } = this;
        const { animationManager } = this.ctx;

        const fns = preparePieSeriesAnimationFunctions(
            false,
            this.properties.rotation,
            radiusScale,
            previousRadiusScale
        );
        fromToMotion(
            this.id,
            'nodes',
            animationManager,
            [itemSelection, highlightSelection, phantomSelection],
            fns.nodes,
            (_, datum) => this.getDatumId(datum)
        );

        seriesLabelFadeOutAnimation(this, 'callout', this.ctx.animationManager, this.calloutLabelSelection);
        seriesLabelFadeOutAnimation(this, 'sector', this.ctx.animationManager, this.labelSelection);
        seriesLabelFadeOutAnimation(this, 'highlight', this.ctx.animationManager, this.highlightLabelSelection);

        this.previousRadiusScale.range = this.radiusScale.range;
    }

    getDatumIdFromData(datum: any) {
        const { calloutLabelKey, sectorLabelKey, legendItemKey } = this.properties;

        if (!this.processedData?.reduced?.animationValidation?.uniqueKeys) {
            return;
        }

        if (legendItemKey) {
            return datum[legendItemKey];
        } else if (calloutLabelKey) {
            return datum[calloutLabelKey];
        } else if (sectorLabelKey) {
            return datum[sectorLabelKey];
        }
    }

    getDatumId(datum: PieNodeDatum) {
        const { index } = datum;

        const datumId = this.getDatumIdFromData(datum.datum);
        return datumId != null ? String(datumId) : `${index}`;
    }
}
