import { getWindow } from '../util/dom';
import { WidgetEventUtil } from './widgetEvents';
import type { WidgetEventMap_Internal, WidgetSourceEventMap_Internal } from './widgetEvents';

type EventMap = WidgetEventMap_Internal;
type EventType = keyof WidgetEventMap_Internal;
type EventHandler<T> = (target: T, event: unknown) => unknown;
type SourceEventMap = WidgetSourceEventMap_Internal;
type TargetableWidget = { getElement(): HTMLElement };

export class WidgetListenerInternal<T extends TargetableWidget> {
    private dragTriggerRemovers?: Map<EventHandler<T>, () => void>;
    private dragStartListeners?: EventHandler<T>[];
    private dragMoveListeners?: EventHandler<T>[];
    private dragEndListeners?: EventHandler<T>[];

    destroy(): void {
        this.dragTriggerRemovers?.forEach((fn) => fn());
        this.dragTriggerRemovers = undefined;
        this.dragStartListeners = undefined;
        this.dragMoveListeners = undefined;
        this.dragEndListeners = undefined;
    }

    add<K extends EventType>(type: K, target: T, handler: (target: T, event: EventMap[K]) => unknown): void;
    add<K extends EventType>(type: K, target: T, handler: EventHandler<T>): void {
        switch (type) {
            case 'drag-start': {
                this.dragStartListeners ??= [];
                this.dragStartListeners.push(handler);
                this.registerDragTrigger(target, handler);
                break;
            }
            case 'drag-move': {
                this.dragMoveListeners ??= [];
                this.dragMoveListeners.push(handler);
                break;
            }
            case 'drag-end': {
                this.dragEndListeners ??= [];
                this.dragEndListeners.push(handler);
                break;
            }
        }
    }

    remove<K extends EventType>(type: K, _target: T, handler: (target: T, event: EventMap[K]) => unknown): void;
    remove<K extends EventType>(type: K, _target: T, handler: EventHandler<T>): void {
        switch (type) {
            case 'drag-start':
                return this.removeHandler(this.dragStartListeners, handler);
            case 'drag-move':
                return this.removeHandler(this.dragMoveListeners, handler);
            case 'drag-end':
                return this.removeHandler(this.dragEndListeners, handler);
        }
    }

    private removeHandler(array: EventHandler<T>[] | undefined, handler: EventHandler<T>): void {
        const index = array?.indexOf(handler);
        if (index !== undefined) array?.splice(index, 1);
    }

    private registerDragTrigger(target: T, handler: EventHandler<T>) {
        const mouseDownHandler = (event: MouseEvent) => event.button === 0 && this.startDrag(target, event);

        target.getElement().addEventListener('mousedown', mouseDownHandler);
        this.dragTriggerRemovers ??= new Map();
        this.dragTriggerRemovers.set(handler, () =>
            target.getElement().removeEventListener('mousedown', mouseDownHandler)
        );
    }

    private startDrag(target: T, sourceEvent: SourceEventMap['drag-start']) {
        const window = getWindow();
        const mousemove = (ev: MouseEvent) => this.dispatch('drag-move', target, ev);
        const mouseup = (ev: MouseEvent) => {
            if (ev.button === 0) {
                window.removeEventListener('mousemove', mousemove);
                window.removeEventListener('mouseup', mouseup);
                this.dispatch('drag-end', target, ev);
            }
        };
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
        this.dispatch('drag-start', target, sourceEvent);
    }

    private dispatch<K extends EventType>(type: K, target: T, sourceEvent: SourceEventMap[K]): void {
        const widgetEvent = WidgetEventUtil.alloc(type, sourceEvent);
        switch (type) {
            case 'drag-start':
                return this.dragStartListeners?.forEach((handler) => handler(target, widgetEvent));
            case 'drag-move':
                return this.dragMoveListeners?.forEach((handler) => handler(target, widgetEvent));
            case 'drag-end':
                return this.dragEndListeners?.forEach((handler) => handler(target, widgetEvent));
        }
    }
}
