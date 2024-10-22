import type { LocaleManager } from '../locale/localeManager';
import type { ModuleContext } from '../module/moduleContext';
import type { Selection } from '../scene/selection';
import { DestroyFns } from '../util/destroy';
import { createElement } from '../util/dom';
import { initRovingTabIndex } from '../util/keynavUtil';
import { isDefined } from '../util/type-guards';
import type { CategoryLegendDatum } from './legendDatum';
import type { LegendMarkerLabel } from './legendMarkerLabel';

type ItemSelection = Selection<LegendMarkerLabel, CategoryLegendDatum>;

interface ButtonListener {
    onClick(event: Event, datum: CategoryLegendDatum, proxyButton: HTMLButtonElement): void;
    onDoubleClick(event: MouseEvent, datum: CategoryLegendDatum): void;
    onHover(event: FocusEvent | MouseEvent, node: LegendMarkerLabel): void;
    onLeave(): void;
    onContextClick(sourceEvent: MouseEvent, node: LegendMarkerLabel): void;
}

export class LegendDOMProxy {
    public dirty = true;

    public readonly itemList: HTMLDivElement;
    public readonly itemDescription: HTMLParagraphElement;
    public readonly paginationGroup: HTMLDivElement;
    public readonly destroyFns: DestroyFns = new DestroyFns();
    public prevButton?: HTMLButtonElement;
    public nextButton?: HTMLButtonElement;

    public constructor(ctx: ModuleContext, idPrefix: string) {
        this.itemList = ctx.proxyInteractionService.createProxyContainer({
            type: 'list',
            id: `${idPrefix}-toolbar`,
            classList: ['ag-charts-proxy-legend-toolbar'],
            ariaLabel: { id: 'ariaLabelLegend' },
            ariaHidden: true,
        });
        this.paginationGroup = ctx.proxyInteractionService.createProxyContainer({
            type: 'group',
            id: `${idPrefix}-pagination`,
            classList: ['ag-charts-proxy-legend-pagination'],
            ariaLabel: { id: 'ariaLabelLegendPagination' },
            ariaOrientation: 'horizontal',
            ariaHidden: true,
        });
        this.itemDescription = createElement('p');
        this.itemDescription.style.display = 'none';
        this.itemDescription.id = `${idPrefix}-ariaDescription`;
        this.itemList.append(this.itemDescription);
    }

    public destroy() {
        this.destroyFns.destroy();
    }

    public initLegendList(
        ctx: Pick<ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        itemSelection: ItemSelection,
        datumReader: { getItemLabel(datum: CategoryLegendDatum): string | undefined },
        buttonListener: ButtonListener
    ) {
        if (!this.dirty) return;

        const lm = ctx.localeManager;
        const count = itemSelection.length;
        itemSelection.each((markerLabel, datum, index) => {
            // Create the hidden CSS button.
            markerLabel.destroyProxyButton();
            markerLabel.proxyButton ??= ctx.proxyInteractionService.createProxyElement({
                type: 'listswitch',
                id: `ag-charts-legend-item-${index}`,
                textContent: this.getItemAriaText(lm, datumReader.getItemLabel(datum), index, count),
                ariaChecked: !!markerLabel.datum.enabled,
                ariaDescribedBy: this.itemDescription.id,
                parent: this.itemList,
                // Retrieve the datum from the node rather than from the method parameter.
                // The method parameter `datum` gets destroyed when the data is refreshed
                // using Series.getLegendData(). But the scene node will stay the same.
                onclick: (ev) => buttonListener.onClick(ev, markerLabel.datum, markerLabel.proxyButton!.button),
                ondblclick: (ev) => buttonListener.onDoubleClick(ev, markerLabel.datum),
                onmouseenter: (ev) => buttonListener.onHover(ev, markerLabel),
                onmouseleave: () => buttonListener.onLeave(),
                oncontextmenu: (ev) => buttonListener.onContextClick(ev, markerLabel),
                onblur: () => buttonListener.onLeave(),
                onfocus: (ev) => buttonListener.onHover(ev, markerLabel),
            });
        });

        const buttons: HTMLButtonElement[] = itemSelection
            .nodes()
            .map((markerLabel) => markerLabel.proxyButton?.button)
            .filter(isDefined);
        this.initKeyNav(buttons);
    }

    private initKeyNav(buttons: HTMLButtonElement[]) {
        this.destroyFns.setFns([
            ...initRovingTabIndex({ orientation: 'horizontal', buttons }),
            ...initRovingTabIndex({ orientation: 'vertical', buttons }),
        ]);
        this.itemList.ariaHidden = (buttons.length === 0).toString();
        this.dirty = false;
    }

    public getItemAriaText(
        localeManager: LocaleManager,
        label: string | undefined,
        index: number,
        count: number
    ): string {
        if (index >= 0 && label) {
            index++;
            return localeManager.t('ariaLabelLegendItem', { label, index, count });
        }
        return localeManager.t('ariaLabelLegendItemUnknown');
    }

    public getItemAriaDescription(localeManager: LocaleManager): string {
        return localeManager.t('ariaDescriptionLegendItem');
    }
}
