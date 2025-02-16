import { ChartTypeOriginator } from '../api/preset/chartTypeOriginator';
import { HistoryManager } from '../api/state/historyManager';
import { StateManager } from '../api/state/stateManager';
import { DOMManager } from '../dom/domManager';
import { ProxyInteractionService } from '../dom/proxyInteractionService';
import { LocaleManager } from '../locale/localeManager';
import type { ModuleContext } from '../module/moduleContext';
import type { Group } from '../scene/group';
import { Scene } from '../scene/scene';
import { CallbackCache } from '../util/callbackCache';
import type { Mutex } from '../util/mutex';
import { AnnotationManager } from './annotation/annotationManager';
import { AxisManager } from './axis/axisManager';
import type { ChartService } from './chartService';
import { DataService } from './data/dataService';
import { AnimationManager } from './interaction/animationManager';
import { ChartEventManager } from './interaction/chartEventManager';
import { ContextMenuRegistry } from './interaction/contextMenuRegistry';
import { CursorManager } from './interaction/cursorManager';
import { GestureDetector } from './interaction/gestureDetector';
import { HighlightManager } from './interaction/highlightManager';
import { InteractionManager } from './interaction/interactionManager';
import { KeyNavManager } from './interaction/keyNavManager';
import { RegionManager } from './interaction/regionManager';
import type { SyncManager } from './interaction/syncManager';
import { ToolbarManager } from './interaction/toolbarManager';
import { TooltipManager } from './interaction/tooltipManager';
import { ZoomManager } from './interaction/zoomManager';
import type { Keyboard } from './keyboard';
import { LayoutManager } from './layout/layoutManager';
import { LegendManager } from './legend/legendManager';
import { SeriesStateManager } from './series/seriesStateManager';
import type { Tooltip } from './tooltip/tooltip';
import { type UpdateCallback, UpdateService } from './updateService';

export class ChartContext implements ModuleContext {
    readonly callbackCache = new CallbackCache();
    readonly chartEventManager = new ChartEventManager();
    readonly highlightManager = new HighlightManager();
    readonly layoutManager = new LayoutManager();
    readonly localeManager = new LocaleManager();
    readonly seriesStateManager = new SeriesStateManager();
    readonly stateManager = new StateManager();
    readonly toolbarManager = new ToolbarManager();
    readonly zoomManager = new ZoomManager();

    animationManager: AnimationManager;
    annotationManager: AnnotationManager;
    axisManager: AxisManager;
    legendManager: LegendManager;
    chartService: ChartService;
    chartTypeOriginator: ChartTypeOriginator;
    contextMenuRegistry: ContextMenuRegistry;
    cursorManager: CursorManager;
    dataService: DataService<any>;
    domManager: DOMManager;
    gestureDetector: GestureDetector;
    historyManager: HistoryManager;
    interactionManager: InteractionManager;
    keyNavManager: KeyNavManager;
    proxyInteractionService: ProxyInteractionService;
    regionManager: RegionManager;
    scene: Scene;
    syncManager: SyncManager;
    tooltipManager: TooltipManager;
    updateService: UpdateService;

    constructor(
        chart: ChartService & { annotationRoot: Group; keyboard: Keyboard; tooltip: Tooltip },
        vars: {
            scene?: Scene;
            root: Group;
            syncManager: SyncManager;
            container?: HTMLElement;
            styleContainer?: HTMLElement;
            updateCallback: UpdateCallback;
            updateMutex: Mutex;
            pixelRatio?: number;
        }
    ) {
        const { scene, root, syncManager, container, updateCallback, updateMutex, pixelRatio, styleContainer } = vars;

        this.chartService = chart;
        this.syncManager = syncManager;
        this.domManager = new DOMManager(container, styleContainer);

        // Sets canvas element if scene exists, otherwise use return value with scene constructor
        const canvasElement = this.domManager.addChild(
            'canvas',
            'scene-canvas',
            scene?.canvas.element
        ) as HTMLCanvasElement;

        this.scene = scene ?? new Scene({ pixelRatio, canvasElement });
        this.scene.setRoot(root);

        this.axisManager = new AxisManager(root);
        this.legendManager = new LegendManager(this.chartService);
        this.annotationManager = new AnnotationManager(chart.annotationRoot);
        this.chartTypeOriginator = new ChartTypeOriginator(chart);
        this.cursorManager = new CursorManager(this.domManager);
        this.interactionManager = new InteractionManager(chart.keyboard, this.domManager);
        this.keyNavManager = new KeyNavManager(this.interactionManager);
        this.regionManager = new RegionManager(this.interactionManager);
        this.contextMenuRegistry = new ContextMenuRegistry(this.regionManager);
        this.gestureDetector = new GestureDetector(this.domManager);
        this.updateService = new UpdateService(updateCallback);
        this.proxyInteractionService = new ProxyInteractionService(this.localeManager, this.domManager);
        this.historyManager = new HistoryManager(this.keyNavManager);
        this.animationManager = new AnimationManager(this.interactionManager, updateMutex);
        this.dataService = new DataService<any>(this.animationManager);
        this.tooltipManager = new TooltipManager(this.domManager, chart.tooltip);

        this.zoomManager.addLayoutListeners(this.layoutManager);
    }

    destroy() {
        // chart.ts handles the destruction of the scene.
        this.animationManager.destroy();
        this.highlightManager.destroy();
        this.axisManager.destroy();
        this.callbackCache.invalidateCache();
        this.chartEventManager.destroy();
        this.contextMenuRegistry.destroy();
        this.domManager.destroy();
        this.highlightManager.destroy();
        this.interactionManager.destroy();
        this.keyNavManager.destroy();
        this.proxyInteractionService.destroy();
        this.regionManager.destroy();
        this.syncManager.destroy();
        this.tooltipManager.destroy();
        this.zoomManager.destroy();
    }
}
