import { type AgChartSyncOptions, _ModuleSupport } from 'ag-charts-community';

const {
    BOOLEAN,
    STRING,
    UNION,
    BaseProperties,
    CartesianAxis,
    ChartUpdateType,
    isDate,
    isDefined,
    isFiniteNumber,
    unique,
    ObserveChanges,
    TooltipManager,
    Validate,
    Logger,
} = _ModuleSupport;

interface ChartLike {
    ctx: {
        updateService: {
            update(type: _ModuleSupport.ChartUpdateType, options: { skipSync: boolean }): void;
        };
    };
}

export class ChartSync extends BaseProperties implements _ModuleSupport.ModuleInstance, AgChartSyncOptions {
    static readonly className = 'Sync';

    @Validate(BOOLEAN)
    @ObserveChanges<ChartSync>((target) => target.onEnabledChange())
    enabled: boolean = false;

    @Validate(STRING, { optional: true })
    @ObserveChanges<ChartSync>((target, newValue, oldValue) => target.onGroupIdChange(newValue, oldValue))
    groupId?: string;

    @Validate(UNION(['x', 'y', 'xy'], 'an axis'))
    @ObserveChanges<ChartSync>((target) => target.onAxesChange())
    axes: 'x' | 'y' | 'xy' = 'x';

    @Validate(BOOLEAN)
    @ObserveChanges<ChartSync>((target) => target.onNodeInteractionChange())
    nodeInteraction: boolean = true;

    @Validate(BOOLEAN)
    @ObserveChanges<ChartSync>((target) => target.onZoomChange())
    zoom: boolean = true;

    constructor(protected moduleContext: _ModuleSupport.ModuleContext) {
        super();
    }

    updateSiblings(groupId?: string) {
        const { syncManager } = this.moduleContext;
        for (const chart of syncManager.getGroupSiblings(groupId ?? this.groupId)) {
            this.updateChart(chart);
        }
    }

    private updateChart(chart: ChartLike, updateType = ChartUpdateType.UPDATE_DATA) {
        chart.ctx.updateService.update(updateType, { skipSync: true });
    }

    private enabledZoomSync() {
        const { syncManager, zoomManager } = this.moduleContext;
        this.disableZoomSync = zoomManager.addListener('zoom-change', () => {
            for (const chart of syncManager.getGroupSiblings(this.groupId)) {
                if (chart.modulesManager.getModule<ChartSync>('sync')?.zoom) {
                    chart.ctx.zoomManager.updateZoom('sync', this.mergeZoom(chart));
                }
            }
        });
    }

    private disableZoomSync?: () => void;

    private enabledNodeInteractionSync() {
        const { highlightManager, syncManager } = this.moduleContext;
        this.disableNodeInteractionSync = highlightManager.addListener('highlight-change', (event) => {
            for (const chart of syncManager.getGroupSiblings(this.groupId)) {
                if (!chart.modulesManager.getModule<ChartSync>('sync')?.nodeInteraction) continue;

                if (!event.currentHighlight?.datum) {
                    chart.ctx.highlightManager.updateHighlight(chart.id);
                    chart.ctx.tooltipManager.removeTooltip(chart.id);
                    continue;
                }

                for (const axis of chart.axes) {
                    const validDirection = this.axes === 'xy' ? 'x' : this.axes;
                    if (!CartesianAxis.is(axis) || axis.direction !== validDirection) continue;

                    const matchingNodes = chart.series
                        .map((series) => {
                            const seriesKeys = series.getKeys(axis.direction);

                            if (axis.keys.length && !axis.keys.some((key) => seriesKeys.includes(key))) return;

                            const { nodeData } = (series as any).contextNodeData;

                            if (!nodeData?.length) return;

                            const valueKey = nodeData[0][`${axis.direction}Key`];
                            let eventValue = event.currentHighlight!.datum[valueKey];
                            const valueIsDate = isDate(eventValue);

                            if (valueIsDate) {
                                eventValue = eventValue.getTime();
                            }

                            const nodeDatum = nodeData.find((datum: any) => {
                                const nodeValue = datum.datum[valueKey];
                                return valueIsDate ? nodeValue.getTime() === eventValue : nodeValue === eventValue;
                            });

                            return nodeDatum ? { series, nodeDatum } : null;
                        })
                        .filter(isDefined);

                    if (
                        matchingNodes.length < 2 &&
                        matchingNodes[0]?.nodeDatum !== chart.ctx.highlightManager.getActiveHighlight()
                    ) {
                        const { series, nodeDatum } = matchingNodes[0] ?? {};
                        chart.ctx.highlightManager.updateHighlight(chart.id, nodeDatum);

                        if (nodeDatum) {
                            const offsetX = nodeDatum.midPoint?.x ?? nodeDatum.point?.x ?? 0;
                            const offsetY = nodeDatum.midPoint?.y ?? nodeDatum.point?.y ?? 0;
                            const tooltipMeta = TooltipManager.makeTooltipMeta(
                                { type: 'hover', offsetX, offsetY },
                                nodeDatum
                            );
                            delete tooltipMeta.lastPointerEvent; // remove to prevent triggering TOOLTIP_RECALCULATION

                            chart.ctx.tooltipManager.updateTooltip(
                                chart.id,
                                tooltipMeta,
                                series.getTooltipHtml(nodeDatum)
                            );
                        } else {
                            chart.ctx.tooltipManager.removeTooltip(chart.id);
                        }

                        this.updateChart(chart, ChartUpdateType.SERIES_UPDATE);
                    }
                }
            }
        });
    }

    private disableNodeInteractionSync?: () => void;

    getSyncedDomain(axis: unknown) {
        if (!CartesianAxis.is(axis) || (this.axes !== 'xy' && this.axes !== axis.direction)) {
            return;
        }

        const { syncManager } = this.moduleContext;
        const syncGroup = syncManager.getGroup(this.groupId);
        const [{ axes: syncAxes }] = syncGroup;

        const { direction, min, max, nice, reverse } = axis as (typeof syncAxes)[number];

        for (const mainAxis of syncAxes) {
            if (direction !== mainAxis.direction) continue;

            if (
                nice !== mainAxis.nice ||
                reverse !== mainAxis.reverse ||
                (min !== mainAxis.min && (isFiniteNumber(min) || isFiniteNumber(mainAxis.min))) ||
                (max !== mainAxis.max && (isFiniteNumber(max) || isFiniteNumber(mainAxis.max)))
            ) {
                Logger.warnOnce(
                    'To allow synchronization, ensure that all charts have matching min, max, nice, and reverse properties on the synchronized axes.'
                );
                this.enabled = false;
                return;
            }
        }

        return unique(
            syncGroup
                .flatMap((c) => c.series)
                .filter((series) => {
                    if (series.visible) {
                        const seriesKeys = series.getKeys(axis.direction);
                        return axis.keys.length ? axis.keys.some((key) => seriesKeys.includes(key)) : true;
                    }
                })
                .flatMap((series) => series.getDomain(axis.direction))
        );
    }

    private mergeZoom(chart: any) {
        const { zoomManager } = this.moduleContext;

        if (this.axes === 'xy') {
            return zoomManager.getZoom();
        }

        const combinedZoom = chart.ctx.zoomManager.getZoom() ?? {};
        combinedZoom[this.axes] = zoomManager.getZoom()?.[this.axes];
        return combinedZoom;
    }

    private onEnabledChange() {
        const { syncManager } = this.moduleContext;
        if (this.enabled) {
            syncManager.subscribe(this.groupId);
        } else {
            syncManager.unsubscribe(this.groupId);
        }
        this.updateSiblings();
        this.onNodeInteractionChange();
        this.onZoomChange();
    }

    private onGroupIdChange(newValue?: string, oldValue?: string) {
        if (!this.enabled || newValue === oldValue) return;
        const { syncManager } = this.moduleContext;
        syncManager.unsubscribe(oldValue);
        syncManager.subscribe(newValue);
        this.updateSiblings(oldValue);
        this.updateSiblings(newValue);
    }

    private onAxesChange() {
        if (!this.enabled) return;
        const { syncManager } = this.moduleContext;
        this.updateChart(syncManager.getChart());
    }

    private onNodeInteractionChange() {
        if (this.enabled && this.nodeInteraction) {
            this.enabledNodeInteractionSync();
        } else {
            this.disableNodeInteractionSync?.();
        }
    }

    private onZoomChange() {
        if (this.enabled && this.zoom) {
            this.enabledZoomSync();
        } else {
            this.disableZoomSync?.();
        }
    }

    destroy() {
        const { syncManager } = this.moduleContext;
        syncManager.unsubscribe(this.groupId);
        this.updateSiblings();
        this.disableZoomSync?.();
    }
}
