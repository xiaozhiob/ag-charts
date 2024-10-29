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
            this.setGuardIndices(this.guardTabIndex);
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

    private setGuardIndices(index: number | undefined) {
        const tabindex = index as 0 | -1 | undefined;
        setAttribute(this.topTabGuard, 'tabindex', tabindex);
        setAttribute(this.bottomTabGuard, 'tabindex', tabindex);
    }

    private onFocus() {
        this.hasFocus = true;
        this.setGuardIndices(undefined);
    }

    private onBlur() {
        this.hasFocus = false;
        this.setGuardIndices(this.guardTabIndex);
    }

    private onTab(reverse: boolean) {
        this.getGuardedTarget(reverse)?.focus?.();
    }

    private getGuardedTarget(reverse: boolean): HTMLElement | undefined {
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
