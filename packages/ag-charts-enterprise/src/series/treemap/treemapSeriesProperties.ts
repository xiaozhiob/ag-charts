import type {
    AgTreemapSeriesItemStylerParams,
    AgTreemapSeriesLabelFormatterParams,
    AgTreemapSeriesOptions,
    AgTreemapSeriesStyle,
    AgTreemapSeriesTooltipRendererParams,
    Styler,
    TextAlign,
    VerticalAlign,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import { AutoSizedLabel, AutoSizedSecondaryLabel } from '../util/autoSizedLabel';

const {
    BaseProperties,
    HierarchySeriesProperties,
    HighlightStyle,
    SeriesTooltip,
    Validate,
    BOOLEAN,
    COLOR_STRING,
    FUNCTION,
    NUMBER,
    OBJECT,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
    STRING_ARRAY,
    TEXT_ALIGN,
    VERTICAL_ALIGN,
    Label,
} = _ModuleSupport;

class TreemapGroupLabel extends Label<AgTreemapSeriesLabelFormatterParams> {
    @Validate(NUMBER)
    spacing: number = 0;
}

class TreemapSeriesGroup extends BaseProperties {
    @Validate(STRING, { optional: true })
    fill?: string;

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING, { optional: true })
    stroke?: string;

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(POSITIVE_NUMBER)
    cornerRadius: number = 0;

    @Validate(TEXT_ALIGN)
    textAlign: TextAlign = 'center';

    @Validate(POSITIVE_NUMBER)
    gap: number = 0;

    @Validate(POSITIVE_NUMBER)
    padding: number = 0;

    @Validate(BOOLEAN)
    interactive: boolean = true;

    @Validate(OBJECT)
    readonly label = new TreemapGroupLabel();
}

class TreemapSeriesTile extends BaseProperties {
    @Validate(STRING, { optional: true })
    fill?: string;

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING, { optional: true })
    stroke?: string;

    @Validate(POSITIVE_NUMBER, { optional: true })
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(POSITIVE_NUMBER)
    cornerRadius: number = 0;

    @Validate(TEXT_ALIGN)
    textAlign: TextAlign = 'center';

    @Validate(VERTICAL_ALIGN)
    verticalAlign: VerticalAlign = 'middle';

    @Validate(POSITIVE_NUMBER)
    gap: number = 0;

    @Validate(POSITIVE_NUMBER)
    padding: number = 0;

    @Validate(OBJECT)
    readonly label = new AutoSizedLabel<AgTreemapSeriesLabelFormatterParams>();

    @Validate(OBJECT)
    readonly secondaryLabel = new AutoSizedSecondaryLabel<AgTreemapSeriesLabelFormatterParams>();
}

class TreemapSeriesGroupHighlightStyle extends BaseProperties {
    @Validate(STRING, { optional: true })
    fill?: string;

    @Validate(RATIO, { optional: true })
    fillOpacity?: number;

    @Validate(COLOR_STRING, { optional: true })
    stroke?: string;

    @Validate(POSITIVE_NUMBER, { optional: true })
    strokeWidth?: number;

    @Validate(RATIO, { optional: true })
    strokeOpacity?: number;

    @Validate(OBJECT)
    readonly label = new AutoSizedLabel<AgTreemapSeriesLabelFormatterParams>();
}

class TreemapSeriesTileHighlightStyle extends BaseProperties {
    @Validate(STRING, { optional: true })
    fill?: string;

    @Validate(RATIO, { optional: true })
    fillOpacity?: number;

    @Validate(COLOR_STRING, { optional: true })
    stroke?: string;

    @Validate(POSITIVE_NUMBER, { optional: true })
    strokeWidth?: number;

    @Validate(RATIO, { optional: true })
    strokeOpacity?: number;

    @Validate(OBJECT)
    readonly label = new AutoSizedLabel<AgTreemapSeriesLabelFormatterParams>();

    @Validate(OBJECT)
    readonly secondaryLabel = new AutoSizedSecondaryLabel<AgTreemapSeriesLabelFormatterParams>();
}

class TreemapSeriesHighlightStyle extends HighlightStyle {
    @Validate(OBJECT)
    readonly group = new TreemapSeriesGroupHighlightStyle();

    @Validate(OBJECT)
    readonly tile = new TreemapSeriesTileHighlightStyle();
}

export class TreemapSeriesProperties extends HierarchySeriesProperties<AgTreemapSeriesOptions> {
    @Validate(STRING, { optional: true })
    sizeName?: string;

    @Validate(STRING, { optional: true })
    labelKey?: string;

    @Validate(STRING, { optional: true })
    secondaryLabelKey?: string;

    @Validate(FUNCTION, { optional: true })
    itemStyler?: Styler<AgTreemapSeriesItemStylerParams<unknown>, AgTreemapSeriesStyle>;

    @Validate(OBJECT)
    override readonly highlightStyle = new TreemapSeriesHighlightStyle();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgTreemapSeriesTooltipRendererParams<any>>();

    @Validate(OBJECT)
    readonly group = new TreemapSeriesGroup();

    @Validate(OBJECT)
    readonly tile = new TreemapSeriesTile();

    // We haven't decided how to expose this yet, but we need to have this property, so it can change between light and dark themes
    @Validate(STRING_ARRAY)
    undocumentedGroupFills: string[] = [];

    // We haven't decided how to expose this yet, but we need to have this property, so it can change between light and dark themes
    @Validate(STRING_ARRAY)
    undocumentedGroupStrokes: string[] = [];
}
