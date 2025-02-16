import { Logger } from './logger';

export type EventListener<T> = (event: T) => void | Promise<void>;

export class EventEmitter<EventMap extends object> {
    private readonly events = new Map<keyof EventMap, Set<EventListener<any>>>();

    /**
     * Registers an event listener.
     * @param eventName The event name to listen for.
     * @param listener The callback to be invoked on the event.
     * @returns A function to unregister the listener.
     */
    on<K extends keyof EventMap>(eventName: K, listener: EventListener<EventMap[K]>) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName)?.add(listener);
        return () => this.off(eventName, listener);
    }

    /**
     * Unregisters an event listener.
     * @param eventName The event name to stop listening for.
     * @param listener The callback to be removed.
     */
    off<K extends keyof EventMap>(eventName: K, listener: EventListener<EventMap[K]>) {
        const eventListeners = this.events.get(eventName);
        if (eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                this.events.delete(eventName);
            }
        }
    }

    /**
     * Emits an event to all registered listeners.
     * @param eventName The name of the event to emit.
     * @param event The event payload.
     */
    emit<K extends keyof EventMap>(eventName: K, event: EventMap[K]) {
        for (const callback of this.events.get(eventName) ?? []) {
            const result = callback(event);
            if (result) {
                result.catch((e) => Logger.error(e));
            }
        }
    }

    /**
     * Clears all listeners for a specific event or all events if no event name is provided.
     * @param eventName (Optional) The name of the event to clear listeners for. If not provided, all listeners for all events are cleared.
     */
    clear<K extends keyof EventMap>(eventName?: K) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
    }
}
