import type {
    AgChartOptions,
    AgChartInstance,
    AgBaseAxisOptions,
    AgBaseSeriesOptions,
} from '../options/agChartOptions';
import { CartesianChart } from './cartesianChart';
import { PolarChart } from './polarChart';
import { HierarchyChart } from './hierarchyChart';
import type { Series } from './series/series';
import { getAxis } from './factory/axisTypes';
import { getSeries } from './factory/seriesTypes';
import { PieTitle } from './series/polar/pieSeries';
import type { ChartAxis } from './chartAxis';
import type { Chart, SpecialOverrides } from './chart';
import { ChartUpdateType } from './chartUpdateType';
import type { TypedEventListener } from '../util/observable';
import { jsonDiff, jsonMerge, jsonApply } from '../util/json';
import { prepareOptions, noDataCloneMergeOptions } from './mapping/prepare';
import {
    isAgCartesianChartOptions,
    isAgHierarchyChartOptions,
    isAgPolarChartOptions,
    optionsType,
    type SeriesOptionsTypes,
} from './mapping/types';
import { windowValue } from '../util/window';
import {
    REGISTERED_MODULES,
    type AxisOptionModule,
    type LegendModule,
    type Module,
    type ModuleInstance,
    type RootModule,
    type SeriesOptionModule,
} from '../util/module';
import { Logger } from '../util/logger';
import { getJsonApplyOptions } from './chartOptions';

import { setupModules } from './factory/setupModules';
import { getLegendKeys } from './factory/legendTypes';
import { registerInbuiltModules } from './factory/registerInbuiltModules';

type ProcessedOptions = Partial<AgChartOptions> & { type?: SeriesOptionsTypes['type'] };

export interface DownloadOptions extends ImageDataUrlOptions {
    /** Name of downloaded image file. Defaults to `image`.  */
    fileName?: string;
}

export interface ImageDataUrlOptions {
    /** Width of downloaded chart image in pixels. Defaults to current chart width. */
    width?: number;
    /** Height of downloaded chart image in pixels. Defaults to current chart height. */
    height?: number;
    /** A MIME-type string indicating the image format. The default format type is `image/png`. Options: `image/png`, `image/jpeg`.  */
    fileFormat?: string;
}

function chartType(options: any): 'cartesian' | 'polar' | 'hierarchy' {
    if (isAgCartesianChartOptions(options)) {
        return 'cartesian';
    } else if (isAgPolarChartOptions(options)) {
        return 'polar';
    } else if (isAgHierarchyChartOptions(options)) {
        return 'hierarchy';
    }

    throw new Error(`AG Chart - unknown type of chart for options with type: ${options.type}`);
}

type DeepPartialDepth = [never, 0, 1, 2, 3, 4, 5, 6]; // DeepPartial recursion limit type.
type DeepPartial<T, N extends DeepPartialDepth[number] = 5> = [N] extends [never]
    ? Partial<T>
    : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P], DeepPartialDepth[N]> }
    : T;

/**
 * Factory for creating and updating instances of AgChartInstance.
 *
 * @docsInterface
 */
export abstract class AgChart {
    private static readonly INVALID_CHART_REF_MESSAGE = 'AG Charts - invalid chart reference passed';

    /**
     * Create a new `AgChartInstance` based upon the given configuration options.
     */
    public static create(options: AgChartOptions): AgChartInstance {
        return AgChartInternal.createOrUpdate(options as any);
    }

    /**
     * Update an existing `AgChartInstance`. Options provided should be complete and not
     * partial.
     * <br/>
     * <br/>
     * **NOTE**: As each call could trigger a chart redraw, multiple calls to update options in
     * quick succession could result in undesirable flickering, so callers should batch up and/or
     * debounce changes to avoid unintended partial update renderings.
     */
    public static update(chart: AgChartInstance, options: AgChartOptions) {
        if (!AgChartInstanceProxy.isInstance(chart)) {
            throw new Error(AgChart.INVALID_CHART_REF_MESSAGE);
        }
        AgChartInternal.createOrUpdate(options as any, chart);
    }

    /**
     * Update an existing `AgChartInstance` by applying a partial set of option changes.
     * <br/>
     * <br/>
     * **NOTE**: As each call could trigger a chart redraw, each individual delta options update
     * should leave the chart in a valid options state. Also, multiple calls to update options in
     * quick succession could result in undesirable flickering, so callers should batch up and/or
     * debounce changes to avoid unintended partial update renderings.
     */
    public static updateDelta(chart: AgChartInstance, deltaOptions: DeepPartial<AgChartOptions>) {
        if (!AgChartInstanceProxy.isInstance(chart)) {
            throw new Error(AgChart.INVALID_CHART_REF_MESSAGE);
        }
        return AgChartInternal.updateUserDelta(chart, deltaOptions as any);
    }

    /**
     * Starts a browser-based image download for the given `AgChartInstance`.
     */
    public static download(chart: AgChartInstance, options?: DownloadOptions) {
        if (!(chart instanceof AgChartInstanceProxy)) {
            throw new Error(AgChart.INVALID_CHART_REF_MESSAGE);
        }
        return AgChartInternal.download(chart, options);
    }

    /**
     * Returns a base64-encoded image data URL for the given `AgChartInstance`.
     */
    public static getImageDataURL(chart: AgChartInstance, options?: ImageDataUrlOptions): Promise<string> {
        if (!(chart instanceof AgChartInstanceProxy)) {
            throw new Error(AgChart.INVALID_CHART_REF_MESSAGE);
        }
        return AgChartInternal.getImageDataURL(chart, options);
    }
}

/**
 * Proxy class, to allow library users to keep a stable reference to their chart, even if we need
 * to switch concrete class (e.g. when switching between CartesianChart vs. PolarChart).
 */
class AgChartInstanceProxy implements AgChartInstance {
    chart: Chart;

    static isInstance(x: any): x is AgChartInstanceProxy {
        if (x instanceof AgChartInstanceProxy) {
            // Simple case.
            return true;
        }

        if (x.constructor?.name === 'AgChartInstanceProxy' && x.chart != null) {
            // instanceof can fail if mixing bundles (e.g. grid all-modules vs. standalone).
            return true;
        }

        const signatureProps = Object.keys(x.constructor?.prototype);
        const heuristicTypeCheck = Object.keys(AgChartInstanceProxy.prototype).every((prop) =>
            signatureProps.includes(prop)
        );
        return !!(heuristicTypeCheck && x.chart != null);
    }

    constructor(chart: Chart) {
        this.chart = chart;
    }

    getOptions() {
        return this.chart.getOptions();
    }

    destroy() {
        this.chart.destroy();
    }
}

abstract class AgChartInternal {
    static DEBUG = () => (windowValue('agChartsDebug') as string | boolean) ?? false;

    static initialised = false;
    static initialiseModules() {
        if (AgChartInternal.initialised) return;

        registerInbuiltModules();
        setupModules();

        AgChartInternal.initialised = true;
    }

    static createOrUpdate(userOptions: AgChartOptions & SpecialOverrides, proxy?: AgChartInstanceProxy) {
        AgChartInternal.initialiseModules();

        debug('>>> AgChartV2.createOrUpdate() user options', userOptions);
        const mixinOpts: any = {};
        if (AgChartInternal.DEBUG() === true) {
            mixinOpts['debug'] = true;
        }

        const { overrideDevicePixelRatio, document, window: userWindow } = userOptions;
        delete userOptions['overrideDevicePixelRatio'];
        delete (userOptions as any)['document'];
        delete (userOptions as any)['window'];
        const specialOverrides = { overrideDevicePixelRatio, document, window: userWindow };

        const processedOptions = prepareOptions(userOptions, mixinOpts);
        let chart = proxy?.chart;
        if (chart == null || chartType(userOptions as any) !== chartType(chart.processedOptions as any)) {
            chart = AgChartInternal.createChartInstance(processedOptions, specialOverrides, chart);
        }

        if (proxy == null) {
            proxy = new AgChartInstanceProxy(chart);
        } else {
            proxy.chart = chart;
        }

        if (AgChartInternal.DEBUG() === true && typeof window !== 'undefined') {
            (window as any).agChartInstances ??= {};
            (window as any).agChartInstances[chart.id] = chart;
        }

        const chartToUpdate = chart;
        chartToUpdate.queuedUserOptions.push(userOptions);
        const dequeue = () => {
            // If there are a lot of update calls, `requestFactoryUpdate()` may skip callbacks,
            // so we need to remove all queue items up to the last successfully applied item.
            const queuedOptionsIdx = chartToUpdate.queuedUserOptions.indexOf(userOptions);
            chartToUpdate.queuedUserOptions.splice(0, queuedOptionsIdx);
        };

        chartToUpdate.requestFactoryUpdate(async () => {
            // Chart destroyed, skip processing.
            if (chartToUpdate.destroyed) return;

            const deltaOptions = jsonDiff(chartToUpdate.processedOptions, processedOptions);
            if (deltaOptions == null) {
                dequeue();
                return;
            }

            await AgChartInternal.updateDelta(chartToUpdate, deltaOptions, userOptions);
            dequeue();
        });

        return proxy;
    }

    static updateUserDelta(proxy: AgChartInstanceProxy, deltaOptions: DeepPartial<AgChartOptions>) {
        const {
            chart,
            chart: { queuedUserOptions },
        } = proxy;

        const lastUpdateOptions = queuedUserOptions[queuedUserOptions.length - 1] ?? chart.userOptions;
        const userOptions = jsonMerge([lastUpdateOptions, deltaOptions]);
        debug('>>> AgChartV2.updateUserDelta() user delta', deltaOptions);
        debug('AgChartV2.updateUserDelta() - base options', lastUpdateOptions);
        AgChartInternal.createOrUpdate(userOptions as any, proxy);
    }

    /**
     * Returns the content of the current canvas as an image.
     * @param opts The download options including `width` and `height` of the image as well as `fileName` and `fileFormat`.
     */
    static download(proxy: AgChartInstanceProxy, opts?: DownloadOptions) {
        const asyncDownload = async () => {
            const maybeClone = await AgChartInternal.prepareResizedChart(proxy, opts);

            const { chart } = maybeClone;
            chart.scene.download(opts?.fileName, opts?.fileFormat);

            if (maybeClone !== proxy) {
                maybeClone.destroy();
            }
        };

        asyncDownload().catch((e) => Logger.errorOnce(e));
    }

    static async getImageDataURL(proxy: AgChartInstanceProxy, opts?: ImageDataUrlOptions): Promise<string> {
        const maybeClone = await AgChartInternal.prepareResizedChart(proxy, opts);

        const { chart } = maybeClone;
        const result = chart.scene.canvas.getDataURL(opts?.fileFormat);

        if (maybeClone !== proxy) {
            maybeClone.destroy();
        }

        return result;
    }

    private static async prepareResizedChart(
        proxy: AgChartInstanceProxy,
        opts?: DownloadOptions | ImageDataUrlOptions
    ) {
        const { chart } = proxy;

        let { width, height } = opts ?? {};
        const currentWidth = chart.width;
        const currentHeight = chart.height;

        const unchanged =
            (width === undefined && height === undefined) ||
            (chart.scene.canvas.pixelRatio === 1 && currentWidth === width && currentHeight === height);

        if (unchanged) {
            return proxy;
        }

        width = width ?? currentWidth;
        height = height ?? currentHeight;

        const options = {
            ...chart.userOptions,
            container: document.createElement('div'),
            width,
            height,
            autoSize: false,
            overrideDevicePixelRatio: 1,
        };

        const clonedChart = AgChartInternal.createOrUpdate(options as any);

        await clonedChart.chart.waitForUpdate();
        return clonedChart;
    }

    private static createChartInstance(
        options: AgChartOptions,
        specialOverrides: SpecialOverrides,
        oldChart?: Chart
    ): Chart {
        const transferableResource = oldChart?.destroy({ keepTransferableResources: true });

        if (isAgCartesianChartOptions(options)) {
            return new CartesianChart(specialOverrides, transferableResource);
        } else if (isAgHierarchyChartOptions(options)) {
            return new HierarchyChart(specialOverrides, transferableResource);
        } else if (isAgPolarChartOptions(options)) {
            return new PolarChart(specialOverrides, transferableResource);
        }

        throw new Error(
            `AG Charts - couldn't apply configuration, check options are correctly structured and series types are specified`
        );
    }

    private static async updateDelta(chart: Chart, processedOptions: ProcessedOptions, userOptions: AgChartOptions) {
        if (processedOptions.type == null) {
            processedOptions = {
                ...processedOptions,
                type: chart.processedOptions.type ?? optionsType(processedOptions),
            };
        }

        await chart.awaitUpdateCompletion();

        if (chart.destroyed) return;

        debug('AgChartV2.updateDelta() - applying delta', processedOptions);
        applyChartOptions(chart, processedOptions, userOptions);
    }
}

function debug(message?: any, ...optionalParams: any[]): void {
    if ([true, 'opts'].includes(AgChartInternal.DEBUG())) {
        Logger.debug(message, ...optionalParams);
    }
}

function applyChartOptions(chart: Chart, processedOptions: ProcessedOptions, userOptions: AgChartOptions): void {
    const completeOptions = jsonMerge([chart.processedOptions ?? {}, processedOptions], noDataCloneMergeOptions);
    const modulesChanged = applyModules(chart, completeOptions);

    const skip = ['type', 'data', 'series', 'listeners', 'theme', 'legend.listeners'];
    if (isAgCartesianChartOptions(processedOptions) || isAgPolarChartOptions(processedOptions)) {
        // Append axes to defaults.
        skip.push('axes');
    } else if (isAgHierarchyChartOptions(processedOptions)) {
        // Use defaults.
    } else {
        throw new Error(
            `AG Charts - couldn't apply configuration, check type of options and chart: ${processedOptions['type']}`
        );
    }

    // Needs to be done before applying the series to detect if a seriesNode[Double]Click listener has been added
    if (processedOptions.listeners) {
        registerListeners(chart, processedOptions.listeners);
    }

    applyOptionValues(chart, processedOptions, { skip });

    let forceNodeDataRefresh = false;
    if (processedOptions.series && processedOptions.series.length > 0) {
        applySeries(chart, processedOptions);
        forceNodeDataRefresh = true;
    }
    if ('axes' in processedOptions && Array.isArray(processedOptions.axes)) {
        const axesPresent = applyAxes(chart, processedOptions);
        if (axesPresent) {
            forceNodeDataRefresh = true;
        }
    }

    const seriesOpts = processedOptions.series as any[];
    const seriesDataUpdate = !!processedOptions.data || seriesOpts?.some((s) => s.data != null);
    const legendKeys = getLegendKeys();
    const optionsHaveLegend = Object.values(legendKeys).some(
        (legendKey) => (processedOptions as any)[legendKey] != null
    );
    const otherRefreshUpdate = processedOptions.title != null && processedOptions.subtitle != null;
    forceNodeDataRefresh = forceNodeDataRefresh || seriesDataUpdate || optionsHaveLegend || otherRefreshUpdate;
    if (processedOptions.data) {
        chart.data = processedOptions.data;
    }
    if (processedOptions.legend?.listeners) {
        Object.assign(chart.legend!.listeners, processedOptions.legend.listeners ?? {});
    }
    if (processedOptions.listeners) {
        chart.updateAllSeriesListeners();
    }

    chart.processedOptions = completeOptions;
    chart.userOptions = jsonMerge([chart.userOptions ?? {}, userOptions], noDataCloneMergeOptions);

    const majorChange = forceNodeDataRefresh || modulesChanged;
    const updateType = majorChange ? ChartUpdateType.PROCESS_DATA : ChartUpdateType.PERFORM_LAYOUT;
    debug('AgChartV2.applyChartOptions() - update type', ChartUpdateType[updateType]);
    chart.update(updateType, { forceNodeDataRefresh });
}

function applyModules(chart: Chart, options: AgChartOptions) {
    const matchingChartType = (module: Module) => {
        return (
            (chart instanceof CartesianChart && module.chartTypes.includes('cartesian')) ||
            (chart instanceof PolarChart && module.chartTypes.includes('polar')) ||
            (chart instanceof HierarchyChart && module.chartTypes.includes('hierarchy'))
        );
    };

    let modulesChanged = false;
    const processModules = <T extends Module<ModuleInstance>>(
        moduleType: Module['type'],
        add: (module: T) => void,
        remove: (module: T) => void
    ) => {
        const modules = REGISTERED_MODULES.filter((m): m is T => m.type === moduleType);
        for (const next of modules) {
            const shouldBeEnabled = matchingChartType(next) && (options as any)[next.optionsKey] != null;
            const isEnabled = chart.isModuleEnabled(next);

            if (shouldBeEnabled === isEnabled) continue;
            modulesChanged = true;

            if (shouldBeEnabled) {
                add(next);
            } else {
                remove(next);
            }
        }
    };
    processModules<RootModule>(
        'root',
        (next) => chart.addModule(next),
        (next) => chart.removeModule(next)
    );
    processModules<LegendModule>(
        'legend',
        (next) => chart.addLegendModule(next),
        (next) => chart.removeLegendModule(next)
    );

    return modulesChanged;
}

function applySeries(chart: Chart, options: AgChartOptions) {
    const optSeries = options.series;
    if (!optSeries) {
        return;
    }

    const matchingTypes =
        chart.series.length === optSeries.length && chart.series.every((s, i) => s.type === optSeries[i]?.type);

    // Try to optimise series updates if series count and types didn't change.
    if (matchingTypes) {
        chart.series.forEach((s, i) => {
            const previousOpts = chart.processedOptions?.series?.[i] ?? {};
            const seriesDiff = jsonDiff(previousOpts, optSeries[i] ?? {}) as any;

            if (!seriesDiff) {
                return;
            }

            debug(`AgChartV2.applySeries() - applying series diff idx ${i}`, seriesDiff);

            applySeriesValues(s as any, seriesDiff, { path: `series[${i}]`, index: i });
            s.markNodeDataDirty();
        });

        return;
    }

    chart.series = createSeries(chart, optSeries);
}

function applyAxes(chart: Chart, options: { axes?: AgBaseAxisOptions[] }) {
    const optAxes = options.axes;
    if (!optAxes) {
        return false;
    }

    const matchingTypes =
        chart.axes.length === optAxes.length && chart.axes.every((a, i) => a.type === optAxes[i].type);

    // Try to optimise series updates if series count and types didn't change.
    if (matchingTypes) {
        const oldOpts = chart.processedOptions;
        if (isAgCartesianChartOptions(oldOpts)) {
            chart.axes.forEach((a, i) => {
                const previousOpts = oldOpts.axes?.[i] ?? {};
                const axisDiff = jsonDiff(previousOpts, optAxes[i]) as any;

                debug(`AgChartV2.applyAxes() - applying axis diff idx ${i}`, axisDiff);

                const path = `axes[${i}]`;
                const skip = ['axes[].type'];
                applyOptionValues(a, axisDiff, { path, skip });
            });
            return true;
        }
    }

    chart.axes = createAxis(chart, optAxes);
    return true;
}

function createSeries(chart: Chart, options: SeriesOptionsTypes[]): Series[] {
    const series: Series<any>[] = [];
    const moduleContext = chart.getModuleContext();

    let index = 0;
    for (const seriesOptions of options ?? []) {
        const path = `series[${index++}]`;
        const seriesInstance = getSeries(seriesOptions.type ?? 'unknown', moduleContext);
        applySeriesOptionModules(seriesInstance, seriesOptions);
        applySeriesValues(seriesInstance, seriesOptions, { path, index });
        series.push(seriesInstance);
    }

    return series;
}

function applySeriesOptionModules(series: Series, options: AgBaseSeriesOptions<any>) {
    const seriesOptionModules = REGISTERED_MODULES.filter((m): m is SeriesOptionModule => m.type === 'series-option');

    for (const mod of seriesOptionModules) {
        if (mod.optionsKey in options) {
            series.getModuleMap().addModule(mod);
        }
    }
}

function createAxis(chart: Chart, options: AgBaseAxisOptions[]): ChartAxis[] {
    const axes: ChartAxis[] = [];
    const skip = ['axes[].type'];
    const moduleContext = chart.getModuleContext();

    let index = 0;
    for (const axisOptions of options ?? []) {
        const axis = getAxis(axisOptions.type, moduleContext);
        const path = `axes[${index++}]`;
        applyAxisModules(axis, axisOptions);
        applyOptionValues(axis, axisOptions, { path, skip });

        axes.push(axis);
    }

    return axes;
}

function applyAxisModules(axis: ChartAxis, options: AgBaseAxisOptions) {
    let modulesChanged = false;
    const rootModules = REGISTERED_MODULES.filter((m): m is AxisOptionModule => m.type === 'axis-option');

    for (const next of rootModules) {
        const shouldBeEnabled = (options as any)[next.optionsKey] != null;
        const isEnabled = axis.isModuleEnabled(next);

        if (shouldBeEnabled === isEnabled) continue;
        modulesChanged = true;

        if (shouldBeEnabled) {
            axis.addModule(next);
        } else {
            axis.removeModule(next);
        }
    }

    return modulesChanged;
}

type ObservableLike = {
    addEventListener(key: string, cb: TypedEventListener): void;
    clearEventListeners(): void;
};
function registerListeners<T extends ObservableLike>(source: T, listeners?: {}) {
    source.clearEventListeners();
    for (const property in listeners) {
        const listener = (listeners as any)[property] as TypedEventListener;
        if (typeof listener !== 'function') continue;

        source.addEventListener(property, listener);
    }
}

function applyOptionValues<T extends object, S>(
    target: T,
    options?: S,
    { skip, path }: { skip?: string[]; path?: string } = {}
): T {
    const applyOpts = {
        ...getJsonApplyOptions(),
        skip,
        ...(path ? { path } : {}),
    };
    return jsonApply<T, any>(target, options, applyOpts);
}

function applySeriesValues(
    target: Series<any>,
    options?: AgBaseSeriesOptions<any>,
    { path, index }: { path?: string; index?: number } = {}
): Series<any> {
    const skip: string[] = ['series[].listeners', 'series[].seriesGrouping'];
    const jsonApplyOptions = getJsonApplyOptions();
    const ctrs = jsonApplyOptions.constructors ?? {};
    const seriesTypeOverrides = {
        constructors: {
            ...ctrs,
            title: target.type === 'pie' ? PieTitle : ctrs['title'],
        },
    };

    const applyOpts = {
        ...jsonApplyOptions,
        ...seriesTypeOverrides,
        skip: ['series[].type', ...(skip ?? [])],
        ...(path ? { path } : {}),
        idx: index ?? -1,
    };

    const result = jsonApply(target, options, applyOpts);

    const listeners = options?.listeners;
    if (listeners != null) {
        registerListeners(target, listeners as unknown as { [key: string]: Function });
    }

    const seriesGrouping = (options as any).seriesGrouping;
    if ('seriesGrouping' in (options ?? {})) {
        if (seriesGrouping) {
            const newSeriesGroup = Object.freeze({
                ...(target.seriesGrouping ?? {}),
                ...seriesGrouping,
            });
            target.seriesGrouping = newSeriesGroup;
        } else {
            target.seriesGrouping = seriesGrouping;
        }
    }

    return result;
}
