import type { AgBulletSeriesTooltipRendererParams, Direction } from 'ag-charts-community';
import { _ModuleSupport, _Scale, _Scene } from 'ag-charts-community';

const {
    partialAssign,
    keyProperty,
    valueProperty,
    Validate,
    COLOR_STRING,
    DIRECTION,
    STRING,
    OPT_ARRAY,
    OPT_NUMBER,
    OPT_STRING,
} = _ModuleSupport;

interface BulletNodeDatum extends _ModuleSupport.CartesianSeriesNodeDatum {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly target?: {
        readonly value: number;
        readonly x1: number;
        readonly y1: number;
        readonly x2: number;
        readonly y2: number;
    };
}

class BulletColorRange {
    @Validate(COLOR_STRING)
    color: string = 'white';

    @Validate(OPT_NUMBER())
    stop?: number = undefined;
}

class BulletNode extends _Scene.Group {
    private valueRect: _Scene.Rect = new _Scene.Rect();
    private targetLine: _Scene.Line = new _Scene.Line();

    public constructor() {
        super();
        this.append(this.valueRect);
        this.append(this.targetLine);
    }

    public update(datum: BulletNodeDatum) {
        partialAssign(['x', 'y', 'height', 'width'], this.valueRect, datum);
        this.valueRect.visible = true;

        partialAssign(['x1', 'x2', 'y1', 'y2'], this.targetLine, datum.target);
        this.targetLine.stroke = 'black';
        this.targetLine.strokeWidth = 3;
        this.targetLine.visible = datum.target !== undefined;
    }
}

export class BulletSeries extends _ModuleSupport.CartesianSeries<BulletNode, BulletNodeDatum> {
    @Validate(STRING)
    valueKey: string = '';

    @Validate(OPT_STRING)
    valueName?: string = undefined;

    @Validate(OPT_STRING)
    targetKey?: string = undefined;

    @Validate(OPT_STRING)
    targetName?: string = undefined;

    @Validate(DIRECTION)
    direction: Direction = 'vertical';

    readonly xValue: string = 'xPlaceholderValue';

    tooltip = new _ModuleSupport.SeriesTooltip<AgBulletSeriesTooltipRendererParams>();

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({ moduleCtx });
    }

    override async processData(dataController: _ModuleSupport.DataController) {
        const { valueKey, targetKey, data = [] } = this;
        if (!valueKey || !targetKey || !data) return;

        const isContinuousX = _Scale.ContinuousScale.is(this.getCategoryAxis()?.scale);
        const isContinuousY = _Scale.ContinuousScale.is(this.getValueAxis()?.scale);

        await this.requestDataModel<any, any, true>(dataController, data, {
            props: [
                keyProperty(this, valueKey, isContinuousX, { id: 'xValue' }),
                valueProperty(this, valueKey, isContinuousY, { id: 'value' }),
                valueProperty(this, targetKey, isContinuousY, { id: 'target' }),
            ],
            groupByKeys: true,
            dataVisible: this.visible,
        });
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection) {
        const { dataModel, processedData } = this;
        if (!dataModel || !processedData) return [];

        if (direction === this.getCategoryDirection()) {
            return [this.xValue];
        } else if (direction == this.getValueAxis()?.direction) {
            const valueDomain = dataModel.getDomain(this, 'value', 'value', processedData);
            const targetDomain = dataModel.getDomain(this, 'target', 'value', processedData);
            return [0, Math.max(...valueDomain, ...targetDomain)];
        } else {
            throw new Error(`unknown direction ${direction}`);
        }
    }

    override async createNodeData() {
        const { valueKey, dataModel, processedData } = this;
        const xScale = this.getCategoryAxis()?.scale;
        const yScale = this.getValueAxis()?.scale;
        if (!valueKey || !dataModel || !processedData || !xScale || !yScale) return [];

        const valueIndex = dataModel.resolveProcessedDataIndexById(this, 'value').index;
        const targetIndex = dataModel.resolveProcessedDataIndexById(this, 'target').index;
        const context: _ModuleSupport.CartesianSeriesNodeDataContext<BulletNodeDatum> = {
            itemId: valueKey,
            nodeData: [],
            labelData: [],
            scales: super.calculateScaling(),
            visible: this.visible,
        };
        for (const { datum, values } of processedData.data) {
            const xValue = this.xValue;
            const yValue = values[0][valueIndex];
            const x = xScale.convert(xValue);
            const y = yScale.convert(yValue);
            const barWidth = 8;
            const bottomY = yScale.convert(0);
            const barAlongX = this.getBarDirection() === _ModuleSupport.ChartAxisDirection.X;
            const rect = {
                x: barAlongX ? Math.min(y, bottomY) : x,
                y: barAlongX ? x : Math.min(y, bottomY),
                width: barAlongX ? Math.abs(bottomY - y) : barWidth,
                height: barAlongX ? barWidth : Math.abs(bottomY - y),
            };

            let target;
            if (this.targetKey) {
                const targetLineLength = 20;
                const targetValue = values[0][targetIndex];
                if (!isNaN(targetValue) && targetValue !== undefined) {
                    const convertedY = yScale.convert(targetValue);
                    const convertedX = xScale.convert(xValue) + barWidth / 2;
                    let x1 = convertedX - targetLineLength / 2;
                    let x2 = convertedX + targetLineLength / 2;
                    let [y1, y2] = [convertedY, convertedY];
                    if (barAlongX) {
                        [x1, x2, y1, y2] = [y1, y2, x1, x2];
                    }
                    target = { value: targetValue, x1, x2, y1, y2 };
                }
            }

            const nodeData: BulletNodeDatum = {
                series: this,
                datum,
                xKey: valueKey,
                xValue,
                yKey: valueKey,
                yValue,
                target,
                ...rect,
                midPoint: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            };
            context.nodeData.push(nodeData);
        }
        return [context];
    }

    override getLegendData(legendType: _ModuleSupport.ChartLegendType) {
        // TODO(olegat)
        legendType as any;
        return [];
    }
    override getTooltipHtml(nodeDatum: BulletNodeDatum): string {
        // TODO(olegat)
        nodeDatum as any;
        return '';
    }
    protected override isLabelEnabled() {
        // TODO(olegat)
        return false;
    }
    protected override nodeFactory() {
        return new BulletNode();
    }

    protected override async updateDatumSelection(opts: {
        nodeData: BulletNodeDatum[];
        datumSelection: _Scene.Selection<BulletNode, BulletNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, undefined);
    }

    protected override async updateDatumNodes(opts: {
        datumSelection: _Scene.Selection<BulletNode, BulletNodeDatum>;
        isHighlight: boolean;
    }) {
        for (const { node, datum } of opts.datumSelection) {
            node.update(datum);
        }
    }

    protected override async updateLabelSelection(opts: {
        labelData: BulletNodeDatum[];
        labelSelection: _Scene.Selection<_Scene.Text, BulletNodeDatum>;
    }) {
        return opts.labelSelection;
    }

    protected override async updateLabelNodes(_opts: {
        labelSelection: _Scene.Selection<_Scene.Text, BulletNodeDatum>;
    }) {}

    // barSeries.ts copy/pasta
    private getCategoryAxis(): _ModuleSupport.ChartAxis | undefined {
        const direction = this.getCategoryDirection();
        return this.axes[direction];
    }

    private getValueAxis(): _ModuleSupport.ChartAxis | undefined {
        const direction = this.getBarDirection();
        return this.axes[direction];
    }

    private getBarDirection() {
        if (this.direction === 'vertical') {
            return _ModuleSupport.ChartAxisDirection.Y;
        }
        return _ModuleSupport.ChartAxisDirection.X;
    }

    private getCategoryDirection() {
        if (this.direction === 'vertical') {
            return _ModuleSupport.ChartAxisDirection.X;
        }
        return _ModuleSupport.ChartAxisDirection.Y;
    }
}
