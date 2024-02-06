import type { ChartService } from '../chart/chartService';
import type { AnimationManager } from '../chart/interaction/animationManager';
import type { ChartEventManager } from '../chart/interaction/chartEventManager';
import type { CursorManager } from '../chart/interaction/cursorManager';
import type { GestureDetector } from '../chart/interaction/gestureDetector';
import type { HighlightManager } from '../chart/interaction/highlightManager';
import type { InteractionManager } from '../chart/interaction/interactionManager';
import type { SyncManager } from '../chart/interaction/syncManager';
import type { TooltipManager } from '../chart/interaction/tooltipManager';
import type { ZoomManager } from '../chart/interaction/zoomManager';
import type { LayoutService } from '../chart/layout/layoutService';
import type { SeriesLayerManager } from '../chart/series/seriesLayerManager';
import type { SeriesStateManager } from '../chart/series/seriesStateManager';
import type { UpdateService } from '../chart/updateService';
import type { AgCartesianAxisPosition } from '../options/agChartOptions';
import type { Scene } from '../scene/scene';
import type { CallbackCache } from '../util/callbackCache';

export interface ModuleContext {
    document: Document;
    window: Window;
    scene: Scene;

    callbackCache: CallbackCache;
    gestureDetector: GestureDetector;

    chartService: ChartService;
    layoutService: LayoutService;
    updateService: UpdateService;

    animationManager: AnimationManager;
    chartEventManager: ChartEventManager;
    cursorManager: CursorManager;
    highlightManager: HighlightManager;
    interactionManager: InteractionManager;
    seriesLayerManager: SeriesLayerManager;
    seriesStateManager: SeriesStateManager;
    syncManager: SyncManager;
    tooltipManager: TooltipManager;
    zoomManager: ZoomManager;
}

export interface ModuleContextWithParent<P> extends ModuleContext {
    parent: P;
}

export interface AxisContext {
    axisId: string;
    continuous: boolean;
    direction: 'x' | 'y';
    position?: AgCartesianAxisPosition;
    keys(): string[];
    scaleBandwidth(): number;
    scaleConvert(val: any): number;
    scaleInvert(position: number): any;
    scaleValueFormatter(specifier: string): ((x: any) => string) | undefined;
}

export interface SeriesContext extends ModuleContext {
    series: { type: string };
}
