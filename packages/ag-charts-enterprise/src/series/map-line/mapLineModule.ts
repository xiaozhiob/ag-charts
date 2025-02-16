import { _ModuleSupport } from 'ag-charts-community';

import { MAP_THEME_DEFAULTS } from '../map-util/mapThemeDefaults';
import { MapLineSeries } from './mapLineSeries';

const { DEFAULT_DIVERGING_SERIES_COLOR_RANGE, DEFAULT_FONT_FAMILY, DEFAULT_LABEL_COLOUR } = _ModuleSupport.ThemeSymbols;

export const MapLineModule: _ModuleSupport.SeriesModule<'map-line'> = {
    type: 'series',
    optionsKey: 'series[]',
    packageType: 'enterprise',
    chartTypes: ['topology'],

    identifier: 'map-line',
    moduleFactory: (ctx) => new MapLineSeries(ctx),
    tooltipDefaults: { range: 'exact' },
    themeTemplate: {
        ...MAP_THEME_DEFAULTS,
        series: {
            strokeWidth: 1,
            maxStrokeWidth: 3,
            lineDash: [0],
            lineDashOffset: 0,
            label: {
                enabled: true,
                fontSize: 12,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_LABEL_COLOUR,
            },
        },
    },
    paletteFactory: (opts) => {
        const { takeColors, colorsCount, userPalette, themeTemplateParameters } = opts;
        const { fill } = _ModuleSupport.singleSeriesPaletteFactory(opts);
        const defaultColorRange = themeTemplateParameters.get(DEFAULT_DIVERGING_SERIES_COLOR_RANGE);
        const { fills } = takeColors(colorsCount);
        return {
            colorRange: userPalette === 'inbuilt' ? defaultColorRange : [fills[0], fills[1]],
            stroke: fill,
        };
    },
};
