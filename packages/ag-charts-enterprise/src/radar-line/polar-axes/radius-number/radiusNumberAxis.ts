import { _ModuleSupport, _Scale, _Scene, _Util, AgAxisCaptionFormatterParams } from 'ag-charts-community';

const { ChartAxisDirection, Layers } = _ModuleSupport;
const { LinearScale } = _Scale;
const { Arc, Caption, Group, Path, Selection } = _Scene;

export class RadiusNumberAxis extends _ModuleSupport.PolarAxis {
    static className = 'RadiusNumberAxis';
    static type = 'polar-radius-number' as const;

    gridShape: 'polygon' | 'circle' = 'polygon';

    protected readonly gridArcGroup = this.gridGroup.appendChild(
        new Group({
            name: `${this.id}-gridArcs`,
            zIndex: Layers.AXIS_GRID_ZINDEX,
        })
    );

    protected readonly gridPolygonGroup = this.gridGroup.appendChild(
        new Group({
            name: `${this.id}-gridPolygons`,
            zIndex: Layers.AXIS_GRID_ZINDEX,
        })
    );
    protected gridArcGroupSelection = Selection.select(this.gridArcGroup, Arc);
    protected gridPolygonGroupSelection = Selection.select(this.gridPolygonGroup, Path);

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super(moduleCtx, new LinearScale());
    }

    get direction() {
        return ChartAxisDirection.Y;
    }

    update(primaryTickCount?: number) {
        primaryTickCount = super.update(primaryTickCount);
        this.updateGridArcs();
        return primaryTickCount;
    }

    private updateGridArcs() {
        const { scale, gridStyle, tick, gridShape } = this;
        if (!gridStyle) {
            return;
        }

        const maxRadius = scale.range[0];
        const ticks = scale.ticks?.() || [];
        ticks.sort((a, b) => b - a); // Apply grid styles starting from the largest arc
        this.gridArcGroup.translationY = maxRadius;
        this.gridPolygonGroup.translationY = maxRadius;

        const setStyle = (node: _Scene.Path | _Scene.Arc, index: number) => {
            const style = gridStyle[index % gridStyle.length];
            node.stroke = style.stroke;
            node.strokeWidth = tick.width;
            node.lineDash = style.lineDash;
            node.fill = undefined;
        };

        this.gridArcGroupSelection.update(gridShape === 'circle' ? ticks : []).each((node, value, index) => {
            setStyle(node, index);

            node.centerX = 0;
            node.centerY = 0;
            node.radius = scale.convert(value);
            node.startAngle = 0;
            node.endAngle = 2 * Math.PI;
        });

        this.gridPolygonGroupSelection.update(gridShape === 'polygon' ? ticks : []).each((node, value, index) => {
            setStyle(node, index);

            const { path } = node;
            const angles = this.gridAngles;
            path.clear({ trackChanges: true });
            if (!angles || angles.length < 3) {
                return;
            }

            const radius = scale.convert(value);
            angles.forEach((angle, i) => {
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                if (i === 0) {
                    path.moveTo(x, y);
                } else {
                    path.lineTo(x, y);
                }
            });
            path.closePath();
        });
    }

    protected updateTitle() {
        const identityFormatter = (params: AgAxisCaptionFormatterParams) => params.defaultValue;
        const {
            title,
            _titleCaption,
            lineNode,
            range: requestedRange,
            moduleCtx: { callbackCache },
        } = this;
        const { formatter = identityFormatter } = this.title ?? {};

        if (!title) {
            _titleCaption.enabled = false;
            return;
        }

        _titleCaption.enabled = title.enabled;
        _titleCaption.fontFamily = title.fontFamily;
        _titleCaption.fontSize = title.fontSize;
        _titleCaption.fontStyle = title.fontStyle;
        _titleCaption.fontWeight = title.fontWeight;
        _titleCaption.color = title.color;
        _titleCaption.wrapping = title.wrapping;

        let titleVisible = false;
        const titleNode = _titleCaption.node;
        if (title.enabled && lineNode.visible) {
            titleVisible = true;

            titleNode.rotation = Math.PI / 2;
            titleNode.x = Math.floor((requestedRange[0] + requestedRange[1]) / 2);
            titleNode.y = -Caption.PADDING;
            titleNode.textAlign = 'center';
            titleNode.textBaseline = 'bottom';

            titleNode.text = callbackCache.call(formatter, this.getTitleFormatterParams());
        }

        titleNode.visible = titleVisible;
    }
}
