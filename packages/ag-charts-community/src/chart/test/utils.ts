import { afterEach, beforeEach, expect, jest } from '@jest/globals';
import type { MatchImageSnapshotOptions } from 'jest-image-snapshot';

import type {
    AgCartesianChartOptions,
    AgChartInstance,
    AgChartOptions,
    AgChartTheme,
    AgFinancialChartOptions,
    AgPolarChartOptions,
} from 'ag-charts-types';

import { AgCharts } from '../../api/agCharts';
import { type IAnimation, PHASE_METADATA } from '../../motion/animation';
import { BBox } from '../../scene/bbox';
import { getDocument } from '../../util/dom';
import {
    CANVAS_HEIGHT,
    CANVAS_TO_BUFFER_DEFAULTS,
    CANVAS_WIDTH,
    extractImageData,
    setupMockCanvas,
    toMatchImage,
} from '../../util/test/mockCanvas';
import type { Chart } from '../chart';
import type { AgChartProxy } from '../chartProxy';
import { AnimationManager } from '../interaction/animationManager';
import type { PointerOffsets } from '../interaction/interactionManager';

export type { Chart } from '../chart';
export type { AgChartProxy } from '../chartProxy';
export * from '../../util/test/mockConsole';

export type ChartOrProxy<O extends AgChartOptions | AgFinancialChartOptions = AgChartOptions> =
    | AgChartInstance<O>
    | AgChartProxy
    | Chart;

export interface TestCase {
    options: AgChartOptions;
    assertions: (chart: ChartOrProxy) => Promise<void> | void;
    extraScreenshotActions?: (chart: ChartOrProxy) => Promise<void>;
    warnings?: Array<string | Array<string>>;
}

export interface CartesianOrPolarTestCase extends TestCase {
    options: AgCartesianChartOptions | AgPolarChartOptions;
}

export interface CartesianTestCase extends TestCase {
    options: AgCartesianChartOptions;
}

export interface PolarTestCase extends TestCase {
    options: AgPolarChartOptions;
}

const FAILURE_THRESHOLD = Number(process.env.SNAPSHOT_FAILURE_THRESHOLD ?? 0);
export const IMAGE_SNAPSHOT_DEFAULTS: MatchImageSnapshotOptions = {
    failureThreshold: FAILURE_THRESHOLD,
    failureThresholdType: 'percent',
    dumpInlineDiffToConsole: process.env.CI != null,
};

export async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function prepareFinancialTestOptions(options: AgFinancialChartOptions, container = getDocument('body')) {
    options.width = CANVAS_WIDTH;
    options.height = CANVAS_HEIGHT;
    options.container = container;

    return options;
}

export function prepareTestOptions<T extends AgChartOptions>(options: T, container = getDocument('body')) {
    options.width = CANVAS_WIDTH;
    options.height = CANVAS_HEIGHT;
    options.container = container;

    let baseTestTheme: AgChartTheme = {
        baseTheme: 'ag-default',
        palette: {
            fills: ['#f3622d', '#fba71b', '#57b757', '#41a9c9', '#4258c9', '#9a42c8', '#c84164', '#888888'],
            strokes: ['#aa4520', '#b07513', '#3d803d', '#2d768d', '#2e3e8d', '#6c2e8c', '#8c2d46', '#5f5f5f'],
        },
    };

    if (typeof options?.theme === 'object' && options?.theme.palette != null) {
        // Keep existing theme.
        baseTestTheme = options.theme;
    } else if (typeof options?.theme === 'object') {
        // Keep theme supplied, just override palette colours.
        baseTestTheme = {
            ...options.theme,
            palette: baseTestTheme.palette,
        };
    } else if (typeof options?.theme === 'string') {
        // Override colours.
        baseTestTheme.baseTheme = options.theme;
    }

    options.theme = baseTestTheme;

    return options;
}

function isChartInstance(chartOrProxy: ChartOrProxy): chartOrProxy is Chart {
    return chartOrProxy.constructor.name !== 'AgChartInstanceProxy' || (chartOrProxy as Chart).className != null;
}

export function deproxy(chartOrProxy: ChartOrProxy<any>): Chart {
    return isChartInstance(chartOrProxy) ? chartOrProxy : ((chartOrProxy as any).chart as Chart);
}

export function repeat<T>(value: T, count: number): T[] {
    return new Array(count).fill(value);
}

export function range(start: number, end: number, step = 1): number[] {
    const result = new Array(Math.floor((end - start) / step));

    let resultIndex = 0;
    for (let index = start; index <= end; index += step) {
        result[resultIndex++] = index;
    }

    return result;
}

export function dateRange(start: Date, end: Date, step = 24 * 60 * 60 * 1000): Date[] {
    const result: Date[] = [];

    let next = start.getTime();
    const endTime = end.getTime();
    while (next <= endTime) {
        result.push(new Date(next));

        next += step;
    }

    return result;
}

export async function waitForChartStability<O extends AgChartOptions | AgFinancialChartOptions>(
    chartOrProxy: ChartOrProxy<O>,
    animationAdvanceMs = 0
): Promise<void> {
    const timeoutMs = 5000;
    const chart = deproxy(chartOrProxy);
    const chartAny = chart as any; // to access private properties
    await chart.waitForUpdate(timeoutMs, true);
    if ((chart.width == null || chart.height == null) && !chartAny._lastAutoSize) {
        // Bypass wait for SizeObservable callback - it's never going to be invoked.
        const width = chart.width ?? chart.ctx.scene.canvas.width;
        const height = chart.height ?? chart.ctx.scene.canvas.height;
        chartAny._lastAutoSize = [width, height];
        chartAny.resize(width, height);
        await chart.waitForUpdate(timeoutMs, true);
    }

    if (activeAnimateCb) {
        await activeAnimateCb(0, 1);
        if (animationAdvanceMs > 0) {
            await activeAnimateCb(animationAdvanceMs, 1);
        }
        await chart.waitForUpdate(timeoutMs, true);
    } else if (animationAdvanceMs > 0) {
        throw new Error(`animationAdvancedMs is non-zero, but no animation mocks are present.`);
    }
}

function makeMouseEvent<T extends 'mousedown' | 'mouseup' | 'mousemove' | 'click' | 'dblclick' | 'contextmenu'>(
    type: T,
    offsets: PointerOffsets
): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true });
    const { offsetX, offsetY, pageX = offsetX, pageY = offsetY } = offsets;
    Object.assign(event, { offsetX, offsetY, pageX, pageY });
    return event;
}

function mouseDownEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('mousedown', offsets);
}

function mouseUpEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('mouseup', offsets);
}

function mouseMoveEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('mousemove', offsets);
}

function clickEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('click', offsets);
}

function doubleClickEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('dblclick', offsets);
}

function contextMenuEvent(offsets: PointerOffsets): MouseEvent {
    return makeMouseEvent('contextmenu', offsets);
}

export enum WheelDeltaMode {
    Pixels = 0,
    Lines = 1,
    Pages = 2,
}

type WheelEventData = {
    clientX: number;
    clientY: number;
    deltaX: number;
    deltaY: number;
    deltaMode: WheelDeltaMode;
};

export function wheelEvent({ clientX, clientY, deltaX, deltaY, deltaMode }: WheelEventData): WheelEvent {
    return new WheelEvent('wheel', { bubbles: true, clientX, clientY, deltaX, deltaY, deltaMode });
}

export function cartesianChartAssertions(params?: { type?: string; axisTypes?: string[]; seriesTypes?: string[] }) {
    const { axisTypes = ['category', 'number'], seriesTypes = ['bar', 'bar'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('CartesianChart');
        expect(chart.axes).toHaveLength(axisTypes.length);
        expect(chart.axes.map((a) => a.type)).toEqual(axisTypes);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function polarChartAssertions(params?: { seriesTypes?: string[] }) {
    const { seriesTypes = ['pie'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('PolarChart');
        expect(chart.axes).toHaveLength(0);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function hierarchyChartAssertions(params?: { seriesTypes?: string[] }) {
    const { seriesTypes = ['treemap'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('HierarchyChart');
        expect(chart.axes).toHaveLength(0);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function topologyChartAssertions(params?: { seriesTypes?: string[] }) {
    const { seriesTypes = ['map-shape'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('TopologyChart');
        expect(chart.axes).toHaveLength(0);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function flowProportionChartAssertions(params?: { seriesTypes?: string[] }) {
    const { seriesTypes = ['flow-proportion'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('FlowProportionChart');
        expect(chart.axes).toHaveLength(0);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function standaloneChartAssertions(params?: { seriesTypes?: string[] }) {
    const { seriesTypes = ['standalone'] } = params ?? {};

    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('StandaloneChart');
        expect(chart.axes).toHaveLength(0);
        expect(chart.series.map((s) => s.type)).toEqual(seriesTypes);
    };
}

export function gaugeAssertions() {
    return (chartOrProxy: ChartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        expect(chart?.constructor?.name).toEqual('GaugeChart');
    };
}

const checkTargetValid = (target: HTMLElement) => {
    if (!target.isConnected) throw new Error('Chart must be configured with a container for event testing to work');
};

type TestTarget = { target: HTMLElement; x: number; y: number };
type TestModuleFns = { testFindTarget: (canvasX: number, canvasY: number) => TestTarget | undefined };

function findTarget(chart: Chart, canvasX: number, canvasY: number): { target: HTMLElement; x: number; y: number } {
    for (const moduleName of ['legend', 'navigator', 'zoom']) {
        const mod = chart.modulesManager.getModule<TestModuleFns>(moduleName);
        const modTarget = mod?.testFindTarget(canvasX, canvasY);
        if (modTarget) {
            return modTarget;
        }
    }
    return { target: chart.ctx.scene.canvas.element, x: canvasX, y: canvasY };
}

export function hoverAction(canvasX: number, canvasY: number): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const { target, x, y } = findTarget(chart, canvasX, canvasY);
        checkTargetValid(target);

        target?.dispatchEvent(mouseMoveEvent({ offsetX: x, offsetY: y }));
        return delay(50);
    };
}

export function clickAction(
    canvasX: number,
    canvasY: number,
    opts?: { mousedown?: { offsetX: number; offsetY: number } }
): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const { target, x, y } = findTarget(
            chart,
            opts?.mousedown?.offsetX ?? canvasX,
            opts?.mousedown?.offsetY ?? canvasY
        );
        checkTargetValid(target);

        const offsets = { offsetX: x, offsetY: y };
        target?.dispatchEvent(mouseDownEvent(opts?.mousedown ?? offsets));
        target?.dispatchEvent(mouseUpEvent(offsets));
        target?.dispatchEvent(clickEvent(offsets));
        return delay(50);
    };
}

export function doubleClickAction(canvasX: number, canvasY: number): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const { target, x, y } = findTarget(chart, canvasX, canvasY);
        const offsets = { offsetX: x, offsetY: y };
        // A double click is always preceded by two single clicks, simulate here to ensure correct handling
        target?.dispatchEvent(mouseDownEvent(offsets));
        target?.dispatchEvent(mouseUpEvent(offsets));
        target?.dispatchEvent(clickEvent(offsets));
        target?.dispatchEvent(mouseDownEvent(offsets));
        target?.dispatchEvent(mouseUpEvent(offsets));
        target?.dispatchEvent(clickEvent(offsets));
        await delay(50);
        await waitForChartStability(chart);
        target?.dispatchEvent(doubleClickEvent(offsets));
        return delay(50);
    };
}

export function contextMenuAction(canvasX: number, canvasY: number): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const { target, x, y } = findTarget(chart, canvasX, canvasY);
        checkTargetValid(target);

        const offsets = { offsetX: x, offsetY: y };
        target?.dispatchEvent(contextMenuEvent(offsets));
        return delay(50);
    };
}

export function dragAction(
    from: { x: number; y: number },
    to: { x: number; y: number }
): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const fromTarget = findTarget(chart, from.x, from.y);
        const toTarget = findTarget(chart, to.x, to.y);
        const fromOffsets = {
            offsetX: fromTarget.x,
            offsetY: fromTarget.y,
            pageX: from.x,
            pageY: from.y,
        };
        const toOffsets = {
            offsetX: toTarget.x,
            offsetY: toTarget.y,
            pageX: to.x,
            pageY: to.y,
        };
        checkTargetValid(fromTarget.target);
        checkTargetValid(toTarget.target);

        fromTarget.target?.dispatchEvent(mouseDownEvent(fromOffsets));
        fromTarget.target?.dispatchEvent(mouseMoveEvent(fromOffsets));
        toTarget.target?.dispatchEvent(mouseMoveEvent(toOffsets));
        toTarget.target?.dispatchEvent(mouseUpEvent(toOffsets));

        return delay(50);
    };
}

export function scrollAction(
    canvasX: number,
    canvasY: number,
    deltaY: number,
    deltaMode: WheelDeltaMode = WheelDeltaMode.Lines,
    deltaX: number = 0
): (chart: ChartOrProxy) => Promise<void> {
    return async (chartOrProxy) => {
        const chart = deproxy(chartOrProxy);
        const { target, x, y } = findTarget(chart, canvasX, canvasY);
        target?.dispatchEvent(wheelEvent({ clientX: x, clientY: y, deltaY, deltaX, deltaMode }));
        await delay(50);
    };
}

export { setupMockCanvas, toMatchImage, CANVAS_TO_BUFFER_DEFAULTS, extractImageData };

export async function createChart(options: AgChartOptions) {
    options = prepareTestOptions({ ...options });
    const chart = deproxy(AgCharts.create(options) as AgChartProxy);
    await waitForChartStability(chart);
    return chart;
}

let activeAnimateCb: ((totalDuration: number, ratio: number) => Promise<void>) | undefined;
export function spyOnAnimationManager() {
    const mocks: jest.SpiedFunction<(...args: any[]) => any>[] = [];
    const rafCbs: Map<number, Parameters<typeof requestAnimationFrame>[0]> = new Map();
    let nextRafId = 1;
    const animateParameters = [0, 0];

    let time = Date.now();
    const animateCb = async (totalDuration: number, ratio: number) => {
        time += totalDuration * ratio;
        const cbs = [...rafCbs.values()];
        rafCbs.clear();

        // eslint-disable-next-line sonarjs/array-callback-without-return
        await Promise.all(cbs.map((cb) => cb(time)));
    };

    beforeEach(() => {
        const skippedMock = jest.spyOn(AnimationManager.prototype, 'isSkipped');
        skippedMock.mockImplementation(() => false);

        const forceTimeJumpMock = jest.spyOn(AnimationManager.prototype, 'forceTimeJump');
        forceTimeJumpMock.mockImplementation((controller: IAnimation, defaultDuration: number) => {
            if (!controller.isComplete) {
                // Convert test timing info to phase-relative execution timing.
                const { phase } = controller;
                const { animationDelay } = PHASE_METADATA[phase];

                // Account for phase notional starting offset.
                let updateBy = animateParameters[0] * animateParameters[1];
                updateBy -= animationDelay * defaultDuration;

                controller.update(updateBy);
            }
            return true;
        });
        const skippingFramesMock = jest.spyOn(AnimationManager.prototype, 'isSkippingFrames');
        skippingFramesMock.mockImplementation(() => false);

        const safMock = jest.spyOn(AnimationManager.prototype, 'scheduleAnimationFrame');
        safMock.mockImplementation(function (this: AnimationManager, cb) {
            (this as any).requestId = nextRafId++;

            const rafId = nextRafId++;
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            rafCbs.set(rafId, cb);
        });
        mocks.push(skippedMock, forceTimeJumpMock, skippingFramesMock, safMock);

        if (activeAnimateCb) throw new Error('activeAnimateCb already initialized - something is very wrong!');
        activeAnimateCb = animateCb;
    });

    afterEach(() => {
        activeAnimateCb = undefined;
        mocks.forEach((mock) => mock.mockRestore());
        rafCbs.clear();
    });

    return (totalDuration: number, ratio: number) => {
        animateParameters[0] = totalDuration;
        animateParameters[1] = ratio;
    };
}

export function reverseAxes<T extends AgCartesianChartOptions | AgPolarChartOptions>(opts: T, reverse: boolean): T {
    return {
        ...opts,
        axes: opts.axes?.map((axis) => ({ ...axis, reverse })),
    };
}

export function mixinReversedAxesCases(
    baseCases: Record<string, CartesianOrPolarTestCase & { skip?: boolean; skipWarningsReversed?: boolean }>
): Record<string, CartesianOrPolarTestCase> {
    const result = { ...baseCases };

    Object.entries(baseCases).forEach(([name, baseCase]) => {
        result[name + '_REVERSED_AXES'] = {
            ...baseCase,
            options: reverseAxes(baseCase.options, true),
            warnings: baseCase.skipWarningsReversed === false ? baseCase.warnings : [],
        };
    });

    return result;
}

export function computeLegendBBox(chart: Chart): BBox {
    const legendModule = chart.modulesManager.getModule<any>('legend');
    const { x = 0, y = 0, width = 0, height = 0 } = legendModule?.group.getBBox() ?? {};
    return new BBox(x, y, width, height);
}

export function getCursor(chart: Chart | AgChartProxy): string {
    const ctx = deproxy(chart).getModuleContext();
    return ctx.cursorManager.getCursor();
}
