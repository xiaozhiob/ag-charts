import { _ModuleSupport } from 'ag-charts-community';

import { AnchoredPopover, type AnchoredPopoverOptions } from '../../components/popover/anchoredPopover';
import type { PopoverConstructorOptions } from '../../components/popover/popover';
import colorPickerTemplate from './colorPickerTemplate.html';

const { createElement, Color, clamp } = _ModuleSupport;

export interface ColorPickerOptions extends AnchoredPopoverOptions {
    color?: string;
    opacity?: number;
    sourceEvent: Event;
    onChange?: (colorOpacity: string, color: string, opacity: number) => void;
    onChangeHide?: () => void;
}

const getHsva = (input: string) => {
    try {
        const color = Color.fromString(input);
        const [h, s, v] = color.toHSB();
        return [h, s, v, color.a];
    } catch {
        return;
    }
};

export class ColorPicker extends AnchoredPopover<ColorPickerOptions> {
    private hasChanged = false;
    private onChangeHide?: () => void;

    constructor(ctx: _ModuleSupport.ModuleContext, options?: PopoverConstructorOptions) {
        super(ctx, 'color-picker', options);
        this.hideFns.push(() => {
            if (this.hasChanged) this.onChangeHide?.();
        });
    }

    public show(options: ColorPickerOptions) {
        this.hasChanged = false;
        this.onChangeHide = options.onChangeHide;

        const { element, initialFocus } = this.createColorPicker(options);
        const popover = this.showWithChildren([element], { initialFocus, ...options });
        popover.classList.add('ag-charts-color-picker');
        popover.setAttribute('role', 'dialog');
    }

    private createColorPicker(opts: ColorPickerOptions) {
        let [h, s, v, a] = getHsva(opts.color ?? '#f00') ?? [0, 1, 0.5, 1];
        a = opts.opacity ?? a;

        const colorPicker = createElement('div', 'ag-charts-color-picker__content');
        colorPicker.innerHTML = colorPickerTemplate;
        colorPicker.ariaLabel = this.ctx.localeManager.t('ariaLabelColorPicker');

        const paletteInput = colorPicker.querySelector<HTMLDivElement>('.ag-charts-color-picker__palette')!;
        const hueInput = colorPicker.querySelector<HTMLInputElement>('.ag-charts-color-picker__hue-input')!;
        const alphaInput = colorPicker.querySelector<HTMLInputElement>('.ag-charts-color-picker__alpha-input')!;
        const colorInput = colorPicker.querySelector<HTMLInputElement>('.ag-charts-color-picker__color-input')!;

        const update = (trackChange = true) => {
            const color = Color.fromHSB(h, s, v, a);
            const colorString = color.toHexString();

            colorPicker.style.setProperty('--h', `${h}`);
            colorPicker.style.setProperty('--s', `${s}`);
            colorPicker.style.setProperty('--v', `${v}`);
            colorPicker.style.setProperty('--a', `${a}`);
            colorPicker.style.setProperty('--color', colorString.slice(0, 7));
            colorPicker.style.setProperty('--color-a', colorString);

            hueInput.value = `${h}`;
            alphaInput.value = `${a}`;

            alphaInput.classList.toggle('ag-charts-color-picker__alpha-input--opaque', a === 1);

            if (document.activeElement !== colorInput) {
                colorInput.value = colorString.toUpperCase();
            }

            if (trackChange || opts.color == null) {
                const plainColor = Color.fromHSB(h, s, v, 1).toHexString();
                opts.onChange?.(colorString, plainColor, a);
            }

            if (trackChange) this.hasChanged = true;
        };

        update(false);

        const beginPaletteInteraction = (e: MouseEvent) => {
            e.preventDefault();
            const currentTarget = e.currentTarget as HTMLDivElement;
            currentTarget.focus();
            const rect = currentTarget.getBoundingClientRect();

            const mouseMove = ({ pageX, pageY }: MouseEvent) => {
                s = Math.min(Math.max((pageX - rect.left) / rect.width, 0), 1);
                v = 1 - Math.min(Math.max((pageY - rect.top) / rect.height, 0), 1);
                update();
            };

            mouseMove(e);

            window.addEventListener('mousemove', mouseMove);
            window.addEventListener('mouseup', () => window.removeEventListener('mousemove', mouseMove), {
                once: true,
            });
        };

        colorPicker.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        colorPicker.addEventListener('keydown', (e) => {
            e.stopPropagation();
            switch (e.key) {
                case 'Enter':
                case 'Escape':
                    this.hide();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });
        paletteInput.addEventListener('mousedown', beginPaletteInteraction);
        paletteInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                s = clamp(0, s - 0.01, 1);
            } else if (e.key === 'ArrowRight') {
                s = clamp(0, s + 0.01, 1);
            } else if (e.key === 'ArrowUp') {
                v = clamp(0, v + 0.01, 1);
            } else if (e.key === 'ArrowDown') {
                v = clamp(0, v - 0.01, 1);
            } else {
                return;
            }
            e.preventDefault();
            update();
        });
        hueInput.addEventListener('input', (e) => {
            h = (e.currentTarget as HTMLInputElement).valueAsNumber ?? 0;
            update();
        });
        alphaInput.addEventListener('input', (e) => {
            a = (e.currentTarget as HTMLInputElement).valueAsNumber ?? 0;
            update();
        });
        colorInput.addEventListener('input', (e) => {
            const hsva = getHsva((e.currentTarget as HTMLInputElement).value);
            if (hsva == null) return;
            [h, s, v, a] = hsva;
            update();
        });
        colorInput.addEventListener('blur', () => update());
        colorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                (e.currentTarget as HTMLInputElement).blur();
                update();
            }
        });

        return { element: colorPicker, initialFocus: paletteInput };
    }
}
