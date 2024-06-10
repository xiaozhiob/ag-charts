import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

import { buildBounds } from '../../utils/position';
import { ColorPicker } from '../color-picker/colorPicker';
import type {
    AnnotationContext,
    Coords,
    Point,
    StateClickEvent,
    StateDragEvent,
    StateHoverEvent,
} from './annotationTypes';
import { ANNOTATION_BUTTONS, AnnotationType, stringToAnnotationType } from './annotationTypes';
import { invertCoords, validateDatumPoint } from './annotationUtils';
import { CrossLineAnnotation } from './cross-line/crossLineProperties';
import { CrossLine } from './cross-line/crossLineScene';
import { CrossLineStateMachine } from './cross-line/crossLineState';
import { DisjointChannelAnnotation } from './disjoint-channel/disjointChannelProperties';
import { DisjointChannel } from './disjoint-channel/disjointChannelScene';
import { DisjointChannelStateMachine } from './disjoint-channel/disjointChannelState';
import { LineAnnotation } from './line/lineProperties';
import { Line } from './line/lineScene';
import { LineStateMachine } from './line/lineState';
import { ParallelChannelAnnotation } from './parallel-channel/parallelChannelProperties';
import { ParallelChannel } from './parallel-channel/parallelChannelScene';
import { ParallelChannelStateMachine } from './parallel-channel/parallelChannelState';
import type { Annotation } from './scenes/annotation';

const {
    BOOLEAN,
    OBJECT_ARRAY,
    ChartUpdateType,
    Cursor,
    InteractionState,
    PropertiesArray,
    StateMachine,
    ToolbarManager,
    Validate,
    REGIONS,
} = _ModuleSupport;

type Constructor<T = {}> = new (...args: any[]) => T;

type AnnotationScene = Line | CrossLine | DisjointChannel | ParallelChannel;
type AnnotationProperties =
    | LineAnnotation
    | CrossLineAnnotation
    | ParallelChannelAnnotation
    | DisjointChannelAnnotation;
type AnnotationPropertiesArray = _ModuleSupport.PropertiesArray<AnnotationProperties>;

export type AnnotationAxis = {
    layout: _ModuleSupport.AxisLayout;
    context: _ModuleSupport.AxisContext;
    bounds: _Scene.BBox;
};

const annotationDatums: Record<AnnotationType, Constructor<AnnotationProperties>> = {
    [AnnotationType.Line]: LineAnnotation,
    [AnnotationType.CrossLine]: CrossLineAnnotation,
    [AnnotationType.ParallelChannel]: ParallelChannelAnnotation,
    [AnnotationType.DisjointChannel]: DisjointChannelAnnotation,
};

const annotationScenes: Record<AnnotationType, Constructor<AnnotationScene>> = {
    [AnnotationType.Line]: Line,
    [AnnotationType.CrossLine]: CrossLine,
    [AnnotationType.DisjointChannel]: DisjointChannel,
    [AnnotationType.ParallelChannel]: ParallelChannel,
};

class AnnotationsStateMachine extends StateMachine<'idle', AnnotationType | 'click' | 'hover' | 'drag' | 'cancel'> {
    override debug = _Util.Debug.create(true, 'annotations');

    constructor(
        onEnterIdle: () => void,
        appendDatum: (type: AnnotationType, datum: AnnotationProperties) => void,
        validateChildStateDatumPoint: (point: Point) => boolean
    ) {
        super('idle', {
            idle: {
                onEnter: () => onEnterIdle(),
                [AnnotationType.Line]: new LineStateMachine((datum) => appendDatum(AnnotationType.Line, datum)),
                [AnnotationType.CrossLine]: new CrossLineStateMachine((datum) =>
                    appendDatum(AnnotationType.CrossLine, datum)
                ),
                [AnnotationType.DisjointChannel]: new DisjointChannelStateMachine(
                    (datum) => appendDatum(AnnotationType.DisjointChannel, datum),
                    validateChildStateDatumPoint
                ),
                [AnnotationType.ParallelChannel]: new ParallelChannelStateMachine(
                    (datum) => appendDatum(AnnotationType.ParallelChannel, datum),
                    validateChildStateDatumPoint
                ),
            },
        });
    }
}

export class Annotations extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    @_ModuleSupport.ObserveChanges<Annotations>((target, enabled) => {
        target.ctx.toolbarManager.toggleGroup('annotations', 'annotations', Boolean(enabled));
    })
    @Validate(BOOLEAN)
    public enabled: boolean = true;

    @_ModuleSupport.ObserveChanges<Annotations>((target, initial: AnnotationPropertiesArray) => {
        target.annotationData ??= initial;
    })
    @Validate(OBJECT_ARRAY, { optional: true })
    public initial = new PropertiesArray(this.createAnnotationDatum);

    // State
    private readonly state: AnnotationsStateMachine;
    private annotationData?: AnnotationPropertiesArray;
    private hovered?: number;
    private active?: number;
    private dragOffset?: Coords;

    // Elements
    private seriesRect?: _Scene.BBox;
    private readonly container = new _Scene.Group({ name: 'static-annotations' });
    private readonly annotations = new _Scene.Selection<AnnotationScene, AnnotationProperties>(
        this.container,
        this.createAnnotationScene.bind(this)
    );

    private readonly colorPicker = new ColorPicker(this.ctx);

    private xAxis?: AnnotationAxis;
    private yAxis?: AnnotationAxis;

    constructor(readonly ctx: _ModuleSupport.ModuleContext) {
        super();

        this.state = new AnnotationsStateMachine(
            () => {
                ctx.cursorManager.updateCursor('annotations');
                ctx.interactionManager.popState(InteractionState.Annotations);
                ctx.toolbarManager.toggleGroup('annotations', 'annotationOptions', this.active != null);
                for (const annotationType of ANNOTATION_BUTTONS) {
                    ctx.toolbarManager.toggleButton('annotations', annotationType, { active: false });
                }
                this.toggleAnnotationOptionsButtons();
            },
            this.appendDatum.bind(this),
            this.validateChildStateDatumPoint.bind(this)
        );

        const { All, Default, Annotations: AnnotationsState, ZoomDrag } = InteractionState;

        const seriesRegion = ctx.regionManager.getRegion(REGIONS.SERIES);
        const horizontalAxesRegion = ctx.regionManager.getRegion(REGIONS.HORIZONTAL_AXES);
        const verticalAxesRegion = ctx.regionManager.getRegion(REGIONS.VERTICAL_AXES);

        const otherRegions = Object.values(REGIONS)
            .filter((region) => ![REGIONS.SERIES, REGIONS.HORIZONTAL_AXES, REGIONS.VERTICAL_AXES].includes(region))
            .map((region) => ctx.regionManager.getRegion(region));

        this.destroyFns.push(
            ctx.annotationManager.attachNode(this.container),
            () => this.colorPicker.destroy(),
            horizontalAxesRegion.addListener('click', (event) => this.onAxisClick(event, REGIONS.HORIZONTAL_AXES), All),
            verticalAxesRegion.addListener('click', (event) => this.onAxisClick(event, REGIONS.VERTICAL_AXES), All),
            seriesRegion.addListener('hover', (event) => this.onHover(event, REGIONS.SERIES), All),
            seriesRegion.addListener('click', (event) => this.onClick(event, REGIONS.SERIES), All),
            seriesRegion.addListener('drag', this.onDrag.bind(this), Default | ZoomDrag | AnnotationsState),
            seriesRegion.addListener('drag-end', this.onDragEnd.bind(this), All),
            seriesRegion.addListener('cancel', this.onCancel.bind(this), All),
            seriesRegion.addListener('delete', this.onDelete.bind(this), All),
            ...otherRegions.map((region) => region.addListener('click', this.onCancel.bind(this), All)),
            ctx.annotationManager.addListener('restore-annotations', this.onRestoreAnnotations.bind(this)),
            ctx.toolbarManager.addListener('button-pressed', this.onToolbarButtonPress.bind(this)),
            ctx.layoutService.addListener('layout-complete', this.onLayoutComplete.bind(this))
        );
    }

    private createAnnotationScene(datum: AnnotationProperties) {
        return new annotationScenes[datum.type]();
    }

    private createAnnotationDatum(params: { type: AnnotationType }) {
        if (params.type in annotationDatums) {
            return new annotationDatums[params.type]().set(params);
        }
        throw new Error(
            `AG Charts - Cannot set property of unknown type [${params.type}], expected one of [${Object.keys(annotationDatums)}], ignoring.`
        );
    }

    private appendDatum(type: AnnotationType, datum: AnnotationProperties) {
        this.annotationData?.push(datum);
        const styles = this.ctx.annotationManager.getAnnotationTypeStyles(type);
        if (styles) datum.set(styles);
    }

    private onRestoreAnnotations(event: { annotations?: any }) {
        if (!this.enabled) return;

        this.clear();

        this.annotationData ??= new PropertiesArray(this.createAnnotationDatum);
        this.annotationData.set(event.annotations);

        this.update();
    }

    private onToolbarButtonPress(event: _ModuleSupport.ToolbarButtonPressedEvent) {
        const {
            state,
            ctx: { interactionManager, toolbarManager },
        } = this;

        if (ToolbarManager.isGroup('annotationOptions', event)) {
            this.onToolbarAnnotationOptionButtonPress(event);
            return;
        }

        this.reset();

        if (!ToolbarManager.isGroup('annotations', event)) {
            return;
        }

        const annotation = stringToAnnotationType(event.value);
        if (!annotation) {
            _Util.Logger.errorOnce(`Can not create unknown annotation type [${event.value}], ignoring.`);
            return;
        }

        interactionManager.pushState(InteractionState.Annotations);
        for (const annotationType of ANNOTATION_BUTTONS) {
            toolbarManager.toggleButton('annotations', annotationType, { active: annotationType === event.value });
        }
        state.transition(annotation);
    }

    private onToolbarAnnotationOptionButtonPress(event: _ModuleSupport.ToolbarButtonPressedEvent) {
        if (!ToolbarManager.isGroup('annotationOptions', event)) return;

        const { active, annotationData } = this;

        if (!annotationData || active == null) return;

        switch (event.value) {
            case 'color':
                this.colorPicker.show({
                    anchor: this.annotations.nodes()[active]?.getAnchor(),
                    color: this.getTypedDatum(annotationData[active])?.stroke,
                    onChange: this.onColorPickerChange.bind(this),
                });
                break;

            case 'delete':
                annotationData.splice(active, 1);
                this.reset();
                break;

            case 'lock':
                annotationData[active].locked = true;
                this.toggleAnnotationOptionsButtons();
                this.colorPicker.hide();
                break;

            case 'unlock':
                annotationData[active].locked = false;
                this.toggleAnnotationOptionsButtons();
                break;
        }

        this.update();
    }

    private onColorPickerChange(color: string) {
        const { active, annotationData } = this;

        if (active == null || !annotationData) return;

        const datum = this.getTypedDatum(annotationData[active]);

        if (datum) {
            datum.stroke = color;
            if ('background' in datum) datum.background.fill = color;
        }

        this.update();
    }

    private onLayoutComplete(event: _ModuleSupport.LayoutCompleteEvent) {
        this.seriesRect = event.series.rect;

        for (const axisLayout of event.axes ?? []) {
            if (axisLayout.direction === _ModuleSupport.ChartAxisDirection.X) {
                this.xAxis = this.getAxis(axisLayout, event.series.rect);
            } else {
                this.yAxis = this.getAxis(axisLayout, event.series.rect);
            }
        }

        this.updateAnnotations();
    }

    private getAxis(axisLayout: _ModuleSupport.AxisLayout, seriesRect: _Scene.BBox): AnnotationAxis {
        const axisCtx = this.ctx.axisManager.getAxisContext(axisLayout.direction)[0];

        const { position: axisPosition = 'bottom' } = axisCtx;
        const padding = axisLayout.gridPadding + axisLayout.seriesAreaPadding;
        const bounds = buildBounds(new _Scene.BBox(0, 0, seriesRect.width, seriesRect.height), axisPosition, padding);

        return { layout: axisLayout, context: axisCtx, bounds };
    }

    private updateAnnotations() {
        const {
            active,
            seriesRect,
            annotationData,
            annotations,
            ctx: { annotationManager, toolbarManager },
        } = this;

        const context = this.getAnnotationContext();
        if (!seriesRect || !context) {
            return;
        }

        annotationManager.updateData(annotationData?.toJson());

        annotations
            .update(annotationData ?? [], undefined, (datum) => datum.id)
            .each((node, datum, index) => {
                if (!this.validateDatum(datum)) {
                    node.visible = false;
                    return;
                }

                if (LineAnnotation.is(datum) && Line.is(node)) {
                    node.update(datum, context);
                }

                if (DisjointChannelAnnotation.is(datum) && DisjointChannel.is(node)) {
                    node.update(datum, context);
                }

                if (CrossLineAnnotation.is(datum) && CrossLine.is(node)) {
                    node.update(datum, context);
                }

                if (ParallelChannelAnnotation.is(datum) && ParallelChannel.is(node)) {
                    node.update(datum, context);
                }

                if (active === index) {
                    toolbarManager.changeFloatingAnchor('annotationOptions', node.getAnchor());
                }
            });
    }

    // Validation of the options beyond the scope of the @Validate decorator
    private validateDatum(datum: AnnotationProperties) {
        const context = this.getAnnotationContext();
        return context ? datum.isValidWithContext(context, `Annotation [${datum.type}] `) : true;
    }

    private validateChildStateDatumPoint(point: Point) {
        const context = this.getAnnotationContext();
        const valid = context ? validateDatumPoint(context, point) : true;
        if (!valid) {
            this.ctx.cursorManager.updateCursor('annotations', Cursor.NotAllowed);
        }
        return valid;
    }

    private getAnnotationContext(): AnnotationContext | undefined {
        const { seriesRect, xAxis, yAxis } = this;

        if (!(seriesRect && xAxis && yAxis)) {
            return;
        }

        return {
            seriesRect,
            xAxis: {
                ...xAxis.context,
                bounds: xAxis.bounds,
                labelPadding: this.calculateAxisLabelPadding(xAxis.layout),
            },
            yAxis: {
                ...yAxis.context,
                bounds: yAxis.bounds,
                labelPadding: this.calculateAxisLabelPadding(xAxis.layout),
            },
        };
    }

    private calculateAxisLabelPadding(axisLayout: _ModuleSupport.AxisLayout) {
        return axisLayout.seriesAreaPadding + axisLayout.tickSize + axisLayout.label.padding;
    }

    private onHover(event: _ModuleSupport.PointerInteractionEvent<'hover'>, region: _ModuleSupport.RegionName) {
        if (this.state.is('idle')) {
            this.onHoverSelecting(event);
        } else {
            this.onHoverAdding(event, region);
        }
    }

    private onHoverSelecting(event: _ModuleSupport.PointerInteractionEvent<'hover'>) {
        const {
            active,
            annotations,
            ctx: { cursorManager },
        } = this;

        this.hovered = undefined;

        annotations.each((annotation, _, index) => {
            const contains = annotation.containsPoint(event.offsetX, event.offsetY);
            if (contains) this.hovered ??= index;
            annotation.toggleHandles(contains || active === index);
        });

        cursorManager.updateCursor(
            'annotations',
            this.hovered == null ? undefined : annotations.nodes()[this.hovered].getCursor()
        );
    }

    private onHoverAdding(event: _ModuleSupport.PointerInteractionEvent<'hover'>, region?: _ModuleSupport.RegionName) {
        const {
            annotationData,
            annotations,
            seriesRect,
            state,
            ctx: { cursorManager },
        } = this;

        const context = this.getAnnotationContext();

        if (!annotationData || !context) return;

        const offset = {
            x: event.offsetX - (seriesRect?.x ?? 0),
            y: event.offsetY - (seriesRect?.y ?? 0),
        };

        const point = invertCoords(offset, context);
        const valid = validateDatumPoint(context, point);
        cursorManager.updateCursor('annotations', valid ? undefined : Cursor.NotAllowed);

        if (!valid || state.is('start')) return;

        const datum = annotationData.at(-1);
        this.active = annotationData.length - 1;
        const node = annotations.nodes()[this.active];

        if (!datum || !node) return;

        node.toggleActive(true);

        const data: StateHoverEvent<AnnotationProperties, Annotation> = { datum, node, point, region };
        this.state.transition('hover', data);

        this.update();
    }

    private onClick(event: _ModuleSupport.PointerInteractionEvent<'click'>, region: _ModuleSupport.RegionName) {
        const { dragOffset, state } = this;

        // Prevent clicks triggered on the exact same event as the drag when placing the second point. This "double"
        // event causes channels to be created with start and end at the same position and render incorrectly.
        if (state.is('end') && dragOffset && dragOffset.x === event.offsetX && dragOffset.y === event.offsetY) {
            this.dragOffset = undefined;
            return;
        }

        if (state.is('idle')) {
            this.onClickSelecting();
        } else {
            this.onClickAdding(event, region);
        }
    }

    private onAxisClick(event: _ModuleSupport.PointerInteractionEvent<'click'>, region: _ModuleSupport.RegionName) {
        this.onCancel();
        this.onAxisClickAdding(event, region);
    }

    private onAxisClickAdding(
        event: _ModuleSupport.PointerInteractionEvent<'click'>,
        region: _ModuleSupport.RegionName
    ) {
        if (!this.annotationData) return;

        this.ctx.interactionManager.pushState(InteractionState.Annotations);
        this.state.transition(AnnotationType.CrossLine);

        this.onClickAdding(event, region);
    }

    private onClickSelecting() {
        const {
            annotations,
            colorPicker,
            hovered,
            ctx: { toolbarManager, tooltipManager },
        } = this;

        if (this.active != null) {
            annotations.nodes()[this.active].toggleActive(false);
        }

        this.active = hovered;
        toolbarManager.toggleGroup('annotations', 'annotationOptions', this.active != null);

        if (this.active == null) {
            tooltipManager.unsuppressTooltip('annotations');
            colorPicker.hide();
        } else {
            const node = annotations.nodes()[this.active];
            node.toggleActive(true);
            tooltipManager.suppressTooltip('annotations');
            this.toggleAnnotationOptionsButtons();
        }

        this.update();
    }

    private onClickAdding(event: _ModuleSupport.PointerInteractionEvent<'click'>, region: _ModuleSupport.RegionName) {
        const {
            active,
            annotationData,
            annotations,
            seriesRect,
            state,
            ctx: { toolbarManager },
        } = this;

        toolbarManager.toggleGroup('annotations', 'annotationOptions', false);

        const context = this.getAnnotationContext();
        if (!annotationData || !context) return;

        const datum = annotationData?.at(-1);
        const offset = {
            x: event.offsetX - (seriesRect?.x ?? 0),
            y: event.offsetY - (seriesRect?.y ?? 0),
        };
        const point = invertCoords(offset, context);

        const node = active != null ? annotations.nodes()[active] : undefined;

        if (!validateDatumPoint(context, point)) {
            return;
        }

        const data: StateClickEvent<AnnotationProperties, Annotation> = { datum, node, point, region };
        state.transition('click', data);

        this.update();
    }

    private onDrag(event: _ModuleSupport.PointerInteractionEvent<'drag'>) {
        // TODO: This shouldn't happen. Prevent drags on color picker triggering here.
        if (this.colorPicker.isVisible()) return;

        // Only track pointer offset for drag + click prevention when we are placing the first point
        if (this.state.is('start')) {
            this.dragOffset = { x: event.offsetX, y: event.offsetY };
        }

        if (this.state.is('idle')) {
            this.onClickSelecting();
            this.onDragHandle(event);
        } else {
            this.onDragAdding(event);
        }
    }

    private onDragHandle(event: _ModuleSupport.PointerInteractionEvent<'drag'>) {
        const {
            annotationData,
            annotations,
            hovered,
            seriesRect,
            ctx: { cursorManager, interactionManager },
        } = this;

        const context = this.getAnnotationContext();

        if (hovered == null || annotationData == null || !this.state.is('idle') || context == null) return;

        interactionManager.pushState(InteractionState.Annotations);

        const { offsetX, offsetY } = event;
        const datum = annotationData[hovered];
        const node = annotations.nodes()[hovered];
        const offset = {
            x: offsetX - (seriesRect?.x ?? 0),
            y: offsetY - (seriesRect?.y ?? 0),
        };

        cursorManager.updateCursor('annotations');

        const onDragInvalid = () => this.ctx.cursorManager.updateCursor('annotations', Cursor.NotAllowed);

        if (LineAnnotation.is(datum) && Line.is(node)) {
            node.dragHandle(datum, offset, context, onDragInvalid);
        }

        if (CrossLineAnnotation.is(datum) && CrossLine.is(node)) {
            node.dragHandle(datum, offset, context, onDragInvalid);
        }

        if (DisjointChannelAnnotation.is(datum) && DisjointChannel.is(node)) {
            node.dragHandle(datum, offset, context, onDragInvalid);
        }

        if (ParallelChannelAnnotation.is(datum) && ParallelChannel.is(node)) {
            node.dragHandle(datum, offset, context, onDragInvalid);
        }

        this.update();
    }

    private onDragAdding(event: _ModuleSupport.PointerInteractionEvent<'drag'>) {
        const {
            active,
            annotationData,
            annotations,
            seriesRect,
            state,
            ctx: { interactionManager },
        } = this;

        const context = this.getAnnotationContext();
        if (annotationData == null || context == null) return;

        const { offsetX, offsetY } = event;
        const datum = active != null ? annotationData[active] : undefined;
        const node = active != null ? annotations.nodes()[active] : undefined;
        const offset = {
            x: offsetX - (seriesRect?.x ?? 0),
            y: offsetY - (seriesRect?.y ?? 0),
        };

        interactionManager.pushState(InteractionState.Annotations);

        const point = invertCoords(offset, context);
        const data: StateDragEvent<AnnotationProperties, Annotation> = { datum, node, point };

        state.transition('drag', data);

        // Assuming the first drag event appends a new datum, immediately activate it
        this.active = annotationData.length - 1;

        this.update();
    }

    private onDragEnd(_event: _ModuleSupport.PointerInteractionEvent<'drag-end'>) {
        const {
            active,
            annotations,
            ctx: { cursorManager, interactionManager },
        } = this;

        if (!this.state.is('idle')) return;

        interactionManager.popState(InteractionState.Annotations);
        cursorManager.updateCursor('annotations');

        if (active == null) return;

        annotations.nodes()[active].stopDragging();
        this.update();
    }

    private onCancel() {
        const { active, annotationData, state } = this;

        if (!state.is('idle')) {
            state.transition('cancel');

            // Delete active annotation if it is in the process of being created
            if (active != null && annotationData) {
                annotationData.splice(active, 1);
            }
        }

        this.reset();
        this.update();
    }

    private onDelete() {
        const { active, annotationData, state } = this;

        if (active == null || !annotationData) return;

        if (!state.is('idle')) {
            state.transition('cancel');
        }

        annotationData.splice(active, 1);

        this.reset();
        this.update();
    }

    private toggleAnnotationOptionsButtons() {
        const {
            active,
            annotationData,
            ctx: { toolbarManager },
        } = this;

        if (active == null || !annotationData) return;

        const locked = annotationData?.at(active)?.locked ?? false;
        toolbarManager.toggleButton('annotationOptions', 'color', { visible: !locked });
        toolbarManager.toggleButton('annotationOptions', 'delete', { visible: !locked });
        toolbarManager.toggleButton('annotationOptions', 'lock', { visible: !locked });
        toolbarManager.toggleButton('annotationOptions', 'unlock', { visible: locked });
    }

    getTypedDatum(datum: unknown) {
        if (
            LineAnnotation.is(datum) ||
            CrossLineAnnotation.is(datum) ||
            DisjointChannelAnnotation.is(datum) ||
            ParallelChannelAnnotation.is(datum)
        ) {
            return datum;
        }
    }

    private clear() {
        this.annotations.clear();
        this.reset();
    }

    private reset() {
        if (this.active != null) {
            this.annotations.nodes().at(this.active)?.toggleActive(false);
        }
        this.hovered = undefined;
        this.active = undefined;
        this.ctx.toolbarManager.toggleGroup('annotations', 'annotationOptions', false);
        this.colorPicker.hide();
    }

    private update() {
        this.ctx.updateService.update(ChartUpdateType.PERFORM_LAYOUT, { skipAnimations: true });
    }
}
