import { afterEach, describe, expect, it } from '@jest/globals';

import type { AgCartesianChartOptions } from 'ag-charts-types';

import { AgCharts } from '../../api/agCharts';
import * as CROSSLINE_EXAMPLES from '../crossline/test/examples';
import {
    type CartesianTestCase,
    IMAGE_SNAPSHOT_DEFAULTS,
    cartesianChartAssertions,
    expectWarningsCalls,
    extractImageData,
    prepareTestOptions,
    repeat,
    setupMockCanvas,
    setupMockConsole,
    waitForChartStability,
} from '../test/utils';

const { VALID_RANGE_CROSSLINES } = CROSSLINE_EXAMPLES;

const NAVIGATOR_ZOOM_EXAMPLES: Record<string, CartesianTestCase> = {
    NAV_ZOOMED_CROSSLINES: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.4, end: 0.6 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_NO_CROSSLINES: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0, end: 0.05 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_NO_CROSSLINES_2: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.95, end: 1.0 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_CLIPPED_CROSSLINES_1: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0, end: 0.5 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_CLIPPED_CROSSLINES_2: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.5, end: 1.0 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_INSIDE_CROSSLINES_1: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.4, end: 0.6 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_INSIDE_CROSSLINES_2: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.51, end: 0.55 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_EDGE_CROSSLINES_1: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.14661198412976173, end: 0.3286788694841538 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_EDGE_CROSSLINES_2: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 0.15, end: 0.3286788694841538 + 0.001 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_EDGE_CROSSLINES_3: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 1 - 0.3286788694841538, end: 1 - 0.14661198412976173 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
    NAV_ZOOMED_EDGE_CROSSLINES_4: {
        options: {
            ...VALID_RANGE_CROSSLINES,
            navigator: { enabled: true },
            initialState: { zoom: { ratioX: { start: 1 - 0.3286788694841538 - 0.006, end: 0.85 } } },
        },
        assertions: cartesianChartAssertions({ axisTypes: ['time', 'number'], seriesTypes: repeat('line', 2) }),
    },
};

describe('Navigator', () => {
    setupMockConsole();

    let chart: any;

    afterEach(() => {
        if (chart) {
            chart.destroy();
            (chart as unknown) = undefined;
        }
    });

    const ctx = setupMockCanvas();

    describe('#create', () => {
        it.each(Object.entries(NAVIGATOR_ZOOM_EXAMPLES))(
            'for %s it should create chart instance as expected',
            async (_exampleName, example) => {
                const options: AgCartesianChartOptions = { ...example.options };
                prepareTestOptions(options);

                chart = AgCharts.create(options);
                await waitForChartStability(chart);
                await example.assertions(chart);

                expectWarningsCalls().toEqual([]);
            }
        );

        it.each(Object.entries(NAVIGATOR_ZOOM_EXAMPLES))(
            'for %s it should render to canvas as expected',
            async (_exampleName, example) => {
                const compare = async () => {
                    await waitForChartStability(chart);

                    const imageData = extractImageData(ctx);
                    expect(imageData).toMatchImageSnapshot(IMAGE_SNAPSHOT_DEFAULTS);
                };

                const options: AgCartesianChartOptions = { ...example.options };
                prepareTestOptions(options);

                chart = AgCharts.create(options);
                await compare();

                expectWarningsCalls().toEqual([]);
            }
        );
    });
});
