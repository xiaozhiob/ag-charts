import { type AgMapShapeSeriesStyle, _ModuleSupport } from 'ag-charts-community';

import { extendBbox } from '../map-util/bboxUtil';
import { geometryBbox, projectGeometry } from '../map-util/geometryUtil';
import { prepareMapMarkerAnimationFunctions } from '../map-util/mapUtil';
import { MapZIndexMap } from '../map-util/mapZIndexMap';
import { markerPositions } from '../map-util/markerUtil';
import { TopologySeries } from '../map-util/topologySeries';
import { GEOJSON_OBJECT } from '../map-util/validation';
import {
    type MapMarkerNodeDatum,
    type MapMarkerNodeLabelDatum,
    MapMarkerSeriesProperties,
} from './mapMarkerSeriesProperties';

const {
    CachedTextMeasurerPool,
    Validate,
    fromToMotion,
    StateMachine,
    getMissCount,
    createDatumId,
    SeriesNodePickMode,
    valueProperty,
    computeMarkerFocusBounds,
    sanitizeHtml,
    Logger,
    ColorScale,
    LinearScale,
    Group,
    Selection,
    Text,
    getMarker,
} = _ModuleSupport;

export interface MapMarkerNodeDataContext
    extends _ModuleSupport.SeriesNodeDataContext<MapMarkerNodeDatum, MapMarkerNodeLabelDatum> {}

type MapMarkerAnimationState = 'empty' | 'ready' | 'waiting' | 'clearing';
type MapMarkerAnimationEvent = {
    update: undefined;
    updateData: undefined;
    highlight: undefined;
    resize: undefined;
    clear: undefined;
    reset: undefined;
    skip: undefined;
};

export class MapMarkerSeries
    extends TopologySeries<
        MapMarkerNodeDatum,
        MapMarkerSeriesProperties,
        MapMarkerNodeLabelDatum,
        MapMarkerNodeDataContext
    >
    implements _ModuleSupport.ITopology
{
    static readonly className = 'MapMarkerSeries';
    static readonly type = 'map-marker' as const;

    scale: _ModuleSupport.MercatorScale | undefined;

    public topologyBounds: _ModuleSupport.LonLatBBox | undefined;

    override properties = new MapMarkerSeriesProperties();

    @Validate(GEOJSON_OBJECT, { optional: true, property: 'topology' })
    private _chartTopology?: _ModuleSupport.FeatureCollection = undefined;

    public override getNodeData(): MapMarkerNodeDatum[] | undefined {
        return this.contextNodeData?.nodeData;
    }

    private get topology() {
        return this.properties.topology ?? this._chartTopology;
    }

    override get hasData() {
        const hasLatLon = this.properties.latitudeKey != null && this.properties.longitudeKey != null;
        return super.hasData && (this.topology != null || hasLatLon);
    }

    private readonly colorScale = new ColorScale();
    private readonly sizeScale = new LinearScale();

    private readonly markerGroup = this.contentGroup.appendChild(new Group({ name: 'markerGroup' }));

    private labelSelection: _ModuleSupport.Selection<
        _ModuleSupport.Text,
        _ModuleSupport.PlacedLabel<_ModuleSupport.PointLabelDatum>
    > = Selection.select(this.labelGroup, Text, false);
    private markerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, MapMarkerNodeDatum> = Selection.select(
        this.markerGroup,
        () => this.markerFactory(),
        false
    );
    private highlightMarkerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, MapMarkerNodeDatum> =
        Selection.select(this.highlightNode, () => this.markerFactory());

    private contextNodeData?: MapMarkerNodeDataContext;

    private readonly animationState: _ModuleSupport.StateMachine<MapMarkerAnimationState, MapMarkerAnimationEvent>;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH, SeriesNodePickMode.NEAREST_NODE],
        });

        this.animationState = new StateMachine<MapMarkerAnimationState, MapMarkerAnimationEvent>(
            'empty',
            {
                empty: {
                    update: {
                        target: 'ready',
                        action: () => this.animateMarkers(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                ready: {
                    updateData: 'waiting',
                    clear: 'clearing',
                    resize: () => this.resetAllAnimation(),
                    reset: 'empty',
                    skip: 'ready',
                },
                waiting: {
                    update: {
                        target: 'ready',
                        action: () => this.animateMarkers(),
                    },
                    // chart.ts transitions to updateData on zoom change
                    resize: {
                        target: 'ready',
                        action: () => this.resetAllAnimation(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                clearing: {
                    update: {
                        target: 'empty',
                        action: () => this.resetAllAnimation(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
            },
            () => this.checkProcessedDataAnimatable()
        );
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

        this.contentGroup.zIndex = [MapZIndexMap.Marker, index];
        this.highlightGroup.zIndex = [MapZIndexMap.MarkerHighlight, index];

        return true;
    }

    private isLabelEnabled() {
        return this.properties.labelKey != null && this.properties.label.enabled;
    }

    private markerFactory(): _ModuleSupport.Marker {
        const { shape } = this.properties;
        const MarkerShape = getMarker(shape);
        return new MarkerShape();
    }

    override async processData(dataController: _ModuleSupport.DataController): Promise<void> {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const { data, topology, sizeScale, colorScale } = this;
        const { topologyIdKey, idKey, latitudeKey, longitudeKey, sizeKey, colorKey, labelKey, sizeDomain, colorRange } =
            this.properties;

        const featureById = new Map<string, _ModuleSupport.Feature>();
        topology?.features.forEach((feature) => {
            const property = feature.properties?.[topologyIdKey];
            if (property == null) return;
            featureById.set(property, feature);
        });

        const sizeScaleType = this.sizeScale.type;
        const colorScaleType = this.colorScale.type;
        const mercatorScaleType = this.scale?.type;

        const hasLatLon = latitudeKey != null && longitudeKey != null;
        const { dataModel, processedData } = await this.requestDataModel<any, any, true>(dataController, data, {
            props: [
                ...(idKey != null
                    ? [
                          valueProperty(idKey, mercatorScaleType, { id: 'idValue', includeProperty: false }),
                          valueProperty(idKey, mercatorScaleType, {
                              id: 'featureValue',
                              includeProperty: false,
                              processor: () => (datum) => featureById.get(datum),
                          }),
                      ]
                    : []),
                ...(hasLatLon
                    ? [
                          valueProperty(latitudeKey, mercatorScaleType, { id: 'latValue' }),
                          valueProperty(longitudeKey, mercatorScaleType, { id: 'lonValue' }),
                      ]
                    : []),
                ...(labelKey ? [valueProperty(labelKey, 'band', { id: 'labelValue' })] : []),
                ...(sizeKey ? [valueProperty(sizeKey, sizeScaleType, { id: 'sizeValue' })] : []),
                ...(colorKey ? [valueProperty(colorKey, colorScaleType, { id: 'colorValue' })] : []),
            ],
        });

        const hasData = processedData.rawData.length !== 0;
        const featureValues =
            hasData && idKey != null
                ? dataModel.resolveColumnById<_ModuleSupport.Feature | undefined>(this, `featureValue`, processedData)
                : undefined;
        const latValues =
            hasData && hasLatLon ? dataModel.resolveColumnById<number>(this, `latValue`, processedData) : undefined;
        const lonValues =
            hasData && hasLatLon ? dataModel.resolveColumnById<number>(this, `lonValue`, processedData) : undefined;
        this.topologyBounds = processedData.rawData.reduce<_ModuleSupport.LonLatBBox | undefined>(
            (current, _datum, datumIndex) => {
                const feature: _ModuleSupport.Feature | undefined = featureValues?.[datumIndex];
                const geometry = feature?.geometry;
                if (geometry != null) {
                    current = geometryBbox(geometry, current);
                }
                if (latValues != null && lonValues != null) {
                    const lon = lonValues[datumIndex];
                    const lat = latValues[datumIndex];
                    current = extendBbox(current, lon, lat, lon, lat);
                }
                return current;
            },
            undefined
        );

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

        this.animationState.transition('updateData');
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
        x: number,
        y: number,
        size: number,
        font: string
    ): MapMarkerNodeLabelDatum | undefined {
        if (labelValue == null) return;

        const {
            idKey,
            idName,
            latitudeKey,
            latitudeName,
            longitudeKey,
            longitudeName,
            sizeKey,
            sizeName,
            colorKey,
            colorName,
            labelKey,
            labelName,
            label,
        } = this.properties;
        const { placement } = label;
        const labelText = this.getLabelText(label, {
            value: labelValue,
            datum,
            idKey,
            idName,
            latitudeKey,
            latitudeName,
            longitudeKey,
            longitudeName,
            sizeKey,
            sizeName,
            colorKey,
            colorName,
            labelKey,
            labelName,
        });
        if (labelText == null) return;

        const { width, height } = CachedTextMeasurerPool.measureText(String(labelText), { font });

        return {
            point: { x, y, size },
            label: { width, height, text: labelText },
            marker: getMarker(this.properties.shape),
            placement,
        };
    }

    override createNodeData() {
        const { id: seriesId, dataModel, processedData, colorScale, sizeScale, properties, scale } = this;
        const { idKey, latitudeKey, longitudeKey, sizeKey, colorKey, labelKey, label } = properties;

        if (dataModel == null || processedData == null || processedData.rawData.length === 0 || scale == null) return;

        const colorScaleValid = this.isColorScaleValid();

        const hasLatLon = latitudeKey != null && longitudeKey != null;

        const idValues =
            idKey != null ? dataModel.resolveColumnById<string>(this, `idValue`, processedData) : undefined;
        const featureValues =
            idKey != null
                ? dataModel.resolveColumnById<_ModuleSupport.Feature | undefined>(this, `featureValue`, processedData)
                : undefined;
        const latValues = hasLatLon ? dataModel.resolveColumnById<number>(this, `latValue`, processedData) : undefined;
        const lonValues = hasLatLon ? dataModel.resolveColumnById<number>(this, `lonValue`, processedData) : undefined;
        const labelValues =
            labelKey != null ? dataModel.resolveColumnById<string>(this, `labelValue`, processedData) : undefined;
        const sizeValues =
            sizeKey != null ? dataModel.resolveColumnById<number>(this, `sizeValue`, processedData) : undefined;
        const colorValues =
            colorKey != null ? dataModel.resolveColumnById<number>(this, `colorValue`, processedData) : undefined;

        const markerMaxSize = properties.maxSize ?? properties.size;
        sizeScale.range = [Math.min(properties.size, markerMaxSize), markerMaxSize];
        const font = label.getFont();

        let projectedGeometries: Map<string, _ModuleSupport.Geometry> | undefined;
        if (idValues != null && featureValues != null) {
            projectedGeometries = new Map<string, _ModuleSupport.Geometry>();
            processedData.rawData.forEach((_datum, datumIndex) => {
                const id: string | undefined = idValues[datumIndex];
                const geometry: _ModuleSupport.Geometry | undefined = featureValues[datumIndex]?.geometry ?? undefined;
                const projectedGeometry =
                    geometry != null && scale != null ? projectGeometry(geometry, scale) : undefined;
                if (id != null && projectedGeometry != null) {
                    projectedGeometries!.set(id, projectedGeometry);
                }
            });
        }

        const nodeData: MapMarkerNodeDatum[] = [];
        const labelData: MapMarkerNodeLabelDatum[] = [];
        const missingGeometries: string[] = [];
        processedData.rawData.forEach((datum, datumIndex) => {
            const idValue = idValues?.[datumIndex];
            const lonValue = lonValues?.[datumIndex];
            const latValue = latValues?.[datumIndex];
            const colorValue = colorValues?.[datumIndex];
            const sizeValue = sizeValues?.[datumIndex];
            const labelValue = labelValues?.[datumIndex];

            const color = colorScaleValid && colorValue != null ? colorScale.convert(colorValue) : undefined;
            const size = sizeValue != null ? sizeScale.convert(sizeValue, true) : properties.size;

            const projectedGeometry = idValue != null ? projectedGeometries?.get(idValue) : undefined;
            if (idValue != null && projectGeometry == null) {
                missingGeometries.push(idValue);
            }

            if (lonValue != null && latValue != null) {
                const [x, y] = scale.convert([lonValue, latValue]);

                const labelDatum = this.getLabelDatum(datum, labelValue, x, y, size, font);
                if (labelDatum) {
                    labelData.push(labelDatum);
                }

                nodeData.push({
                    series: this,
                    itemId: latitudeKey,
                    datum,
                    index: -1,
                    fill: color,
                    idValue,
                    lonValue,
                    latValue,
                    labelValue,
                    sizeValue,
                    colorValue,
                    point: { x, y, size },
                    midPoint: { x, y },
                });
            } else if (projectedGeometry != null) {
                markerPositions(projectedGeometry, 1).forEach(([x, y], index) => {
                    const labelDatum = this.getLabelDatum(datum, labelValue, x, y, size, font);
                    if (labelDatum) {
                        labelData.push(labelDatum);
                    }

                    nodeData.push({
                        series: this,
                        itemId: latitudeKey,
                        datum,
                        index,
                        fill: color,
                        idValue,
                        lonValue,
                        latValue,
                        labelValue,
                        sizeValue,
                        colorValue,
                        point: { x, y, size },
                        midPoint: { x, y },
                    });
                });
            }
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

    private previousScale: _ModuleSupport.MercatorScale | undefined;
    private checkScaleChange() {
        if (this.previousScale === this.scale) return false;
        this.previousScale = this.scale;
        return true;
    }

    override update({ seriesRect }: { seriesRect?: _ModuleSupport.BBox }) {
        const resize = this.checkResize(seriesRect);
        const scaleChange = this.checkScaleChange();

        const { labelSelection, markerSelection, highlightMarkerSelection } = this;

        this.updateSelections();

        this.contentGroup.visible = this.visible;
        this.contentGroup.opacity = this.getOpacity();

        let highlightedDatum: MapMarkerNodeDatum | undefined = this.ctx.highlightManager?.getActiveHighlight() as any;
        if (highlightedDatum != null && (highlightedDatum.series !== this || highlightedDatum.datum == null)) {
            highlightedDatum = undefined;
        }

        const nodeData = this.contextNodeData?.nodeData ?? [];

        this.labelSelection = this.updateLabelSelection({ labelSelection });
        this.updateLabelNodes({ labelSelection });

        this.markerSelection = this.updateMarkerSelection({ markerData: nodeData, markerSelection });
        this.updateMarkerNodes({ markerSelection, isHighlight: false, highlightedDatum });

        this.highlightMarkerSelection = this.updateMarkerSelection({
            markerData: highlightedDatum != null ? [highlightedDatum] : [],
            markerSelection: highlightMarkerSelection,
        });
        this.updateMarkerNodes({
            markerSelection: highlightMarkerSelection,
            isHighlight: true,
            highlightedDatum,
        });

        if (scaleChange || resize) {
            this.animationState.transition('resize');
        }
        this.animationState.transition('update');
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

    private updateMarkerSelection(opts: {
        markerData: MapMarkerNodeDatum[];
        markerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, MapMarkerNodeDatum>;
    }) {
        const { markerData, markerSelection } = opts;

        return markerSelection.update(markerData, undefined, (datum) =>
            createDatumId([datum.index, datum.idValue, datum.lonValue, datum.latValue])
        );
    }

    private updateMarkerNodes(opts: {
        markerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, MapMarkerNodeDatum>;
        isHighlight: boolean;
        highlightedDatum: MapMarkerNodeDatum | undefined;
    }) {
        const { properties } = this;
        const { markerSelection, isHighlight, highlightedDatum } = opts;
        const { fill, fillOpacity, stroke, strokeOpacity } = properties;
        const highlightStyle = isHighlight ? properties.highlightStyle.item : undefined;
        const strokeWidth = this.getStrokeWidth(properties.strokeWidth);

        markerSelection.each((marker, markerDatum) => {
            const { datum, point } = markerDatum;
            const format = this.getMapMarkerStyle(markerDatum, isHighlight);
            marker.size = format?.size ?? point.size;
            marker.fill = highlightStyle?.fill ?? format?.fill ?? markerDatum.fill ?? fill;
            marker.fillOpacity = highlightStyle?.fillOpacity ?? format?.fillOpacity ?? fillOpacity;
            marker.stroke = highlightStyle?.stroke ?? format?.stroke ?? stroke;
            marker.strokeWidth = highlightStyle?.strokeWidth ?? format?.strokeWidth ?? strokeWidth;
            marker.strokeOpacity = highlightStyle?.strokeOpacity ?? format?.strokeOpacity ?? strokeOpacity;
            marker.translationX = point.x;
            marker.translationY = point.y;
            marker.zIndex = !isHighlight && highlightedDatum != null && datum === highlightedDatum.datum ? 1 : 0;
        });
    }

    override isProcessedDataAnimatable() {
        return true;
    }

    override resetAnimation(phase: _ModuleSupport.ChartAnimationPhase): void {
        if (phase === 'initial') {
            this.animationState.transition('reset');
        } else if (phase === 'ready') {
            this.animationState.transition('skip');
        }
    }

    private resetAllAnimation() {
        // Stop any running animations by prefix convention.
        this.ctx.animationManager.stopByAnimationGroupId(this.id);
        this.ctx.animationManager.skipCurrentBatch();

        this.labelSelection.cleanup();
        this.markerSelection.cleanup();
        this.highlightMarkerSelection.cleanup();
    }

    private animateMarkers() {
        const { animationManager } = this.ctx;
        const fns = prepareMapMarkerAnimationFunctions();
        fromToMotion(this.id, 'markers', animationManager, [this.markerSelection, this.highlightMarkerSelection], fns);
    }

    override getLabelData(): _ModuleSupport.PointLabelDatum[] {
        return this.contextNodeData?.labelData ?? [];
    }

    override getSeriesDomain() {
        return [NaN, NaN];
    }

    override pickNodeClosestDatum(p: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined {
        const { x: x0, y: y0 } = p;

        let minDistanceSquared = Infinity;
        let minDatum: _ModuleSupport.SeriesNodeDatum | undefined;

        this.contextNodeData?.nodeData.forEach((datum) => {
            const { x, y, size } = datum.point;
            const dx = Math.max(Math.abs(x - x0) - size, 0);
            const dy = Math.max(Math.abs(y - y0) - size, 0);
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < minDistanceSquared) {
                minDistanceSquared = distanceSquared;
                minDatum = datum;
            }
        });

        return minDatum != null ? { datum: minDatum, distance: Math.sqrt(minDistanceSquared) } : undefined;
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
            idName,
            idKey,
            colorKey,
            colorName,
            colorRange,
            shape,
            fill,
            stroke,
            fillOpacity,
            strokeOpacity,
            strokeWidth,
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
                label: { text: legendItemName ?? title ?? idName ?? idKey ?? seriesId },
                symbols: [
                    {
                        marker: {
                            shape,
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

    override getTooltipHtml(nodeDatum: MapMarkerNodeDatum): _ModuleSupport.TooltipContent {
        const { id: seriesId, processedData, properties } = this;

        if (!processedData || !this.properties.isValid()) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const {
            legendItemName,
            idKey,
            idName,
            latitudeKey,
            longitudeKey,
            sizeKey,
            sizeName,
            colorKey,
            colorName,
            labelKey,
            labelName,
            itemStyler,
            tooltip,
            latitudeName,
            longitudeName,
            shape,
            size,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
        } = properties;
        const { datum, fill, idValue, latValue, lonValue, sizeValue, colorValue, labelValue, itemId } = nodeDatum;

        const title = sanitizeHtml(properties.title ?? legendItemName) ?? '';
        const contentLines: string[] = [];
        if (idValue != null) {
            contentLines.push(sanitizeHtml((idName != null ? `${idName}: ` : '') + idValue));
        }
        if (colorValue != null) {
            contentLines.push(sanitizeHtml((colorName ?? colorKey) + ': ' + colorValue));
        }
        if (sizeValue != null) {
            contentLines.push(sanitizeHtml((sizeName ?? sizeKey) + ': ' + sizeValue));
        }
        if (labelValue != null && (idKey == null || idKey !== labelKey)) {
            contentLines.push(sanitizeHtml((labelName ?? labelKey) + ': ' + labelValue));
        }
        if (latValue != null && lonValue != null) {
            contentLines.push(
                sanitizeHtml(
                    `${Math.abs(latValue).toFixed(4)}\u00B0 ${latValue >= 0 ? 'N' : 'S'}, ${Math.abs(lonValue).toFixed(4)}\u00B0 ${latValue >= 0 ? 'W' : 'E'}`
                )
            );
        }
        const content = contentLines.join('<br>');

        let format: AgMapShapeSeriesStyle | undefined;

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
                    latitudeKey,
                    longitudeKey,
                    shape,
                    size,
                    fill: fill!,
                    fillOpacity,
                    stroke: stroke!,
                    strokeWidth,
                    strokeOpacity,
                })
            );
        }

        const color = format?.fill ?? fill ?? properties.fill;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                datum,
                idKey,
                latitudeKey,
                longitudeKey,
                title,
                color,
                colorKey,
                colorName,
                idName,
                itemId,
                labelKey,
                labelName,
                latitudeName,
                longitudeName,
                sizeKey,
                sizeName,
                ...this.getModuleTooltipParams(),
            }
        );
    }

    public getMapMarkerStyle(markerDatum: MapMarkerNodeDatum, highlighted: boolean) {
        const { id: seriesId, properties } = this;
        const { datum, point } = markerDatum;
        const {
            idKey,
            latitudeKey,
            longitudeKey,
            labelKey,
            sizeKey,
            colorKey,
            fill,
            fillOpacity,
            stroke,
            strokeOpacity,
            shape,
            itemStyler,
        } = properties;
        const strokeWidth = this.getStrokeWidth(properties.strokeWidth);
        if (itemStyler !== undefined) {
            return this.cachedDatumCallback(createDatumId(datum.idValue, highlighted ? 'highlight' : 'node'), () =>
                itemStyler({
                    seriesId,
                    datum,
                    size: point.size,
                    idKey,
                    latitudeKey,
                    longitudeKey,
                    labelKey,
                    sizeKey,
                    colorKey,
                    fill: fill!,
                    fillOpacity,
                    stroke: stroke!,
                    strokeWidth,
                    strokeOpacity,
                    shape,
                    highlighted,
                })
            );
        }
    }

    public getFormattedMarkerStyle(markerDatum: MapMarkerNodeDatum) {
        const style = this.getMapMarkerStyle(markerDatum, true);
        return { size: style?.size ?? markerDatum.point.size };
    }

    protected override computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        return computeMarkerFocusBounds(this, opts);
    }
}
