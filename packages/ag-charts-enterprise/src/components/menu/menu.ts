import { _ModuleSupport } from 'ag-charts-community';

import { AnchoredPopover, type AnchoredPopoverOptions } from '../popover/anchoredPopover';

const { createElement, getIconClassNames, initMenuKeyNav, isButtonClickEvent } = _ModuleSupport;

export interface MenuOptions<Value = any> extends AnchoredPopoverOptions {
    items: Array<MenuItem<Value>>;
    sourceEvent: Event;
    value?: Value;
    onPress?: (item: MenuItem<Value>) => void;
    menuItemRole?: 'menuitem' | 'menuitemradio';
}

export type MenuItem<Value = any> = _ModuleSupport.LabelIcon & {
    value: Value;
    strokeWidth?: number;
};

/**
 * An anchored popover containing a list of pressable items.
 */
export class Menu extends AnchoredPopover {
    protected menuCloser?: _ModuleSupport.MenuCloser;

    public show<Value = any>(options: MenuOptions<Value>): void {
        const rows = options.items.map((item) => this.createRow(options, item));

        const popover = this.showWithChildren(rows, options);
        popover.classList.add('ag-charts-menu');
        popover.setAttribute('role', 'menu');

        this.menuCloser = initMenuKeyNav({
            orientation: 'vertical',
            menu: popover,
            buttons: rows,
            sourceEvent: options.sourceEvent,
            closeCallback: () => this.hide(),
        });
        this.hideFns.push(() => {
            this.menuCloser?.finishClosing();
            this.menuCloser = undefined;
        });
    }

    private createRow<Value>(options: MenuOptions<Value>, item: MenuItem<Value>) {
        const { menuItemRole = 'menuitem' } = options;

        const active = item.value === options.value;
        const row = createElement('div', 'ag-charts-menu__row');
        row.setAttribute('role', menuItemRole);
        if (menuItemRole === 'menuitemradio') {
            row.setAttribute('aria-checked', (options.value === item.value).toString());
        }
        if (typeof item.value === 'string') {
            row.dataset.popoverId = item.value;
        }
        row.classList.toggle(`ag-charts-menu__row--active`, active);

        if (item.icon != null) {
            const icon = createElement('span', `ag-charts-menu__icon ${getIconClassNames(item.icon)}`);
            row.appendChild(icon);
        }

        const strokeWidthVisible = item.strokeWidth != null;
        if (strokeWidthVisible) {
            row.classList.toggle(`ag-charts-menu__row--stroke-width-visible`, strokeWidthVisible);
            row.style.setProperty('--strokeWidth', strokeWidthVisible ? `${item.strokeWidth}px` : null);
        }

        if (item.label != null) {
            const label = createElement('span', 'ag-charts-menu__label');
            label.textContent = this.ctx.localeManager.t(item.label);
            row.appendChild(label);
        }

        if ('altText' in item) {
            row.ariaLabel = this.ctx.localeManager.t(item.altText);
        }

        const select = () => {
            options.onPress?.(item);
        };

        const onclick = (e: KeyboardEvent | MouseEvent) => {
            if (isButtonClickEvent(e)) {
                select();
                e.preventDefault();
                e.stopPropagation();
            }
        };
        row.addEventListener('keydown', onclick);
        row.addEventListener('click', onclick);

        row.addEventListener('mousemove', () => {
            row.focus();
        });

        return row;
    }
}
