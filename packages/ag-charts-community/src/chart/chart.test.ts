import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { AgCartesianChartOptions, AgPolarChartOptions, InteractionRange } from 'ag-charts-types';

import { AgCharts } from '../api/agCharts';
import type { Node } from '../scene/node';
import { Selection } from '../scene/selection';
import { Rect } from '../scene/shape/rect';
import { Sector } from '../scene/shape/sector';
import { Transformable } from '../scene/transformable';
import type { Chart } from './chart';
import type { AgChartProxy } from './chartProxy';
import { Circle } from './marker/circle';
import {
    clickAction,
    createChart,
    deproxy,
    hoverAction,
    prepareTestOptions,
    setupMockCanvas,
    setupMockConsole,
    waitForChartStability,
} from './test/utils';

describe('Chart', () => {
    setupMockConsole();

    let chart: Chart;

    afterEach(() => {
        if (chart) {
            chart.destroy();
            (chart as unknown) = undefined;
        }
    });

    setupMockCanvas();

    const datasets = {
        economy: {
            data: [
                { year: '2018', gdp: 12000, gnp: 10000 },
                { year: '2019', gdp: 18000, gnp: 16000 },
                { year: '2020', gdp: 20000, gnp: 18000 },
            ],
            valueKey: 'gdp',
            valueKey2: 'gnp',
            categoryKey: 'year',
        },
        food: {
            data: {
                name: 'Food',
                children: [
                    {
                        name: 'Fruits',
                        children: [
                            { name: 'Banana', count: 10 },
                            { name: 'Apple', count: 5 },
                        ],
                    },
                    {
                        name: 'Vegetables',
                        children: [{ name: 'Cucumber', count: 2 }],
                    },
                ],
            },
            valueKey: 'count',
            labelKey: 'name',
        },
    };

    const testPointerEvents = (testParams: {
        seriesOptions: any;
        chartOptions?: any;
        getNodeData: (series: any) => any[];
        getNodePoint: (nodeItem: any) => [number, number];
        getNodeExitPoint: (nodeItem: any) => [number, number];
        getDatumValues: (datum: any, series: any) => any[];
        getTooltipRenderedValues: (tooltipRendererParams: any) => any[];
        getHighlightNode: (chart: any, series: any) => any;
    }) => {
        const format = (...values: any[]) => values.join(': ');

        const createChartPreset = async (params: {
            hasTooltip: boolean;
            onNodeClick?: () => void;
            nodeClickRange?: InteractionRange;
        }): Promise<Chart> => {
            const tooltip = params.hasTooltip
                ? {
                      renderer(rParams: any) {
                          const values = testParams.getTooltipRenderedValues(rParams);
                          return format(...values);
                      },
                  }
                : { enabled: false };

            const listeners = params.onNodeClick ? { nodeClick: params.onNodeClick } : undefined;
            const nodeClickRangeParams = params.nodeClickRange ? { nodeClickRange: params.nodeClickRange } : {};
            const options: AgCartesianChartOptions | AgPolarChartOptions = {
                container: document.body,
                series: [
                    {
                        tooltip,
                        highlightStyle: { item: { fill: 'lime' } },
                        listeners,
                        ...nodeClickRangeParams,
                        ...testParams.seriesOptions,
                    },
                ],
                ...(testParams.chartOptions ?? {}),
            };
            return createChart(options);
        };

        const hoverChartNodes = async (
            chartInstance: Chart,
            iterator: (params: { series: any; item: any; x: number; y: number }) => Promise<void> | void
        ) => {
            for (const series of chartInstance.series) {
                const nodeData = testParams.getNodeData(series);
                expect(nodeData.length).toBeGreaterThan(0);
                for (const item of nodeData) {
                    const itemPoint = testParams.getNodePoint(item);
                    const { x, y } = Transformable.toCanvasPoint(series.contentGroup, itemPoint[0], itemPoint[1]);
                    await hoverAction(x, y)(chartInstance);
                    await waitForChartStability(chartInstance);
                    await iterator({ series, item, x, y });
                }
            }
        };

        const checkHighlight = async (chartInstance: Chart) => {
            await hoverChartNodes(chartInstance, ({ series }) => {
                // Check the highlighted marker
                const highlightNode = testParams.getHighlightNode(chartInstance, series);
                expect(highlightNode).toBeDefined();
                expect(highlightNode.fill).toEqual('lime');
            });
        };

        const checkNodeClick = async (
            chartInstance: Chart,
            onNodeClick: () => void,
            offsetX?: boolean,
            offsetY?: boolean
        ) => {
            await hoverChartNodes(chartInstance, async ({ x, y }) => {
                const seriesAreaCenter = (chartInstance as any).seriesRect.computeCenter();

                if (offsetX) {
                    x += x < seriesAreaCenter.x ? 5 : -5;
                }
                if (offsetY) {
                    y += y < seriesAreaCenter.y ? 5 : -5;
                }
                // Perform click
                await clickAction(x, y)(chartInstance);
                await waitForChartStability(chartInstance);
            });

            // Check click handler
            const nodeCount = chartInstance.series.reduce(
                (sum, series) => sum + testParams.getNodeData(series).length,
                0
            );
            expect(onNodeClick).toHaveBeenCalledTimes(nodeCount);
        };

        const checkMouseUpOnlyClick = async (
            chartInstance: Chart,
            onNodeClick: () => void,
            nodeExit: (item: any) => [number, number]
        ) => {
            await hoverChartNodes(chartInstance, async ({ item, x, y }) => {
                // Perform click
                const [downX, downY] = nodeExit(item);
                await clickAction(x, y, { mousedown: { offsetX: downX, offsetY: downY } })(chartInstance);
                await waitForChartStability(chartInstance);
            });

            // Check click handler
            expect(onNodeClick).toHaveBeenCalledTimes(0);
        };

        it(`should render tooltip correctly`, async () => {
            chart = await createChartPreset({ hasTooltip: true });
            await hoverChartNodes(chart, ({ series, item }) => {
                // Check the tooltip is shown
                const tooltip = document.querySelector('.ag-chart-tooltip');
                expect(tooltip).toBeInstanceOf(HTMLElement);
                expect(tooltip?.classList.contains('ag-chart-tooltip-hidden')).toBe(false);

                // Check the tooltip text
                const values = testParams.getDatumValues(item, series);
                expect(tooltip?.textContent).toEqual(format(...values));
            });

            // Check the tooltip is hidden
            await hoverAction(0, 0)(chart);
            await waitForChartStability(chart);
            const tooltip = document.querySelector('.ag-chart-tooltip');
            expect(tooltip?.classList.contains('ag-chart-tooltip-hidden')).toBe(true);
        });

        it(`should highlight hovered items`, async () => {
            chart = await createChartPreset({ hasTooltip: true });
            await checkHighlight(chart);
        });

        it(`should handle nodeClick event`, async () => {
            const onNodeClick = jest.fn();
            chart = await createChartPreset({ hasTooltip: true, onNodeClick });
            await checkNodeClick(chart, onNodeClick);
        });

        it(`should highlight hovered items when tooltip is disabled`, async () => {
            chart = await createChartPreset({ hasTooltip: false });
            await checkHighlight(chart);
        });

        it(`should handle nodeClick event when tooltip is disabled`, async () => {
            const onNodeClick = jest.fn();
            chart = await createChartPreset({ hasTooltip: false, onNodeClick });
            await checkNodeClick(chart, onNodeClick);
        });

        it(`should handle nodeClick event with offset click when range is 'nearest'`, async () => {
            const onNodeClick = jest.fn();
            chart = await createChartPreset({ hasTooltip: true, onNodeClick, nodeClickRange: 'nearest' });
            await checkNodeClick(chart, onNodeClick, true, true);
        });

        it(`should handle nodeClick event with offset click when range is within pixel distance`, async () => {
            const onNodeClick = jest.fn();
            chart = await createChartPreset({ hasTooltip: true, onNodeClick, nodeClickRange: 6 });
            await waitForChartStability(chart);
            await checkNodeClick(chart, onNodeClick, false, true);
        });

        it(`should trigger nodeClick event only on mousedown and mouseup`, async () => {
            const onNodeClick = jest.fn();
            chart = await createChartPreset({ hasTooltip: true });
            await waitForChartStability(chart);
            await checkMouseUpOnlyClick(chart, onNodeClick, testParams.getNodeExitPoint);
        });
    };

    const cartesianTestParams = {
        getNodeData: (series) => series.contextNodeData?.nodeData ?? [],
        getTooltipRenderedValues: (params) => [params.datum[params.xKey], params.datum[params.yKey]],
        // Returns a highlighted marker
        getHighlightNode: (_, series) => series.highlightNode.children().next().value,
    } as Parameters<typeof testPointerEvents>[0];

    describe(`Line Series Pointer Events`, () => {
        testPointerEvents({
            ...cartesianTestParams,
            seriesOptions: {
                type: 'line',
                data: datasets.economy.data,
                xKey: datasets.economy.categoryKey,
                yKey: datasets.economy.valueKey,
            },
            getNodePoint: (item) => [item.point.x, item.point.y],
            getNodeExitPoint: (item) => [item.point.x, item.point.y + 8],
            getDatumValues: (item, series) => {
                const xValue = item.datum[series.properties['xKey']];
                const yValue = item.datum[series.properties['yKey']];
                return [xValue, yValue];
            },
        });
    });

    describe(`Area Series Pointer Events`, () => {
        testPointerEvents({
            ...cartesianTestParams,
            seriesOptions: {
                type: 'area',
                data: datasets.economy.data,
                xKey: datasets.economy.categoryKey,
                yKey: datasets.economy.valueKey,
                marker: {
                    enabled: true,
                },
            },
            getNodePoint: (item) => [item.point.x, item.point.y],
            getNodeExitPoint: (item) => [item.point.x, item.point.y + 8],
            getDatumValues: (item, series) => {
                const xValue = item.datum[series.properties.xKey];
                const yValue = item.datum[series.properties.yKey];
                return [xValue, yValue];
            },
        });
    });

    describe(`Scatter Series Pointer Events`, () => {
        testPointerEvents({
            ...cartesianTestParams,
            seriesOptions: {
                type: 'scatter',
                data: datasets.economy.data,
                xKey: datasets.economy.categoryKey,
                yKey: datasets.economy.valueKey,
            },
            chartOptions: {
                axes: [
                    { type: 'number', position: 'left' },
                    { type: 'category', position: 'bottom' },
                ],
            },
            getNodePoint: (item) => [item.point.x, item.point.y],
            getNodeExitPoint: (item) => [item.point.x, item.point.y + 8],
            getDatumValues: (item, series) => {
                const xValue = item.datum[series.properties['xKey']];
                const yValue = item.datum[series.properties['yKey']];
                return [xValue, yValue];
            },
        });
    });

    describe(`Bar Series Pointer Events`, () => {
        testPointerEvents({
            ...cartesianTestParams,
            seriesOptions: {
                type: 'bar',
                data: datasets.economy.data,
                xKey: datasets.economy.categoryKey,
                yKey: datasets.economy.valueKey,
            },
            getNodePoint: (item) => [item.x + item.width / 2, item.y + item.height / 2],
            getNodeExitPoint: (item) => [item.x + item.width / 2, item.y + item.height + 8],
            getDatumValues: (item, series) => {
                const xValue = item.datum[series.properties.xKey];
                const yValue = item.datum[series.properties.yKey];
                return [xValue, yValue];
            },
        });
    });

    describe(`Pie Series Pointer Events`, () => {
        testPointerEvents({
            seriesOptions: {
                type: 'pie',
                data: datasets.economy.data,
                angleKey: datasets.economy.valueKey,
                sectorLabelKey: datasets.economy.categoryKey,
            },
            getNodeData: (series) => series.labelSelection.nodes(),
            getNodePoint: (item) => [item.x, item.y],
            getNodeExitPoint: (_item) => [20, 20],
            getDatumValues: (item, series) => {
                const category = item.datum.datum[series.properties.sectorLabelKey];
                const value = item.datum.datum[series.properties.angleKey];
                return [category, value];
            },
            getTooltipRenderedValues: (params) => [params.datum[params.sectorLabelKey], params.datum[params.angleKey]],
            getHighlightNode: (chartInstance, series) => {
                // Returns a highlighted sector
                const highlightedDatum = chartInstance.ctx.highlightManager.getActiveHighlight();
                for (const child of series.highlightGroup.children()) {
                    if (child.datum?.itemId === highlightedDatum.itemId) {
                        return child;
                    }
                }
            },
        });
    });

    describe('Chart data change', () => {
        const testDataUpdate = async (testOptions: { seriesOptions: any; getNodes: (chart: Chart) => Node[] }) => {
            const chartOptions = prepareTestOptions<{
                data: { year: string; gdp: number; gnp: number }[];
                series: any[];
            }>({
                data: [],
                series: [testOptions.seriesOptions],
            });
            const chartProxy = AgCharts.create(chartOptions);
            chart = deproxy(chartProxy);
            await waitForChartStability(chart);
            expect(testOptions.getNodes(chart).length).toEqual(0);

            await chartProxy.updateDelta({
                data: datasets.economy.data,
            });
            await waitForChartStability(chart);
            expect(testOptions.getNodes(chart).length).toEqual(3);

            await chartProxy.updateDelta({
                data: datasets.economy.data.slice(0, 2),
            });
            await waitForChartStability(chart);
            expect(testOptions.getNodes(chart).length).toEqual(2);

            await chartProxy.updateDelta({
                data: datasets.economy.data,
            });
            await waitForChartStability(chart);
            expect(testOptions.getNodes(chart).length).toEqual(3);
        };

        it('Line Chart should render correctly after update', async () => {
            await testDataUpdate({
                seriesOptions: {
                    type: 'line',
                    xKey: datasets.economy.categoryKey,
                    yKey: datasets.economy.valueKey,
                },
                getNodes: (chartInstance) => Selection.selectByClass(chartInstance.series[0].contentGroup, Circle),
            });
        });

        it('Column Chart should render correctly after update', async () => {
            await testDataUpdate({
                seriesOptions: {
                    type: 'bar',
                    xKey: datasets.economy.categoryKey,
                    yKey: datasets.economy.valueKey,
                },
                getNodes: (chartInstance) => Selection.selectByClass(chartInstance.series[0].contentGroup, Rect),
            });
        });

        it('Area Chart should render correctly after update', async () => {
            await testDataUpdate({
                seriesOptions: {
                    type: 'area',
                    xKey: datasets.economy.categoryKey,
                    yKey: datasets.economy.valueKey,
                    marker: {
                        enabled: true,
                    },
                },
                getNodes: (chartInstance) => Selection.selectByClass(chartInstance.series[0].contentGroup, Circle),
            });
        });

        it('Scatter Chart should render correctly after update', async () => {
            await testDataUpdate({
                seriesOptions: {
                    type: 'scatter',
                    xKey: datasets.economy.valueKey,
                    yKey: datasets.economy.valueKey,
                },
                getNodes: (chartInstance) => Selection.selectByClass(chartInstance.series[0].contentGroup, Circle),
            });
        });

        it('Pie Chart should render correctly after update', async () => {
            await testDataUpdate({
                seriesOptions: {
                    type: 'pie',
                    calloutLabelKey: datasets.economy.categoryKey,
                    angleKey: datasets.economy.valueKey,
                },
                getNodes: (chartInstance) => Selection.selectByClass(chartInstance.series[0].contentGroup, Sector),
            });
        });
    });

    describe('Chart data inherited by Series', () => {
        async function createSeriesTestChart(options: object) {
            const chartOptions = prepareTestOptions(options);
            const chartProxy = AgCharts.create(chartOptions) as AgChartProxy;
            chart = deproxy(chartProxy);
            await waitForChartStability(chart);
            return { chartProxy, chartOptions };
        }

        async function updateChart(chartProxy: AgChartProxy, options: object) {
            const chartOptions = prepareTestOptions(options);
            await chartProxy.update(chartOptions);
            await waitForChartStability(deproxy(chartProxy));
        }

        it('Chart data inherited only when Series data is not defined ', async () => {
            const moreData = datasets.economy.data;
            const lessData = datasets.economy.data.slice(0, 2);
            const { chartProxy } = await createSeriesTestChart({
                data: moreData,
                series: [
                    {
                        type: 'line',
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey,
                    },
                    {
                        type: 'line',
                        data: lessData,
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey2,
                    },
                ],
            });
            expect(chart.data).toEqual(moreData);
            expect(chart.series[0].data).toEqual(moreData);
            expect(chart.series[1].data).toEqual(lessData);

            await updateChart(chartProxy, {
                data: moreData,
                series: [
                    {
                        type: 'line',
                        data: lessData,
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey,
                    },
                    {
                        type: 'line',
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey2,
                    },
                ],
            });

            expect(chart.data).toEqual(moreData);
            expect(chart.series[0].data).toEqual(lessData);
            expect(chart.series[1].data).toEqual(moreData);

            await updateChart(chartProxy, {
                data: moreData,
                series: [
                    {
                        type: 'line',
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey,
                    },
                    {
                        type: 'line',
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey2,
                    },
                ],
            });

            expect(chart.series[0].data).toEqual(chart.data);
            expect(chart.series[1].data).toEqual(chart.data);
        });
    });

    describe('Chart lifecycle', () => {
        let agChartInstance: AgChartProxy;

        beforeEach(async () => {
            const options: AgCartesianChartOptions | AgPolarChartOptions = prepareTestOptions({
                container: document.body,
                series: [
                    {
                        type: 'line',
                        data: datasets.economy.data,
                        xKey: datasets.economy.categoryKey,
                        yKey: datasets.economy.valueKey,
                    },
                ],
            });
            agChartInstance = AgCharts.create(options) as AgChartProxy;
            chart = deproxy(agChartInstance);
            await waitForChartStability(chart);
        });

        afterEach(() => {
            agChartInstance = undefined as any;
        });

        it('should setup DOM on create', () => {
            const elements = document.querySelectorAll('.ag-charts-wrapper');
            expect(elements.length).toEqual(1);

            expect(elements[0].querySelectorAll('canvas')).toHaveLength(1);
            expect(elements[0].querySelectorAll('.ag-charts-focus-indicator')).toHaveLength(1);
        });

        it('should cleanup DOM on destroy()', () => {
            agChartInstance.destroy();

            const elements = document.querySelectorAll('.ag-charts-wrapper');
            expect(elements.length).toEqual(0);

            expect(document.querySelectorAll('canvas')).toHaveLength(0);
            expect(document.querySelectorAll('.ag-charts-focus-indicator')).toHaveLength(0);
            expect(document.querySelectorAll('div')).toHaveLength(0);
        });

        it('should cleanup DOM on chart-type switch', async () => {
            const options: AgCartesianChartOptions | AgPolarChartOptions = prepareTestOptions({
                container: document.body,
                series: [
                    {
                        type: 'pie',
                        data: datasets.economy.data,
                        calloutLabelKey: datasets.economy.categoryKey,
                        angleKey: datasets.economy.valueKey,
                    },
                ],
            });
            await agChartInstance.update(options);
            await waitForChartStability(agChartInstance);

            const elements = document.querySelectorAll('.ag-charts-wrapper');
            expect(elements).toHaveLength(1);

            expect(elements[0].querySelectorAll('canvas')).toHaveLength(1);
            expect(elements[0].querySelectorAll('.ag-charts-focus-indicator')).toHaveLength(1);
            expect(elements[0].querySelectorAll('.ag-charts-toolbar')).toHaveLength(0);
        });
    });
});
