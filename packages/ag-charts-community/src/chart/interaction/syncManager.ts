import { BaseManager } from '../../util/baseManager';
import type { ChartAxisDirection } from '../chartAxisDirection';
import type { ISeries } from '../series/seriesTypes';
import type { UpdateService } from '../updateService';
import type { HighlightManager } from './highlightManager';
import type { TooltipManager } from './tooltipManager';
import type { ZoomManager } from './zoomManager';

type GroupId = string | symbol;

/** Breaks circular dependencies which occur when importing ChartAxis. */
type AxisLike = {
    boundSeries: ISeries<any, any>[];
    direction: ChartAxisDirection;
    keys: string[];
    reverse?: boolean;
    nice: boolean;
    min?: number;
    max?: number;
};

/** Breaks circular dependencies which occur when importing Chart. */
type ChartLike = {
    id: string;
    axes: AxisLike[];
    series: ISeries<any, any>[];
    modulesManager: { getModule<R>(module: string): R | undefined };
    ctx: {
        highlightManager: HighlightManager;
        tooltipManager: TooltipManager;
        updateService: UpdateService;
        zoomManager: ZoomManager;
    };
};

export class SyncManager extends BaseManager {
    private static readonly chartsGroups = new Map<GroupId, Set<ChartLike>>();
    private static readonly DEFAULT_GROUP = Symbol('sync-group-default');

    constructor(protected chart: ChartLike) {
        super();
    }

    subscribe(groupId: GroupId = SyncManager.DEFAULT_GROUP) {
        let syncGroup = this.get(groupId);
        if (!syncGroup) {
            syncGroup = new Set();
            SyncManager.chartsGroups.set(groupId, syncGroup);
        }
        syncGroup.add(this.chart);
        return this;
    }

    unsubscribe(groupId: GroupId = SyncManager.DEFAULT_GROUP) {
        this.get(groupId)?.delete(this.chart);
        return this;
    }

    getChart() {
        return this.chart;
    }

    getGroup(groupId: GroupId = SyncManager.DEFAULT_GROUP) {
        const syncGroup = this.get(groupId);
        return syncGroup ? Array.from(syncGroup) : [];
    }

    getGroupSiblings(groupId: GroupId = SyncManager.DEFAULT_GROUP) {
        return this.getGroup(groupId).filter((chart) => chart !== this.chart);
    }

    private get(groupId: GroupId) {
        return SyncManager.chartsGroups.get(groupId);
    }
}
