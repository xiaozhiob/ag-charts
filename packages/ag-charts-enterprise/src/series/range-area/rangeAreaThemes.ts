import { type AgRangeAreaSeriesThemeableOptions, type InteractionRange, _ModuleSupport } from 'ag-charts-community';

export const RANGE_AREA_SERIES_THEME: {
    series: AgRangeAreaSeriesThemeableOptions;
    axes: any;
} = {
    series: {
        fillOpacity: 0.7,
        nodeClickRange: 'nearest' as InteractionRange,
        marker: {
            enabled: false,
            size: 6,
            strokeWidth: 2,
        },
        label: {
            enabled: false,
            placement: 'outside',
            padding: 10,
            fontSize: 12,
            fontFamily: _ModuleSupport.ThemeSymbols.DEFAULT_FONT_FAMILY,
            color: _ModuleSupport.ThemeSymbols.DEFAULT_LABEL_COLOUR,
        },
        interpolation: {
            type: 'linear',
            // @ts-expect-error - users shouldn't specify all options, but we have to for theming to work
            tension: 1,
            position: 'end',
        },
    },
    axes: {
        [_ModuleSupport.ThemeConstants.CARTESIAN_AXIS_TYPE.NUMBER]: {
            crosshair: { enabled: true },
        },
    },
};
