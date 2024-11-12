import type { AgCandlestickSeriesItemOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import type { CandlestickNodeDatum } from './candlestickTypes';

enum GroupTags {
    Body,
    LowWick,
    HighWick,
}

const { Logger } = _ModuleSupport;
const { SceneChangeDetection, BBox } = _ModuleSupport;

export abstract class CandlestickBaseGroup<TNodeDatum, TStyles>
    extends _ModuleSupport.Group
    implements _ModuleSupport.QuadtreeCompatibleNode
{
    abstract updateDatumStyles(datum: TNodeDatum, activeStyles: TStyles): void;
    abstract updateCoordinates(): void;

    @SceneChangeDetection()
    x: number = 0;

    @SceneChangeDetection()
    y: number = 0;

    @SceneChangeDetection()
    yBottom: number = 0;

    @SceneChangeDetection()
    yHigh: number = 0;

    @SceneChangeDetection()
    yLow: number = 0;

    @SceneChangeDetection()
    width: number = 0;

    @SceneChangeDetection()
    height: number = 0;

    distanceSquared(x: number, y: number): number {
        const nodes = _ModuleSupport.Selection.selectByClass<_ModuleSupport.Rect | _ModuleSupport.Line>(
            this,
            _ModuleSupport.Rect,
            _ModuleSupport.Line
        );
        return _ModuleSupport.nearestSquared(x, y, nodes).distanceSquared;
    }

    get midPoint(): { x: number; y: number } {
        const datum: { midPoint?: { readonly x: number; readonly y: number } } = this.datum;
        if (datum.midPoint === undefined) {
            Logger.error('CandlestickBaseGroup.datum.midPoint is undefined');
            return { x: NaN, y: NaN };
        }
        return datum.midPoint;
    }

    override preRender(): _ModuleSupport.ChildNodeCounts {
        this.updateCoordinates();
        return super.preRender();
    }
}

export class CandlestickGroup extends CandlestickBaseGroup<CandlestickNodeDatum, AgCandlestickSeriesItemOptions> {
    constructor() {
        super();
        this.append([
            new _ModuleSupport.Rect({ tag: GroupTags.Body }),
            new _ModuleSupport.Line({ tag: GroupTags.LowWick }),
            new _ModuleSupport.Line({ tag: GroupTags.HighWick }),
        ]);
    }

    updateCoordinates() {
        const { x, y, yBottom, yHigh, yLow, width, height } = this;
        const selection = _ModuleSupport.Selection.select(this, _ModuleSupport.Rect);
        const [body] = selection.selectByTag<_ModuleSupport.Rect>(GroupTags.Body);
        const [lowWick] = selection.selectByTag<_ModuleSupport.Line>(GroupTags.LowWick);
        const [highWick] = selection.selectByTag<_ModuleSupport.Line>(GroupTags.HighWick);

        if (width === 0 || height === 0) {
            body.visible = false;
            lowWick.visible = false;
            highWick.visible = false;
            return;
        }

        body.visible = true;
        lowWick.visible = true;
        highWick.visible = true;

        body.setProperties({
            x,
            y,
            width,
            height,
            crisp: true,
            clipBBox: new BBox(x, y, width, height),
        });

        const halfWidth = width / 2;

        lowWick.setProperties({
            y1: Math.round(yLow + lowWick.strokeWidth / 2),
            y2: yBottom,
            x: x + halfWidth,
        });

        highWick.setProperties({
            y1: Math.round(yHigh + highWick.strokeWidth / 2),
            y2: y,
            x: x + halfWidth,
        });
    }

    updateDatumStyles(datum: CandlestickNodeDatum, activeStyles: AgCandlestickSeriesItemOptions) {
        const { bandwidth } = datum;

        const {
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
            lineDash,
            lineDashOffset,
            wick: wickStyles = {},
            cornerRadius,
        } = activeStyles;

        wickStyles.strokeWidth ??= 1;

        const selection = _ModuleSupport.Selection.select(this, _ModuleSupport.Rect);
        const [body] = selection.selectByTag<_ModuleSupport.Rect>(GroupTags.Body);
        const [lowWick] = selection.selectByTag<_ModuleSupport.Line>(GroupTags.LowWick);
        const [highWick] = selection.selectByTag<_ModuleSupport.Line>(GroupTags.HighWick);

        if (wickStyles.strokeWidth > bandwidth) {
            wickStyles.strokeWidth = bandwidth;
        }

        body.setProperties({
            fill,
            fillOpacity,
            strokeWidth,
            strokeOpacity,
            stroke,
            lineDash,
            lineDashOffset,
            cornerRadius,
        });

        lowWick.setProperties(wickStyles);
        highWick.setProperties(wickStyles);
    }
}
