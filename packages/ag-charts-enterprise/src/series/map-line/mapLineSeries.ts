import { type AgMapLineSeriesStyle, _ModuleSupport } from 'ag-charts-community';

import { GeoGeometry, GeoGeometryRenderMode } from '../map-util/geoGeometry';
import { GeometryType, containsType, geometryBbox, largestLineString, projectGeometry } from '../map-util/geometryUtil';
import { lineStringCenter } from '../map-util/lineStringUtil';
import { findFocusedGeoGeometry } from '../map-util/mapUtil';
import { MapZIndexMap } from '../map-util/mapZIndexMap';
import { TopologySeries } from '../map-util/topologySeries';
import { GEOJSON_OBJECT } from '../map-util/validation';
import { type MapLineNodeDatum, type MapLineNodeLabelDatum, MapLineSeriesProperties } from './mapLineSeriesProperties';

const {
    getMissCount,
    createDatumId,
    SeriesNodePickMode,
    valueProperty,
    CachedTextMeasurerPool,
    Validate,
    sanitizeHtml,
    Logger,
    ColorScale,
    LinearScale,
    Selection,
    Text,
} = _ModuleSupport;

export interface MapLineNodeDataContext
    extends _ModuleSupport.SeriesNodeDataContext<MapLineNodeDatum, MapLineNodeLabelDatum> {}

export class MapLineSeries extends TopologySeries<
    MapLineNodeDatum,
    MapLineSeriesProperties,
    MapLineNodeLabelDatum,
    MapLineNodeDataContext
> {
    static readonly className = 'MapLineSeries';
    static readonly type = 'map-line' as const;

    scale: _ModuleSupport.MercatorScale | undefined;

    public topologyBounds: _ModuleSupport.LonLatBBox | undefined;

    override properties = new MapLineSeriesProperties();

    @Validate(GEOJSON_OBJECT, { optional: true, property: 'topology' })
    private _chartTopology?: _ModuleSupport.FeatureCollection = undefined;

    public override getNodeData(): MapLineNodeDatum[] | undefined {
        return this.contextNodeData?.nodeData;
    }

    private get topology() {
        return this.properties.topology ?? this._chartTopology;
    }

    override get hasData() {
        return super.hasData && this.topology != null;
    }

    private readonly colorScale = new ColorScale();
    private readonly sizeScale = new LinearScale();

    public datumSelection: _ModuleSupport.Selection<GeoGeometry, MapLineNodeDatum> = Selection.select(
        this.contentGroup,
        () => this.nodeFactory()
    );
    private labelSelection: _ModuleSupport.Selection<
        _ModuleSupport.Text,
        _ModuleSupport.PlacedLabel<_ModuleSupport.PointLabelDatum>
    > = Selection.select(this.labelGroup, Text);
    private highlightDatumSelection: _ModuleSupport.Selection<GeoGeometry, MapLineNodeDatum> = Selection.select(
        this.highlightNode,
        () => this.nodeFactory()
    );

    public contextNodeData?: MapLineNodeDataContext;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH, SeriesNodePickMode.NEAREST_NODE],
        });
    }

    override renderToOffscreenCanvas(): boolean {
        return true;
    }

    override setSeriesIndex(index: number): boolean {
        if (!super.setSeriesIndex(index)) return false;

        this.contentGroup.zIndex = [MapZIndexMap.ShapeLine, index];
        this.highlightGroup.zIndex = [MapZIndexMap.ShapeLineHighlight, index];

        return true;
    }

    setChartTopology(topology: any): void {
        this._chartTopology = topology;
        if (this.topology === topology) {
            this.nodeDataRefresh = true;
        }
    }

    private isLabelEnabled() {
        return this.properties.labelKey != null && this.properties.label.enabled;
    }

    private nodeFactory(): GeoGeometry {
        const geoGeometry = new GeoGeometry();
        geoGeometry.renderMode = GeoGeometryRenderMode.Lines;
        geoGeometry.lineJoin = 'round';
        geoGeometry.lineCap = 'round';
        return geoGeometry;
    }

    override async processData(dataController: _ModuleSupport.DataController) {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const { data, topology, sizeScale, colorScale } = this;
        const { topologyIdKey, idKey, sizeKey, colorKey, labelKey, sizeDomain, colorRange } = this.properties;

        const featureById = new Map<string, _ModuleSupport.Feature>();
        topology?.features.forEach((feature) => {
            const property = feature.properties?.[topologyIdKey];
            if (property == null || !containsType(feature.geometry, GeometryType.LineString)) return;
            featureById.set(property, feature);
        });

        const sizeScaleType = this.sizeScale.type;
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
                ...(labelKey != null ? [valueProperty(labelKey, 'band', { id: 'labelValue' })] : []),
                ...(sizeKey != null ? [valueProperty(sizeKey, sizeScaleType, { id: 'sizeValue' })] : []),
                ...(colorKey != null ? [valueProperty(colorKey, colorScaleType, { id: 'colorValue' })] : []),
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

        if (sizeKey != null) {
            const sizeIdx = dataModel.resolveProcessedDataIndexById(this, `sizeValue`);
            const processedSize = processedData.domain.values[sizeIdx] ?? [];
            sizeScale.domain = sizeDomain ?? processedSize;
        }

        if (colorRange != null && this.isColorScaleValid()) {
            const colorKeyIdx = dataModel.resolveProcessedDataIndexById(this, 'colorValue');
            colorScale.domain = processedData.domain.values[colorKeyIdx];
            colorScale.range = colorRange;
            colorScale.update();
        }

        if (topology == null) {
            Logger.warnOnce(`no topology was provided for [MapLineSeries]; nothing will be rendered.`);
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

    private getLabelDatum(
        datum: any,
        labelValue: string | undefined,
        projectedGeometry: _ModuleSupport.Geometry | undefined,
        font: string
    ): MapLineNodeLabelDatum | undefined {
        if (labelValue == null || projectedGeometry == null) return;

        const lineString = largestLineString(projectedGeometry);
        if (lineString == null) return;

        const { idKey, idName, sizeKey, sizeName, colorKey, colorName, labelKey, labelName, label } = this.properties;

        const labelText = this.getLabelText(label, {
            value: labelValue,
            datum,
            idKey,
            idName,
            sizeKey,
            sizeName,
            colorKey,
            colorName,
            labelKey,
            labelName,
        });
        if (labelText == null) return;

        const labelSize = CachedTextMeasurerPool.measureText(String(labelText), { font });
        const labelCenter = lineStringCenter(lineString);
        if (labelCenter == null) return;

        const [x, y] = labelCenter.point;
        const { width, height } = labelSize;

        return {
            point: { x, y, size: 0 },
            label: { width, height, text: labelText },
            marker: undefined,
            placement: undefined,
        };
    }

    override createNodeData() {
        const { id: seriesId, dataModel, processedData, sizeScale, colorScale, properties, scale } = this;
        const { idKey, sizeKey, colorKey, labelKey, label } = properties;

        if (dataModel == null || processedData == null || processedData.rawData.length === 0) return;

        const colorScaleValid = this.isColorScaleValid();

        const idValues = dataModel.resolveColumnById<string>(this, `idValue`, processedData);
        const featureValues = dataModel.resolveColumnById<_ModuleSupport.Feature | undefined>(
            this,
            `featureValue`,
            processedData
        );
        const labelValues =
            labelKey != null ? dataModel.resolveColumnById<string>(this, `labelValue`, processedData) : undefined;
        const sizeValues =
            sizeKey != null ? dataModel.resolveColumnById<number>(this, `sizeValue`, processedData) : undefined;
        const colorValues =
            colorKey != null ? dataModel.resolveColumnById<number>(this, `colorValue`, processedData) : undefined;

        const maxStrokeWidth = properties.maxStrokeWidth ?? properties.strokeWidth;
        sizeScale.range = [Math.min(properties.strokeWidth, maxStrokeWidth), maxStrokeWidth];
        const font = label.getFont();

        const projectedGeometries = new Map<string, _ModuleSupport.Geometry>();
        processedData.rawData.forEach((_datum, datumIndex) => {
            const id: string | undefined = idValues[datumIndex];
            const geometry: _ModuleSupport.Geometry | undefined = featureValues[datumIndex]?.geometry ?? undefined;
            const projectedGeometry = geometry != null && scale != null ? projectGeometry(geometry, scale) : undefined;
            if (id != null && projectedGeometry != null) {
                projectedGeometries.set(id, projectedGeometry);
            }
        });

        const nodeData: MapLineNodeDatum[] = [];
        const labelData: MapLineNodeLabelDatum[] = [];
        const missingGeometries: string[] = [];
        processedData.rawData.forEach((datum, datumIndex) => {
            const idValue = idValues[datumIndex];
            const colorValue = colorValues?.[datumIndex];
            const sizeValue = sizeValues?.[datumIndex];
            const labelValue = labelValues?.[datumIndex];

            const color: string | undefined =
                colorScaleValid && colorValue != null ? colorScale.convert(colorValue) : undefined;
            const size = sizeValue != null ? sizeScale.convert(sizeValue, true) : undefined;

            const projectedGeometry = projectedGeometries.get(idValue);
            if (projectedGeometry == null) {
                missingGeometries.push(idValue);
            }

            const labelDatum = this.getLabelDatum(datum, labelValue, projectedGeometry, font);
            if (labelDatum != null) {
                labelData.push(labelDatum);
            }

            nodeData.push({
                series: this,
                itemId: idKey,
                datum,
                stroke: color,
                strokeWidth: size,
                idValue,
                labelValue,
                colorValue,
                sizeValue,
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

        let highlightedDatum: MapLineNodeDatum | undefined = this.ctx.highlightManager?.getActiveHighlight() as any;
        if (highlightedDatum != null && (highlightedDatum.series !== this || highlightedDatum.datum == null)) {
            highlightedDatum = undefined;
        }

        const nodeData = this.contextNodeData?.nodeData ?? [];

        this.datumSelection = this.updateDatumSelection({ nodeData, datumSelection });
        this.updateDatumNodes({ datumSelection, isHighlight: false });

        this.labelSelection = this.updateLabelSelection({ labelSelection });
        this.updateLabelNodes({ labelSelection });

        this.highlightDatumSelection = this.updateDatumSelection({
            nodeData: highlightedDatum != null ? [highlightedDatum] : [],
            datumSelection: highlightDatumSelection,
        });
        this.updateDatumNodes({ datumSelection: highlightDatumSelection, isHighlight: true });
    }

    private updateDatumSelection(opts: {
        nodeData: MapLineNodeDatum[];
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapLineNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) => createDatumId(datum.idValue));
    }

    private updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapLineNodeDatum>;
        isHighlight: boolean;
    }) {
        const { id: seriesId, properties } = this;
        const { datumSelection, isHighlight } = opts;
        const { idKey, labelKey, sizeKey, colorKey, stroke, strokeOpacity, lineDash, lineDashOffset, itemStyler } =
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

            let format: AgMapLineSeriesStyle | undefined;
            if (itemStyler != null) {
                format = this.cachedDatumCallback(
                    createDatumId(datum.idValue, isHighlight ? 'highlight' : 'node'),
                    () =>
                        itemStyler({
                            seriesId,
                            datum: datum.datum,
                            idKey,
                            labelKey,
                            sizeKey,
                            colorKey,
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
            geoGeometry.stroke = highlightStyle?.stroke ?? format?.stroke ?? datum.stroke ?? stroke;
            geoGeometry.strokeWidth = Math.max(
                highlightStyle?.strokeWidth ?? 0,
                format?.strokeWidth ?? datum.strokeWidth ?? strokeWidth
            );
            geoGeometry.strokeOpacity = highlightStyle?.strokeOpacity ?? format?.strokeOpacity ?? strokeOpacity;
            geoGeometry.lineDash = highlightStyle?.lineDash ?? format?.lineDash ?? lineDash;
            geoGeometry.lineDashOffset = highlightStyle?.lineDashOffset ?? format?.lineDashOffset ?? lineDashOffset;
        });
    }

    private updateLabelSelection(opts: {
        labelSelection: _ModuleSupport.Selection<
            _ModuleSupport.Text,
            _ModuleSupport.PlacedLabel<_ModuleSupport.PointLabelDatum>
        >;
    }) {
        const placedLabels = (this.isLabelEnabled() ? this.chart?.placeLabels().get(this) : undefined) ?? [];
        return opts.labelSelection.update(placedLabels);
    }

    private updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<
            _ModuleSupport.Text,
            _ModuleSupport.PlacedLabel<_ModuleSupport.PointLabelDatum>
        >;
    }) {
        const { labelSelection } = opts;
        const { color: fill, fontStyle, fontWeight, fontSize, fontFamily } = this.properties.label;

        labelSelection.each((label, { x, y, width, height, text }) => {
            label.visible = true;
            label.x = x + width / 2;
            label.y = y + height / 2;
            label.text = text;
            label.fill = fill;
            label.fontStyle = fontStyle;
            label.fontWeight = fontWeight;
            label.fontSize = fontSize;
            label.fontFamily = fontFamily;
            label.textAlign = 'center';
            label.textBaseline = 'middle';
        });
    }

    resetAnimation() {
        // No animations
    }

    override getLabelData(): _ModuleSupport.PointLabelDatum[] {
        return this.contextNodeData?.labelData ?? [];
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

        const projectedGeometry = (datum as MapLineNodeDatum).projectedGeometry;
        const lineString = projectedGeometry != null ? largestLineString(projectedGeometry) : undefined;
        const center = lineString != null ? lineStringCenter(lineString)?.point : undefined;
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
            colorKey,
            colorName,
            colorRange,
            stroke,
            strokeWidth,
            strokeOpacity,
            lineDash,
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
                            fill: stroke,
                            fillOpacity: strokeOpacity,
                            stroke: undefined,
                            strokeWidth: 0,
                            strokeOpacity: 0,
                            enabled: false,
                        },
                        line: {
                            stroke,
                            strokeOpacity,
                            strokeWidth,
                            lineDash,
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

    override getTooltipHtml(nodeDatum: MapLineNodeDatum): _ModuleSupport.TooltipContent {
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
            sizeKey,
            sizeName,
            labelKey,
            labelName,
            itemStyler,
            tooltip,
            strokeOpacity,
            lineDash,
            lineDashOffset,
        } = properties;
        const { datum, stroke, idValue, colorValue, sizeValue, labelValue, itemId } = nodeDatum;

        const title = sanitizeHtml(properties.title ?? legendItemName) ?? '';
        const contentLines: string[] = [];
        contentLines.push(sanitizeHtml((idName != null ? `${idName}: ` : '') + idValue));
        if (colorValue != null) {
            contentLines.push(sanitizeHtml((colorName ?? colorKey) + ': ' + colorValue));
        }
        if (sizeValue != null) {
            contentLines.push(sanitizeHtml((sizeName ?? sizeKey) + ': ' + sizeValue));
        }
        if (labelValue != null && labelKey !== idKey) {
            contentLines.push(sanitizeHtml((labelName ?? labelKey) + ': ' + labelValue));
        }
        const content = contentLines.join('<br>');

        let format: AgMapLineSeriesStyle | undefined;

        if (itemStyler) {
            format = this.cachedDatumCallback(createDatumId(datum.idValue, 'tooltip'), () =>
                itemStyler({
                    highlighted: false,
                    seriesId,
                    datum,
                    idKey,
                    sizeKey,
                    colorKey,
                    labelKey,
                    stroke: stroke!,
                    strokeWidth: this.getStrokeWidth(nodeDatum.strokeWidth ?? properties.strokeWidth),
                    strokeOpacity,
                    lineDash,
                    lineDashOffset,
                })
            );
        }

        const color = format?.stroke ?? stroke ?? properties.stroke;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                datum,
                idKey,
                title,
                color,
                itemId,
                sizeKey,
                colorKey,
                colorName,
                idName,
                labelKey,
                labelName,
                sizeName,
                ...this.getModuleTooltipParams(),
            }
        );
    }

    protected override computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        const geometry = findFocusedGeoGeometry(this, opts);
        return geometry ? _ModuleSupport.Transformable.toCanvas(geometry) : undefined;
    }
}
