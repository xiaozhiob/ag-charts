import type { AgChartThemeOptions, AgChartThemePalette } from '../../options/agChartOptions';
import { ChartTheme } from './chartTheme';
import {
    DEFAULT_AXIS_GRID_COLOUR,
    DEFAULT_BACKGROUND_COLOUR,
    DEFAULT_CROSS_LINES_COLOUR,
    DEFAULT_DIVERGING_SERIES_COLOUR_RANGE,
    DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
    DEFAULT_LABEL_COLOUR,
    DEFAULT_MUTED_LABEL_COLOUR,
    DEFAULT_POLAR_SERIES_STROKE,
    DEFAULT_WATERFALL_SERIES_CONNECTOR_LINE_STROKE,
    DEFAULT_WATERFALL_SERIES_NEGATIVE_COLOURS,
    DEFAULT_WATERFALL_SERIES_POSITIVE_COLOURS,
    DEFAULT_WATERFALL_SERIES_TOTAL_COLOURS,
} from './symbols';

const DEFAULT_DARK_BACKGROUND_FILL = '#0a161f';

const DEFAULT_DARK_FILLS = {
    BLUE: '#5090dc',
    ORANGE: '#ffa03a',
    GREEN: '#459d55',
    CYAN: '#34bfe1',
    YELLOW: '#e1cc00',
    VIOLET: '#9669cb',
    GRAY: '#b5b5b5',
    MAGENTA: '#bd5aa7',
    BROWN: '#8a6224',
    RED: '#ef5452',
};

const DEFAULT_DARK_STROKES = {
    BLUE: '#74a8e6',
    ORANGE: '#ffbe70',
    GREEN: '#6cb176',
    CYAN: '#75d4ef',
    YELLOW: '#f6e559',
    VIOLET: '#aa86d8',
    GRAY: '#a1a1a1',
    MAGENTA: '#ce7ab9',
    BROWN: '#997b52',
    RED: '#ff7872',
};

const palette: AgChartThemePalette = {
    fills: Array.from(Object.values(DEFAULT_DARK_FILLS)),
    strokes: Array.from(Object.values(DEFAULT_DARK_STROKES)),
};

export class DarkTheme extends ChartTheme {
    protected static override getWaterfallSeriesDefaultPositiveColors() {
        return {
            fill: DEFAULT_DARK_FILLS.BLUE,
            stroke: DEFAULT_DARK_STROKES.BLUE,
        };
    }

    protected static override getWaterfallSeriesDefaultNegativeColors() {
        return {
            fill: DEFAULT_DARK_FILLS.ORANGE,
            stroke: DEFAULT_DARK_STROKES.ORANGE,
        };
    }

    protected static override getWaterfallSeriesDefaultTotalColors() {
        return {
            fill: DEFAULT_DARK_FILLS.GRAY,
            stroke: DEFAULT_DARK_STROKES.GRAY,
        };
    }

    override getTemplateParameters() {
        const result = super.getTemplateParameters();

        result.properties.set(
            DEFAULT_WATERFALL_SERIES_POSITIVE_COLOURS,
            DarkTheme.getWaterfallSeriesDefaultPositiveColors()
        );
        result.properties.set(
            DEFAULT_WATERFALL_SERIES_NEGATIVE_COLOURS,
            DarkTheme.getWaterfallSeriesDefaultNegativeColors()
        );
        result.properties.set(DEFAULT_WATERFALL_SERIES_TOTAL_COLOURS, DarkTheme.getWaterfallSeriesDefaultTotalColors());

        result.properties.set(
            DEFAULT_WATERFALL_SERIES_CONNECTOR_LINE_STROKE,
            DarkTheme.getWaterfallSeriesDefaultTotalColors().stroke
        );
        result.properties.set(DEFAULT_POLAR_SERIES_STROKE, DEFAULT_DARK_BACKGROUND_FILL);

        result.properties.set(DEFAULT_LABEL_COLOUR, 'white');
        result.properties.set(DEFAULT_MUTED_LABEL_COLOUR, '#7D91A0');
        result.properties.set(DEFAULT_AXIS_GRID_COLOUR, '#545A6E');
        result.properties.set(DEFAULT_CROSS_LINES_COLOUR, 'white');
        result.properties.set(DEFAULT_DIVERGING_SERIES_COLOUR_RANGE, ['#AB644C', '#66AB57']);
        result.properties.set(DEFAULT_BACKGROUND_COLOUR, DEFAULT_DARK_BACKGROUND_FILL);
        result.properties.set(DEFAULT_INSIDE_SERIES_LABEL_COLOUR, DEFAULT_DARK_BACKGROUND_FILL);

        return result;
    }

    protected override getPalette(): AgChartThemePalette {
        return palette;
    }

    constructor(options?: AgChartThemeOptions) {
        super(options);
    }
}
