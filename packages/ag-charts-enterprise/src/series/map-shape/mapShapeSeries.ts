import { _ModuleSupport } from 'ag-charts-community';
import type { AgMapShapeSeriesStyle } from 'ag-charts-types';

import { GeoGeometry, GeoGeometryRenderMode } from '../map-util/geoGeometry';
import { GeometryType, containsType, geometryBbox, largestPolygon, projectGeometry } from '../map-util/geometryUtil';
import { findFocusedGeoGeometry } from '../map-util/mapUtil';
import { MapZIndexMap } from '../map-util/mapZIndexMap';
import { polygonMarkerCenter } from '../map-util/markerUtil';
import { maxWidthInPolygonForRectOfHeight, preferredLabelCenter } from '../map-util/polygonLabelUtil';
import { TopologySeries } from '../map-util/topologySeries';
import { GEOJSON_OBJECT } from '../map-util/validation';
import { formatSingleLabel } from '../util/labelFormatter';
import {
    type MapShapeNodeDatum,
    type MapShapeNodeLabelDatum,
    MapShapeSeriesProperties,
} from './mapShapeSeriesProperties';

const {
    getMissCount,
    createDatumId,
    SeriesNodePickMode,
    valueProperty,
    Validate,
    CachedTextMeasurerPool,
    TextUtils,
    sanitizeHtml,
    Logger,
    ColorScale,
    Group,
    Selection,
    Text,
    PointerEvents,
} = _ModuleSupport;

export interface MapShapeNodeDataContext
    extends _ModuleSupport.SeriesNodeDataContext<MapShapeNodeDatum, MapShapeNodeLabelDatum> {}

const fixedScale = _ModuleSupport.MercatorScale.fixedScale();

interface LabelLayout {
    geometry: _ModuleSupport.Geometry;
    labelText: string;
    aspectRatio: number;
    x: number;
    y: number;
    maxWidth: number;
    fixedPolygon: _ModuleSupport.Position[][];
}
export class MapShapeSeries
    extends TopologySeries<MapShapeNodeDatum, MapShapeSeriesProperties, MapShapeNodeLabelDatum, MapShapeNodeDataContext>
    implements _ModuleSupport.ITopology
{
    static readonly className = 'MapShapeSeries';
    static readonly type = 'map-shape' as const;

    scale: _ModuleSupport.MercatorScale | undefined;

    public topologyBounds: _ModuleSupport.LonLatBBox | undefined;

    override properties = new MapShapeSeriesProperties();

    @Validate(GEOJSON_OBJECT, { optional: true, property: 'topology' })
    private _chartTopology?: _ModuleSupport.FeatureCollection = undefined;

    public override getNodeData(): MapShapeNodeDatum[] | undefined {
        return this.contextNodeData?.nodeData;
    }

    private get topology() {
        return this.properties.topology ?? this._chartTopology;
    }

    override get hasData() {
        return super.hasData && this.topology != null;
    }

    private readonly colorScale = new ColorScale();

    private readonly itemGroup = this.contentGroup.appendChild(new Group({ name: 'itemGroup' }));
    private readonly itemLabelGroup = this.contentGroup.appendChild(new Group({ name: 'itemLabelGroup' }));

    public datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeNodeDatum> = Selection.select(
        this.itemGroup,
        () => this.nodeFactory()
    );
    private labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, MapShapeNodeLabelDatum> = Selection.select(
        this.itemLabelGroup,
        Text
    );
    private highlightDatumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeNodeDatum> = Selection.select(
        this.highlightNode,
        () => this.nodeFactory()
    );

    public contextNodeData?: MapShapeNodeDataContext;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH, SeriesNodePickMode.NEAREST_NODE],
        });

        this.itemLabelGroup.pointerEvents = PointerEvents.None;
    }

    override renderToOffscreenCanvas(): boolean {
        return true;
    }

    setChartTopology(topology: any): void {
        this._chartTopology = topology;
        if (this.topology === topology) {
            this.nodeDataRefresh = true;
        }
    }

    override setSeriesIndex(index: number): boolean {
        if (!super.setSeriesIndex(index)) return false;

        this.contentGroup.zIndex = [MapZIndexMap.ShapeLine, index];
        this.highlightGroup.zIndex = [MapZIndexMap.ShapeLineHighlight, index];

        return true;
    }

    private isLabelEnabled() {
        return this.properties.labelKey != null && this.properties.label.enabled;
    }

    private nodeFactory(): GeoGeometry {
        const geoGeometry = new GeoGeometry();
        geoGeometry.renderMode = GeoGeometryRenderMode.Polygons;
        geoGeometry.lineJoin = 'round';
        return geoGeometry;
    }

    override async processData(dataController: _ModuleSupport.DataController): Promise<void> {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const { data, topology, colorScale } = this;
        const { topologyIdKey, idKey, colorKey, labelKey, colorRange } = this.properties;

        const featureById = new Map<string, _ModuleSupport.Feature>();
        topology?.features.forEach((feature) => {
            const property = feature.properties?.[topologyIdKey];
            if (property == null || !containsType(feature.geometry, GeometryType.Polygon)) return;
            featureById.set(property, feature);
        });

        const colorScaleType = this.colorScale.type;
        const mercatorScaleType = this.scale?.type;

        const { dataModel, processedData } = await this.requestDataModel<any, any, true>(dataController, data, {
            props: [
                valueProperty(idKey, mercatorScaleType, { id: 'idValue', includeProperty: false }),
                valueProperty(idKey, mercatorScaleType, {
                    id: 'featureValue',
                    includeProperty: false,
                    processor: () => (datum) => featureById.get(datum),
                }),
                ...(labelKey ? [valueProperty(labelKey, 'band', { id: 'labelValue' })] : []),
                ...(colorKey ? [valueProperty(colorKey, colorScaleType, { id: 'colorValue' })] : []),
            ],
        });

        const featureValues =
            processedData.rawData.length !== 0
                ? dataModel.resolveColumnById<_ModuleSupport.Feature | undefined>(this, `featureValue`, processedData)
                : undefined;
        this.topologyBounds = featureValues?.reduce<_ModuleSupport.LonLatBBox | undefined>((current, feature) => {
            const geometry = feature?.geometry;
            if (geometry == null) return current;
            return geometryBbox(geometry, current);
        }, undefined);

        if (colorRange != null && this.isColorScaleValid()) {
            const colorKeyIdx = dataModel.resolveProcessedDataIndexById(this, 'colorValue');
            colorScale.domain = processedData.domain.values[colorKeyIdx];
            colorScale.range = colorRange;
            colorScale.update();
        }

        if (topology == null) {
            Logger.warnOnce(`no topology was provided for [MapShapeSeries]; nothing will be rendered.`);
        }
    }

    private isColorScaleValid() {
        const { colorKey } = this.properties;
        if (!colorKey) {
            return false;
        }

        const { dataModel, processedData } = this;
        if (!dataModel || !processedData) {
            return false;
        }

        const colorIdx = dataModel.resolveProcessedDataIndexById(this, 'colorValue');
        const dataCount = processedData.rawData.length;
        const missCount = getMissCount(this, processedData.defs.values[colorIdx].missing);
        const colorDataMissing = dataCount === 0 || dataCount === missCount;
        return !colorDataMissing;
    }

    private getLabelLayout(
        datum: any,
        labelValue: string | undefined,
        font: string,
        geometry: _ModuleSupport.Geometry | undefined,
        previousLabelLayout: LabelLayout | undefined
    ): LabelLayout | undefined {
        if (labelValue == null || geometry == null) return;

        const { idKey, idName, colorKey, colorName, labelKey, labelName, padding, label } = this.properties;

        const labelText = this.getLabelText(label, {
            value: labelValue,
            datum,
            idKey,
            idName,
            colorKey,
            colorName,
            labelKey,
            labelName,
        });
        if (labelText == null) return;

        const baseSize = CachedTextMeasurerPool.measureText(String(labelText), { font });
        const numLines = labelText.split('\n').length;
        const aspectRatio =
            (baseSize.width + 2 * padding) / (numLines * TextUtils.getLineHeight(label.fontSize) + 2 * padding);

        if (
            previousLabelLayout?.geometry === geometry &&
            previousLabelLayout?.labelText === labelText &&
            previousLabelLayout?.aspectRatio === aspectRatio
        ) {
            return previousLabelLayout;
        }

        const fixedGeometry = projectGeometry(geometry, fixedScale);
        const fixedPolygon = largestPolygon(fixedGeometry);
        if (fixedPolygon == null) return;

        const labelPlacement = preferredLabelCenter(fixedPolygon, {
            aspectRatio,
            precision: 1e-3,
        });
        if (labelPlacement == null) return;

        const { x, y, maxWidth } = labelPlacement;

        return { geometry, labelText, aspectRatio, x, y, maxWidth, fixedPolygon };
    }

    private getLabelDatum(labelLayout: LabelLayout, scaling: number): MapShapeNodeLabelDatum | undefined {
        const { scale } = this;
        if (scale == null) return;

        const { padding, label } = this.properties;
        const { labelText, aspectRatio, x: untruncatedX, y, maxWidth, fixedPolygon } = labelLayout;

        const maxSizeWithoutTruncation = {
            width: Math.ceil(maxWidth * scaling),
            height: Math.ceil((maxWidth * scaling) / aspectRatio),
            meta: untruncatedX,
        };
        const labelFormatting = formatSingleLabel<number>(labelText, label, { padding }, (height, allowTruncation) => {
            if (!allowTruncation) return maxSizeWithoutTruncation;

            const result = maxWidthInPolygonForRectOfHeight(fixedPolygon, untruncatedX, y, height / scaling);
            return {
                width: result.width * scaling,
                height,
                meta: result.x,
            };
        });
        if (labelFormatting == null) return;

        const [{ text, fontSize, lineHeight, width }, formattingX] = labelFormatting;
        // FIXME - formatSingleLabel should never return an ellipsis
        if (text === TextUtils.EllipsisChar) return;

        // Only shift horizontally if necessary
        const x = width < maxSizeWithoutTruncation.width ? untruncatedX : formattingX;

        const position = this.scale!.convert(fixedScale.invert([x, y]));

        return {
            x: position[0],
            y: position[1],
            text,
            fontSize,
            lineHeight,
        };
    }

    private previousLabelLayouts: Map<string, LabelLayout> | undefined = undefined;
    override createNodeData() {
        const { id: seriesId, dataModel, processedData, colorScale, properties, scale, previousLabelLayouts } = this;
        const { idKey, colorKey, labelKey, label, fill: fillProperty } = properties;

        if (dataModel == null || processedData == null || processedData.rawData.length === 0) return;

        const scaling = scale != null ? (scale.range[1][0] - scale.range[0][0]) / scale.bounds.width : NaN;

        const colorScaleValid = this.isColorScaleValid();

        const idValues = dataModel.resolveColumnById<string>(this, `idValue`, processedData);
        const featureValues = dataModel.resolveColumnById<_ModuleSupport.Feature | undefined>(
            this,
            `featureValue`,
            processedData
        );
        const labelValues =
            labelKey != null ? dataModel.resolveColumnById<string>(this, `labelValue`, processedData) : undefined;
        const colorValues =
            colorKey != null ? dataModel.resolveColumnById<number>(this, `colorValue`, processedData) : undefined;

        const font = label.getFont();

        const labelLayouts = new Map<string, LabelLayout>();
        this.previousLabelLayouts = labelLayouts;

        const nodeData: MapShapeNodeDatum[] = [];
        const labelData: MapShapeNodeLabelDatum[] = [];
        const missingGeometries: string[] = [];
        processedData.rawData.forEach((datum, datumIndex) => {
            const idValue = idValues[datumIndex];
            const colorValue: number | undefined = colorValues?.[datumIndex];
            const labelValue: string | undefined = labelValues?.[datumIndex];

            const geometry = featureValues[datumIndex]?.geometry ?? undefined;
            if (geometry == null) {
                missingGeometries.push(idValue);
            }

            const color: string | undefined =
                colorScaleValid && colorValue != null ? colorScale.convert(colorValue) : undefined;

            const labelLayout = this.getLabelLayout(
                datum,
                labelValue,
                font,
                geometry,
                previousLabelLayouts?.get(idValue)
            );
            if (labelLayout != null) {
                labelLayouts.set(idValue, labelLayout);
            }

            const labelDatum =
                labelLayout != null && scale != null ? this.getLabelDatum(labelLayout, scaling) : undefined;
            if (labelDatum != null) {
                labelData.push(labelDatum);
            }

            const projectedGeometry = geometry != null && scale != null ? projectGeometry(geometry, scale) : undefined;

            nodeData.push({
                series: this,
                itemId: idKey,
                datum,
                idValue,
                colorValue,
                labelValue,
                fill: color ?? fillProperty,
                projectedGeometry,
            });
        });

        const missingGeometriesCap = 10;
        if (missingGeometries.length > missingGeometriesCap) {
            const excessItems = missingGeometries.length - missingGeometriesCap;
            missingGeometries.length = missingGeometriesCap;
            missingGeometries.push(`(+${excessItems} more)`);
        }
        if (missingGeometries.length > 0) {
            Logger.warnOnce(`some data items do not have matches in the provided topology`, missingGeometries);
        }

        return {
            itemId: seriesId,
            nodeData,
            labelData,
        };
    }

    updateSelections() {
        if (this.nodeDataRefresh) {
            this.contextNodeData = this.createNodeData();
            this.nodeDataRefresh = false;
        }
    }

    override update() {
        const { datumSelection, labelSelection, highlightDatumSelection } = this;

        this.updateSelections();

        this.contentGroup.visible = this.visible;
        this.contentGroup.opacity = this.getOpacity();

        let highlightedDatum: MapShapeNodeDatum | undefined = this.ctx.highlightManager?.getActiveHighlight() as any;
        if (highlightedDatum != null && (highlightedDatum.series !== this || highlightedDatum.datum == null)) {
            highlightedDatum = undefined;
        }

        const nodeData = this.contextNodeData?.nodeData ?? [];
        const labelData = this.contextNodeData?.labelData ?? [];

        this.datumSelection = this.updateDatumSelection({ nodeData, datumSelection });
        this.updateDatumNodes({ datumSelection, isHighlight: false });

        this.labelSelection = this.updateLabelSelection({ labelData, labelSelection });
        this.updateLabelNodes({ labelSelection });

        this.highlightDatumSelection = this.updateDatumSelection({
            nodeData: highlightedDatum != null ? [highlightedDatum] : [],
            datumSelection: highlightDatumSelection,
        });
        this.updateDatumNodes({ datumSelection: highlightDatumSelection, isHighlight: true });
    }

    private updateDatumSelection(opts: {
        nodeData: MapShapeNodeDatum[];
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) => createDatumId(datum.idValue));
    }

    private updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeNodeDatum>;
        isHighlight: boolean;
    }) {
        const { id: seriesId, properties } = this;
        const { datumSelection, isHighlight } = opts;
        const { idKey, colorKey, labelKey, fillOpacity, stroke, strokeOpacity, lineDash, lineDashOffset, itemStyler } =
            properties;
        const highlightStyle = isHighlight ? properties.highlightStyle.item : undefined;
        const strokeWidth = this.getStrokeWidth(properties.strokeWidth);

        datumSelection.each((geoGeometry, datum) => {
            const { projectedGeometry } = datum;
            if (projectedGeometry == null) {
                geoGeometry.visible = false;
                geoGeometry.projectedGeometry = undefined;
                return;
            }

            let format: AgMapShapeSeriesStyle | undefined;
            if (itemStyler != null) {
                format = this.cachedDatumCallback(
                    createDatumId(datum.idValue, isHighlight ? 'highlight' : 'node'),
                    () =>
                        itemStyler({
                            seriesId,
                            datum: datum.datum,
                            idKey,
                            colorKey,
                            labelKey,
                            fill: datum.fill,
                            fillOpacity,
                            strokeOpacity,
                            stroke,
                            strokeWidth,
                            lineDash,
                            lineDashOffset,
                            highlighted: isHighlight,
                        })
                );
            }

            geoGeometry.visible = true;
            geoGeometry.projectedGeometry = projectedGeometry;
            geoGeometry.fill = highlightStyle?.fill ?? format?.fill ?? datum.fill;
            geoGeometry.fillOpacity = highlightStyle?.fillOpacity ?? format?.fillOpacity ?? fillOpacity;
            geoGeometry.stroke = highlightStyle?.stroke ?? format?.stroke ?? stroke;
            geoGeometry.strokeWidth = highlightStyle?.strokeWidth ?? format?.strokeWidth ?? strokeWidth;
            geoGeometry.strokeOpacity = highlightStyle?.strokeOpacity ?? format?.strokeOpacity ?? strokeOpacity;
            geoGeometry.lineDash = highlightStyle?.lineDash ?? format?.lineDash ?? lineDash;
            geoGeometry.lineDashOffset = highlightStyle?.lineDashOffset ?? format?.lineDashOffset ?? lineDashOffset;
        });
    }

    private updateLabelSelection(opts: {
        labelData: MapShapeNodeLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, MapShapeNodeLabelDatum>;
    }) {
        const labels = this.isLabelEnabled() ? opts.labelData : [];
        return opts.labelSelection.update(labels);
    }

    private updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, MapShapeNodeLabelDatum>;
    }) {
        const { labelSelection } = opts;
        const { color: fill, fontStyle, fontWeight, fontFamily } = this.properties.label;

        labelSelection.each((label, { x, y, text, fontSize, lineHeight }) => {
            label.visible = true;
            label.x = x;
            label.y = y;
            label.text = text;
            label.fill = fill;
            label.fontStyle = fontStyle;
            label.fontWeight = fontWeight;
            label.fontSize = fontSize;
            label.lineHeight = lineHeight;
            label.fontFamily = fontFamily;
            label.textAlign = 'center';
            label.textBaseline = 'middle';
        });
    }

    resetAnimation() {
        // No animations
    }

    override getLabelData(): _ModuleSupport.PointLabelDatum[] {
        return [];
    }

    override getSeriesDomain() {
        return [NaN, NaN];
    }

    override pickNodeClosestDatum({ x, y }: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined {
        let minDistanceSquared = Infinity;
        let minDatum: _ModuleSupport.SeriesNodeDatum | undefined;

        this.datumSelection.each((node, datum) => {
            const distanceSquared = node.distanceSquared(x, y);
            if (distanceSquared < minDistanceSquared) {
                minDistanceSquared = distanceSquared;
                minDatum = datum;
            }
        });

        return minDatum != null ? { datum: minDatum, distance: Math.sqrt(minDistanceSquared) } : undefined;
    }

    private _previousDatumMidPoint:
        | { datum: _ModuleSupport.SeriesNodeDatum; point: _ModuleSupport.Point | undefined }
        | undefined = undefined;
    datumMidPoint(datum: _ModuleSupport.SeriesNodeDatum): _ModuleSupport.Point | undefined {
        const { _previousDatumMidPoint } = this;
        if (_previousDatumMidPoint?.datum === datum) {
            return _previousDatumMidPoint.point;
        }

        const projectedGeometry = (datum as MapShapeNodeDatum).projectedGeometry;
        const polygon = projectedGeometry != null ? largestPolygon(projectedGeometry) : undefined;
        const center = polygon != null ? polygonMarkerCenter(polygon, 2) : undefined;
        const point = center != null ? { x: center[0], y: center[1] } : undefined;

        this._previousDatumMidPoint = { datum, point };

        return point;
    }

    override getLegendData(
        legendType: _ModuleSupport.ChartLegendType
    ): _ModuleSupport.CategoryLegendDatum[] | _ModuleSupport.GradientLegendDatum[] {
        const { processedData, dataModel } = this;
        if (processedData == null || dataModel == null) return [];

        const { id: seriesId, visible } = this;

        const {
            title,
            legendItemName,
            idKey,
            idName,
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
            colorKey,
            colorName,
            colorRange,
            showInLegend,
        } = this.properties;

        if (legendType === 'gradient' && colorKey != null && colorRange != null) {
            const colorDomain =
                processedData.domain.values[dataModel.resolveProcessedDataIndexById(this, 'colorValue')];
            const legendDatum: _ModuleSupport.GradientLegendDatum = {
                legendType: 'gradient',
                enabled: visible,
                seriesId,
                colorName,
                colorRange,
                colorDomain,
            };
            return [legendDatum];
        } else if (legendType === 'category') {
            const legendDatum: _ModuleSupport.CategoryLegendDatum = {
                legendType: 'category',
                id: seriesId,
                itemId: seriesId,
                seriesId,
                enabled: visible,
                label: { text: legendItemName ?? title ?? idName ?? idKey },
                symbols: [
                    {
                        marker: {
                            fill,
                            fillOpacity,
                            stroke,
                            strokeWidth,
                            strokeOpacity,
                        },
                    },
                ],
                legendItemName,
                hideInLegend: !showInLegend,
            };
            return [legendDatum];
        } else {
            return [];
        }
    }

    override getTooltipHtml(nodeDatum: MapShapeNodeDatum): _ModuleSupport.TooltipContent {
        const { id: seriesId, processedData, properties } = this;

        if (!processedData || !properties.isValid()) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const {
            legendItemName,
            idKey,
            idName,
            colorKey,
            colorName,
            labelKey,
            labelName,
            stroke,
            strokeWidth,
            strokeOpacity,
            fillOpacity,
            lineDash,
            lineDashOffset,
            itemStyler,
            tooltip,
        } = properties;
        const { datum, fill, idValue, colorValue, labelValue, itemId } = nodeDatum;

        const title = sanitizeHtml(properties.title ?? legendItemName) ?? '';
        const contentLines: string[] = [];
        contentLines.push(sanitizeHtml((idName != null ? `${idName}: ` : '') + idValue));
        if (colorValue != null) {
            contentLines.push(sanitizeHtml((colorName ?? colorKey) + ': ' + colorValue));
        }
        if (labelValue != null && labelKey !== idKey) {
            contentLines.push(sanitizeHtml((labelName ?? labelKey) + ': ' + labelValue));
        }
        const content = contentLines.join('<br>');

        let format: AgMapShapeSeriesStyle | undefined;

        if (itemStyler) {
            format = this.cachedDatumCallback(createDatumId(datum.idValue, 'tooltip'), () =>
                itemStyler({
                    seriesId,
                    datum,
                    idKey,
                    colorKey,
                    labelKey,
                    fill,
                    stroke,
                    strokeWidth: this.getStrokeWidth(strokeWidth),
                    highlighted: false,
                    fillOpacity,
                    strokeOpacity,
                    lineDash,
                    lineDashOffset,
                })
            );
        }

        const color = format?.fill ?? fill;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                datum,
                idKey,
                title,
                color,
                colorKey,
                colorName,
                idName,
                itemId,
                labelKey,
                labelName,
                ...this.getModuleTooltipParams(),
            }
        );
    }

    protected override computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.Path | undefined {
        return findFocusedGeoGeometry(this, opts);
    }
}
