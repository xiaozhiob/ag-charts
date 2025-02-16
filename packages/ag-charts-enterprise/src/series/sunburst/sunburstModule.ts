import { _ModuleSupport } from 'ag-charts-community';

import { SunburstSeries } from './sunburstSeries';

const { DEFAULT_INSIDE_SERIES_LABEL_COLOUR, DEFAULT_DIVERGING_SERIES_COLOR_RANGE } = _ModuleSupport.ThemeSymbols;

export const SunburstModule: _ModuleSupport.SeriesModule<'sunburst'> = {
    type: 'series',
    optionsKey: 'series[]',
    packageType: 'enterprise',
    chartTypes: ['hierarchy'],

    identifier: 'sunburst',
    moduleFactory: (ctx) => new SunburstSeries(ctx),
    tooltipDefaults: { range: 'exact' },
    solo: true,
    themeTemplate: {
        series: {
            label: {
                fontSize: 14,
                minimumFontSize: 9,
                color: DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
                overflowStrategy: 'ellipsis',
                wrapping: 'never',
                spacing: 2,
            },
            secondaryLabel: {
                fontSize: 8,
                minimumFontSize: 7,
                color: DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
                overflowStrategy: 'ellipsis',
                wrapping: 'never',
            },
            sectorSpacing: 2,
            padding: 3,
            highlightStyle: {
                label: {
                    color: DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
                },
                secondaryLabel: {
                    color: DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
                },
                stroke: `rgba(0, 0, 0, 0.4)`,
                strokeWidth: 2,
            },
        },
        gradientLegend: {
            enabled: true,
        },
    },
    paletteFactory: ({ takeColors, colorsCount, themeTemplateParameters }) => {
        const { fills, strokes } = takeColors(colorsCount);
        const defaultColorRange = themeTemplateParameters.get(DEFAULT_DIVERGING_SERIES_COLOR_RANGE);
        return { fills, strokes, colorRange: defaultColorRange };
    },
};
