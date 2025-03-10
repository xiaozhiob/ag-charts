import { _ModuleSupport } from 'ag-charts-community';

import { Crosshair } from './crosshair';

export const CrosshairModule: _ModuleSupport.AxisOptionModule = {
    type: 'axis-option',
    optionsKey: 'crosshair',
    packageType: 'enterprise',
    chartTypes: ['cartesian'],
    axisTypes: ['category', 'ordinal-time', 'number', 'log', 'time'],
    moduleFactory: (ctx) => new Crosshair(ctx),
    themeTemplate: {
        crosshair: {
            snap: true,
            stroke: _ModuleSupport.ThemeSymbols.DEFAULT_MUTED_LABEL_COLOUR,
            strokeWidth: 1,
            strokeOpacity: 1,
            lineDash: [5, 6],
            lineDashOffset: 0,
            label: {
                enabled: true,
            },
        },
    },
};
