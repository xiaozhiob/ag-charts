import { _ModuleSupport } from 'ag-charts-community';

import { GeoGeometry, GeoGeometryRenderMode } from '../map-util/geoGeometry';
import { geometryBbox, projectGeometry } from '../map-util/geometryUtil';
import { MapZIndexMap } from '../map-util/mapZIndexMap';
import { TopologySeries } from '../map-util/topologySeries';
import { GEOJSON_OBJECT } from '../map-util/validation';
import {
    type MapShapeBackgroundNodeDatum,
    MapShapeBackgroundSeriesProperties,
} from './mapShapeBackgroundSeriesProperties';

const { createDatumId, SeriesNodePickMode, Validate, Logger, Selection, Group, PointerEvents } = _ModuleSupport;

export interface MapShapeBackgroundNodeDataContext
    extends _ModuleSupport.SeriesNodeDataContext<MapShapeBackgroundNodeDatum> {}

export class MapShapeBackgroundSeries
    extends TopologySeries<
        MapShapeBackgroundNodeDatum,
        MapShapeBackgroundSeriesProperties,
        MapShapeBackgroundNodeDatum,
        MapShapeBackgroundNodeDataContext
    >
    implements _ModuleSupport.ITopology
{
    static readonly className = 'MapShapeBackgroundSeries';
    static readonly type = 'map-shape-background' as const;

    scale: _ModuleSupport.MercatorScale | undefined;

    public topologyBounds: _ModuleSupport.LonLatBBox | undefined;

    override properties = new MapShapeBackgroundSeriesProperties();

    @Validate(GEOJSON_OBJECT, { optional: true, property: 'topology' })
    private _chartTopology?: _ModuleSupport.FeatureCollection = undefined;

    private get topology() {
        return this.properties.topology ?? this._chartTopology;
    }

    override setOptionsData() {
        // Ignore data
    }

    override setChartData() {
        // Ignore data
    }

    public override getNodeData(): MapShapeBackgroundNodeDatum[] | undefined {
        return;
    }

    override get hasData() {
        return false;
    }

    private readonly itemGroup = this.contentGroup.appendChild(new Group({ name: 'itemGroup' }));

    private datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeBackgroundNodeDatum> = Selection.select(
        this.itemGroup,
        () => this.nodeFactory()
    );

    private contextNodeData?: MapShapeBackgroundNodeDataContext;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH],
        });
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

        this.contentGroup.zIndex = [MapZIndexMap.ShapeLineBackground, index, 0];
        this.highlightGroup.zIndex = [MapZIndexMap.ShapeLineBackground, index, 1];

        return true;
    }

    private nodeFactory(): GeoGeometry {
        const geoGeometry = new GeoGeometry();
        geoGeometry.renderMode = GeoGeometryRenderMode.Polygons;
        geoGeometry.lineJoin = 'round';
        geoGeometry.pointerEvents = PointerEvents.None;
        return geoGeometry;
    }

    override processData() {
        const { topology } = this;

        this.topologyBounds = topology?.features.reduce<_ModuleSupport.LonLatBBox | undefined>((current, feature) => {
            const geometry = feature.geometry;
            if (geometry == null) return current;
            return geometryBbox(geometry, current);
        }, undefined);

        if (topology == null) {
            Logger.warnOnce(`no topology was provided for [MapShapeBackgroundSeries]; nothing will be rendered.`);
        }
    }

    override createNodeData() {
        const { id: seriesId, topology, scale } = this;

        if (topology == null) return;

        const nodeData: MapShapeBackgroundNodeDatum[] = [];
        const labelData: never[] = [];
        topology.features.forEach((feature, index) => {
            const { geometry } = feature;
            const projectedGeometry = geometry != null && scale != null ? projectGeometry(geometry, scale) : undefined;

            if (projectedGeometry == null) return;

            nodeData.push({
                series: this,
                itemId: index,
                datum: feature,
                index,
                projectedGeometry,
            });
        });

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
        const { datumSelection } = this;

        this.updateSelections();

        this.contentGroup.visible = this.visible;

        const { nodeData = [] } = this.contextNodeData ?? {};

        this.datumSelection = this.updateDatumSelection({ nodeData, datumSelection });
        this.updateDatumNodes({ datumSelection });
    }

    private updateDatumSelection(opts: {
        nodeData: MapShapeBackgroundNodeDatum[];
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeBackgroundNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) => createDatumId(datum.index));
    }

    private updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeBackgroundNodeDatum>;
    }) {
        const { properties } = this;
        const { datumSelection } = opts;
        const { fill, fillOpacity, stroke, strokeOpacity, lineDash, lineDashOffset } = properties;
        const strokeWidth = this.getStrokeWidth(properties.strokeWidth);

        datumSelection.each((geoGeometry, datum) => {
            const { projectedGeometry } = datum;
            if (projectedGeometry == null) {
                geoGeometry.visible = false;
                geoGeometry.projectedGeometry = undefined;
                return;
            }

            geoGeometry.visible = true;
            geoGeometry.projectedGeometry = projectedGeometry;
            geoGeometry.fill = fill;
            geoGeometry.fillOpacity = fillOpacity;
            geoGeometry.stroke = stroke;
            geoGeometry.strokeWidth = strokeWidth;
            geoGeometry.strokeOpacity = strokeOpacity;
            geoGeometry.lineDash = lineDash;
            geoGeometry.lineDashOffset = lineDashOffset;
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

    override getLegendData() {
        return [];
    }

    override getTooltipHtml(): _ModuleSupport.TooltipContent {
        return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
    }

    public override pickFocus() {
        return undefined;
    }

    protected override computeFocusBounds(_opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        return undefined;
    }
}
