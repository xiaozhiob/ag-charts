import { afterEach, beforeEach } from '@jest/globals';

import { flushTimings, loadBuiltExampleOptions, logTimings, recordTiming, setupMockConsole } from 'ag-charts-test';
import { AgChartInstance, AgChartOptions } from 'ag-charts-types';

import {
    CartesianSeries,
    CartesianSeriesNodeDataContext,
    CartesianSeriesNodeDatum,
} from '../src/chart/series/cartesian/cartesianSeries';
import { AgChartProxy, deproxy, prepareTestOptions } from '../src/chart/test/utils';
import { AgCharts } from '../src/main';
import { Point } from '../src/scene/point';
import { Transformable } from '../src/scene/transformable';
import { extractImageData, setupMockCanvas } from '../src/util/test/mockCanvas';

export interface BenchmarkExpectations {
    expectedMaxMemoryMB: number;
    autoSnapshot?: boolean;
}

export class BenchmarkContext<T extends AgChartOptions = AgChartOptions> {
    chart?: AgChartProxy | AgChartInstance;
    options: T;
    nodePositions: Point[][] = [];
    repeat = 1;

    public constructor(
        readonly canvasCtx: ReturnType<typeof setupMockCanvas>,
        readonly createApi: 'create' | '__createSparkline'
    ) {}

    async create(extraOpts?: object) {
        if (this.chart) this.chart.destroy();

        this.chart = AgCharts[this.createApi]({ ...this.options, ...extraOpts } as any) as AgChartProxy;
        await this.waitForUpdate();
    }

    async update() {
        await this.chart?.update(this.options);
    }

    async updateDelta(options: Partial<T>) {
        await this.chart?.updateDelta(options as T);
    }

    async waitForUpdate() {
        await this.chart?.waitForUpdate();
    }

    repeatCount(count: number) {
        this.repeat = count;
        return this;
    }
}

export function benchmark(
    name: string,
    ctx: BenchmarkContext,
    expectations: BenchmarkExpectations,
    callback: () => Promise<void>,
    timeoutMs = 10000
) {
    if (!global.gc) {
        throw new Error('GC flags disabled - invoke via `npm run benchmark` to collect heap usage stats');
    }

    it(
        name,
        async () => {
            global.gc?.();
            const memoryUsageBefore = process.memoryUsage();

            const start = performance.now();
            const { repeat: runCount = 1 } = ctx;
            for (let i = 0; i < runCount; i++) {
                await callback();
            }
            const duration = (performance.now() - start) / runCount;

            if (runCount > 1) global.gc?.();
            const memoryUsageAfter = process.memoryUsage();
            const canvasInstances = ctx.canvasCtx.getActiveCanvasInstances();
            const { currentTestName, testPath } = expect.getState();

            if (testPath == null || currentTestName == null) {
                throw new Error('Unable to resolve current test name.');
            }

            const memoryUse = recordTiming(testPath, currentTestName, {
                timeMs: duration,
                runCount,
                memory: {
                    before: memoryUsageBefore,
                    after: memoryUsageAfter,
                    nativeAllocations: {
                        canvas: {
                            count: canvasInstances.length,
                            bytes: canvasInstances.reduce(
                                (totalBytes, canvas) => totalBytes + getBitmapMemoryUsage(canvas),
                                0
                            ),
                        },
                    },
                },
            });

            if (expectations.autoSnapshot ?? true) {
                const newImageData = extractImageData(ctx.canvasCtx);
                expect(newImageData).toMatchImageSnapshot({ failureThresholdType: 'pixel', failureThreshold: 5 });
            }

            const BYTES_PER_MB = 1024 ** 2;
            expect(memoryUse / BYTES_PER_MB).toBeLessThanOrEqual(expectations.expectedMaxMemoryMB);
        },
        timeoutMs
    );
}

export function setupBenchmark<T extends AgChartOptions>(
    exampleName: string,
    opts?: {
        createApi: 'create' | '__createSparkline';
    }
): BenchmarkContext<T> {
    const canvasCtx = setupMockCanvas();
    const { createApi = 'create' } = opts ?? {};
    setupMockConsole();

    beforeEach(() => {
        ctx.options = prepareTestOptions(loadBuiltExampleOptions(exampleName));
    });

    afterEach(() => {
        if (ctx.chart) {
            ctx.chart.destroy();
            (ctx.chart as unknown) = undefined;
        }
    });

    afterAll(() => {
        logTimings();
    });

    const ctx = new BenchmarkContext<T>(canvasCtx, createApi);
    return ctx;
}

afterAll(() => {
    flushTimings();
});

export function addSeriesNodePoints<T extends AgChartOptions>(
    ctx: BenchmarkContext<T>,
    seriesIdx: number,
    nodeCount: number
) {
    if (ctx.chart == null) throw new Error('No ctx.chart to update');

    const series = deproxy(ctx.chart).series[seriesIdx] as CartesianSeries<any, any, any>;
    const { nodeData = [] } = getSeriesNodeData(series) ?? {};

    if (nodeCount < nodeData.length) {
        expect(nodeData.length).toBeGreaterThanOrEqual(nodeCount);
    }

    const results: Point[] = [];
    const addResult = (idx: number) => {
        const node = nodeData.at(Math.floor(idx));
        const midPoint = node?.midPoint;
        if (!midPoint) throw new Error('No node midPoint found.');

        const point = Transformable.toCanvasPoint(series.contentGroup, midPoint.x, midPoint.y);
        results.push(point);
    };

    for (let i = 0; i < nodeCount; i++) {
        addResult(Math.floor(nodeData.length / nodeCount) * i);
    }

    ctx.nodePositions.push(results);
}

function getBitmapMemoryUsage(dimensions: { width: number; height: number }, bitsPerPixel: number = 32): number {
    const { width, height } = dimensions;
    const numPixels = width * height;
    const bytesPerPixel = bitsPerPixel / 8;
    return numPixels * bytesPerPixel;
}

function getSeriesNodeData(
    series: CartesianSeries<any, any, any, any, CartesianSeriesNodeDataContext<CartesianSeriesNodeDatum, any>>
): CartesianSeriesNodeDataContext<CartesianSeriesNodeDatum, any> | null {
    if (!series.contextNodeData) return null;
    // HACK: support running the benchmark script against old versions of the library.
    // Previous versions of the library used to support multiple `contextNodeData` per series, so take the first item.
    if (Array.isArray(series.contextNodeData)) {
        return (series.contextNodeData as Array<CartesianSeriesNodeDataContext<any, any>>)[0];
    }
    return series.contextNodeData;
}
