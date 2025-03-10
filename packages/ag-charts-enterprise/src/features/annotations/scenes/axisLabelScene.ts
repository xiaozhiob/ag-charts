import { _ModuleSupport } from 'ag-charts-community';

import type { AxisLabelProperties } from '../annotationProperties';
import type { AnnotationAxisContext } from '../annotationTypes';

const { calculateLabelTranslation, ChartAxisDirection } = _ModuleSupport;

type UpdateOpts = {
    x: number;
    y: number;
    value: any;
    styles: Partial<AxisLabelProperties>;
    context: AnnotationAxisContext;
};

export class AxisLabelScene extends _ModuleSupport.Group {
    static override readonly className = 'AxisLabel';

    private readonly label = new _ModuleSupport.Text({ zIndex: 1 });
    private readonly rect = new _ModuleSupport.Rect();

    constructor() {
        super({ name: 'AnnotationAxisLabelGroup' });

        const { label } = this;
        label.fontSize = 12;
        label.fontFamily = 'Verdana, sans-serif';
        label.fill = 'black';
        label.textBaseline = 'middle';
        label.textAlign = 'center';

        this.append([this.rect, this.label]);
    }

    update(opts: UpdateOpts) {
        this.updateLabel(opts);
        this.updateRect(opts);
        this.updatePosition(opts);
    }

    private updateLabel({ value, styles, context }: UpdateOpts) {
        const {
            fontWeight,
            fontSize,
            fontStyle,
            fontFamily,
            textAlign,
            color = 'white',
            formatter = context.scaleValueFormatter(),
        } = styles;
        this.label.setProperties({
            fontWeight,
            fontSize,
            fontStyle,
            fontFamily,
            textAlign,
            fill: color,
            text: formatter(value),
        });
    }

    private updateRect({ styles }: UpdateOpts) {
        const { rect } = this;

        const { cornerRadius, fill, fillOpacity, stroke, strokeOpacity } = styles;

        rect.setProperties({ cornerRadius, fill, fillOpacity, stroke, strokeOpacity });
    }

    private updatePosition({ x, y, context, styles: { padding } }: UpdateOpts) {
        const { label, rect } = this;

        const labelBBox = label.getBBox()?.clone();

        const horizontalPadding = padding ?? 8;
        const verticalPadding = padding ?? 5;

        labelBBox.grow(horizontalPadding, 'horizontal');
        labelBBox.grow(verticalPadding, 'vertical');

        const shift = context.direction === ChartAxisDirection.X ? verticalPadding / 2 : horizontalPadding;

        const { xTranslation, yTranslation } = calculateLabelTranslation({
            yDirection: true,
            padding: context.labelPadding - shift,
            position: context.position ?? 'left',
            bbox: labelBBox,
        });

        const translationX = x + xTranslation;
        const translationY = y + yTranslation;

        label.x = translationX;
        label.y = translationY;

        rect.x = translationX - labelBBox.width / 2;
        rect.y = translationY - labelBBox.height / 2;
        rect.height = labelBBox.height;
        rect.width = labelBBox.width;
    }
}
