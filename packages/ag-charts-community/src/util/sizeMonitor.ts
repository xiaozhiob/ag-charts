import { getDocument, getWindow } from './dom';

export type Size = {
    width: number;
    height: number;
};
type OnSizeChange = (size: Size, element: HTMLElement) => void;
type Entry = {
    cb: OnSizeChange;
    size?: Size;
};

export class SizeMonitor {
    private readonly elements = new Map<HTMLElement, Entry>();
    private resizeObserver: any;
    private documentReady = false;
    private queuedObserveRequests: [HTMLElement, OnSizeChange][] = [];

    constructor() {
        if (typeof ResizeObserver === 'undefined') return;

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const {
                target,
                contentRect: { width, height },
            } of entries) {
                const entry = this.elements.get(target as HTMLElement);
                this.checkSize(entry, target as HTMLElement, width, height);
            }
        });

        this.documentReady = getDocument('readyState') === 'complete';
        if (!this.documentReady) {
            // Add load listener, so we can check if the main document is ready and all styles are loaded,
            // and if it is then attach any queued requests for resize monitoring.
            //
            // If we attach before document.readyState === 'complete', then additional incorrect resize events
            // are fired, leading to multiple re-renderings on chart initial load. Waiting for the
            // document to be loaded irons out this browser quirk.
            getWindow()?.addEventListener('load', this.onLoad);
        }
    }

    onLoad: EventListener = () => {
        this.documentReady = true;
        this.queuedObserveRequests.forEach(([el, cb]) => this.observe(el, cb));
        this.queuedObserveRequests = [];
    };

    private destroy() {
        getWindow()?.removeEventListener('load', this.onLoad);
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }

    private checkSize(entry: Entry | undefined, element: HTMLElement, width: number, height: number) {
        if (!entry) return;

        if (width !== entry.size?.width || height !== entry.size?.height) {
            entry.size = { width, height };
            entry.cb(entry.size, element);
        }
    }

    // Only a single callback is supported.
    observe(element: HTMLElement, cb: OnSizeChange) {
        if (!this.documentReady) {
            this.queuedObserveRequests.push([element, cb]);
            return;
        }

        if (this.elements.has(element)) {
            this.removeFromQueue(element);
        } else {
            this.resizeObserver?.observe(element);
        }
        const entry = { cb };
        this.elements.set(element, entry);
    }

    unobserve(element: HTMLElement) {
        this.resizeObserver?.unobserve(element);
        this.elements.delete(element);
        this.removeFromQueue(element);

        if (!this.elements.size) {
            this.destroy();
        }
    }

    removeFromQueue(element: HTMLElement) {
        this.queuedObserveRequests = this.queuedObserveRequests.filter(([el]) => el !== element);
    }
}
