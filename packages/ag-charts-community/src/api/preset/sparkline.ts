import {
    type AgAxisGridLineOptions,
    type AgBaseSparklinePresetOptions,
    type AgCartesianAxisOptions,
    type AgCartesianChartOptions,
    type AgCartesianSeriesOptions,
    type AgCategoryAxisOptions,
    type AgChartTheme,
    type AgChartThemeName,
    type AgNumberAxisOptions,
    type AgSparklineAxisOptions,
    type AgSparklineOptions,
    type AgTimeAxisOptions,
    type AgTooltipPositionType,
} from 'ag-charts-types';

import { IS_ENTERPRISE } from '../../chart/themes/symbols';
import { simpleMemorize } from '../../util/memo';
import { IGNORED_PROP, assertEmpty, pickProps } from './presetUtils';

const commonAxisProperties = {
    title: {
        enabled: false,
    },
    label: {
        enabled: false,
    },
    line: {
        enabled: false,
    },
    gridLine: {
        enabled: false,
    },
    crosshair: {
        enabled: false,
        strokeOpacity: 0.25,
        lineDash: [0],
        label: {
            enabled: false,
        },
    },
};

const numericAxisProperties = {
    ...commonAxisProperties,
    nice: false,
};

const bottomCrossHairAxisProperties = {
    bottom: {
        crosshair: {
            enabled: IS_ENTERPRISE,
        },
    },
};

const crossHairAxes = {
    category: bottomCrossHairAxisProperties,
    number: bottomCrossHairAxisProperties,
    log: bottomCrossHairAxisProperties,
    time: bottomCrossHairAxisProperties,
};

const crossHairTooltip = {
    position: {
        type: 'sparkline' as any as AgTooltipPositionType,
    },
};

const SPARKLINE_THEME: AgChartTheme = {
    overrides: {
        common: {
            animation: {
                enabled: false,
            },
            contextMenu: { enabled: false },
            toolbar: { enabled: false },
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            axes: {
                number: {
                    ...numericAxisProperties,
                    interval: {
                        values: [0],
                    },
                },
                log: {
                    ...numericAxisProperties,
                },
                time: {
                    ...numericAxisProperties,
                },
                category: {
                    ...commonAxisProperties,
                },
            },
        },
        bar: {
            series: {
                // @ts-expect-error
                sparklineMode: true,
            },
            tooltip: {
                range: 'nearest',
            },
        },
        line: {
            seriesArea: {
                padding: {
                    top: 2,
                    right: 2,
                    bottom: 2,
                    left: 2,
                },
            },
            axes: crossHairAxes,
            series: {
                // @ts-expect-error
                sparklineMode: true,
                strokeWidth: 1,
                marker: {
                    enabled: false,
                    size: 3,
                },
                tooltip: crossHairTooltip,
            },
        },
        area: {
            seriesArea: {
                padding: {
                    top: 1,
                    right: 0,
                    bottom: 1,
                    left: 0,
                },
            },
            axes: crossHairAxes,
            series: {
                strokeWidth: 1,
                fillOpacity: 0.4,
                tooltip: crossHairTooltip,
            },
        },
    },
};

const setInitialBaseTheme = simpleMemorize(createInitialBaseTheme);

function createInitialBaseTheme(
    baseTheme: AgChartTheme | AgChartThemeName | undefined,
    initialBaseTheme: AgChartTheme
): AgChartTheme {
    if (typeof baseTheme === 'string') {
        return {
            ...initialBaseTheme,
            baseTheme,
        };
    }

    if (baseTheme != null) {
        return {
            ...baseTheme,
            // @ts-expect-error internal implementation
            baseTheme: setInitialBaseTheme(baseTheme.baseTheme, initialBaseTheme),
        };
    }

    return initialBaseTheme;
}

function dataPreset(data: any[] | undefined): [any[] | undefined, AgCartesianSeriesOptions | undefined] {
    if (Array.isArray(data) && data.length !== 0) {
        const firstItem = data[0];
        if (typeof firstItem === 'number') {
            const mappedData = data.map((y, x) => ({ x, y }));
            return [mappedData, { xKey: 'x', yKey: 'y' }];
        } else if (Array.isArray(firstItem)) {
            const mappedData = data.map(([x, y]) => ({ x, y }));
            return [mappedData, { xKey: 'x', yKey: 'y' }];
        }
    }

    return [data, undefined];
}

function axisPreset(
    opts: AgSparklineAxisOptions | undefined,
    defaultType: AgCartesianAxisOptions['type']
): AgCartesianAxisOptions {
    switch (opts?.type) {
        case 'number': {
            const {
                type,
                visible: _visible,
                stroke: _stroke,
                strokeWidth: _strokeWidth,
                min,
                max,
                reverse,
                ...optsRest
            } = opts;
            assertEmpty(optsRest);
            return pickProps<Pick<AgNumberAxisOptions, 'type' | 'reverse' | 'min' | 'max'>>(opts, {
                type,
                reverse,
                min,
                max,
            });
        }
        case 'time': {
            const {
                type,
                visible: _visible,
                stroke: _stroke,
                strokeWidth: _strokeWidth,
                min,
                max,
                reverse,
                ...optsRest
            } = opts;
            assertEmpty(optsRest);
            return pickProps<Pick<AgTimeAxisOptions, 'type' | 'reverse' | 'min' | 'max'>>(opts, {
                type,
                reverse,
                min,
                max,
            });
        }
        case 'category': {
            const {
                type,
                visible: _visible,
                stroke: _stroke,
                strokeWidth: _strokeWidth,
                paddingInner,
                paddingOuter,
                reverse,
                ...optsRest
            } = opts;
            assertEmpty(optsRest);
            return pickProps<Pick<AgCategoryAxisOptions, 'type' | 'reverse' | 'paddingInner' | 'paddingOuter'>>(opts, {
                type,
                reverse,
                paddingInner,
                paddingOuter,
            });
        }
    }

    return { type: defaultType };
}

function gridLinePreset(opts: AgSparklineAxisOptions | undefined, defaultEnabled: boolean): AgAxisGridLineOptions {
    const gridLineOpts: AgAxisGridLineOptions = {};
    if (opts?.stroke != null) {
        gridLineOpts.style = [{ stroke: opts?.stroke }];
        gridLineOpts.enabled ??= true;
    }
    if (opts?.strokeWidth != null) {
        gridLineOpts.width = opts?.strokeWidth;
        gridLineOpts.enabled ??= true;
    }
    if (opts?.visible != null) {
        gridLineOpts.enabled = opts.visible;
    }
    gridLineOpts.enabled ??= defaultEnabled;
    return gridLineOpts;
}

export function sparkline(opts: AgSparklineOptions): AgCartesianChartOptions {
    const {
        background,
        container,
        height,
        listeners,
        locale,
        minHeight,
        minWidth,
        padding,
        width,
        theme: baseTheme,
        data: baseData,
        axis,
        min,
        max,
        reverse,
        ...optsRest
    } = opts as any as AgBaseSparklinePresetOptions;
    assertEmpty(optsRest);

    const chartOpts: AgCartesianChartOptions = pickProps<AgBaseSparklinePresetOptions>(opts, {
        background,
        container,
        height,
        listeners,
        locale,
        minHeight,
        minWidth,
        padding,
        width,
        data: IGNORED_PROP,
        axis: IGNORED_PROP,
        min: IGNORED_PROP,
        max: IGNORED_PROP,
        reverse: IGNORED_PROP,
        theme: IGNORED_PROP,
    });

    const [data, seriesOverrides] = dataPreset(baseData);

    const seriesOptions = optsRest as any as AgCartesianSeriesOptions;
    // Assign is safe as it comes from a rest object
    if (seriesOverrides != null) Object.assign(seriesOptions, seriesOverrides);

    chartOpts.theme = setInitialBaseTheme(baseTheme, SPARKLINE_THEME);
    chartOpts.data = data;
    chartOpts.series = [seriesOptions];

    const swapAxes = seriesOptions.type !== 'bar' || seriesOptions.direction !== 'horizontal';
    const [xAxisPosition, yAxisPosition] = swapAxes ? (['bottom', 'left'] as const) : (['left', 'bottom'] as const);

    const xAxis: AgCartesianAxisOptions = {
        ...axisPreset(axis, 'category'),
        position: xAxisPosition,
    };
    const yAxis: AgCartesianAxisOptions = Object.assign(
        {
            type: 'number',
            gridLine: gridLinePreset(axis, false),
            position: yAxisPosition,
        },
        pickProps<Pick<AgNumberAxisOptions, 'reverse' | 'min' | 'max'>>(opts, {
            min,
            max,
            reverse,
        })
    );

    chartOpts.axes = swapAxes ? [yAxis, xAxis] : [xAxis, yAxis];

    return chartOpts;
}
