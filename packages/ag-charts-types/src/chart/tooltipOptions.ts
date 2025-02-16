import type { AgChartCallbackParams } from './callbackOptions';
import type { CssColor, DurationMs, InteractionRange, PixelSize, TextWrap } from './types';

export interface AgChartTooltipOptions {
    /** Set to `false` to disable tooltips for all series in the chart. */
    enabled?: boolean;
    /** The tooltip arrow is displayed by default, unless the container restricts it or a position offset is provided. To always display the arrow, set `showArrow` to `true`. To remove the arrow, set `showArrow` to `false`.  */
    showArrow?: boolean;
    /** A class name to be added to the tooltip element of the chart. */
    class?: string;
    /** Range from a point that triggers the tooltip to show. This will be used unless overridden by the series `tooltip.range` option. */
    range?: InteractionRange;
    /** The position of the tooltip. This will be used unless overridden by the series `tooltip.range` option.*/
    position?: AgTooltipPositionOptions;
    /** The time interval (in milliseconds) after which the tooltip is shown. */
    delay?: DurationMs;
    /**
     * Text wrapping strategy for tooltips.
     * - `'always'` will always wrap text to fit within the tooltip.
     * - `'hyphenate'` is similar to `'always'`, but inserts a hyphen (`-`) if forced to wrap in the middle of a word.
     * - `'on-space'` will only wrap on white space. If there is no possibility to wrap a line on space and satisfy the tooltip dimensions, the text will be truncated.
     * - `'never'` disables text wrapping.
     *
     * Default: `'hyphenate'`
     */
    wrapping?: TextWrap;
}

export enum AgTooltipPositionType {
    POINTER = 'pointer',
    NODE = 'node',
    TOP = 'top',
    RIGHT = 'right',
    BOTTOM = 'bottom',
    LEFT = 'left',
    TOP_LEFT = 'top-left',
    TOP_RIGHT = 'top-right',
    BOTTOM_RIGHT = 'bottom-right',
    BOTTOM_LEFT = 'bottom-left',
}

export interface AgTooltipPositionOptions {
    /** The type of positioning for the tooltip. By default, the tooltip follows the mouse pointer for series without markers, and it is anchored to the highlighted marker node for series with markers. */
    type?: `${AgTooltipPositionType}`;
    /** The horizontal offset in pixels for the position of the tooltip. */
    xOffset?: PixelSize;
    /** The vertical offset in pixels for the position of the tooltip. */
    yOffset?: PixelSize;
}

export interface AgTooltipRendererResult {
    /** Title text for the tooltip header. */
    title?: string;
    /** Content text for the tooltip body. */
    content?: string;
    /** Tooltip title text colour. */
    color?: CssColor;
    /** Tooltip title background colour. */
    backgroundColor?: CssColor;
    /** Tooltip CSS class. */
    class?: CssColor;
}

export interface AgSeriesTooltipRendererParams<TDatum> extends AgChartCallbackParams<TDatum> {
    /** Series title or yName depending on series configuration. */
    readonly title?: string;
    /** Series primary colour, as selected from the active theme, series options or formatter. */
    readonly color?: CssColor;
}

export interface AgSeriesTooltip<TParams extends AgSeriesTooltipRendererParams<any>> {
    /** Whether to show tooltips when the series are hovered over. */
    enabled?: boolean;
    /** The tooltip arrow is displayed by default, unless the container restricts it or a position offset is provided. To always display the arrow, set `showArrow` to `true`. To remove the arrow, set `showArrow` to `false`.  */
    showArrow?: boolean;
    /** Range from a point that triggers the tooltip to show. Each series type uses its own default; typically this is `'nearest'` for marker-based series and `'exact'` for shape-based series. */
    range?: InteractionRange;
    /** The position of the tooltip. Each series type uses its own default; typically this is `'node'` for marker-based series and `'pointer'` for shape-based series. */
    position?: AgTooltipPositionOptions;
    /** Configuration for tooltip interaction. */
    interaction?: AgSeriesTooltipInteraction;
    /** Function used to create the content for tooltips. */
    renderer?: (params: TParams) => string | AgTooltipRendererResult;
}

export interface AgSeriesTooltipInteraction {
    /** Set to `true` to keep the tooltip open when the mouse is hovering over it, and enable clicking tooltip text */
    enabled: boolean;
}
