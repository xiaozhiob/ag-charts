import type {
    AgAnnotationsOptions,
    AgBarSeriesItemStylerParams,
    AgBarSeriesOptions,
    AgBaseFinancialPresetOptions,
    AgCandlestickSeriesOptions,
    AgCartesianChartOptions,
    AgChartTheme,
    AgChartThemeName,
    AgLineSeriesOptions,
    AgNavigatorOptions,
    AgNumberAxisOptions,
    AgOhlcSeriesOptions,
    AgPriceVolumePreset,
    AgRangeAreaSeriesOptions,
    AgRangeBarSeriesOptions,
    AgToolbarOptions,
    AgZoomOptions,
} from 'ag-charts-types';

import type { ChartTheme } from '../../chart/themes/chartTheme';
import {
    PALETTE_ALT_NEUTRAL_STROKE,
    PALETTE_DOWN_FILL,
    PALETTE_DOWN_STROKE,
    PALETTE_NEUTRAL_FILL,
    PALETTE_NEUTRAL_STROKE,
    PALETTE_UP_FILL,
    PALETTE_UP_STROKE,
} from '../../chart/themes/symbols';
import { Logger } from '../../util/logger';
import { mergeDefaults } from '../../util/object';
import { isObject } from '../../util/type-guards';

type ThemeType = AgChartTheme | AgChartThemeName;

function fromTheme<T>(theme: ThemeType | undefined, cb: (theme: AgChartTheme) => T): T | undefined {
    if (isObject(theme)) {
        return cb(theme);
    }
}

const chartTypes = ['ohlc', 'line', 'step-line', 'hlc', 'high-low', 'candlestick', 'hollow-candlestick'];

export function priceVolume(
    opts: AgPriceVolumePreset & AgBaseFinancialPresetOptions,
    _presetTheme: any,
    getTheme: () => ChartTheme
): AgCartesianChartOptions {
    const {
        dateKey = 'date',
        highKey = 'high',
        openKey = 'open',
        lowKey = 'low',
        closeKey = 'close',
        volumeKey = 'volume',
        chartType = 'candlestick',
        navigator = false,
        volume = true,
        rangeButtons = true,
        statusBar = true,
        toolbar = true,
        zoom = true,
        theme,
        data,
        ...unusedOpts
    } = opts;

    const priceSeries = createPriceSeries(theme, chartType, dateKey, highKey, lowKey, openKey, closeKey);
    const volumeSeries = createVolumeSeries(theme, getTheme, openKey, closeKey, volume, volumeKey);

    const miniChart = volume
        ? {
              miniChart: {
                  enabled: navigator,
                  series: [
                      {
                          type: 'line' as const,
                          xKey: dateKey,
                          yKey: volumeKey,
                          marker: { enabled: false },
                      },
                  ],
              },
          }
        : null;
    const navigatorOpts = {
        navigator: {
            enabled: navigator,
            ...miniChart,
        } satisfies AgNavigatorOptions,
    };

    const annotationOpts = {
        annotations: {
            enabled: toolbar,
            // @ts-expect-error undocumented option
            data,
            xKey: dateKey,
            volumeKey: volume ? volumeKey : undefined,
        } satisfies AgAnnotationsOptions,
    };

    const statusBarOpts = statusBar
        ? {
              statusBar: {
                  enabled: true,
                  data,
                  highKey,
                  openKey,
                  lowKey,
                  closeKey,
                  volumeKey: volume ? volumeKey : undefined,
              },
          }
        : null;

    const zoomOpts = {
        zoom: {
            enabled: zoom,
            // @ts-expect-error undocumented option
            enableIndependentAxes: true,
        } satisfies AgZoomOptions,
    };

    const toolbarOpts = {
        chartToolbar: { enabled: true },
        ranges: {
            enabled: rangeButtons,
        },
        toolbar: {
            seriesType: {
                enabled: toolbar,
            },
            annotationOptions: {
                enabled: toolbar,
            },
            annotations: {
                enabled: toolbar,
            },
        } satisfies AgToolbarOptions,
    };

    const volumeAxis = volume
        ? [
              {
                  type: 'number',
                  position: 'left',
                  keys: [volumeKey],
                  label: { enabled: false },
                  crosshair: { enabled: false },
                  gridLine: { enabled: false },
                  nice: false,
                  // @ts-expect-error undocumented option
                  layoutConstraints: {
                      stacked: false,
                      width: 20,
                      unit: 'percentage',
                      align: 'end',
                  },
              } satisfies AgNumberAxisOptions,
          ]
        : [];

    return {
        theme: {
            baseTheme: typeof theme === 'string' ? theme : ('ag-financial' as AgChartThemeName),
            ...mergeDefaults(typeof theme === 'object' ? theme : null, {
                overrides: {
                    common: {
                        title: { padding: 4 },
                        padding: {
                            top: 6,
                            right: 8,
                            bottom: 5,
                        },
                    },
                },
            }),
        },
        animation: { enabled: false },
        legend: { enabled: false },
        series: [...volumeSeries, ...priceSeries],
        seriesArea: { clip: true },
        axes: [
            {
                type: 'number',
                position: 'right',
                keys: [openKey, closeKey, highKey, lowKey],
                interval: {
                    maxSpacing: fromTheme(theme, (t) => t.overrides?.common?.axes?.number?.interval?.maxSpacing) ?? 45,
                },
                label: {
                    format: fromTheme(theme, (t) => t.overrides?.common?.axes?.number?.label?.format) ?? '.2f',
                },
                crosshair: {
                    enabled: true,
                    snap: false,
                },
                // @ts-expect-error undocumented option
                layoutConstraints: {
                    stacked: false,
                    width: 100,
                    unit: 'percentage',
                    align: 'start',
                },
            },
            ...volumeAxis,
            {
                type: 'ordinal-time',
                position: 'bottom',
                line: {
                    enabled: false,
                },
                label: {
                    enabled: true,
                },
                crosshair: {
                    enabled: true,
                },
            },
        ],
        tooltip: { enabled: false },
        data,
        ...annotationOpts,
        ...navigatorOpts,
        ...statusBarOpts,
        ...zoomOpts,
        ...toolbarOpts,
        ...unusedOpts,
    } satisfies AgCartesianChartOptions;
}

function createVolumeSeries(
    theme: ThemeType | undefined,
    getTheme: () => ChartTheme,
    openKey: string,
    closeKey: string,
    volume: boolean,
    volumeKey: string
) {
    if (!volume) return [];

    const barSeriesFill = fromTheme(theme, (t) => t.overrides?.bar?.series?.fill);
    const itemStyler = barSeriesFill
        ? { fill: barSeriesFill }
        : {
              itemStyler({ datum }: AgBarSeriesItemStylerParams<any>) {
                  const { up, down } = getTheme().palette;
                  return { fill: datum[openKey] < datum[closeKey] ? up?.fill : down?.fill };
              },
          };
    return [
        {
            type: 'bar',
            xKey: 'date',
            yKey: volumeKey,
            tooltip: { enabled: false },
            highlight: { enabled: false },
            fillOpacity: fromTheme(theme, (t) => t.overrides?.bar?.series?.fillOpacity) ?? 0.5,
            ...itemStyler,
            // @ts-expect-error undocumented option
            focusPriority: 1,
            fastDataProcessing: true,
        } satisfies AgBarSeriesOptions,
    ];
}

const RANGE_AREA_TYPE = 'range-area';

interface PriceSeriesCommon {
    pickOutsideVisibleMinorAxis: boolean;
}

interface PriceSeriesKeys {
    xKey: string;
    openKey: string;
    closeKey: string;
    highKey: string;
    lowKey: string;
}

interface PriceSeriesSingleKeys {
    xKey: string;
    yKey: string;
}

function createPriceSeries(
    theme: ThemeType | undefined,
    chartType: AgPriceVolumePreset['chartType'],
    xKey: string,
    highKey: string,
    lowKey: string,
    openKey: string,
    closeKey: string
) {
    const keys: PriceSeriesKeys = {
        xKey,
        openKey,
        closeKey,
        highKey,
        lowKey,
    };
    const singleKeys: PriceSeriesSingleKeys = {
        xKey,
        yKey: closeKey,
    };
    const common: PriceSeriesCommon = {
        pickOutsideVisibleMinorAxis: true,
    };

    switch (chartType ?? 'candlestick') {
        case 'ohlc':
            return createPriceSeriesOHLC(common, keys);
        case 'line':
            return createPriceSeriesLine(common, theme, singleKeys);
        case 'step-line':
            return createPriceSeriesStepLine(common, theme, singleKeys);
        case 'hlc':
            return createPriceSeriesHLC(common, theme, singleKeys, keys);
        case 'high-low':
            return createPriceSeriesHighLow(common, theme, keys);
        case 'candlestick':
            return createPriceSeriesCandlestick(common, keys);
        case 'hollow-candlestick':
            return createPriceSeriesHollowCandlestick(common, theme, keys);
        default:
            Logger.warnOnce(`unknown chart type: ${chartType}; expected one of: ${chartTypes.join(', ')}`);
            return createPriceSeriesCandlestick(common, keys);
    }
}

function createPriceSeriesOHLC(common: PriceSeriesCommon, keys: PriceSeriesKeys) {
    return [
        {
            type: 'ohlc',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            ...keys,
        } satisfies AgOhlcSeriesOptions,
    ];
}

function createPriceSeriesLine(
    common: PriceSeriesCommon,
    theme: ThemeType | undefined,
    singleKeys: PriceSeriesSingleKeys
) {
    return [
        {
            type: 'line',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            ...singleKeys,
            stroke: fromTheme(theme, (t) => t.overrides?.line?.series?.stroke) ?? PALETTE_NEUTRAL_STROKE,
            marker: fromTheme(theme, (t) => t.overrides?.line?.series?.marker) ?? { enabled: false },
        } satisfies AgLineSeriesOptions,
    ];
}

function createPriceSeriesStepLine(
    common: PriceSeriesCommon,
    theme: ThemeType | undefined,
    singleKeys: PriceSeriesSingleKeys
) {
    return [
        {
            type: 'line',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            ...singleKeys,
            stroke: fromTheme(theme, (t) => t.overrides?.line?.series?.stroke) ?? PALETTE_NEUTRAL_STROKE,
            interpolation: fromTheme(theme, (t) => t.overrides?.line?.series?.interpolation) ?? {
                type: 'step',
            },
            marker: fromTheme(theme, (t) => t.overrides?.line?.series?.marker) ?? { enabled: false },
        } satisfies AgLineSeriesOptions,
    ];
}

function createPriceSeriesHLC(
    common: PriceSeriesCommon,
    theme: ThemeType | undefined,
    singleKeys: PriceSeriesSingleKeys,
    { xKey, highKey, closeKey, lowKey }: PriceSeriesKeys
) {
    const rangeAreaColors = getThemeColors(RANGE_AREA_TYPE, theme);

    return [
        {
            type: RANGE_AREA_TYPE,
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            xKey,
            yHighKey: highKey,
            yLowKey: closeKey,
            fill: rangeAreaColors.fill ?? PALETTE_UP_FILL,
            stroke: rangeAreaColors.stroke ?? PALETTE_UP_STROKE,
            fillOpacity: fromTheme(theme, (t) => t.overrides?.['range-area']?.series?.fillOpacity) ?? 0.3,
            strokeWidth: fromTheme(theme, (t) => t.overrides?.['range-area']?.series?.strokeWidth) ?? 2,
        } satisfies AgRangeAreaSeriesOptions,
        {
            type: RANGE_AREA_TYPE,
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            xKey,
            yHighKey: closeKey,
            yLowKey: lowKey,
            fill: rangeAreaColors.fill ?? PALETTE_DOWN_FILL,
            stroke: rangeAreaColors.stroke ?? PALETTE_DOWN_STROKE,
            fillOpacity: fromTheme(theme, (t) => t.overrides?.['range-area']?.series?.fillOpacity) ?? 0.3,
            strokeWidth: fromTheme(theme, (t) => t.overrides?.['range-area']?.series?.strokeWidth) ?? 2,
        } satisfies AgRangeAreaSeriesOptions,
        {
            type: 'line',
            ...common,
            ...singleKeys,
            stroke: fromTheme(theme, (t) => t.overrides?.line?.series?.stroke) ?? PALETTE_ALT_NEUTRAL_STROKE,
            strokeWidth: fromTheme(theme, (t) => t.overrides?.line?.series?.strokeWidth) ?? 2,
            marker: fromTheme(theme, (t) => t.overrides?.line?.series?.marker) ?? { enabled: false },
        } satisfies AgLineSeriesOptions,
    ];
}

function createPriceSeriesHighLow(
    common: PriceSeriesCommon,
    theme: ThemeType | undefined,
    { xKey, highKey, lowKey }: PriceSeriesKeys
) {
    const rangeBarColors = getThemeColors('range-bar', theme);

    return [
        {
            type: 'range-bar',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            xKey,
            yHighKey: highKey,
            yLowKey: lowKey,
            fill: rangeBarColors.fill ?? PALETTE_NEUTRAL_FILL,
            stroke: rangeBarColors.stroke ?? PALETTE_NEUTRAL_STROKE,
            tooltip: {
                range: 'nearest',
            },
        } satisfies AgRangeBarSeriesOptions,
    ];
}

function createPriceSeriesCandlestick(common: PriceSeriesCommon, keys: PriceSeriesKeys) {
    return [
        {
            type: 'candlestick',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            ...keys,
        } satisfies AgCandlestickSeriesOptions,
    ];
}

function createPriceSeriesHollowCandlestick(
    common: PriceSeriesCommon,
    theme: AgChartThemeName | AgChartTheme | undefined,
    keys: PriceSeriesKeys
) {
    const item = fromTheme(theme, (t) => t.overrides?.candlestick?.series?.item);
    return [
        {
            type: 'candlestick',
            // @ts-expect-error undocumented option
            focusPriority: 0,
            ...common,
            ...keys,
            item: {
                up: {
                    fill: item?.up?.fill ?? 'transparent',
                },
            },
        } satisfies AgCandlestickSeriesOptions,
    ];
}

function getThemeColors(seriesType: 'range-area' | 'range-bar', theme: AgChartThemeName | AgChartTheme | undefined) {
    const fill = fromTheme(theme, (t) => t.overrides?.[seriesType]?.series?.fill);
    const stroke = fromTheme(theme, (t) => t.overrides?.[seriesType]?.series?.stroke);
    return { fill, stroke };
}
