import { type AgRadialSeriesFormat, _ModuleSupport, _Scene } from 'ag-charts-community';

import type { RadialColumnNodeDatum } from '../radial-column/radialColumnSeriesBase';
import { RadialColumnSeriesBase } from '../radial-column/radialColumnSeriesBase';
import { NightingaleSeriesProperties } from './nightingaleSeriesProperties';
import { prepareNightingaleAnimationFunctions, resetNightingaleSelectionFn } from './nightingaleUtil';

const { Sector, SectorBox } = _Scene;

export class NightingaleSeries extends RadialColumnSeriesBase<_Scene.Sector> {
    static readonly className = 'NightingaleSeries';
    static readonly type = 'nightingale' as const;

    override properties = new NightingaleSeriesProperties();

    // TODO: Enable once the options contract has been revisited
    // @Validate(POSITIVE_NUMBER)
    // sectorSpacing = 1;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super(moduleCtx, { animationResetFns: { item: resetNightingaleSelectionFn } });
    }

    protected getStackId() {
        const groupIndex = this.seriesGrouping?.groupIndex ?? this.id;
        return `nightingale-stack-${groupIndex}-yValues`;
    }

    protected override nodeFactory(): _Scene.Sector {
        return new Sector();
    }

    protected updateItemPath(
        node: _Scene.Sector,
        datum: RadialColumnNodeDatum,
        highlight: boolean,
        _format: AgRadialSeriesFormat | undefined
    ) {
        node.centerX = 0;
        node.centerY = 0;
        node.startOuterCornerRadius = !datum.negative ? this.properties.cornerRadius : 0;
        node.endOuterCornerRadius = !datum.negative ? this.properties.cornerRadius : 0;
        node.startInnerCornerRadius = datum.negative ? this.properties.cornerRadius : 0;
        node.endInnerCornerRadius = datum.negative ? this.properties.cornerRadius : 0;
        if (highlight) {
            node.innerRadius = datum.stackInnerRadius;
            node.outerRadius = datum.stackOuterRadius;
            node.startAngle = datum.startAngle;
            node.endAngle = datum.endAngle;
            node.clipSector = new SectorBox(datum.startAngle, datum.endAngle, datum.innerRadius, datum.outerRadius);
        }

        // TODO: Enable once the options contract has been revisited
        // const appliedHighlightStyle = highlight ? this.highlightStyle.item : undefined;

        // const hasStroke = (format?.stroke ?? appliedHighlightStyle?.stroke ?? this.stroke) != null;

        // const strokeWidth = hasStroke
        //     ? format?.strokeWidth ?? (highlight ? appliedHighlightStyle?.strokeWidth : undefined) ?? this.strokeWidth
        //     : 0;
        // node.inset = (this.sectorSpacing + strokeWidth) / 2;
    }

    protected override getColumnTransitionFunctions() {
        const axisZeroRadius = this.isRadiusAxisReversed() ? this.radius : this.getAxisInnerRadius();
        return prepareNightingaleAnimationFunctions(axisZeroRadius);
    }
}
