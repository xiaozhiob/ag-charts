import { _ModuleSupport } from 'ag-charts-community';

const { COLOR_STRING, RATIO, Validate } = _ModuleSupport;

export class ZoomRect extends _ModuleSupport.Rect {
    static override readonly className = 'ZoomRect';

    @Validate(COLOR_STRING)
    public override fill = 'rgb(33, 150, 243)';

    @Validate(RATIO)
    public override fillOpacity = 0.2;
}
