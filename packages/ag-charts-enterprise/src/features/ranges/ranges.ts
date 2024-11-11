import { _ModuleSupport, _Scene } from 'ag-charts-community';

import { RangesButtonProperties } from './rangesButtonProperties';

const {
    BOOLEAN,
    OBJECT,
    ChartAxisDirection,
    LayoutElement,
    PropertiesArray,
    ToolbarButtonWidget,
    ToolbarWidget,
    Validate,
} = _ModuleSupport;

export class Ranges extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    @Validate(BOOLEAN)
    public enabled = false;

    @Validate(OBJECT)
    public buttons = new PropertiesArray(RangesButtonProperties);

    private readonly verticalSpacing = 10;

    private readonly toolbar: _ModuleSupport.ToolbarWidget;
    private readonly buttonWidgets: Array<_ModuleSupport.ToolbarButtonWidget> = [];

    constructor(private readonly ctx: _ModuleSupport.ModuleContext) {
        super();

        this.toolbar = new ToolbarWidget();
        const element = this.toolbar.getElement();
        element.classList.add('ag-charts-toolbar', 'ag-charts-toolbar--ranges');

        ctx.domManager.addChild('canvas-overlay', 'range-buttons', element);

        this.destroyFns.push(
            ctx.layoutManager.registerElement(LayoutElement.Toolbar, this.onLayoutStart.bind(this)),
            ctx.zoomManager.addListener('zoom-change', this.onZoomChanged.bind(this)),
            () => this.toolbar.destroy()
        );
    }

    private onLayoutStart(event: _ModuleSupport.LayoutContext) {
        const { toolbar, verticalSpacing } = this;
        const { layoutBox } = event;

        this.refreshButtons();

        const height = toolbar.getElement().offsetHeight;
        toolbar.setBounds({
            x: layoutBox.x,
            y: layoutBox.y + layoutBox.height - height,
            width: layoutBox.width,
            height: height,
        });

        layoutBox.shrink({ bottom: height + verticalSpacing });
    }

    private onZoomChanged() {
        this.toggleButtons();
    }

    private refreshButtons() {
        const { buttons, buttonWidgets } = this;

        for (const [index, options] of buttons.entries()) {
            const button = this.buttonWidgets.at(index) ?? this.createButton(index);
            button.update(options);

            const element = button.getElement();
            element.classList.toggle('ag-charts-toolbar__button--first', index === 0);
            element.classList.toggle('ag-charts-toolbar__button--last', index === buttons.length - 1);
        }

        for (let index = buttons.length; index < buttonWidgets.length; index++) {
            const button = this.buttonWidgets.at(index);
            // this.toolbar.removeChild(button); // TODO
            button?.destroy();
        }
    }

    private createButton(index: number) {
        const { toolbar } = this;

        const button = new ToolbarButtonWidget(this.ctx);
        const element = button.getElement();
        element.classList.add('ag-charts-toolbar__button');
        element.addEventListener('click', () => {
            this.onButtonPress({ index });
        });

        this.buttonWidgets.push(button);
        toolbar.appendChild(button as _ModuleSupport.ButtonWidget);

        return button;
    }

    private onButtonPress(event: { index: number }) {
        const { index } = event;
        const { zoomManager } = this.ctx;

        const button = this.buttons.at(index);
        if (!button) return;

        const { value } = button;

        if (typeof value === 'number') {
            zoomManager.extendToEnd('zoom-buttons', ChartAxisDirection.X, value);
        } else if (Array.isArray(value)) {
            zoomManager.updateWith('zoom-buttons', ChartAxisDirection.X, () => value);
        } else if (typeof value === 'function') {
            zoomManager.updateWith('zoom-buttons', ChartAxisDirection.X, value);
        }

        this.toggleButtons(index);
    }

    private toggleButtons(activeIndex?: number) {
        for (const [index, button] of this.buttonWidgets.entries()) {
            const element = button.getElement();
            element.classList.toggle('ag-charts-toolbar__button--active', activeIndex != null && activeIndex === index);
        }
    }
}
