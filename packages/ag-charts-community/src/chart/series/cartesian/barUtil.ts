import { isNumber } from '../../../util/value';
import { Point } from '../../../scene/point';
import { AgBarSeriesFormat, AgCartesianSeriesLabelFormatterParams } from '../../agChartOptions';
import { Rect } from '../../../scene/shape/rect';
import { DropShadow } from '../../../scene/dropShadow';
import { CartesianSeriesNodeDatum } from './cartesianSeries';
import { SeriesItemHighlightStyle } from '../series';

type Bounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type LabelPlacement = 'start' | 'end' | 'inside' | 'outside';

type LabelDatum = Readonly<Point> & {
    readonly text: string;
    readonly textAlign: CanvasTextAlign;
    readonly textBaseline: CanvasTextBaseline;
};

export type RectConfig = {
    fill: string;
    stroke: string;
    strokeWidth: number;
    fillOpacity: number;
    strokeOpacity: number;
    lineDashOffset: number;
    lineDash?: number[];
    fillShadow?: DropShadow;
    crisp?: boolean;
    visible?: boolean;
};

export function createLabelData({
    value,
    rect,
    placement,
    seriesId,
    padding = 0,
    formatter,
    barAlongX,
}: {
    value: any;
    rect: Bounds;
    placement: LabelPlacement;
    seriesId: string;
    padding?: number;
    formatter?: (params: AgCartesianSeriesLabelFormatterParams) => string;
    barAlongX: boolean;
}): LabelDatum {
    let labelText: string;
    if (formatter) {
        labelText = formatter({
            value: isNumber(value) ? value : undefined,
            seriesId,
        });
    } else {
        labelText = isNumber(value) ? value.toFixed(2) : '';
    }

    let labelX = rect.x + rect.width / 2;
    let labelY = rect.y + rect.height / 2;

    let labelTextAlign: CanvasTextAlign = 'center';
    let labelTextBaseline: CanvasTextBaseline = 'middle';

    const isPositive = value >= 0;
    switch (placement) {
        case 'start': {
            if (barAlongX) {
                labelX = isPositive ? rect.x - padding : rect.x + rect.width + padding;
                labelTextAlign = isPositive ? 'start' : 'end';
            } else {
                labelY = isPositive ? rect.y + rect.height + padding : rect.y - padding;
                labelTextBaseline = isPositive ? 'top' : 'bottom';
            }
            break;
        }
        case 'outside':
        case 'end': {
            if (barAlongX) {
                labelX = isPositive ? rect.x + rect.width + padding : rect.x - padding;
                labelTextAlign = isPositive ? 'start' : 'end';
            } else {
                labelY = isPositive ? rect.y - padding : rect.y + rect.height + padding;
                labelTextBaseline = isPositive ? 'bottom' : 'top';
            }
            break;
        }
        case 'inside':
        default: {
            labelTextBaseline = 'middle';
            break;
        }
    }

    return {
        text: labelText,
        textAlign: labelTextAlign,
        textBaseline: labelTextBaseline,
        x: labelX,
        y: labelY,
    };
}

export function updateRect({ rect, config }: { rect: Rect; config: RectConfig }) {
    const {
        crisp = true,
        fill,
        stroke,
        strokeWidth,
        fillOpacity,
        strokeOpacity,
        lineDash,
        lineDashOffset,
        fillShadow,
        visible = true,
    } = config;
    rect.crisp = crisp;
    rect.fill = fill;
    rect.stroke = stroke;
    rect.strokeWidth = strokeWidth;
    rect.fillOpacity = fillOpacity;
    rect.strokeOpacity = strokeOpacity;
    rect.lineDash = lineDash;
    rect.lineDashOffset = lineDashOffset;
    rect.fillShadow = fillShadow;
    rect.visible = visible;
}

export function getRectConfig<DatumType extends CartesianSeriesNodeDatum, FormatterType extends (params: any) => {}>({
    datum,
    isHighlighted,
    style,
    highlightStyle,
    formatter,
    seriesId,
    stackGroup,
}: {
    datum: DatumType;
    isHighlighted: boolean;
    style: RectConfig;
    highlightStyle: SeriesItemHighlightStyle;
    formatter?: FormatterType;
    seriesId: string;
    stackGroup?: string;
}): RectConfig {
    const itemFill = isHighlighted ? highlightStyle.fill ?? style.fill : style.fill;
    const itemStroke = isHighlighted ? highlightStyle.stroke ?? style.stroke : style.stroke;
    const itemStrokeWidth = isHighlighted ? highlightStyle.strokeWidth ?? style.strokeWidth : style.strokeWidth;
    const fillOpacity = isHighlighted ? highlightStyle.fillOpacity ?? style.fillOpacity : style.fillOpacity;
    const { strokeOpacity, fillShadow, lineDash, lineDashOffset } = style;

    let format: AgBarSeriesFormat | undefined = undefined;
    if (formatter) {
        format = formatter({
            datum: datum.datum,
            xKey: datum.xKey,
            yKey: datum.yKey,
            fill: itemFill,
            stroke: itemStroke,
            strokeWidth: itemStrokeWidth,
            highlighted: isHighlighted,
            seriesId,
            stackGroup,
        });
    }

    return {
        fill: format?.fill ?? itemFill,
        stroke: format?.stroke ?? itemStroke,
        strokeWidth: format?.strokeWidth ?? itemStrokeWidth,
        fillOpacity,
        strokeOpacity,
        lineDash,
        lineDashOffset,
        fillShadow,
    };
}

export function checkCrisp(visibleRange: number[] = []): boolean {
    const [visibleMin, visibleMax] = visibleRange;
    const isZoomed = visibleMin !== 0 || visibleMax !== 1;
    const crisp = !isZoomed;
    return crisp;
}
