import { _ModuleSupport } from 'ag-charts-community';

import { MAP_THEME_DEFAULTS } from '../map-util/mapThemeDefaults';
import { MapShapeSeries } from './mapShapeSeries';

const { DEFAULT_INVERTED_LABEL_COLOUR, DEFAULT_DIVERGING_SERIES_COLOR_RANGE, DEFAULT_BACKGROUND_COLOUR } =
    _ModuleSupport.ThemeSymbols;

export const MapShapeModule: _ModuleSupport.SeriesModule<'map-shape'> = {
    type: 'series',
    optionsKey: 'series[]',
    packageType: 'enterprise',
    chartTypes: ['topology'],

    identifier: 'map-shape',
    moduleFactory: (ctx) => new MapShapeSeries(ctx),
    tooltipDefaults: { range: 'exact' },
    themeTemplate: {
        ...MAP_THEME_DEFAULTS,
        series: {
            fillOpacity: 1,
            strokeWidth: 1,
            lineDash: [0],
            lineDashOffset: 0,
            padding: 2,
            label: {
                color: DEFAULT_INVERTED_LABEL_COLOUR,
                fontWeight: 'bold',
                overflowStrategy: 'hide',
            },
        },
    },
    paletteFactory: (opts) => {
        const { takeColors, colorsCount, userPalette, themeTemplateParameters } = opts;
        const { fill } = _ModuleSupport.singleSeriesPaletteFactory(opts);
        const defaultColorRange = themeTemplateParameters.get(DEFAULT_DIVERGING_SERIES_COLOR_RANGE);
        const { fills } = takeColors(colorsCount);
        return {
            fill,
            stroke: themeTemplateParameters.get(DEFAULT_BACKGROUND_COLOUR) as string,
            colorRange: userPalette === 'inbuilt' ? defaultColorRange : [fills[0], fills[1]],
        };
    },
};
