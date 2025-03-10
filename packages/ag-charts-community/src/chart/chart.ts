import type { AgBaseAxisOptions, AgChartInstance, AgChartOptions, AgInitialStateLegendOptions } from 'ag-charts-types';

import type { AxisOptionModule } from '../module/axisOptionModule';
import type { LayoutContext } from '../module/baseModule';
import type { LegendModule, RootModule } from '../module/coreModules';
import { moduleRegistry } from '../module/module';
import type { ModuleContext } from '../module/moduleContext';
import type { ChartOptions } from '../module/optionsModule';
import type { SeriesOptionModule } from '../module/optionsModuleTypes';
import { BBox } from '../scene/bbox';
import { Group, TranslatableGroup } from '../scene/group';
import type { Scene } from '../scene/scene';
import type { PlacedLabel, PointLabelDatum } from '../scene/util/labelPlacement';
import { isPointLabelDatum, placeLabels } from '../scene/util/labelPlacement';
import { groupBy } from '../util/array';
import { AsyncAwaitQueue, pause } from '../util/async';
import { Debug } from '../util/debug';
import { isInputPending } from '../util/dom';
import { createId } from '../util/id';
import { jsonApply, jsonDiff } from '../util/json';
import { Logger } from '../util/logger';
import { Mutex } from '../util/mutex';
import { mergeDefaults, without } from '../util/object';
import type { TypedEvent, TypedEventListener } from '../util/observable';
import { Observable } from '../util/observable';
import { Padding } from '../util/padding';
import { BaseProperties } from '../util/properties';
import { ActionOnSet, ProxyProperty } from '../util/proxy';
import { debouncedCallback } from '../util/render';
import { isDefined, isFiniteNumber, isFunction } from '../util/type-guards';
import { BOOLEAN, OBJECT, UNION, Validate } from '../util/validation';
import { Caption } from './caption';
import type { ChartAnimationPhase } from './chartAnimationPhase';
import type { ChartAxis } from './chartAxis';
import { ChartAxisDirection } from './chartAxisDirection';
import { ChartCaptions } from './chartCaptions';
import { ChartContext } from './chartContext';
import { ChartHighlight } from './chartHighlight';
import type { ChartMode } from './chartMode';
import { ChartUpdateType } from './chartUpdateType';
import { type CachedData } from './data/caching';
import { DataController } from './data/dataController';
import { axisRegistry } from './factory/axisRegistry';
import { EXPECTED_ENTERPRISE_MODULES } from './factory/expectedEnterpriseModules';
import { legendRegistry } from './factory/legendRegistry';
import { seriesRegistry } from './factory/seriesRegistry';
import { REGIONS, SimpleRegionBBoxProvider } from './interaction/regions';
import { SyncManager } from './interaction/syncManager';
import { Keyboard } from './keyboard';
import { LayoutElement } from './layout/layoutManager';
import type { ChartLegend, ChartLegendType } from './legend/legendDatum';
import { guessInvalidPositions } from './mapping/prepareAxis';
import { matchSeriesOptions } from './mapping/prepareSeries';
import { type SeriesOptionsTypes, isAgCartesianChartOptions } from './mapping/types';
import { ModulesManager } from './modulesManager';
import { ChartOverlays } from './overlay/chartOverlays';
import { getLoadingSpinner } from './overlay/loadingSpinner';
import { type Series, SeriesGroupingChangedEvent } from './series/series';
import { type SeriesAreaChartDependencies, SeriesAreaManager } from './series/seriesAreaManager';
import { SeriesLayerManager } from './series/seriesLayerManager';
import type { SeriesGrouping } from './series/seriesStateManager';
import type { ISeries } from './series/seriesTypes';
import { Tooltip } from './tooltip/tooltip';
import { DataWindowProcessor } from './update/dataWindowProcessor';
import { OverlaysProcessor } from './update/overlaysProcessor';
import type { UpdateProcessor } from './update/processor';
import type { UpdateOpts } from './updateService';
import { ZIndexMap } from './zIndexMap';

const debug = Debug.create(true, 'opts');

export type TransferableResources = {
    container?: HTMLElement;
    styleContainer?: HTMLElement;
    scene: Scene;
};

type SeriesChangeType =
    | 'no-op'
    | 'no-change'
    | 'replaced'
    | 'data-change'
    | 'series-grouping-change'
    | 'series-count-changed'
    | 'updated';

type ObservableLike = {
    addEventListener(key: string, cb: TypedEventListener): void;
    clearEventListeners(): void;
};

class SeriesArea extends BaseProperties {
    @Validate(BOOLEAN, { optional: true })
    clip?: boolean;

    @Validate(OBJECT)
    padding = new Padding(0);
}

export abstract class Chart extends Observable {
    private static readonly chartsInstances = new WeakMap<HTMLElement, Chart>();

    static getInstance(element: HTMLElement): Chart | undefined {
        return Chart.chartsInstances.get(element);
    }

    readonly id = createId(this);

    className?: string;

    readonly seriesRoot = new TranslatableGroup({
        name: `${this.id}-series-root`,
        zIndex: ZIndexMap.SERIES_LAYER,
    });
    readonly annotationRoot = new TranslatableGroup({
        name: `${this.id}-annotation-root`,
        zIndex: ZIndexMap.SERIES_ANNOTATION,
    });
    private readonly titleGroup = new Group({
        name: 'titles',
        zIndex: ZIndexMap.SERIES_LABEL,
    });

    readonly tooltip: Tooltip;
    readonly overlays: ChartOverlays;
    readonly highlight: ChartHighlight;

    private readonly debug = Debug.create();

    private extraDebugStats: Record<string, number> = {};

    @ActionOnSet<Chart>({
        newValue(value: HTMLElement) {
            if (this.destroyed) return;

            this.ctx.domManager.setContainer(value);
            Chart.chartsInstances.set(value, this);
        },
        oldValue(value: HTMLElement) {
            Chart.chartsInstances.delete(value);
        },
    })
    container?: HTMLElement;

    public data: any = [];

    @ActionOnSet<Chart>({
        newValue(value) {
            this.resize('width option', { inWidth: value });
        },
    })
    width?: number;

    @ActionOnSet<Chart>({
        newValue(value) {
            this.resize('height option', { inHeight: value });
        },
    })
    height?: number;

    @ActionOnSet<Chart>({
        newValue(value) {
            this.resize('minWidth option', { inMinWidth: value });
        },
    })
    minWidth?: number;

    @ActionOnSet<Chart>({
        newValue(value) {
            this.resize('minHeight option', { inMinHeight: value });
        },
    })
    minHeight?: number;

    /** NOTE: This is exposed for use by Integrated charts only. */
    get canvasElement() {
        return this.ctx.scene.canvas.element;
    }

    private _lastAutoSize?: [number, number];
    private _firstAutoSize = true;
    private readonly _autoSizeNotify = new AsyncAwaitQueue();

    download(fileName?: string, fileFormat?: string) {
        this.ctx.scene.download(fileName, fileFormat);
    }
    getCanvasDataURL(fileFormat?: string) {
        return this.ctx.scene.getDataURL(fileFormat);
    }

    toSVG() {
        return this.ctx.scene.toSVG();
    }

    @Validate(OBJECT)
    readonly padding = new Padding(20);

    @Validate(OBJECT)
    readonly seriesArea = new SeriesArea();

    @Validate(OBJECT)
    readonly keyboard = new Keyboard();

    @Validate(UNION(['standalone', 'integrated'], 'a chart mode'))
    mode: ChartMode = 'standalone';

    private readonly chartCaptions = new ChartCaptions();

    @ProxyProperty('chartCaptions.title')
    readonly title!: Caption;

    @ProxyProperty('chartCaptions.subtitle')
    readonly subtitle!: Caption;

    @ProxyProperty('chartCaptions.footnote')
    readonly footnote!: Caption;

    public destroyed = false;

    private readonly _destroyFns: (() => void)[] = [];

    // Used to prevent infinite update loops when syncing charts.
    protected skipSync = false;

    chartAnimationPhase: ChartAnimationPhase = 'initial';

    public readonly modulesManager = new ModulesManager();
    public readonly ctx: ChartContext;
    protected readonly seriesLayerManager: SeriesLayerManager;
    protected readonly seriesAreaManager: SeriesAreaManager;

    private readonly processors: UpdateProcessor[] = [];

    queuedUserOptions: AgChartOptions[] = [];
    chartOptions: ChartOptions;
    private firstApply = true;

    /**
     * Public API for this Chart instance. NOTE: This is initialized after construction by the
     * wrapping class that implements AgChartInstance.
     */
    publicApi?: AgChartInstance;

    getOptions() {
        return this.queuedUserOptions.at(-1) ?? this.chartOptions.userOptions;
    }

    protected constructor(options: ChartOptions, resources?: TransferableResources) {
        super();

        this.chartOptions = options;

        const scene: Scene | undefined = resources?.scene;
        const container = resources?.container ?? options.processedOptions.container ?? undefined;
        const styleContainer = resources?.styleContainer ?? options.specialOverrides.styleContainer;

        const root = new Group({ name: 'root' });
        // Prevent the scene from rendering chart components in an invalid state
        // (before first layout is performed).
        root.visible = false;
        root.append(this.seriesRoot);
        root.append(this.annotationRoot);
        root.append(this.titleGroup);

        this.titleGroup.append(this.title.node);
        this.titleGroup.append(this.subtitle.node);
        this.titleGroup.append(this.footnote.node);

        this.tooltip = new Tooltip();
        this.seriesLayerManager = new SeriesLayerManager(this.seriesRoot);
        this.mode = (options.userOptions as { mode?: ChartMode }).mode ?? this.mode;
        const ctx = (this.ctx = new ChartContext(this, {
            scene,
            root,
            container,
            styleContainer,
            syncManager: new SyncManager(this),
            pixelRatio: options.specialOverrides.overrideDevicePixelRatio,
            updateCallback: (type, opts) => this.update(type, opts),
            updateMutex: this.updateMutex,
        }));

        this._destroyFns.push(
            ctx.domManager.addListener('resize', () => this.parentResize(ctx.domManager.containerSize))
        );

        this.overlays = new ChartOverlays();
        this.overlays.loading.renderer ??= () =>
            getLoadingSpinner(this.overlays.loading.getText(ctx.localeManager), ctx.animationManager.defaultDuration);

        this.processors = [
            new DataWindowProcessor(this, ctx.dataService, ctx.updateService, ctx.zoomManager),
            new OverlaysProcessor(
                this,
                this.overlays,
                ctx.dataService,
                ctx.layoutManager,
                ctx.localeManager,
                ctx.animationManager,
                ctx.domManager
            ),
        ];

        this.highlight = new ChartHighlight();
        this.container = container;

        const moduleContext = this.getModuleContext();
        ctx.regionManager.addRegion(
            REGIONS.SERIES,
            this.seriesRoot,
            new SimpleRegionBBoxProvider(this.seriesRoot, () => this.seriesRect ?? BBox.zero),
            this.ctx.axisManager.axisGridGroup
        );
        ctx.regionManager.addRegion('root', root);

        // The 'data-animating' is used by e2e tests to wait for the animation to end before starting kbm interactions
        ctx.domManager.setDataBoolean('animating', false);

        this.seriesAreaManager = new SeriesAreaManager(this.initSeriesAreaDependencies());
        this._destroyFns.push(
            ctx.layoutManager.registerElement(LayoutElement.Caption, (e) => {
                e.layoutBox.shrink(this.padding.toJson());
                this.chartCaptions.positionCaptions(e);
            }),
            ctx.layoutManager.addListener('layout:complete', (e) => this.chartCaptions.positionAbsoluteCaptions(e)),

            ctx.dataService.addListener('data-load', (event) => {
                this.data = event.data;
            }),

            this.title.registerInteraction(moduleContext, 'beforebegin'),
            this.subtitle.registerInteraction(moduleContext, 'beforebegin'),
            this.footnote.registerInteraction(moduleContext, 'afterend'),

            ctx.interactionManager.addListener('page-left', () => this.destroy()),

            ctx.animationManager.addListener('animation-frame', () => {
                this.update(ChartUpdateType.SCENE_RENDER);
            }),
            ctx.animationManager.addListener('animation-start', () => ctx.domManager.setDataBoolean('animating', true)),
            ctx.animationManager.addListener('animation-stop', () => ctx.domManager.setDataBoolean('animating', false)),
            ctx.zoomManager.addListener('zoom-change', () => {
                this.series.forEach((s) => (s as any).animationState?.transition('updateData'));
                const skipAnimations = this.chartAnimationPhase !== 'initial';
                this.update(ChartUpdateType.PERFORM_LAYOUT, { forceNodeDataRefresh: true, skipAnimations });
            })
        );

        this.parentResize(ctx.domManager.containerSize);
    }

    private initSeriesAreaDependencies(): SeriesAreaChartDependencies {
        const { ctx, tooltip, highlight, overlays, seriesRoot, mode } = this;
        const chartType = this.getChartType();
        const fireEvent = this.fireEvent.bind(this);
        const getUpdateType = () => this.performUpdateType;
        return { fireEvent, getUpdateType, chartType, ctx, tooltip, highlight, overlays, seriesRoot, mode };
    }

    getModuleContext(): ModuleContext {
        return this.ctx;
    }

    abstract getChartType():
        | 'cartesian'
        | 'polar'
        | 'hierarchy'
        | 'topology'
        | 'flow-proportion'
        | 'standalone'
        | 'gauge';

    protected getCaptionText(): string {
        return [this.title, this.subtitle, this.footnote]
            .filter((caption) => caption.enabled && caption.text)
            .map((caption) => caption.text)
            .join('. ');
    }

    protected getAriaLabel(): string {
        return this.ctx.localeManager.t('ariaAnnounceChart', { seriesCount: this.series.length });
    }

    resetAnimations() {
        this.chartAnimationPhase = 'initial';

        for (const series of this.series) {
            series.resetAnimation(this.chartAnimationPhase);
        }
        for (const axis of this.axes) {
            axis.resetAnimation(this.chartAnimationPhase);
        }

        // Reset animation state.
        this.animationRect = undefined;
        this.ctx.animationManager.reset();
    }

    skipAnimations() {
        this.ctx.animationManager.skipCurrentBatch();
        this._performUpdateSkipAnimations = true;
    }

    detachAndClear() {
        this.container = undefined;
        this.ctx.scene.clear();
    }

    destroy(opts?: { keepTransferableResources: boolean }): TransferableResources | undefined {
        if (this.destroyed) {
            return;
        }

        const keepTransferableResources = opts?.keepTransferableResources;
        let result: TransferableResources | undefined;

        this.performUpdateType = ChartUpdateType.NONE;

        this._destroyFns.forEach((fn) => fn());
        this.processors.forEach((p) => p.destroy());
        this.tooltip.destroy(this.ctx.domManager);
        this.overlays.destroy();
        this.modulesManager.destroy();

        if (keepTransferableResources) {
            this.ctx.scene.strip();
            // The wrapper object is going to get destroyed. So to be safe, copy its properties.
            result = {
                container: this.container,
                scene: this.ctx.scene,
            };
        } else {
            this.ctx.scene.destroy();
            this.container = undefined;
        }

        this.destroySeries(this.series);
        this.seriesLayerManager.destroy();

        this.axes.forEach((a) => a.destroy());
        this.axes = [];

        // Reset animation state.
        this.animationRect = undefined;

        this.ctx.destroy();
        this.destroyed = true;

        Object.freeze(this);

        return result;
    }

    requestFactoryUpdate(cb: (chart: Chart) => Promise<void> | void) {
        if (this.destroyed) return;
        this._pendingFactoryUpdatesCount++;
        this.updateMutex
            .acquire(async () => {
                if (this.destroyed) return;
                try {
                    await cb(this);
                } finally {
                    if (!this.destroyed) {
                        this._pendingFactoryUpdatesCount--;
                    }
                }
            })
            .catch((e) => Logger.errorOnce(e));
    }

    private _pendingFactoryUpdatesCount = 0;
    private _performUpdateSkipAnimations: boolean = false;
    private readonly _performUpdateNotify = new AsyncAwaitQueue();
    private performUpdateType: ChartUpdateType = ChartUpdateType.NONE;
    private runningUpdateType: ChartUpdateType = ChartUpdateType.NONE;

    private updateShortcutCount = 0;
    private readonly seriesToUpdate: Set<ISeries<any, any>> = new Set();
    private readonly updateMutex = new Mutex();
    private updateRequestors: Record<string, ChartUpdateType> = {};
    private readonly performUpdateTrigger = debouncedCallback(({ count }) => {
        if (this.destroyed) return;
        this.updateMutex
            .acquire(async () => {
                try {
                    await this.performUpdate(count);
                } catch (error) {
                    Logger.error('update error', error);
                }
            })
            .catch((e) => Logger.errorOnce(e));
    });
    public update(type = ChartUpdateType.FULL, opts?: UpdateOpts) {
        const {
            forceNodeDataRefresh = false,
            skipAnimations,
            seriesToUpdate = this.series,
            newAnimationBatch,
        } = opts ?? {};

        if (forceNodeDataRefresh) {
            this.series.forEach((series) => series.markNodeDataDirty());
        }

        for (const series of seriesToUpdate) {
            this.seriesToUpdate.add(series);
        }

        if (skipAnimations) {
            this.ctx.animationManager.skipCurrentBatch();
            this._performUpdateSkipAnimations = true;
        }

        if (newAnimationBatch && this.ctx.animationManager.isActive()) {
            this._performUpdateSkipAnimations = true;
        }

        this.skipSync = opts?.skipSync ?? false;

        if (this.debug.check()) {
            let stack = new Error().stack ?? '<unknown>';
            stack = stack.replace(/\([^)]*/g, '');
            this.updateRequestors[stack] = type;
        }

        if (type < this.performUpdateType) {
            this.performUpdateType = type;
            this.ctx.domManager.setDataBoolean('updatePending', true);
            this.performUpdateTrigger.schedule(opts?.backOffMs);
        }
    }

    private readonly _performUpdateSplits: Record<string, number> = {};
    private async performUpdate(count: number) {
        const { performUpdateType, extraDebugStats, _performUpdateSplits: splits, ctx } = this;
        const seriesToUpdate = [...this.seriesToUpdate];

        // Clear state immediately so that side effects can be detected prior to SCENE_RENDER.
        this.performUpdateType = ChartUpdateType.NONE;
        this.seriesToUpdate.clear();
        this.runningUpdateType = performUpdateType;

        if (this.updateShortcutCount === 0 && performUpdateType < ChartUpdateType.SCENE_RENDER) {
            ctx.animationManager.startBatch(this._performUpdateSkipAnimations);
            ctx.animationManager.onBatchStop(() => (this.chartAnimationPhase = 'ready'));
        }

        this.debug('Chart.performUpdate() - start', ChartUpdateType[performUpdateType]);
        let previousSplit = performance.now();
        splits.start ??= previousSplit;
        const updateSplits = (splitName: string) => {
            splits[splitName] ??= 0;
            splits[splitName] += performance.now() - previousSplit;
            previousSplit = performance.now();
        };

        switch (performUpdateType) {
            case ChartUpdateType.FULL:
                if (this.checkUpdateShortcut(ChartUpdateType.FULL)) break;

                this.ctx.updateService.dispatchPreDomUpdate();
                this.updateDOM();
            // fallthrough

            case ChartUpdateType.UPDATE_DATA:
                if (this.checkUpdateShortcut(ChartUpdateType.UPDATE_DATA)) break;

                await this.updateData();
                updateSplits('⬇️');
            // fallthrough

            case ChartUpdateType.PROCESS_DATA:
                if (this.checkUpdateShortcut(ChartUpdateType.PROCESS_DATA)) break;

                await this.processData();
                this.seriesAreaManager.dataChanged();
                updateSplits('🏭');
            // fallthrough

            case ChartUpdateType.PERFORM_LAYOUT:
                await this.checkFirstAutoSize();
                if (this.checkUpdateShortcut(ChartUpdateType.PERFORM_LAYOUT)) break;

                await this.processLayout();
                updateSplits('⌖');
            // fallthrough

            case ChartUpdateType.SERIES_UPDATE: {
                if (this.checkUpdateShortcut(ChartUpdateType.SERIES_UPDATE)) break;

                const { seriesRect } = this;
                await Promise.all(seriesToUpdate.map((series) => series.update({ seriesRect })));

                updateSplits('🤔');

                this.updateAriaLabels();
                this.seriesLayerManager.updateLayerCompositing();
            }
            // fallthrough

            case ChartUpdateType.PRE_SCENE_RENDER:
                if (this.checkUpdateShortcut(ChartUpdateType.PRE_SCENE_RENDER)) break;

                // Allow any additional pre-rendering processing to happen.
                ctx.updateService.dispatchPreSceneRender(this.getMinRects());

                updateSplits('↖');
            // fallthrough

            case ChartUpdateType.SCENE_RENDER:
                if (this.checkUpdateShortcut(ChartUpdateType.SCENE_RENDER)) break;

                // Force any initial animation changes to be applied BEFORE any rendering happens.
                ctx.animationManager.endBatch();

                extraDebugStats['updateShortcutCount'] = this.updateShortcutCount;
                ctx.scene.render({ debugSplitTimes: splits, extraDebugStats, seriesRect: this.seriesRect });
                this.extraDebugStats = {};
                for (const key of Object.keys(splits)) {
                    delete splits[key];
                }

                this.ctx.domManager.incrementDataCounter('sceneRenders');
            // fallthrough

            case ChartUpdateType.NONE:
                // Do nothing.
                this.updateShortcutCount = 0;
                this.updateRequestors = {};
                this._performUpdateSkipAnimations = false;
                ctx.animationManager.endBatch();
        }

        if (!this.destroyed) {
            ctx.updateService.dispatchUpdateComplete(this.getMinRects());
            this.ctx.domManager.setDataBoolean('updatePending', false);
            this.runningUpdateType = ChartUpdateType.NONE;
        }
        this._performUpdateNotify.notify();

        const end = performance.now();
        this.debug('Chart.performUpdate() - end', {
            chart: this,
            durationMs: Math.round((end - splits['start']) * 100) / 100,
            count,
            performUpdateType: ChartUpdateType[performUpdateType],
        });
    }

    private updateThemeClassName() {
        const { theme } = this.chartOptions.processedOptions;

        const themeClassNamePrefix = 'ag-charts-theme-';
        const validThemeClassNames = [`${themeClassNamePrefix}default`, `${themeClassNamePrefix}default-dark`];

        let themeClassName = validThemeClassNames[0];
        let isDark = false;

        if (typeof theme === 'string') {
            themeClassName = theme.replace('ag-', themeClassNamePrefix);
            isDark = theme.includes('-dark');
        } else if (typeof theme?.baseTheme === 'string') {
            themeClassName = theme.baseTheme.replace('ag-', themeClassNamePrefix);
            isDark = theme.baseTheme.includes('-dark');
        }

        if (!validThemeClassNames.includes(themeClassName)) {
            themeClassName = isDark ? validThemeClassNames[1] : validThemeClassNames[0];
        }

        this.ctx.domManager.setThemeClass(themeClassName);
    }

    private updateDOM() {
        this.updateThemeClassName();

        const { enabled, tabIndex } = this.keyboard;
        this.ctx.domManager.setTabGuardIndex(enabled ? tabIndex ?? 0 : -1);
    }

    private updateAriaLabels() {
        this.ctx.domManager.updateCanvasLabel(this.getAriaLabel());
    }

    private checkUpdateShortcut(checkUpdateType: ChartUpdateType) {
        const maxShortcuts = 3;

        if (this.destroyed) return true;

        if (this.updateShortcutCount > maxShortcuts) {
            Logger.warn(
                `exceeded the maximum number of simultaneous updates (${
                    maxShortcuts + 1
                }), discarding changes and rendering`,
                this.updateRequestors
            );
            return false;
        }

        if (this.performUpdateType <= checkUpdateType) {
            // A previous step modified series state, and we need to re-run this or an earlier step before rendering.
            this.updateShortcutCount++;
            return true;
        }

        return false;
    }

    private async checkFirstAutoSize() {
        if (this.width != null && this.height != null) {
            // Auto-size isn't in use in this case, don't wait for it.
        } else if (!this._lastAutoSize) {
            const success = await this._autoSizeNotify.await(500);

            if (!success) {
                // After several failed passes, continue and accept there maybe a redundant
                // render. Sometimes this case happens when we already have the correct
                // width/height, and we end up never rendering the chart in that scenario.
                this.debug('Chart.checkFirstAutoSize() - timeout for first size update.');
            }
        }
    }

    @ActionOnSet<Chart>({
        changeValue(newValue, oldValue) {
            this.onAxisChange(newValue, oldValue);
        },
    })
    axes: ChartAxis[] = [];

    @ActionOnSet<Chart>({
        changeValue(newValue, oldValue) {
            this.onSeriesChange(newValue, oldValue);
        },
    })
    series: Series<any, any>[] = [];

    protected onAxisChange(newValue: ChartAxis[], oldValue?: ChartAxis[]) {
        if (oldValue == null && newValue.length === 0) return;

        this.ctx.axisManager.updateAxes(oldValue ?? [], newValue);
    }

    protected onSeriesChange(newValue: Series<any, any>[], oldValue?: Series<any, any>[]) {
        const seriesToDestroy = oldValue?.filter((series) => !newValue.includes(series)) ?? [];
        this.destroySeries(seriesToDestroy);
        this.seriesLayerManager?.setSeriesCount(newValue.length);

        for (const series of newValue) {
            if (oldValue?.includes(series)) continue;

            const seriesContentNode = this.seriesLayerManager.requestGroup(series);
            series.attachSeries(seriesContentNode, this.seriesRoot, this.annotationRoot);

            const chart = this;
            series.chart = {
                get mode() {
                    return chart.mode;
                },
                get isMiniChart() {
                    return false;
                },
                get seriesRect() {
                    return chart.seriesRect;
                },
                placeLabels(padding?: number) {
                    return chart.placeLabels(padding);
                },
            };

            series.resetAnimation(this.chartAnimationPhase);
            this.addSeriesListeners(series);
            series.addChartEventListeners();
        }

        this.seriesAreaManager?.seriesChanged(newValue);
    }

    protected destroySeries(allSeries: Series<any, any>[]): void {
        allSeries?.forEach((series) => {
            series.removeEventListener('nodeClick', this.onSeriesNodeClick);
            series.removeEventListener('nodeDoubleClick', this.onSeriesNodeDoubleClick);
            series.removeEventListener('groupingChanged', this.seriesGroupingChanged);
            series.destroy();
            this.seriesLayerManager.releaseGroup(series);
            series.detachSeries(undefined, this.seriesRoot, this.annotationRoot);

            series.chart = undefined;
        });
    }

    private addSeriesListeners(series: Series<any, any>) {
        if (this.hasEventListener('seriesNodeClick')) {
            series.addEventListener('nodeClick', this.onSeriesNodeClick);
        }

        if (this.hasEventListener('seriesNodeDoubleClick')) {
            series.addEventListener('nodeDoubleClick', this.onSeriesNodeDoubleClick);
        }

        series.addEventListener('groupingChanged', this.seriesGroupingChanged);
    }

    protected assignSeriesToAxes() {
        for (const axis of this.axes) {
            axis.boundSeries = this.series.filter((s) => s.axes[axis.direction] === axis);
        }
    }

    protected assignAxesToSeries() {
        // This method has to run before `assignSeriesToAxes`.
        const directionToAxesMap = groupBy(this.axes, (axis) => axis.direction);

        for (const series of this.series) {
            for (const direction of series.directions) {
                const directionAxes = directionToAxesMap[direction];
                if (!directionAxes) {
                    Logger.warnOnce(
                        `no available axis for direction [${direction}]; check series and axes configuration.`
                    );
                    return;
                }

                const seriesKeys = series.getKeys(direction);
                const newAxis = directionAxes.find(
                    (axis) => !axis.keys.length || seriesKeys.some((key) => axis.keys.includes(key))
                );
                if (!newAxis) {
                    Logger.warnOnce(
                        `no matching axis for direction [${direction}] and keys [${seriesKeys}]; check series and axes configuration.`
                    );
                    return;
                }

                series.axes[direction] = newAxis;
            }
        }
    }

    private parentResize(size: { width: number; height: number } | undefined) {
        if (size == null || (this.width != null && this.height != null)) return;

        let { width, height } = size;

        width = Math.floor(width);
        height = Math.floor(height);

        if (width === 0 && height === 0) return;

        const [autoWidth = 0, authHeight = 0] = this._lastAutoSize ?? [];
        if (autoWidth === width && authHeight === height) return;

        this._lastAutoSize = [width, height];
        this.resize('SizeMonitor', {});
    }

    private resize(
        source: string,
        opts: { inWidth?: number; inHeight?: number; inMinWidth?: number; inMinHeight?: number }
    ) {
        const { scene, animationManager } = this.ctx;
        const { inWidth, inHeight, inMinWidth, inMinHeight } = opts;

        this.ctx.domManager.setSizeOptions(
            inMinWidth ?? this.minWidth,
            inMinHeight ?? this.minHeight,
            inWidth ?? this.width,
            inHeight ?? this.height
        );

        const width = inWidth ?? this.width ?? this._lastAutoSize?.[0];
        const height = inHeight ?? this.height ?? this._lastAutoSize?.[1];
        this.debug(`Chart.resize() from ${source}`, { width, height, stack: new Error().stack });
        if (width == null || height == null || !isFiniteNumber(width) || !isFiniteNumber(height)) return;

        if (scene.resize(width, height)) {
            animationManager.reset();

            let skipAnimations = true;
            if ((this.width == null || this.height == null) && this._firstAutoSize) {
                skipAnimations = false;
                this._firstAutoSize = false;
            }

            this.update(ChartUpdateType.PERFORM_LAYOUT, { forceNodeDataRefresh: true, skipAnimations });
            this._autoSizeNotify.notify();
        }
    }

    async updateData() {
        this.series.forEach((s) => s.setChartData(this.data));
        const modulePromises = this.modulesManager.mapModules((m) => m.updateData?.(this.data));
        await Promise.all(modulePromises);
    }

    private _cachedData: CachedData | undefined = undefined;
    async processData() {
        if (this.series.some((s) => s.canHaveAxes)) {
            this.assignAxesToSeries();
            this.assignSeriesToAxes();
        }

        const dataController = new DataController(this.mode);
        const seriesPromises = this.series.map((s) => {
            s.resetDatumCallbackCache();
            return s.processData(dataController);
        });
        const modulePromises = this.modulesManager.mapModules((m) => m.processData?.(dataController));
        this._cachedData = dataController.execute(this._cachedData);
        await Promise.all([...seriesPromises, ...modulePromises]);

        this.updateLegends();
    }

    private updateLegends(initialStateLegend?: AgInitialStateLegendOptions[]) {
        for (const { legend, legendType } of this.modulesManager.legends()) {
            if (legendType === 'category') {
                this.setCategoryLegendData(initialStateLegend);
            } else {
                this.setLegendData(legendType, legend);
            }
        }
    }

    placeLabels(padding?: number): Map<Series<any, any>, PlacedLabel[]> {
        const visibleSeries: Series<any, any>[] = [];
        const data: PointLabelDatum[][] = [];
        for (const series of this.series) {
            if (!series.visible) continue;

            const labelData: PointLabelDatum[] = series.getLabelData();

            if (isPointLabelDatum(labelData?.[0])) {
                data.push(labelData);
                visibleSeries.push(series);
            }
        }

        const { seriesRect } = this;
        const { top, right, bottom, left } = this.seriesArea.padding;
        const labels: PlacedLabel[][] =
            seriesRect && data.length > 0
                ? placeLabels(
                      data,
                      {
                          x: -left,
                          y: -top,
                          width: seriesRect.width + left + right,
                          height: seriesRect.height + top + bottom,
                      },
                      padding
                  )
                : [];
        return new Map(labels.map((l, i) => [visibleSeries[i], l]));
    }

    private setCategoryLegendData(initialState?: AgInitialStateLegendOptions[]) {
        const {
            ctx: { legendManager, stateManager },
        } = this;

        const legendData = this.series.flatMap((s) => {
            const seriesLegendData = s.getLegendData('category');
            legendManager.updateData(s.id, seriesLegendData);
            return seriesLegendData;
        });

        if (initialState) {
            stateManager.setState(legendManager, initialState);
            return;
        }

        if (this.mode !== 'integrated') {
            // Validate each series that shares a legend item label uses the same fill colour
            const seriesMarkerFills: { [key: string]: { [key: string]: string | undefined } } = {};
            const seriesTypeMap = new Map(this.series.map((s) => [s.id, s.type]));

            for (const {
                seriesId,
                symbols: [{ marker }],
                label,
            } of legendData.filter((d) => !d.hideInLegend)) {
                if (marker.fill == null) continue;

                const seriesType = seriesTypeMap.get(seriesId)!;
                const markerFill = (seriesMarkerFills[seriesType] ??= {});

                markerFill[label.text] ??= marker.fill;
                if (markerFill[label.text] !== marker.fill) {
                    Logger.warnOnce(
                        `legend item '${label.text}' has multiple fill colors, this may cause unexpected behaviour.`
                    );
                }
            }
        }

        legendManager.update();
    }

    private setLegendData(legendType: ChartLegendType, legend: ChartLegend) {
        legend.data = this.series.filter((s) => s.properties.showInLegend).flatMap((s) => s.getLegendData(legendType));
    }

    private async processLayout() {
        const oldRect = this.animationRect;
        const { width, height } = this.ctx.scene;
        const ctx = this.ctx.layoutManager.createContext(width, height);

        await this.performLayout(ctx);

        if (oldRect && !this.animationRect?.equals(oldRect)) {
            // Skip animations if the layout changed.
            this.ctx.animationManager.skipCurrentBatch();
        }
        this.debug('Chart.performUpdate() - seriesRect', this.seriesRect);
    }

    protected abstract performLayout(ctx: LayoutContext): Promise<void> | void;

    // Should be available after the first layout.
    protected seriesRect?: BBox;
    // BBox of the chart area containing animatable elements; if this changes, we skip animations.
    protected animationRect?: BBox;

    private readonly onSeriesNodeClick = (event: TypedEvent) => {
        this.fireEvent({ ...event, type: 'seriesNodeClick' });
    };

    private readonly onSeriesNodeDoubleClick = (event: TypedEvent) => {
        this.fireEvent({ ...event, type: 'seriesNodeDoubleClick' });
    };

    private readonly seriesGroupingChanged = (event: TypedEvent) => {
        if (!(event instanceof SeriesGroupingChangedEvent)) return;
        const { series, seriesGrouping, oldGrouping } = event;

        // Short-circuit if series isn't already attached to the scene-graph yet.
        if (series.contentGroup.isRoot()) return;

        this.seriesLayerManager.changeGroup({
            internalId: series.internalId,
            type: series.type,
            contentGroup: series.contentGroup,
            renderToOffscreenCanvas: () => series.renderToOffscreenCanvas(),
            seriesGrouping,
            oldGrouping,
        });
    };

    async waitForUpdate(timeoutMs = 10_000, failOnTimeout = false): Promise<void> {
        const start = performance.now();

        while (
            this._pendingFactoryUpdatesCount > 0 ||
            this.performUpdateType !== ChartUpdateType.NONE ||
            this.runningUpdateType !== ChartUpdateType.NONE
        ) {
            if (this._pendingFactoryUpdatesCount > 0) {
                // wait until any pending updates are flushed through.
                await this.updateMutex.waitForClearAcquireQueue();
            }

            if (this.performUpdateType !== ChartUpdateType.NONE || this.runningUpdateType !== ChartUpdateType.NONE) {
                await this._performUpdateNotify.await();
            }

            if (performance.now() - start > timeoutMs) {
                const message = `Chart.waitForUpdate() timeout of ${timeoutMs} reached - first chart update taking too long.`;
                if (failOnTimeout) {
                    throw new Error(message);
                } else {
                    Logger.warnOnce(message);
                }
            }

            if (isInputPending()) {
                await pause();
            }
        }
    }

    protected getMinRects() {
        const { width, height } = this.ctx.scene;
        const minRects = this.series.map((series) => series.getMinRects(width, height)).filter(isDefined);

        if (minRects.length === 0) return;

        let maxWidth = 0;
        let maxHeight = 0;
        let maxVisibleWidth = 0;
        let maxVisibleHeight = 0;

        for (const { minRect, minVisibleRect } of minRects) {
            maxWidth = Math.max(maxWidth, minRect.width);
            maxHeight = Math.max(maxHeight, minRect.height);
            maxVisibleWidth = Math.max(maxVisibleWidth, minVisibleRect.width);
            maxVisibleHeight = Math.max(maxVisibleHeight, minVisibleRect.height);
        }

        const minRect = new BBox(0, 0, maxWidth, maxHeight);
        let minVisibleRect = minRect.clone();
        if (maxVisibleWidth > 0 && maxVisibleHeight > 0) {
            minVisibleRect = new BBox(0, 0, maxVisibleWidth, maxVisibleHeight);
        }

        return { minRect, minVisibleRect };
    }

    private filterMiniChartSeries(series: AgChartOptions['series'] | undefined): AgChartOptions['series'] | undefined;
    private filterMiniChartSeries(series: AgChartOptions['series']): AgChartOptions['series'];
    private filterMiniChartSeries(series: any[] | undefined): any[] | undefined {
        return series?.filter((s) => s.showInMiniChart !== false);
    }

    applyOptions(newChartOptions: ChartOptions) {
        const deltaOptions = this.firstApply
            ? newChartOptions.processedOptions
            : newChartOptions.diffOptions(this.chartOptions);
        if (deltaOptions == null || Object.keys(deltaOptions).length === 0) return;

        const oldOpts = this.firstApply ? {} : this.chartOptions.processedOptions;
        const newOpts = newChartOptions.processedOptions;

        debug('Chart.applyOptions() - applying delta', deltaOptions);

        const modulesChanged = this.applyModules(newOpts);

        const skip = [
            'type',
            'data',
            'series',
            'listeners',
            'preset',
            'theme',
            'legend.listeners',
            'navigator.miniChart.series',
            'navigator.miniChart.label',
            'locale.localeText',
            'axes',
            'topology',
            'nodes',
            'initialState',
            'styleContainer',
        ];

        // Needs to be done before applying the series to detect if a seriesNode[Double]Click listener has been added
        if (deltaOptions.listeners) {
            this.registerListeners(this, deltaOptions.listeners as Record<string, TypedEventListener>);
        }

        jsonApply<any, any>(this, deltaOptions, { skip });

        let forceNodeDataRefresh = false;
        let seriesStatus: SeriesChangeType = 'no-op';
        if (deltaOptions.series != null) {
            seriesStatus = this.applySeries(this, deltaOptions.series, oldOpts?.series);
            forceNodeDataRefresh = true;
        }
        if (seriesStatus === 'replaced') {
            this.resetAnimations();
        }
        if (this.applyAxes(this, newOpts, oldOpts, seriesStatus, [])) {
            forceNodeDataRefresh = true;
        }

        if (deltaOptions.data) {
            this.data = deltaOptions.data;
        }
        if (deltaOptions.legend?.listeners && this.modulesManager.isEnabled('legend')) {
            Object.assign((this as any).legend.listeners, deltaOptions.legend.listeners);
        }
        if (deltaOptions.locale?.localeText) {
            this.modulesManager.getModule<any>('locale').localeText = deltaOptions.locale?.localeText;
        }

        this.chartOptions = newChartOptions;

        const navigatorModule = this.modulesManager.getModule<any>('navigator');
        const zoomModule = this.modulesManager.getModule<any>('zoom');

        if (!navigatorModule?.enabled && !zoomModule?.enabled) {
            // reset zoom to initial state
            this.ctx.zoomManager.updateZoom('chart');
        }

        const miniChart = navigatorModule?.miniChart;
        const miniChartSeries = newOpts.navigator?.miniChart?.series ?? newOpts.series;
        if (miniChart?.enabled === true && miniChartSeries != null) {
            this.applyMiniChartOptions(miniChart, miniChartSeries, newOpts, oldOpts);
        } else if (miniChart?.enabled === false) {
            miniChart.series = [];
            miniChart.axes = [];
        }

        this.ctx.annotationManager.setAnnotationStyles(newChartOptions.annotationThemes);

        forceNodeDataRefresh ||= this.shouldForceNodeDataRefresh(deltaOptions, seriesStatus);
        const majorChange = forceNodeDataRefresh || modulesChanged;
        const updateType = majorChange ? ChartUpdateType.FULL : ChartUpdateType.PERFORM_LAYOUT;
        this.maybeResetAnimations(seriesStatus);

        debug('Chart.applyOptions() - update type', ChartUpdateType[updateType], {
            seriesStatus,
            forceNodeDataRefresh,
        });
        this.update(updateType, { forceNodeDataRefresh, newAnimationBatch: true });

        this.ctx.legendManager.clearData();
        this.applyInitialState(newOpts);

        this.firstApply = false;
    }

    private applyInitialState(options: AgChartOptions) {
        const { annotationManager, chartTypeOriginator, historyManager, stateManager, zoomManager } = this.ctx;
        const { initialState } = options;

        if ('annotations' in options && options.annotations?.enabled && initialState?.annotations != null) {
            const annotations = initialState.annotations.map((annotation) => {
                const annotationTheme = annotationManager.getAnnotationTypeStyles(annotation.type);
                return mergeDefaults(annotation, annotationTheme);
            });

            stateManager.setState(annotationManager, annotations);
        }

        if (initialState?.chartType != null) {
            stateManager.setState(chartTypeOriginator, initialState.chartType);
        }

        if ((options.navigator?.enabled || options.zoom?.enabled) && initialState?.zoom != null) {
            stateManager.setState(zoomManager, initialState.zoom);
        }

        if (initialState?.legend != null) {
            this.updateLegends(initialState.legend);
        }

        if (initialState != null) {
            historyManager.clear();
        }
    }

    private maybeResetAnimations(seriesStatus: SeriesChangeType) {
        if (this.mode !== 'standalone') return;

        switch (seriesStatus) {
            case 'series-grouping-change':
            case 'replaced':
                this.resetAnimations();
                break;

            default:
            // Don't reset to initial load in other cases.
        }
    }

    private shouldForceNodeDataRefresh(deltaOptions: AgChartOptions, seriesStatus: SeriesChangeType) {
        const seriesDataUpdate = !!deltaOptions.data || seriesStatus === 'data-change' || seriesStatus === 'replaced';
        const legendKeys = legendRegistry.getKeys();
        const optionsHaveLegend = Object.values(legendKeys).some(
            (legendKey) => (deltaOptions as any)[legendKey] != null
        );
        const otherRefreshUpdate = deltaOptions.title != null && deltaOptions.subtitle != null;
        return seriesDataUpdate || optionsHaveLegend || otherRefreshUpdate;
    }

    private applyMiniChartOptions(
        miniChart: any,
        miniChartSeries: NonNullable<AgChartOptions['series']>,
        completeOptions: AgChartOptions,
        oldOpts: AgChartOptions & { type?: SeriesOptionsTypes['type'] }
    ) {
        const oldSeries = oldOpts?.navigator?.miniChart?.series ?? oldOpts?.series;
        const miniChartSeriesStatus = this.applySeries(
            miniChart,
            this.filterMiniChartSeries(miniChartSeries),
            this.filterMiniChartSeries(oldSeries)
        );
        this.applyAxes(miniChart, completeOptions, oldOpts, miniChartSeriesStatus, [
            'axes[].tick',
            'axes[].thickness',
            'axes[].title',
            'axes[].crosshair',
            'axes[].gridLine',
            'axes[].label',
        ]);

        const series = miniChart.series as Series<any, any>[];
        for (const s of series) {
            // AG-12681
            s.properties.id = undefined;
        }

        const axes = miniChart.axes as ChartAxis[];
        const horizontalAxis = axes.find((axis) => axis.direction === ChartAxisDirection.X);

        for (const axis of axes) {
            axis.gridLine.enabled = false;
            axis.label.enabled = axis === horizontalAxis;
            axis.tick.enabled = false;
            axis.interactionEnabled = false;
        }

        if (horizontalAxis != null) {
            const miniChartOpts = completeOptions.navigator?.miniChart;
            const labelOptions = miniChartOpts?.label;
            const intervalOptions = miniChartOpts?.label?.interval;

            horizontalAxis.line.enabled = false;

            horizontalAxis.label.set(
                without(labelOptions, ['interval', 'rotation', 'minSpacing', 'autoRotate', 'autoRotateAngle'])
            );
            horizontalAxis.tick.set(
                without(intervalOptions, ['enabled', 'width', 'size', 'color', 'interval', 'step'])
            );

            const step = intervalOptions?.step;
            if (step != null) {
                horizontalAxis.interval.step = step;
            }
        }
    }

    private applyModules(options: AgChartOptions) {
        const { type: chartType } = this.constructor as any;

        let modulesChanged = false;
        for (const module of moduleRegistry.byType<RootModule | LegendModule>('root', 'legend')) {
            const isConfigured = options[module.optionsKey as keyof AgChartOptions] != null;
            const shouldBeEnabled = isConfigured && module.chartTypes.includes(chartType);

            if (shouldBeEnabled === this.modulesManager.isEnabled(module)) continue;

            if (shouldBeEnabled) {
                this.modulesManager.addModule(module, (m) => m.moduleFactory(this.getModuleContext()));

                if (module.type === 'legend') {
                    this.modulesManager.getModule<ChartLegend>(module)?.attachLegend(this.ctx.scene);
                }

                (this as any)[module.optionsKey] = this.modulesManager.getModule(module); // TODO remove
            } else {
                this.modulesManager.removeModule(module);
                delete (this as any)[module.optionsKey]; // TODO remove
            }

            modulesChanged = true;
        }

        return modulesChanged;
    }

    private initSeriesDeclarationOrder(series: Series<any, any>[]) {
        // Ensure declaration order is set, this is used for correct z-index behavior for combo charts.
        for (let idx = 0; idx < series.length; idx++) {
            series[idx].setSeriesIndex(idx);
        }
    }

    private applySeries(
        chart: { series: Series<any, any>[] },
        optSeries: AgChartOptions['series'],
        oldOptSeries?: AgChartOptions['series']
    ): SeriesChangeType {
        if (!optSeries) {
            return 'no-change';
        }

        const matchResult = matchSeriesOptions(chart.series, optSeries, oldOptSeries);
        if (matchResult.status === 'no-overlap') {
            debug(`Chart.applySeries() - creating new series instances, status: ${matchResult.status}`, matchResult);
            const chartSeries = optSeries.map((opts) => this.createSeries(opts));
            this.initSeriesDeclarationOrder(chartSeries);
            chart.series = chartSeries;
            return 'replaced';
        }

        debug(`Chart.applySeries() - matchResult`, matchResult);

        const seriesInstances = [];
        let dataChanged = false;
        let groupingChanged = false;
        let isUpdated = false;

        for (const change of matchResult.changes) {
            groupingChanged ||= change.status === 'series-grouping';
            dataChanged ||= change.diff?.data != null;
            isUpdated ||= change.status !== 'no-op';

            switch (change.status) {
                case 'add': {
                    const newSeries = this.createSeries(change.opts);
                    seriesInstances.push(newSeries);
                    debug(`Chart.applySeries() - created new series`, newSeries);
                    break;
                }

                case 'remove':
                    debug(`Chart.applySeries() - removing series at previous idx ${change.idx}`, change.series);
                    break;

                case 'no-op':
                    seriesInstances.push(change.series);
                    debug(`Chart.applySeries() - no change to series at previous idx ${change.idx}`, change.series);
                    break;

                case 'series-grouping':
                case 'update':
                default: {
                    const { series, diff, idx } = change;
                    debug(`Chart.applySeries() - applying series diff previous idx ${idx}`, diff, series);
                    this.applySeriesValues(series, diff);
                    series.markNodeDataDirty();
                    seriesInstances.push(series);
                }
            }
        }
        this.initSeriesDeclarationOrder(seriesInstances);

        debug(`Chart.applySeries() - final series instances`, seriesInstances);
        chart.series = seriesInstances;

        if (groupingChanged) {
            return 'series-grouping-change';
        }
        if (dataChanged) {
            return 'data-change';
        }
        return isUpdated ? 'updated' : 'no-op';
    }

    private applyAxes(
        chart: { axes: ChartAxis[] },
        options: AgChartOptions,
        oldOpts: AgChartOptions,
        seriesStatus: SeriesChangeType,
        skip: string[] = []
    ) {
        if (!('axes' in options) || !options.axes) {
            return false;
        }

        skip = ['axes[].type', ...skip];

        const { axes } = options;
        const forceRecreate = seriesStatus === 'replaced';
        const matchingTypes =
            !forceRecreate && chart.axes.length === axes.length && chart.axes.every((a, i) => a.type === axes[i].type);

        // Try to optimise series updates if series count and types didn't change.
        if (matchingTypes && isAgCartesianChartOptions(oldOpts)) {
            chart.axes.forEach((axis, index) => {
                const previousOpts = oldOpts.axes?.[index] ?? {};
                const axisDiff = jsonDiff(previousOpts, axes[index]) as any;

                debug(`Chart.applyAxes() - applying axis diff idx ${index}`, axisDiff);

                const path = `axes[${index}]`;
                jsonApply(axis, axisDiff, { path, skip });
            });
            return true;
        }

        debug(`Chart.applyAxes() - creating new axes instances; seriesStatus: ${seriesStatus}`);
        chart.axes = this.createAxis(axes, skip);
        return true;
    }

    private createSeries(seriesOptions: SeriesOptionsTypes): Series<any, any> {
        const seriesInstance = seriesRegistry.create(seriesOptions.type, this.getModuleContext()) as Series<any, any>;
        this.applySeriesOptionModules(seriesInstance, seriesOptions);
        this.applySeriesValues(seriesInstance, seriesOptions);
        return seriesInstance;
    }

    private applySeriesOptionModules(series: Series<any, any>, options: SeriesOptionsTypes) {
        const moduleContext = series.createModuleContext();
        const moduleMap = series.getModuleMap();

        for (const module of moduleRegistry.byType<SeriesOptionModule>('series-option')) {
            if (module.optionsKey in options && module.seriesTypes.includes(series.type)) {
                moduleMap.addModule(module, (m) => m.moduleFactory(moduleContext));
            }
        }
    }

    private applySeriesValues(target: Series<any, any>, options: SeriesOptionsTypes) {
        const moduleMap = target.getModuleMap();
        const { type: _, data, listeners, seriesGrouping, showInMiniChart: __, ...seriesOptions } = options as any;

        for (const moduleDef of EXPECTED_ENTERPRISE_MODULES) {
            if (moduleDef.type !== 'series-option') continue;
            if (moduleDef.optionsKey in seriesOptions) {
                const module = moduleMap.getModule<any>(moduleDef.optionsKey);
                if (module) {
                    const moduleOptions = seriesOptions[moduleDef.optionsKey];
                    delete seriesOptions[moduleDef.optionsKey];
                    module.properties.set(moduleOptions);
                }
            }
        }

        target.properties.set(seriesOptions);

        if ('data' in options) {
            target.setOptionsData(data);
        }

        if (listeners) {
            this.registerListeners(target, listeners as Record<string, TypedEventListener>);
        }

        if ('seriesGrouping' in options) {
            if (seriesGrouping == null) {
                target.seriesGrouping = undefined;
            } else {
                target.seriesGrouping = { ...target.seriesGrouping, ...(seriesGrouping as SeriesGrouping) };
            }
        }
    }

    private createAxis(options: AgBaseAxisOptions[], skip: string[]): ChartAxis[] {
        const newAxes: ChartAxis[] = [];
        const moduleContext = this.getModuleContext();

        for (let index = 0; index < options.length; index++) {
            const axisOptions = options[index];
            const axis = axisRegistry.create(axisOptions.type, moduleContext);
            this.applyAxisModules(axis, axisOptions);
            jsonApply(axis, axisOptions, { path: `axes[${index}]`, skip });

            newAxes.push(axis);
        }

        guessInvalidPositions(newAxes);

        return newAxes;
    }

    private applyAxisModules(axis: ChartAxis, options: AgBaseAxisOptions) {
        const moduleContext = axis.createModuleContext();
        const moduleMap = axis.getModuleMap();

        for (const module of moduleRegistry.byType<AxisOptionModule>('axis-option')) {
            const shouldBeEnabled = (options as any)[module.optionsKey] != null;

            if (shouldBeEnabled === moduleMap.isEnabled(module)) continue;

            if (shouldBeEnabled) {
                moduleMap.addModule(module, (m) => m.moduleFactory(moduleContext));
                (axis as any)[module.optionsKey] = moduleMap.getModule(module); // TODO remove
            } else {
                moduleMap.removeModule(module);
                delete (axis as any)[module.optionsKey]; // TODO remove
            }
        }
    }

    private registerListeners(source: ObservableLike, listeners: Record<string, TypedEventListener>) {
        source.clearEventListeners();
        for (const [property, listener] of Object.entries(listeners)) {
            if (isFunction(listener)) {
                source.addEventListener(property, listener);
            }
        }
    }
}
