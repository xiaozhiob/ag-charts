import { setAttribute } from './attributeUtil';
import { getWindow } from './dom';

export class GuardedElement {
    private readonly destroyFns: (() => void)[] = [];
    private guardTabIndex: number = 0;
    private hasFocus = false;

    constructor(
        private readonly element: HTMLElement,
        private readonly topTabGuard: HTMLElement,
        private readonly bottomTabGuard: HTMLElement
    ) {
        this.initTabGuard(this.topTabGuard, () => this.onTab(false));
        this.initTabGuard(this.bottomTabGuard, () => this.onTab(true));
        this.element.addEventListener('focus', () => this.onFocus(), { capture: true });
        this.element.addEventListener('blur', () => this.onBlur(), { capture: true });
    }

    set tabIndex(index: number) {
        this.guardTabIndex = index;
        if (!this.hasFocus) {
            this.topTabGuard.tabIndex = this.guardTabIndex;
            this.bottomTabGuard.tabIndex = this.guardTabIndex;
        }
    }

    destroy() {
        for (const fn of this.destroyFns) fn();
        this.destroyFns.length = 0;
    }

    private initTabGuard(guard: HTMLElement, handler: () => void) {
        guard.addEventListener('focus', handler);
        this.destroyFns.push(() => guard.removeEventListener('focus', handler));
    }

    private onFocus() {
        this.hasFocus = true;
        setAttribute(this.topTabGuard, 'tabindex', undefined);
        setAttribute(this.bottomTabGuard, 'tabindex', undefined);
    }

    private onBlur() {
        this.hasFocus = false;
        this.topTabGuard.tabIndex = this.guardTabIndex;
        this.bottomTabGuard.tabIndex = this.guardTabIndex;
    }

    private onTab(reverse: boolean) {
        this.getFocusableTarget(reverse)?.focus?.();
    }

    private getFocusableTarget(reverse: boolean): HTMLElement | undefined {
        const window = getWindow();
        const focusables = Array.from(this.element.querySelectorAll('[tabindex="0"]')).filter((e): e is HTMLElement => {
            if (e instanceof HTMLElement) {
                const style = window.getComputedStyle(e);
                return style.display !== 'none' && style.visibility !== 'none';
            }
            return false;
        });
        const index = reverse ? focusables.length - 1 : 0;
        return focusables[index];
    }
}
