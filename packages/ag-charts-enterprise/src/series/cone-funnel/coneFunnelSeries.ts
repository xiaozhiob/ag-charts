import { _ModuleSupport } from 'ag-charts-community';

import {
    BaseFunnelSeries,
    type Bounds,
    type FunnelNodeDatum,
    type FunnelNodeLabelDatum,
    type FunnelSeriesShapeStyle,
} from '../funnel/baseFunnelSeries';
import { ConeFunnelProperties } from './coneFunnelProperties';
import { resetLineSelectionsFn } from './coneFunnelUtil';

const { formatValue, Line } = _ModuleSupport;

export class ConeFunnelSeries extends BaseFunnelSeries<_ModuleSupport.Line> {
    static readonly className = 'ConeFunnelSeries';
    static readonly type = 'cone-funnel' as const;

    override properties = new ConeFunnelProperties();

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            animationResetFns: {
                datum: resetLineSelectionsFn,
            },
        });
    }

    override get hasData() {
        return this.data != null && this.data.length > 1;
    }

    override getBandScalePadding() {
        return { inner: 1, outer: 0 };
    }

    protected override connectorEnabled() {
        return true;
    }

    protected override barStyle(): FunnelSeriesShapeStyle {
        return {
            fill: undefined,
            fillOpacity: 1,
            stroke: undefined,
            strokeOpacity: 1,
            strokeWidth: 0,
            lineDash: [],
            lineDashOffset: 0,
        };
    }

    protected override connectorStyle(): FunnelSeriesShapeStyle {
        const { fillOpacity, strokeOpacity, strokeWidth, lineDash, lineDashOffset } = this.properties;
        return {
            fill: undefined,
            fillOpacity,
            stroke: undefined,
            strokeOpacity,
            strokeWidth,
            lineDash,
            lineDashOffset,
        };
    }

    protected override nodeFactory(): _ModuleSupport.Line {
        return new Line();
    }

    protected override createLabelData({
        rect,
        barAlongX,
        yDatum,
        datum,
        visible,
    }: {
        rect: Bounds;
        barAlongX: boolean;
        yDatum: number;
        datum: any;
        visible: boolean;
    }): FunnelNodeLabelDatum | undefined {
        const { stageKey, valueKey, label } = this.properties;
        const { spacing, placement } = label;

        let x: number;
        let y: number;
        let textAlign: CanvasTextAlign;
        let textBaseline: CanvasTextBaseline;
        if (barAlongX) {
            x = rect.x + rect.width / 2;
            textAlign = 'center';

            switch (placement) {
                case 'before':
                    y = rect.y - spacing;
                    textBaseline = 'bottom';
                    break;
                case 'after':
                    y = rect.y + rect.height + spacing;
                    textBaseline = 'top';
                    break;
                default:
                    y = rect.y + rect.height / 2;
                    textBaseline = 'middle';
            }
        } else {
            y = rect.y + rect.height / 2;
            textBaseline = 'middle';

            switch (placement) {
                case 'before':
                    x = rect.x - spacing;
                    textAlign = 'right';
                    break;
                case 'after':
                    x = rect.x + rect.width + spacing;
                    textAlign = 'left';
                    break;
                default:
                    x = rect.x + rect.width / 2;
                    textAlign = 'center';
            }
        }

        return {
            x,
            y,
            textAlign,
            textBaseline,
            text: this.getLabelText(label, { itemId: valueKey, value: yDatum, datum, stageKey, valueKey }, (value) =>
                formatValue(value, 0)
            ),
            itemId: valueKey,
            datum,
            series: this,
            visible,
        };
    }

    protected override updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Line, FunnelNodeDatum>;
        isHighlight: boolean;
    }) {
        const highlightStyle = opts.isHighlight ? this.properties.highlightStyle.item : undefined;

        opts.datumSelection.each((line, datum) => {
            line.setProperties(resetLineSelectionsFn(line, datum));
            line.stroke = highlightStyle?.stroke;
            line.strokeWidth = highlightStyle?.strokeWidth ?? 0;
            line.strokeOpacity = highlightStyle?.strokeOpacity ?? 1;
            line.lineDash = highlightStyle?.lineDash;
            line.lineDashOffset = highlightStyle?.lineDashOffset ?? 0;
        });
    }
}
