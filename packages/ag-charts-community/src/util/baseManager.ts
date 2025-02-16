import { Listeners } from './listeners';

export abstract class BaseManager<EventType extends string = never, Event extends { type: any } = never> {
    protected readonly listeners = new Listeners<EventType, (event: Event) => void>();
    protected readonly destroyFns: (() => void)[] = [];

    public addListener<T extends EventType>(type: T, handler: (event: Event & { type: T }) => void) {
        return this.listeners.addListener(type, handler);
    }

    public destroy() {
        this.listeners.destroy();
        this.destroyFns.forEach((fn) => fn());
    }
}
