import type { SeriesModule } from '../../../module/coreModules';
import { CARTESIAN_AXIS_TYPE, CARTESIAN_POSITION } from '../../themes/constants';
import { DEFAULT_FONT_FAMILY, DEFAULT_LABEL_COLOUR } from '../../themes/symbols';
import { singleSeriesPaletteFactory } from '../../themes/util';
import { BubbleSeries } from './bubbleSeries';

export const BubbleSeriesModule: SeriesModule<'bubble'> = {
    type: 'series',
    optionsKey: 'series[]',
    packageType: 'community',
    chartTypes: ['cartesian'],

    identifier: 'bubble',
    moduleFactory: (ctx) => new BubbleSeries(ctx),
    tooltipDefaults: { range: 'nearest' },
    defaultAxes: [
        {
            type: CARTESIAN_AXIS_TYPE.NUMBER,
            position: CARTESIAN_POSITION.BOTTOM,
        },
        {
            type: CARTESIAN_AXIS_TYPE.NUMBER,
            position: CARTESIAN_POSITION.LEFT,
        },
    ],
    themeTemplate: {
        series: {
            shape: 'circle',
            size: 7,
            maxSize: 30,
            fillOpacity: 0.8,
            tooltip: { position: { type: 'node' } },
            label: {
                enabled: false,
                fontSize: 12,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_LABEL_COLOUR,
            },
        },
    },
    paletteFactory: singleSeriesPaletteFactory,
};
