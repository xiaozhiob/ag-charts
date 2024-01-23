/** Types of chart-update, in pipeline execution order. */
export enum ChartUpdateType {
    FULL,
    UPDATE_DATA,
    PROCESS_DATA,
    PERFORM_LAYOUT,
    SERIES_UPDATE,
    TOOLTIP_RECALCULATION,
    SCENE_RENDER,
    NONE,
}
