import { BaseProperties } from '../../util/properties';
import { ObserveChanges } from '../../util/proxy';
import { ARRAY, BOOLEAN, UNION, Validate } from '../../util/validation';
import {
    TOOLBAR_ALIGNMENTS,
    TOOLBAR_POSITIONS,
    type ToolbarAlignment,
    type ToolbarButton,
    ToolbarPosition,
} from './toolbarTypes';

export interface ButtonConfiguration extends ToolbarButton {
    fill?: string;
    strokeWidth?: number;
}

export class ToolbarGroupProperties extends BaseProperties {
    @ObserveChanges<ToolbarGroupProperties>((target) => {
        target.onChange(target.enabled);
    })
    @Validate(BOOLEAN)
    enabled?: boolean;

    @ObserveChanges<ToolbarGroupProperties>((target) => {
        target.onChange(target.enabled);
    })
    @Validate(UNION([...TOOLBAR_ALIGNMENTS]), { optional: true })
    align: ToolbarAlignment = 'start';

    @ObserveChanges<ToolbarGroupProperties>((target) => {
        target.onChange(target.enabled);
    })
    @Validate(UNION(TOOLBAR_POSITIONS), { optional: true })
    position: ToolbarPosition = ToolbarPosition.Top;

    @Validate(BOOLEAN)
    draggable?: boolean;

    @ObserveChanges<ToolbarGroupProperties>((target) => {
        target.onChange(target.enabled);
    })
    @Validate(UNION(['small', 'normal']), { optional: true })
    size: 'small' | 'normal' = 'normal';

    @ObserveChanges<ToolbarGroupProperties>((target) => {
        target.buttonsChanged(false);
    })
    @Validate(ARRAY, { optional: true })
    protected buttons?: ButtonConfiguration[];

    private readonly buttonOverrides = new Map<any, Omit<ButtonConfiguration, 'value'>>();

    constructor(
        private readonly onChange: (enabled: boolean | undefined) => void,
        private readonly onButtonsChange: (buttons: ButtonConfiguration[], configurationOnly: boolean) => void
    ) {
        super();
    }

    buttonConfigurations() {
        const buttons = [...(this.buttons ?? [])];
        if (this.draggable) {
            buttons.unshift({
                icon: 'drag-handle',
                tooltip: 'toolbarAnnotationsDragHandle',
                value: 'drag',
                id: 'drag',
            });
        }
        return (
            buttons?.map((button) => {
                const id = button.id ?? button.value;
                const overrides = this.buttonOverrides.get(id);
                return overrides != null ? { ...button, ...overrides } : button;
            }) ?? []
        );
    }

    private buttonsChanged(configurationOnly: boolean) {
        this.onButtonsChange(this.buttonConfigurations(), configurationOnly);
    }

    overrideButtonConfiguration(id: string, options: Omit<ButtonConfiguration, 'value'>) {
        let overrides: any = this.buttonOverrides.get(id);
        if (overrides == null) {
            overrides = Object.create(null);
            this.buttonOverrides.set(id, overrides);
        }

        for (const key of Object.keys(options)) {
            const value = (options as any)[key];
            if (value == null) {
                delete overrides[key];
            } else {
                overrides[key] = value;
            }
        }

        this.buttonsChanged(true);
    }
}
