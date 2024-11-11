import type { AgIconName } from 'ag-charts-types';

import type { ModuleContext } from '../../module/moduleContext';
import { ButtonWidget } from '../../widget/buttonWidget';

interface ToolbarButtonOptions {
    icon?: AgIconName;
    label?: string;
    ariaLabel?: string;
    tooltip?: string;
}

export class ToolbarButtonWidget extends ButtonWidget {
    constructor(private readonly ctx: ModuleContext) {
        super();
    }

    public update(options: ToolbarButtonOptions) {
        const { domManager, localeManager } = this.ctx;

        const element = this.getElement();
        element.textContent = options.label ? localeManager.t(options.label) : null;

        if (options.tooltip) {
            element.title = localeManager.t(options.tooltip);
        }

        let innerHTML = '';

        if (options.icon != null) {
            innerHTML = `<span class="${domManager.getIconClassNames(options.icon)} ag-charts-toolbar__icon"></span>`;
        }

        if (options.label != null) {
            const tlabel = localeManager.t(options.label);
            innerHTML = `${innerHTML}<span class="ag-charts-toolbar__label">${tlabel}</span>`;
        }

        element.innerHTML = innerHTML;
    }
}
