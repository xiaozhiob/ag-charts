import type {
    AgChartTheme,
    AgChartThemeOptions,
    AgChartThemeOverrides,
    AgChartThemePalette,
    AgCommonThemeableChartOptions,
    AgPaletteColors,
    AgPresetOverrides,
    AgThemeOverrides,
} from 'ag-charts-types';

import { type PaletteType, paletteType } from '../../module/coreModulesTypes';
import { enterpriseModule } from '../../module/enterpriseModule';
import { deepClone, jsonWalk } from '../../util/json';
import { deepFreeze, mergeDefaults } from '../../util/object';
import { isArray } from '../../util/type-guards';
import { axisRegistry } from '../factory/axisRegistry';
import { type ChartType, chartDefaults, chartTypes } from '../factory/chartTypes';
import { legendRegistry } from '../factory/legendRegistry';
import { seriesRegistry } from '../factory/seriesRegistry';
import { CARTESIAN_AXIS_TYPE, CARTESIAN_POSITION, FONT_SIZE, POLAR_AXIS_TYPE } from './constants';
import { DEFAULT_FILLS, DEFAULT_STROKES, type DefaultColors } from './defaultColors';
import {
    DEFAULT_ANNOTATION_BACKGROUND_FILL,
    DEFAULT_ANNOTATION_COLOR,
    DEFAULT_ANNOTATION_HANDLE_FILL,
    DEFAULT_ANNOTATION_STATISTICS_COLOR,
    DEFAULT_ANNOTATION_STATISTICS_DIVIDER_STROKE,
    DEFAULT_ANNOTATION_STATISTICS_DOWN_FILL,
    DEFAULT_ANNOTATION_STATISTICS_DOWN_STROKE,
    DEFAULT_ANNOTATION_STATISTICS_FILL,
    DEFAULT_ANNOTATION_STATISTICS_STROKE,
    DEFAULT_AXIS_GRID_COLOUR,
    DEFAULT_AXIS_LINE_COLOUR,
    DEFAULT_BACKGROUND_COLOUR,
    DEFAULT_CAPTION_ALIGNMENT,
    DEFAULT_CAPTION_LAYOUT_STYLE,
    DEFAULT_CROSS_LINES_COLOUR,
    DEFAULT_DIVERGING_SERIES_COLOR_RANGE,
    DEFAULT_FONT_FAMILY,
    DEFAULT_FUNNEL_SERIES_COLOR_RANGE,
    DEFAULT_GAUGE_SERIES_COLOR_RANGE,
    DEFAULT_GRIDLINE_ENABLED,
    DEFAULT_HIERARCHY_FILLS,
    DEFAULT_HIERARCHY_STROKES,
    DEFAULT_INSIDE_SERIES_LABEL_COLOUR,
    DEFAULT_INVERTED_LABEL_COLOUR,
    DEFAULT_LABEL_COLOUR,
    DEFAULT_MUTED_LABEL_COLOUR,
    DEFAULT_PADDING,
    DEFAULT_POLAR_SERIES_STROKE,
    DEFAULT_SHADOW_COLOUR,
    DEFAULT_TEXTBOX_COLOR,
    DEFAULT_TEXTBOX_FILL,
    DEFAULT_TEXTBOX_STROKE,
    DEFAULT_TEXT_ANNOTATION_COLOR,
    DEFAULT_TOOLBAR_POSITION,
    IS_COMMUNITY,
    IS_DARK_THEME,
    IS_ENTERPRISE,
    PALETTE_ALT_DOWN_FILL,
    PALETTE_ALT_DOWN_STROKE,
    PALETTE_ALT_NEUTRAL_FILL,
    PALETTE_ALT_NEUTRAL_STROKE,
    PALETTE_ALT_UP_FILL,
    PALETTE_ALT_UP_STROKE,
    PALETTE_DOWN_FILL,
    PALETTE_DOWN_STROKE,
    PALETTE_NEUTRAL_FILL,
    PALETTE_NEUTRAL_STROKE,
    PALETTE_UP_FILL,
    PALETTE_UP_STROKE,
} from './symbols';

// If this changes, update plugins/ag-charts-generate-chart-thumbnail/src/executors/generate/generator/constants.ts
const DEFAULT_BACKGROUND_FILL = 'white';

type ChartTypeConfig = {
    seriesTypes: string[];
    commonOptions: (keyof AgCommonThemeableChartOptions)[];
};

const CHART_TYPE_CONFIG: { [k in ChartType]: ChartTypeConfig } = {
    get cartesian(): ChartTypeConfig {
        return { seriesTypes: chartTypes.cartesianTypes, commonOptions: ['zoom', 'navigator'] };
    },
    get polar(): ChartTypeConfig {
        return { seriesTypes: chartTypes.polarTypes, commonOptions: [] };
    },
    get hierarchy(): ChartTypeConfig {
        return { seriesTypes: chartTypes.hierarchyTypes, commonOptions: [] };
    },
    get topology(): ChartTypeConfig {
        return { seriesTypes: chartTypes.topologyTypes, commonOptions: [] };
    },
    get 'flow-proportion'(): ChartTypeConfig {
        return { seriesTypes: chartTypes.flowProportionTypes, commonOptions: [] };
    },
    get standalone(): ChartTypeConfig {
        return { seriesTypes: chartTypes.standaloneTypes, commonOptions: [] };
    },
    get gauge(): ChartTypeConfig {
        return { seriesTypes: chartTypes.gaugeTypes, commonOptions: [] };
    },
};

type OverridesKey = keyof AgThemeOverrides;

const PRESET_OVERRIDES_TYPES: Record<keyof AgPresetOverrides, true> = {
    'radial-gauge': true,
    'linear-gauge': true,
};

function isPresetOverridesType(type: OverridesKey): type is keyof AgPresetOverrides {
    return PRESET_OVERRIDES_TYPES[type as keyof AgPresetOverrides] === true;
}

const CHART_TYPE_SPECIFIC_COMMON_OPTIONS = Object.values(CHART_TYPE_CONFIG).reduce<
    (keyof AgCommonThemeableChartOptions)[]
>((r, { commonOptions }) => r.concat(commonOptions), []);

export class ChartTheme {
    readonly palette: Required<AgChartThemePalette> & {
        altUp: AgPaletteColors;
        altDown: AgPaletteColors;
        altNeutral: AgPaletteColors;
    };
    readonly paletteType: PaletteType;

    readonly config: any;
    readonly presets: AgPresetOverrides;

    private static getAxisDefaults(overrideDefaults?: object) {
        return mergeDefaults(overrideDefaults, {
            title: {
                enabled: false,
                text: 'Axis Title',
                spacing: 25,
                fontWeight: 'normal' as const,
                fontSize: FONT_SIZE.MEDIUM,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_LABEL_COLOUR,
            },
            label: {
                fontSize: FONT_SIZE.SMALL,
                fontFamily: DEFAULT_FONT_FAMILY,
                padding: 11,
                color: DEFAULT_LABEL_COLOUR,
                avoidCollisions: true,
            },
            line: {
                enabled: true,
                width: 1,
                stroke: DEFAULT_AXIS_LINE_COLOUR,
            },
            tick: {
                enabled: false,
                width: 1,
                stroke: DEFAULT_AXIS_LINE_COLOUR,
            },
            gridLine: {
                enabled: true,
                style: [{ stroke: DEFAULT_AXIS_GRID_COLOUR, lineDash: [] }],
            },
            crossLines: {
                enabled: false,
                fill: DEFAULT_CROSS_LINES_COLOUR,
                stroke: DEFAULT_CROSS_LINES_COLOUR,
                fillOpacity: 0.1,
                strokeWidth: 1,
                label: {
                    enabled: false,
                    fontSize: FONT_SIZE.SMALL,
                    fontFamily: DEFAULT_FONT_FAMILY,
                    padding: 5,
                    color: DEFAULT_LABEL_COLOUR,
                },
            },
            crosshair: {
                enabled: true,
            },
        });
    }

    protected getChartDefaults() {
        return {
            minHeight: 300,
            minWidth: 300,
            background: { visible: true, fill: DEFAULT_BACKGROUND_COLOUR },
            padding: { top: DEFAULT_PADDING, right: DEFAULT_PADDING, bottom: DEFAULT_PADDING, left: DEFAULT_PADDING },
            keyboard: { enabled: true },
            title: {
                enabled: false,
                text: 'Title',
                fontWeight: 'normal' as const,
                fontSize: FONT_SIZE.LARGE,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_LABEL_COLOUR,
                wrapping: 'hyphenate',
                layoutStyle: DEFAULT_CAPTION_LAYOUT_STYLE,
                textAlign: DEFAULT_CAPTION_ALIGNMENT,
            },
            subtitle: {
                enabled: false,
                text: 'Subtitle',
                spacing: 20,
                fontSize: FONT_SIZE.MEDIUM,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_MUTED_LABEL_COLOUR,
                wrapping: 'hyphenate',
                layoutStyle: DEFAULT_CAPTION_LAYOUT_STYLE,
                textAlign: DEFAULT_CAPTION_ALIGNMENT,
            },
            footnote: {
                enabled: false,
                text: 'Footnote',
                spacing: 20,
                fontSize: FONT_SIZE.MEDIUM,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: 'rgb(140, 140, 140)',
                wrapping: 'hyphenate',
                layoutStyle: DEFAULT_CAPTION_LAYOUT_STYLE,
                textAlign: DEFAULT_CAPTION_ALIGNMENT,
            },
            legend: {
                position: CARTESIAN_POSITION.BOTTOM,
                spacing: 30,
                listeners: {},
                toggleSeries: true,
                item: {
                    paddingX: 16,
                    paddingY: 8,
                    marker: { size: 15, padding: 8 },
                    showSeriesStroke: true,
                    label: {
                        color: DEFAULT_LABEL_COLOUR,
                        fontSize: FONT_SIZE.SMALL,
                        fontFamily: DEFAULT_FONT_FAMILY,
                    },
                },
                reverseOrder: false,
                pagination: {
                    marker: { size: 12 },
                    activeStyle: { fill: DEFAULT_LABEL_COLOUR },
                    inactiveStyle: { fill: DEFAULT_MUTED_LABEL_COLOUR },
                    highlightStyle: { fill: DEFAULT_LABEL_COLOUR },
                    label: { color: DEFAULT_LABEL_COLOUR },
                },
            },
            tooltip: {
                enabled: true,
                darkTheme: IS_DARK_THEME,
                delay: 0,
            },
            overlays: { darkTheme: IS_DARK_THEME },
            listeners: {},
        };
    }

    private static readonly cartesianAxisDefault = {
        [CARTESIAN_AXIS_TYPE.NUMBER]: ChartTheme.getAxisDefaults({
            line: { enabled: false },
        }),
        [CARTESIAN_AXIS_TYPE.LOG]: ChartTheme.getAxisDefaults({
            base: 10,
            line: { enabled: false },
            interval: { minSpacing: NaN },
        }),
        [CARTESIAN_AXIS_TYPE.CATEGORY]: ChartTheme.getAxisDefaults({
            groupPaddingInner: 0.1,
            label: { autoRotate: true },
            gridLine: { enabled: DEFAULT_GRIDLINE_ENABLED },
            crosshair: { enabled: false },
        }),
        [CARTESIAN_AXIS_TYPE.GROUPED_CATEGORY]: ChartTheme.getAxisDefaults({
            tick: { enabled: true },
            label: { padding: 5 },
            paddingOuter: 0.1,
            paddingInner: 0.2,
        }),
        [CARTESIAN_AXIS_TYPE.TIME]: ChartTheme.getAxisDefaults({ gridLine: { enabled: DEFAULT_GRIDLINE_ENABLED } }),
        [CARTESIAN_AXIS_TYPE.ORDINAL_TIME]: ChartTheme.getAxisDefaults({
            groupPaddingInner: 0,
            label: { autoRotate: false },
            gridLine: { enabled: DEFAULT_GRIDLINE_ENABLED },
        }),
        [POLAR_AXIS_TYPE.ANGLE_CATEGORY]: ChartTheme.getAxisDefaults({
            label: { padding: 5 },
            gridLine: { enabled: DEFAULT_GRIDLINE_ENABLED },
        }),
        [POLAR_AXIS_TYPE.ANGLE_NUMBER]: ChartTheme.getAxisDefaults({
            label: { padding: 5 },
            gridLine: { enabled: DEFAULT_GRIDLINE_ENABLED },
        }),
        [POLAR_AXIS_TYPE.RADIUS_CATEGORY]: ChartTheme.getAxisDefaults({
            line: { enabled: false },
        }),
        [POLAR_AXIS_TYPE.RADIUS_NUMBER]: ChartTheme.getAxisDefaults({
            line: { enabled: false },
        }),
    };

    constructor(options: AgChartTheme = {}) {
        const { overrides, palette } = deepClone(options) as AgChartThemeOptions;
        const defaults = this.createChartConfigPerChartType(this.getDefaults());
        const presets: Record<string, any> = {};

        if (overrides) {
            this.mergeOverrides(defaults, presets, overrides);
        }

        const { fills, strokes, ...otherColors } = this.getDefaultColors();
        this.palette = deepFreeze(
            mergeDefaults(palette, {
                fills: Object.values(fills),
                strokes: Object.values(strokes),
                ...otherColors,
            })
        );
        this.paletteType = paletteType(palette);

        this.config = deepFreeze(this.templateTheme(defaults));
        this.presets = deepFreeze(presets);
    }

    private mergeOverrides(defaults: AgChartThemeOverrides, presets: AgPresetOverrides, overrides: AgThemeOverrides) {
        for (const { seriesTypes, commonOptions } of Object.values(CHART_TYPE_CONFIG)) {
            const cleanedCommon = { ...overrides.common };
            for (const commonKey of CHART_TYPE_SPECIFIC_COMMON_OPTIONS) {
                if (!commonOptions.includes(commonKey)) {
                    delete cleanedCommon[commonKey];
                }
            }
            if (!cleanedCommon) continue;
            for (const s of seriesTypes) {
                const seriesType = s as keyof AgThemeOverrides;

                if (!isPresetOverridesType(seriesType)) {
                    defaults[seriesType] = mergeDefaults(cleanedCommon, defaults[seriesType]);
                }
            }
        }

        chartTypes.seriesTypes.forEach((s) => {
            const seriesType = s as keyof AgThemeOverrides;
            const seriesOverrides = overrides[seriesType];

            if (isPresetOverridesType(seriesType)) {
                presets[seriesType] = seriesOverrides as any;
            } else {
                defaults[seriesType] = mergeDefaults(seriesOverrides, defaults[seriesType]);
            }
        });
    }

    private createChartConfigPerChartType(config: AgChartThemeOverrides) {
        for (const [nextType, { seriesTypes }] of Object.entries(CHART_TYPE_CONFIG)) {
            const typeDefaults = chartDefaults.get(nextType as ChartType);
            for (const seriesType of seriesTypes) {
                config[seriesType as keyof AgChartThemeOverrides] ??= deepClone(typeDefaults);
            }
        }
        return config;
    }

    private getDefaults(): AgChartThemeOverrides {
        const getOverridesByType = (chartType: ChartType, seriesTypes: string[]) => {
            const result: Record<string, { series?: object; axes?: object }> = {};
            const chartTypeDefaults = {
                axes: {},
                ...legendRegistry.getThemeTemplates(),
                ...this.getChartDefaults(),
                ...chartDefaults.get(chartType),
            };
            for (const seriesType of seriesTypes) {
                result[seriesType] = mergeDefaults(
                    seriesRegistry.getThemeTemplate(seriesType),
                    result[seriesType] ?? deepClone(chartTypeDefaults)
                );

                const { axes } = result[seriesType] as { axes: Record<string, object> };

                for (const axisType of axisRegistry.keys()) {
                    axes[axisType] = mergeDefaults(
                        axes[axisType],
                        axisRegistry.getThemeTemplate(axisType),
                        (ChartTheme.cartesianAxisDefault as any)[axisType]
                    );
                }
            }

            return result;
        };

        return mergeDefaults(
            getOverridesByType('cartesian', chartTypes.cartesianTypes),
            getOverridesByType('polar', chartTypes.polarTypes),
            getOverridesByType('hierarchy', chartTypes.hierarchyTypes),
            getOverridesByType('topology', chartTypes.topologyTypes),
            getOverridesByType('flow-proportion', chartTypes.flowProportionTypes),
            getOverridesByType('standalone', chartTypes.standaloneTypes),
            getOverridesByType('gauge', chartTypes.gaugeTypes)
        );
    }

    private static applyTemplateTheme(this: void, node: any, _other: any, params?: Map<any, any>) {
        if (isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const symbol = node[i];
                if (typeof symbol === 'symbol' && params?.has(symbol)) {
                    node[i] = params.get(symbol);
                }
            }
        } else {
            for (const [name, value] of Object.entries(node)) {
                if (typeof value === 'symbol' && params?.has(value)) {
                    node[name] = params.get(value);
                }
            }
        }
    }

    templateTheme<T>(themeTemplate: T, clone = true): T {
        const themeInstance = clone ? deepClone(themeTemplate) : themeTemplate;
        const params = this.getTemplateParameters();

        jsonWalk(themeInstance, ChartTheme.applyTemplateTheme, undefined, undefined, params);

        return themeInstance;
    }

    protected getDefaultColors(): DefaultColors {
        return {
            fills: DEFAULT_FILLS,
            strokes: DEFAULT_STROKES,
            up: { fill: DEFAULT_FILLS.GREEN, stroke: DEFAULT_STROKES.GREEN },
            down: { fill: DEFAULT_FILLS.RED, stroke: DEFAULT_STROKES.RED },
            neutral: { fill: DEFAULT_FILLS.GRAY, stroke: DEFAULT_STROKES.GRAY },
            altUp: { fill: DEFAULT_FILLS.BLUE, stroke: DEFAULT_STROKES.BLUE },
            altDown: { fill: DEFAULT_FILLS.ORANGE, stroke: DEFAULT_STROKES.ORANGE },
            altNeutral: { fill: DEFAULT_FILLS.GRAY, stroke: DEFAULT_STROKES.GRAY },
        };
    }

    getTemplateParameters() {
        const { isEnterprise } = enterpriseModule;

        const params = new Map();
        params.set(IS_DARK_THEME, false);
        params.set(IS_ENTERPRISE, isEnterprise);
        params.set(IS_COMMUNITY, !isEnterprise);
        params.set(DEFAULT_FONT_FAMILY, 'Verdana, sans-serif');
        params.set(DEFAULT_LABEL_COLOUR, 'rgb(70, 70, 70)');
        params.set(DEFAULT_INVERTED_LABEL_COLOUR, 'white');
        params.set(DEFAULT_MUTED_LABEL_COLOUR, 'rgb(140, 140, 140)');
        params.set(DEFAULT_AXIS_GRID_COLOUR, 'rgb(224,234,241)');
        params.set(DEFAULT_AXIS_LINE_COLOUR, 'rgb(195, 195, 195)');
        params.set(DEFAULT_CROSS_LINES_COLOUR, 'rgb(70, 70, 70)');
        params.set(DEFAULT_INSIDE_SERIES_LABEL_COLOUR, DEFAULT_BACKGROUND_FILL);
        params.set(DEFAULT_BACKGROUND_COLOUR, DEFAULT_BACKGROUND_FILL);
        params.set(DEFAULT_SHADOW_COLOUR, 'rgba(0, 0, 0, 0.5)');
        params.set(DEFAULT_DIVERGING_SERIES_COLOR_RANGE, [
            DEFAULT_FILLS.ORANGE,
            DEFAULT_FILLS.YELLOW,
            DEFAULT_FILLS.GREEN,
        ]);
        params.set(DEFAULT_GAUGE_SERIES_COLOR_RANGE, [DEFAULT_FILLS.GREEN, DEFAULT_FILLS.YELLOW, DEFAULT_FILLS.RED]);
        params.set(DEFAULT_FUNNEL_SERIES_COLOR_RANGE, [
            '#5090dc',
            '#629be0',
            '#73a6e3',
            '#85b1e7',
            '#96bcea',
            '#a8c8ee',
            '#b9d3f1',
            '#cbdef5',
        ]);
        params.set(DEFAULT_PADDING, 20);
        params.set(DEFAULT_CAPTION_LAYOUT_STYLE, 'block');
        params.set(DEFAULT_CAPTION_ALIGNMENT, 'center');
        params.set(DEFAULT_HIERARCHY_FILLS, ['#ffffff', '#e0e5ea', '#c1ccd5', '#a3b4c1', '#859cad']);
        params.set(DEFAULT_HIERARCHY_STROKES, ['#ffffff', '#c5cbd1', '#a4b1bd', '#8498a9', '#648096']);
        params.set(DEFAULT_POLAR_SERIES_STROKE, DEFAULT_BACKGROUND_FILL);

        params.set(DEFAULT_ANNOTATION_COLOR, DEFAULT_FILLS.BLUE);
        params.set(DEFAULT_TEXT_ANNOTATION_COLOR, DEFAULT_FILLS.BLUE);
        params.set(DEFAULT_ANNOTATION_BACKGROUND_FILL, DEFAULT_FILLS.BLUE);
        params.set(DEFAULT_ANNOTATION_HANDLE_FILL, DEFAULT_BACKGROUND_FILL);
        params.set(DEFAULT_ANNOTATION_STATISTICS_FILL, '#fafafa');
        params.set(DEFAULT_ANNOTATION_STATISTICS_STROKE, '#dddddd');
        params.set(DEFAULT_ANNOTATION_STATISTICS_COLOR, '#000000');
        params.set(DEFAULT_ANNOTATION_STATISTICS_DIVIDER_STROKE, '#181d1f');
        params.set(DEFAULT_ANNOTATION_STATISTICS_DOWN_FILL, '#e35c5c');
        params.set(DEFAULT_ANNOTATION_STATISTICS_DOWN_STROKE, '#e35c5c');

        params.set(DEFAULT_TEXTBOX_FILL, '#fafafa');
        params.set(DEFAULT_TEXTBOX_STROKE, '#dddddd');
        params.set(DEFAULT_TEXTBOX_COLOR, '#000000');

        params.set(DEFAULT_TOOLBAR_POSITION, 'top');
        params.set(DEFAULT_GRIDLINE_ENABLED, false);

        const defaultColors = this.getDefaultColors();
        params.set(PALETTE_UP_STROKE, this.palette.up?.stroke ?? defaultColors.up.stroke);
        params.set(PALETTE_UP_FILL, this.palette.up?.fill ?? defaultColors.up.fill);
        params.set(PALETTE_DOWN_STROKE, this.palette.down?.stroke ?? defaultColors.down.stroke);
        params.set(PALETTE_DOWN_FILL, this.palette.down?.fill ?? defaultColors.down.fill);
        params.set(PALETTE_NEUTRAL_STROKE, this.palette.neutral?.stroke ?? defaultColors.neutral.stroke);
        params.set(PALETTE_NEUTRAL_FILL, this.palette.neutral?.fill ?? defaultColors.neutral.fill);
        params.set(PALETTE_ALT_UP_STROKE, this.palette.altUp?.stroke ?? defaultColors.up.stroke);
        params.set(PALETTE_ALT_UP_FILL, this.palette.altUp?.fill ?? defaultColors.up.fill);
        params.set(PALETTE_ALT_DOWN_STROKE, this.palette.altDown?.stroke ?? defaultColors.down.stroke);
        params.set(PALETTE_ALT_DOWN_FILL, this.palette.altDown?.fill ?? defaultColors.down.fill);
        params.set(PALETTE_ALT_NEUTRAL_FILL, this.palette.altNeutral?.fill ?? defaultColors.altNeutral.fill);
        params.set(PALETTE_ALT_NEUTRAL_STROKE, this.palette.altNeutral?.stroke ?? defaultColors.altNeutral.stroke);

        return params;
    }
}
