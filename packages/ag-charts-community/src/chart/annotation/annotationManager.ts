import type { AgAnnotation, AgAnnotationsThemeableOptions } from 'ag-charts-types';

import type { MementoOriginator } from '../../api/state/memento';
import type { Group } from '../../scene/group';
import type { Node } from '../../scene/node';
import { BaseManager } from '../../util/baseManager';
import { mergeDefaults } from '../../util/object';
import { isArray } from '../../util/type-guards';

interface AnnotationsRestoreEvent {
    type: 'restore-annotations';
    annotations: AnnotationsMemento;
}

export type AnnotationsMemento = AgAnnotation[];

export class AnnotationManager
    extends BaseManager<AnnotationsRestoreEvent['type'], AnnotationsRestoreEvent>
    implements MementoOriginator<AnnotationsMemento>
{
    public mementoOriginatorKey = 'annotations' as const;

    private annotations: AnnotationsMemento = [];
    private styles?: AgAnnotationsThemeableOptions;

    constructor(private readonly annotationRoot: Group) {
        super();
    }

    public createMemento() {
        return this.annotations;
    }

    public guardMemento(blob: unknown): blob is AnnotationsMemento | undefined {
        return blob == null || isArray(blob);
    }

    public restoreMemento(_version: string, _mementoVersion: string, memento: AnnotationsMemento | undefined) {
        // Migration from older versions can be implemented here.

        this.annotations = this.cleanData(memento ?? []).map((annotation) => {
            const annotationTheme = this.getAnnotationTypeStyles(annotation.type);
            return mergeDefaults(annotation, annotationTheme);
        });

        this.listeners.dispatch('restore-annotations', {
            type: 'restore-annotations',
            annotations: this.annotations,
        });
    }

    public updateData(annotations?: AnnotationsMemento) {
        this.annotations = this.cleanData(annotations ?? []);
    }

    public attachNode(node: Node) {
        this.annotationRoot.append(node);
        return () => {
            this.annotationRoot?.removeChild(node);
            return this;
        };
    }

    public setAnnotationStyles(styles: AgAnnotationsThemeableOptions) {
        this.styles = styles;
    }

    public getAnnotationTypeStyles(type: keyof AgAnnotationsThemeableOptions) {
        return this.styles?.[type];
    }

    private cleanData(annotations: AnnotationsMemento) {
        // Strip text align from annotations as this is fixed by annotation type
        for (const annotation of annotations) {
            if ('textAlign' in annotation) delete annotation.textAlign;
        }
        return annotations;
    }
}
