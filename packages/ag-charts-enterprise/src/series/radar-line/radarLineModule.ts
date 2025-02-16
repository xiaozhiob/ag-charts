import { _ModuleSupport } from 'ag-charts-community';

import { RADAR_LINE_SERIES_THEME } from '../radar/radarThemes';
import { RadarLineSeries } from './radarLineSeries';

const { POLAR_AXIS_TYPE } = _ModuleSupport.ThemeConstants;

export const RadarLineModule: _ModuleSupport.SeriesModule<'radar-line'> = {
    type: 'series',
    optionsKey: 'series[]',
    packageType: 'enterprise',
    chartTypes: ['polar'],

    identifier: 'radar-line',
    moduleFactory: (ctx) => new RadarLineSeries(ctx),
    tooltipDefaults: { range: 'nearest' },
    defaultAxes: [{ type: POLAR_AXIS_TYPE.ANGLE_CATEGORY }, { type: POLAR_AXIS_TYPE.RADIUS_NUMBER }],
    themeTemplate: RADAR_LINE_SERIES_THEME,
    paletteFactory: ({ takeColors }) => {
        const {
            fills: [fill],
            strokes: [stroke],
        } = takeColors(1);
        return {
            stroke: fill,
            marker: { fill, stroke },
        };
    },
};
