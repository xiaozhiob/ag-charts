import { _ModuleSupport } from 'ag-charts-community';

import { Annotations } from './annotations';

const { ThemeSymbols } = _ModuleSupport;

const stroke = {
    stroke: ThemeSymbols.DEFAULT_ANNOTATION_COLOR,
    strokeOpacity: 1,
    strokeWidth: 2,
};

const handle = {
    fill: ThemeSymbols.DEFAULT_ANNOTATION_HANDLE_FILL,
    strokeOpacity: 1,
    strokeWidth: 2,
};

const font = {
    color: ThemeSymbols.DEFAULT_TEXT_ANNOTATION_COLOR,
    fontSize: 14,
    fontFamily: ThemeSymbols.DEFAULT_FONT_FAMILY,
};

const axisLabel = {
    ...font,
    enabled: true,
    color: 'white',
    fill: ThemeSymbols.DEFAULT_ANNOTATION_COLOR,
    fontSize: 12,
};

const text = {
    ...font,
    color: ThemeSymbols.DEFAULT_TEXT_ANNOTATION_COLOR,
    textAlign: 'left',
};

const lineText = {
    ...font,
    position: 'top',
    alignment: 'center',
    color: ThemeSymbols.DEFAULT_ANNOTATION_COLOR,
};

const measurerStatistics = {
    ...font,
    fontSize: 12,
    color: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_COLOR,
    fill: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_FILL,
    stroke: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_STROKE,
    strokeWidth: 1,
    divider: {
        stroke: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_DIVIDER_STROKE,
        strokeWidth: 1,
        strokeOpacity: 0.5,
    },
};

const measurer = {
    ...stroke,
    background: {
        fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
        fillOpacity: 0.2,
    },
    handle: { ...handle },
    text: { ...lineText },
    statistics: { ...measurerStatistics },
};

export const AnnotationsModule: _ModuleSupport.Module = {
    type: 'root',
    optionsKey: 'annotations',
    packageType: 'enterprise',
    chartTypes: ['cartesian'],
    dependencies: ['toolbar'],
    moduleFactory: (ctx) => new Annotations(ctx),
    themeTemplate: {
        annotations: {
            // Lines
            line: {
                ...stroke,
                handle: { ...handle },
                text: { ...lineText },
            },
            'horizontal-line': {
                ...stroke,
                handle: { ...handle },
                axisLabel: { ...axisLabel },
                text: { ...lineText },
            },
            'vertical-line': {
                ...stroke,
                handle: { ...handle },
                axisLabel: { ...axisLabel },
                text: { ...lineText },
            },

            // Channels
            'disjoint-channel': {
                ...stroke,
                background: {
                    fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
                    fillOpacity: 0.2,
                },
                handle: { ...handle },
                text: { ...lineText },
            },
            'parallel-channel': {
                ...stroke,
                middle: {
                    lineDash: [6, 5],
                    strokeWidth: 1,
                },
                background: {
                    fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
                    fillOpacity: 0.2,
                },
                handle: { ...handle },
                text: { ...lineText },
            },

            // Texts
            callout: {
                ...stroke,
                ...text,
                color: ThemeSymbols.DEFAULT_LABEL_COLOUR,
                handle: { ...handle },
                fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
                fillOpacity: 0.2,
            },
            comment: {
                ...text,
                color: 'white',
                fontWeight: 700,
                handle: { ...handle },
                fill: ThemeSymbols.DEFAULT_ANNOTATION_COLOR,
            },
            note: {
                ...text,
                color: ThemeSymbols.DEFAULT_TEXTBOX_COLOR,
                fill: ThemeSymbols.DEFAULT_ANNOTATION_COLOR,
                stroke: ThemeSymbols.DEFAULT_ANNOTATION_HANDLE_FILL,
                strokeWidth: 1,
                strokeOpacity: 1,
                handle: { ...handle },
                background: {
                    fill: ThemeSymbols.DEFAULT_TEXTBOX_FILL,
                    stroke: ThemeSymbols.DEFAULT_TEXTBOX_STROKE,
                    strokeWidth: 1,
                },
            },
            text: {
                ...text,
                handle: { ...handle },
            },

            // Shapes
            arrow: {
                ...stroke,
                handle: { ...handle },
                text: { ...lineText },
            },
            'arrow-up': {
                fill: ThemeSymbols.PALETTE_UP_FILL,
                handle: { ...handle, stroke: ThemeSymbols.DEFAULT_ANNOTATION_COLOR },
            },
            'arrow-down': {
                fill: ThemeSymbols.PALETTE_DOWN_FILL,
                handle: { ...handle, stroke: ThemeSymbols.DEFAULT_ANNOTATION_COLOR },
            },

            // Measurers
            'date-range': {
                ...measurer,
            },
            'price-range': {
                ...measurer,
            },
            'date-price-range': {
                ...measurer,
            },
            'quick-date-price-range': {
                up: {
                    ...stroke,
                    fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
                    fillOpacity: 0.2,
                    handle: { ...handle },
                    statistics: {
                        ...measurerStatistics,
                        color: '#fff',
                        fill: ThemeSymbols.DEFAULT_ANNOTATION_BACKGROUND_FILL,
                        strokeWidth: 0,
                        divider: {
                            stroke: '#fff',
                            strokeWidth: 1,
                            strokeOpacity: 0.5,
                        },
                    },
                },
                down: {
                    ...stroke,
                    stroke: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_DOWN_STROKE,
                    fill: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_DOWN_FILL,
                    fillOpacity: 0.2,
                    handle: {
                        ...handle,
                        stroke: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_DOWN_STROKE,
                    },
                    statistics: {
                        ...measurerStatistics,
                        color: '#fff',
                        fill: ThemeSymbols.DEFAULT_ANNOTATION_STATISTICS_DOWN_FILL,
                        strokeWidth: 0,
                        divider: {
                            stroke: '#fff',
                            strokeWidth: 1,
                            strokeOpacity: 0.5,
                        },
                    },
                },
            },
        },
    },
};
