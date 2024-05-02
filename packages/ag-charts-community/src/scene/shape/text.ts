import type {
    FontFamily,
    FontSize,
    FontStyle,
    FontWeight,
    OverflowStrategy,
    TextWrap,
} from '../../options/chart/types';
import { memoizeFunction } from '../../util/memo';
import { type LineMetrics, TextMeasurerV2 } from '../../util/textMeasurer';
import { isString } from '../../util/type-guards';
import { BBox } from '../bbox';
import type { RenderContext } from '../node';
import { RedrawType, SceneChangeDetection } from '../node';
import { Shape } from './shape';

export interface TextSizeProperties {
    fontFamily?: FontFamily;
    fontSize?: FontSize;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    lineHeight?: number;
    textBaseline?: CanvasTextBaseline;
    textAlign?: CanvasTextAlign;
}

const ellipsis = '\u2026';

function SceneFontChangeDetection(opts?: { redraw?: RedrawType; changeCb?: (t: any) => any }) {
    const { redraw = RedrawType.MAJOR, changeCb } = opts ?? {};

    return SceneChangeDetection({ redraw, type: 'font', changeCb });
}

export class Text extends Shape {
    static readonly className = 'Text';

    // The default line spacing for document editors is usually 1.15
    static defaultLineHeightRatio = 1.15;

    static override defaultStyles = Object.assign({}, Shape.defaultStyles, {
        textAlign: 'start' as CanvasTextAlign,
        fontStyle: undefined,
        fontWeight: undefined,
        fontSize: 10,
        fontFamily: 'sans-serif',
        textBaseline: 'alphabetic' as CanvasTextBaseline,
    });

    static ellipsis = ellipsis;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    x: number = 0;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    y: number = 0;

    private lines: string[] = [];
    private onTextChange() {
        this.lines = this.text?.split('\n').map((s) => s.trim()) ?? [];
    }

    @SceneChangeDetection({ redraw: RedrawType.MAJOR, changeCb: (o: Text) => o.onTextChange() })
    text?: string = undefined;

    private _dirtyFont: boolean = true;
    private _font?: string;
    get font(): string {
        if (this._font == null || this._dirtyFont) {
            this._dirtyFont = false;
            this._font = getFont(this);
        }

        return this._font;
    }

    @SceneFontChangeDetection()
    fontStyle?: FontStyle;

    @SceneFontChangeDetection()
    fontWeight?: FontWeight;

    @SceneFontChangeDetection()
    fontSize?: number = 10;

    @SceneFontChangeDetection()
    fontFamily?: string = 'sans-serif';

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    textAlign: CanvasTextAlign = Text.defaultStyles.textAlign;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    textBaseline: CanvasTextBaseline = Text.defaultStyles.textBaseline;

    // TextMetrics are used if lineHeight is not defined.
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    lineHeight?: number;

    override computeBBox(): BBox {
        const { x, y, lines, textBaseline, textAlign } = this;
        const { offsetTop, offsetLeft, width, height } = TextMeasurerV2.measureText(lines, {
            font: getFont(this),
            textBaseline,
            textAlign,
        });
        return new BBox(x - offsetLeft, y - offsetTop, width, height);
    }

    private getLineHeight(line: string): number {
        return this.lineHeight ?? (TextMeasurerV2.measureText(line, this) as LineMetrics).lineHeight;
    }

    isPointInPath(x: number, y: number): boolean {
        const point = this.transformPoint(x, y);
        const bbox = this.computeBBox();

        return bbox ? bbox.containsPoint(point.x, point.y) : false;
    }

    override render(renderCtx: RenderContext): void {
        const { ctx, forceRender, stats } = renderCtx;

        if (this.dirty === RedrawType.NONE && !forceRender) {
            if (stats) stats.nodesSkipped += this.nodeCount.count;
            return;
        }

        if (!this.lines.length || !this.layerManager) {
            if (stats) stats.nodesSkipped += this.nodeCount.count;
            return;
        }

        this.computeTransformMatrix();
        this.matrix.toContext(ctx);

        const { fill, stroke, strokeWidth } = this;

        ctx.font = this.font;
        ctx.textAlign = this.textAlign;
        ctx.textBaseline = this.textBaseline;

        const pixelRatio = this.layerManager.canvas.pixelRatio || 1;
        const { globalAlpha } = ctx;

        if (fill) {
            ctx.fillStyle = fill;
            ctx.globalAlpha = globalAlpha * this.opacity * this.fillOpacity;

            const { fillShadow } = this;

            if (fillShadow?.enabled) {
                ctx.shadowColor = fillShadow.color;
                ctx.shadowOffsetX = fillShadow.xOffset * pixelRatio;
                ctx.shadowOffsetY = fillShadow.yOffset * pixelRatio;
                ctx.shadowBlur = fillShadow.blur * pixelRatio;
            }

            this.renderLines((line, x, y) => ctx.fillText(line, x, y));
        }

        if (stroke && strokeWidth) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = globalAlpha * this.opacity * this.strokeOpacity;

            const { lineDash, lineDashOffset, lineCap, lineJoin } = this;

            if (lineDash) {
                ctx.setLineDash(lineDash);
            }

            if (lineDashOffset) {
                ctx.lineDashOffset = lineDashOffset;
            }

            if (lineCap) {
                ctx.lineCap = lineCap;
            }

            if (lineJoin) {
                ctx.lineJoin = lineJoin;
            }

            this.renderLines((line, x, y) => ctx.strokeText(line, x, y));
        }

        super.render(renderCtx);
    }

    private renderLines(renderCallback: (line: string, x: number, y: number) => void): void {
        const { lines, x, y } = this;
        const lineHeights = lines.map((line) => this.getLineHeight(line));
        const totalHeight = lineHeights.reduce((a, b) => a + b, 0);
        let offsetY: number = (lineHeights[0] - totalHeight) * Text.getVerticalModifier(this.textBaseline);

        for (let i = 0; i < lines.length; i++) {
            renderCallback(lines[i], x, y + offsetY);

            offsetY += lineHeights[i];
        }
    }

    static wrapLines(
        text: string,
        maxWidth: number,
        maxHeight: number,
        textProps: TextSizeProperties,
        wrapping: TextWrap,
        overflow: OverflowStrategy
    ): string[] | undefined {
        const canOverflow = overflow !== 'hide';
        const measurer = new TextMeasurer(textProps);
        const lines: string[] = text.split(/\r?\n/g);

        if (lines.length === 0) {
            return;
        }
        if (wrapping === 'never') {
            const truncText = Text.truncateLine(lines[0], maxWidth, measurer, canOverflow ? 'auto' : 'never');
            return truncText != null ? [truncText] : undefined;
        }

        const wrappedLines: string[] = [];
        let cumulativeHeight = 0;
        for (const line of lines) {
            const wrappedLine = Text.wrapLine(
                line,
                maxWidth,
                maxHeight,
                measurer,
                textProps,
                wrapping,
                cumulativeHeight,
                canOverflow
            );

            if (wrappedLine == null) {
                return;
            }

            wrappedLines.push(...wrappedLine.result);
            cumulativeHeight = wrappedLine.cumulativeHeight;
            if (wrappedLine.truncated) break;
        }
        return wrappedLines;
    }

    static wrap(
        text: string,
        maxWidth: number,
        maxHeight: number,
        textProps: TextSizeProperties,
        wrapping: TextWrap,
        overflow: OverflowStrategy = 'ellipsis'
    ): string {
        const lines = Text.wrapLines(text, maxWidth, maxHeight, textProps, wrapping, overflow);
        return lines?.join('\n').trim() ?? '';
    }

    private static wrapLine(
        text: string,
        maxWidth: number,
        maxHeight: number,
        measurer: TextMeasurer,
        textProps: TextSizeProperties,
        wrapping: TextWrap,
        cumulativeHeight: number,
        canOverflow: boolean
    ): { result: string[]; truncated: boolean; cumulativeHeight: number } | undefined {
        text = text.trim();
        if (!text) {
            return { result: [], truncated: false, cumulativeHeight };
        }

        const initialSize = measurer.size(text);
        if (initialSize.width <= maxWidth) {
            // Text fits into a single line
            return {
                result: [text],
                truncated: false,
                cumulativeHeight: cumulativeHeight + initialSize.height,
            };
        }
        if (initialSize.height > maxHeight || measurer.width('W') > maxWidth) {
            // Not enough space for a single line or character
            return canOverflow ? { result: [], truncated: true, cumulativeHeight } : undefined;
        }

        const words = text.split(/\s+/g);
        const wrapResult = Text.wrapLineSequentially(
            words,
            maxWidth,
            maxHeight,
            measurer,
            textProps,
            wrapping,
            cumulativeHeight,
            canOverflow
        );

        if (wrapResult == null) {
            return;
        }

        cumulativeHeight = wrapResult.cumulativeHeight;

        let { lines } = wrapResult;
        if (!(wrapResult.wordsBrokenOrTruncated || wrapResult.linesTruncated)) {
            // If no word breaks or truncations, try the balanced wrapping
            const linesCount = wrapResult.lines.length;
            const balanced = Text.wrapLineBalanced(words, maxWidth, measurer, linesCount);
            if (balanced.length === lines.length) {
                // Some lines can't be balanced properly because of unusually long words
                lines = balanced;
            }
        }

        const wrappedText = lines.map((ln) => ln.join(' '));
        return { result: wrappedText, truncated: wrapResult.linesTruncated, cumulativeHeight };
    }

    private static punctuationMarks = ['.', ',', '-', ':', ';', '!', '?', `'`, '"', '(', ')'];

    private static breakWord(
        word: string,
        firstLineWidth: number,
        maxWidth: number,
        hyphens: boolean,
        measurer: TextMeasurer
    ): string[] {
        const isPunctuationAt = (index: number) => Text.punctuationMarks.includes(word[index]);
        const h = hyphens ? measurer.width('-') : 0;
        const breaks: number[] = [];
        let partWidth = 0;
        let p = 0;
        for (let i = 0; i < word.length; i++) {
            const c = word[i];
            const w = measurer.width(c);
            const limit = p === 0 ? firstLineWidth : maxWidth;
            if (partWidth + w + h > limit) {
                breaks.push(i);
                partWidth = 0;
                p++;
            }
            partWidth += w;
        }
        const parts: string[] = [];
        let start = 0;
        for (const index of breaks) {
            let part = word.substring(start, index);
            if (hyphens && part.length > 0 && !isPunctuationAt(index - 1) && !isPunctuationAt(index)) {
                part += '-';
            }
            parts.push(part);
            start = index;
        }
        parts.push(word.substring(start));
        return parts;
    }

    private static truncateLine(
        text: string,
        maxWidth: number,
        measurer: TextMeasurer,
        ellipsisMode: 'force' | 'never' | 'auto'
    ): string | undefined {
        text = text.trimEnd();

        const lineWidth = measurer.width(text);
        if (lineWidth > maxWidth && ellipsisMode === 'never') {
            return;
        } else if (lineWidth <= maxWidth && ellipsisMode !== 'force') {
            return text;
        }

        const ellipsisWidth = measurer.width(ellipsis);
        let trunc = text;
        let truncWidth = lineWidth;
        while (trunc.length > 0 && truncWidth + ellipsisWidth > maxWidth) {
            // Ensure there is no space between the ellipsis and last letter
            trunc = trunc.slice(0, -1).trimEnd();
            truncWidth = measurer.width(trunc);
        }
        if (truncWidth + ellipsisWidth <= maxWidth) {
            return `${trunc}${ellipsis}`;
        }
    }

    private static wrapLineSequentially(
        words: string[],
        maxWidth: number,
        maxHeight: number,
        measurer: TextMeasurer,
        textProps: TextSizeProperties,
        wrapping: TextWrap,
        cumulativeHeight: number,
        canOverflow: boolean
    ) {
        const { fontSize = 0, lineHeight = fontSize * Text.defaultLineHeightRatio } = textProps;
        const breakWord = wrapping === 'always' || wrapping === 'hyphenate';
        const hyphenate = wrapping === 'hyphenate';
        const spaceWidth = measurer.width(' ');

        let wordsBrokenOrTruncated = false;
        let linesTruncated = false;

        const lines: string[][] = [];
        let currentLine: string[] = [];
        let lineWidth = 0;

        const getReturnValue = () => ({
            lines,
            linesTruncated,
            wordsBrokenOrTruncated,
            cumulativeHeight,
        });

        const truncateLastLine = () => {
            if (!canOverflow) {
                return;
            }

            const lastLine = currentLine.join(' ');
            const text = Text.truncateLine(lastLine, maxWidth, measurer, 'force');
            if (text == null) {
                return;
            }

            currentLine.splice(0, currentLine.length, text);
            linesTruncated = true;
            return getReturnValue();
        };

        const addNewLine = () => {
            const expectedHeight = cumulativeHeight + lineHeight;
            if (expectedHeight >= maxHeight) {
                return false;
            }
            // Add new line
            currentLine = [];
            lineWidth = 0;
            cumulativeHeight = expectedHeight;
            lines.push(currentLine);
            return true;
        };

        if (!addNewLine()) {
            return truncateLastLine();
        }

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const wordWidth = measurer.width(word);
            const expectedSpaceWidth = currentLine.length === 0 ? 0 : spaceWidth;
            const expectedLineWidth = lineWidth + expectedSpaceWidth + wordWidth;

            if (expectedLineWidth <= maxWidth) {
                // If the word fits, add it to the current line
                currentLine.push(word);
                lineWidth = expectedLineWidth;
                continue;
            }

            if (wordWidth <= maxWidth) {
                // If the word is not too long, put it onto new line
                if (!addNewLine()) {
                    return truncateLastLine();
                }
                currentLine.push(word);
                lineWidth = wordWidth;
                continue;
            }

            // Handle a long word
            wordsBrokenOrTruncated = true;
            if (breakWord) {
                // Break the word into parts
                const availWidth = maxWidth - lineWidth - expectedSpaceWidth;
                const parts = Text.breakWord(word, availWidth, maxWidth, hyphenate, measurer);
                for (let p = 0; p < parts.length; p++) {
                    const part = parts[p];
                    part && currentLine.push(part);
                    if (p === parts.length - 1) {
                        lineWidth = measurer.width(part);
                    } else if (!addNewLine()) {
                        return truncateLastLine();
                    }
                }
            } else if (canOverflow) {
                // Truncate the word
                if (!addNewLine()) {
                    return truncateLastLine();
                }
                const text = Text.truncateLine(word, maxWidth, measurer, 'force');
                if (text == null) {
                    return;
                }
                currentLine.push(text);
                if (i < words.length - 1) {
                    linesTruncated = true;
                }
                break;
            } else {
                return;
            }
        }

        return getReturnValue();
    }

    private static wrapLineBalanced(words: string[], maxWidth: number, measurer: TextMeasurer, linesCount: number) {
        const totalWordsWidth = words.reduce((sum, w) => sum + measurer.width(w), 0);
        const spaceWidth = measurer.width(' ');
        const totalSpaceWidth = spaceWidth * (words.length - linesCount - 2);
        const averageLineWidth = (totalWordsWidth + totalSpaceWidth) / linesCount;

        const lines: string[][] = [];

        let currentLine: string[] = [];
        let lineWidth = measurer.width(words[0]);
        let newLine = true;
        for (const word of words) {
            const width = measurer.width(word);
            if (newLine) {
                // New line
                currentLine = [];
                currentLine.push(word);
                lineWidth = width;
                newLine = false;
                lines.push(currentLine);
                continue;
            }
            const expectedLineWidth = lineWidth + spaceWidth + width;
            if (expectedLineWidth <= averageLineWidth) {
                // Keep adding words to the line
                currentLine.push(word);
                lineWidth = expectedLineWidth;
            } else if (expectedLineWidth <= maxWidth) {
                // Add the last word to the line
                currentLine.push(word);
                newLine = true;
            } else {
                // Put the word onto the next line
                currentLine = [word];
                lineWidth = width;
                lines.push(currentLine);
            }
        }

        return lines;
    }

    setFont(props: TextSizeProperties) {
        this.fontFamily = props.fontFamily;
        this.fontSize = props.fontSize;
        this.fontStyle = props.fontStyle;
        this.fontWeight = props.fontWeight;
    }

    setAlign(props: { textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline }) {
        this.textAlign = props.textAlign;
        this.textBaseline = props.textBaseline;
    }

    protected static getVerticalModifier(textBaseline: CanvasTextBaseline): number {
        switch (textBaseline) {
            case 'top':
            case 'hanging':
                return 0;
            case 'bottom':
            case 'alphabetic':
            case 'ideographic':
                return 1;
            case 'middle':
                return 0.5;
        }
    }

    private static _measureText = memoizeFunction(
        ({
            text,
            font,
            textBaseline,
            textAlign,
        }: {
            text: string;
            font: string;
            textBaseline: CanvasTextBaseline;
            textAlign: CanvasTextAlign;
        }) => TextMeasurerV2.measureText(text, { font, textBaseline, textAlign })
    );

    private static _getTextSize = memoizeFunction(({ text, font }: { text: string; font: string }) =>
        TextMeasurerV2.measureText(text, { font })
    );

    static measureText(text: string, font: string, textBaseline: CanvasTextBaseline, textAlign: CanvasTextAlign) {
        return this._measureText({ text, font, textBaseline, textAlign });
    }

    /**
     * Returns the width and height of the measured text.
     * @param text The single-line text to measure.
     * @param font The font shorthand string.
     */
    static getTextSize(text: string, font: string) {
        return this._getTextSize({ text, font });
    }

    static getTextSizeMultiline(
        lines: string[],
        font: string,
        textBaseline: CanvasTextBaseline = Text.defaultStyles.textBaseline,
        textAlign: CanvasTextAlign = Text.defaultStyles.textAlign
    ): { top: number; left: number; width: number; height: number } {
        const r = TextMeasurerV2.measureText(lines, { font, textBaseline, textAlign });
        return { top: r.offsetTop, left: r.offsetLeft, width: r.width, height: r.height };
    }
}

export class TextMeasurer {
    protected font: string;

    constructor(font: string | TextSizeProperties) {
        this.font = isString(font) ? font : getFont(font);
    }

    size(text: string) {
        return TextMeasurerV2.measureText(text, { font: this.font });
    }

    width(text: string): number {
        return this.size(text).width;
    }
}

export function getFont(fontProps: TextSizeProperties): string {
    const { fontFamily, fontSize, fontStyle, fontWeight } = fontProps;
    return [fontStyle ?? '', fontWeight ?? '', fontSize + 'px', fontFamily].join(' ').trim();
}
