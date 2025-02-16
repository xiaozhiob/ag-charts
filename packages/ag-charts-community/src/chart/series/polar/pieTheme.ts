import type { ExtensibleTheme } from '../../../module/coreModules';
import type { SeriesPaletteFactory } from '../../../module/coreModulesTypes';
import { FONT_SIZE } from '../../themes/constants';
import {
    DEFAULT_FONT_FAMILY,
    DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
    DEFAULT_LABEL_COLOUR,
    DEFAULT_MUTED_LABEL_COLOUR,
    DEFAULT_SHADOW_COLOUR,
} from '../../themes/symbols';

export const pieTheme: ExtensibleTheme<'pie'> = {
    series: {
        title: {
            enabled: true,
            fontWeight: 'normal' as const,
            fontSize: 14,
            fontFamily: DEFAULT_FONT_FAMILY,
            color: DEFAULT_MUTED_LABEL_COLOUR,
            spacing: 5,
        },
        calloutLabel: {
            enabled: true,
            fontSize: FONT_SIZE.SMALL,
            fontFamily: DEFAULT_FONT_FAMILY,
            color: DEFAULT_LABEL_COLOUR,
            offset: 3,
            minAngle: 0,
        },
        sectorLabel: {
            enabled: true,
            fontWeight: 'normal' as const,
            fontSize: FONT_SIZE.SMALL,
            fontFamily: DEFAULT_FONT_FAMILY,
            color: DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
            positionOffset: 0,
            positionRatio: 0.5,
        },
        calloutLine: {
            length: 10,
            strokeWidth: 2,
        },
        fillOpacity: 1,
        strokeOpacity: 1,
        strokeWidth: 0,
        lineDash: [0],
        lineDashOffset: 0,
        rotation: 0,
        sectorSpacing: 1,
        shadow: {
            enabled: false,
            color: DEFAULT_SHADOW_COLOUR,
            xOffset: 3,
            yOffset: 3,
            blur: 5,
        },
    },
};

export const piePaletteFactory: SeriesPaletteFactory<'pie'> = ({ takeColors, colorsCount }) => {
    const { fills, strokes } = takeColors(colorsCount);
    return { fills, strokes, calloutLine: { colors: strokes } };
};
