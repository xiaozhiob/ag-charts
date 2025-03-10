import { type AgFinancialChartOptions, type AgPriceVolumeChartType, _ModuleSupport } from 'ag-charts-community';

import { Menu, type MenuItem } from '../../components/menu/menu';

const { ActionOnSet, Validate, BOOLEAN, Logger } = _ModuleSupport;

const menuItems: MenuItem<AgPriceVolumeChartType>[] = [
    { label: 'toolbarSeriesTypeOHLC', icon: 'ohlc-series', value: 'ohlc' },
    { label: 'toolbarSeriesTypeCandles', icon: 'candlestick-series', value: 'candlestick' },
    { label: 'toolbarSeriesTypeHollowCandles', icon: 'hollow-candlestick-series', value: 'hollow-candlestick' },
    { label: 'toolbarSeriesTypeLine', icon: 'line-series', value: 'line' },
    { label: 'toolbarSeriesTypeStepLine', icon: 'step-line-series', value: 'step-line' },
    { label: 'toolbarSeriesTypeHLC', icon: 'hlc-series', value: 'hlc' },
    { label: 'toolbarSeriesTypeHighLow', icon: 'high-low-series', value: 'high-low' },
];

const BUTTON_GROUP = 'seriesType';
const BUTTON_VALUE = 'type';

export class ChartToolbar extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    @Validate(BOOLEAN)
    @ActionOnSet<ChartToolbar>({
        changeValue: function (enabled) {
            this.onEnableChanged(enabled);
        },
    })
    enabled: boolean = false;

    private readonly menu = new Menu(this.ctx, 'chart-toolbar');

    constructor(private readonly ctx: _ModuleSupport.ModuleContext) {
        super();

        this.destroyFns.push(
            ctx.layoutManager.addListener('layout:complete', this.onLayoutComplete.bind(this)),
            ctx.toolbarManager.addListener('button-moved', this.onToolbarButtonMoved.bind(this)),
            ctx.toolbarManager.addListener('button-pressed', this.onToolbarButtonPressed.bind(this))
        );
    }

    private onEnableChanged(enabled: boolean) {
        this.ctx.toolbarManager.toggleGroup('chart-toolbar', BUTTON_GROUP, { visible: enabled });
    }

    private onLayoutComplete() {
        if (!this.enabled) return;

        const chartType = this.getChartType();
        const icon = menuItems.find((item) => item.value === chartType)?.icon;
        if (icon != null) {
            this.ctx.toolbarManager.updateButton(BUTTON_GROUP, BUTTON_VALUE, { icon });
        }
    }

    private setAnchor(anchor: _ModuleSupport.BBox) {
        this.menu.setAnchor({ x: anchor.x + anchor.width + 6, y: anchor.y });
    }

    private onToolbarButtonMoved(e: _ModuleSupport.ToolbarButtonMovedEvent<any>) {
        if (e.group !== BUTTON_GROUP) return;
        this.setAnchor(e.rect);
    }

    private onToolbarButtonPressed(e: _ModuleSupport.ToolbarButtonPressedEvent<any>) {
        if (e.group !== BUTTON_GROUP) return;

        this.setAnchor(e.rect);

        this.menu.show({
            items: menuItems,
            menuItemRole: 'menuitemradio',
            ariaLabel: this.ctx.localeManager.t('toolbarSeriesTypeDropdown'),
            value: this.getChartType(),
            sourceEvent: e.sourceEvent,
            onPress: (item) => {
                this.setChartType(item.value);
                this.hidePopover();
            },
            onHide: () => {
                this.ctx.toolbarManager.toggleButton(BUTTON_GROUP, BUTTON_VALUE, { active: false });
            },
        });

        this.ctx.toolbarManager.toggleButton(BUTTON_GROUP, BUTTON_VALUE, { active: true });
    }

    private hidePopover() {
        this.ctx.toolbarManager.toggleButton(BUTTON_GROUP, BUTTON_VALUE, { active: false });
        this.menu.hide();
    }

    private setChartType(chartType: AgPriceVolumeChartType) {
        const options: AgFinancialChartOptions = { chartType };
        this.ctx.chartService.publicApi?.updateDelta(options as any).catch((e) => Logger.error(e));
    }

    private getChartType(): AgPriceVolumeChartType {
        const chartType = (this.ctx.chartService.publicApi?.getOptions() as AgFinancialChartOptions)?.chartType;
        if (chartType == null || !menuItems.some((item) => item.value === chartType)) {
            return 'candlestick';
        }
        return chartType;
    }
}
