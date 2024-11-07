import { WidgetEventUtil } from './widgetEvents';
import type { WidgetEventMap_HTML, WidgetSourceEventMap_HTML } from './widgetEvents';

type TargetableWidget = { getElement(): HTMLElement };

type TypedMap<K extends keyof WidgetEventMap_HTML, TWidget extends TargetableWidget> = Map<
    (target: TWidget, widgetEvent: WidgetEventMap_HTML[K]) => unknown,
    (this: HTMLElement, sourceEvent: WidgetSourceEventMap_HTML[K]) => void
>;

export class WidgetListenerHTML<TWidget extends TargetableWidget> {
    private readonly maps: { [K in keyof WidgetEventMap_HTML]?: TypedMap<K, TWidget> } = {};

    private lazyGetMap<K extends keyof WidgetEventMap_HTML>(type: K): TypedMap<K, TWidget> {
        let result = this.maps[type];
        if (result === undefined) {
            result = new Map();
            this.maps[type] = result;
        }
        return result;
    }

    add<K extends keyof WidgetEventMap_HTML>(
        type: K,
        target: TWidget,
        widgetHandler: (target: TWidget, widgetEvent: WidgetEventMap_HTML[K]) => unknown
    ): void {
        const map = this.lazyGetMap(type);
        if (map.has(widgetHandler)) throw new Error('AG Charts - duplicate add(handler)');

        const sourceHandler = (sourceEvent: WidgetSourceEventMap_HTML[K]): void => {
            const widgetEvent = WidgetEventUtil.alloc(type, sourceEvent);
            widgetHandler(target, widgetEvent);
        };
        target.getElement().addEventListener(type, sourceHandler);
        map.set(widgetHandler, sourceHandler);
    }

    remove<K extends keyof WidgetEventMap_HTML>(
        type: K,
        target: TWidget,
        widgetHandler: (target: TWidget, widgetEvent: WidgetEventMap_HTML[K]) => unknown
    ): void {
        const map = this.lazyGetMap(type);
        const sourceHandler = map.get(widgetHandler);
        if (sourceHandler) {
            target.getElement().removeEventListener(type, sourceHandler);
        }
        map.delete(widgetHandler);
    }

    destroy(target: TWidget): void {
        for (const type of Object.keys(this.maps) as (keyof WidgetEventMap_HTML)[]) {
            this.typedDestroy(type, target);
        }
    }

    private typedDestroy<K extends keyof WidgetEventMap_HTML>(type: K, target: TWidget): void {
        const map = this.maps[type];
        if (map == null) return;
        for (const [_widgetHandler, sourceHandler] of map.entries()) {
            target.getElement().removeEventListener(type, sourceHandler);
        }
    }
}
