import type { AgChartThemePalette, AgPaletteColors } from 'ag-charts-types';

import type { SeriesOptionsTypes } from '../chart/mapping/types';

export type RequiredSeriesType = NonNullable<SeriesOptionsTypes['type']>;

export type PaletteType = 'inbuilt' | 'user-indexed' | 'user-full';

export function paletteType(partial?: AgChartThemePalette): PaletteType {
    if (partial?.up || partial?.down || partial?.neutral) {
        return 'user-full';
    } else if (partial?.fills || partial?.strokes) {
        return 'user-indexed';
    }
    return 'inbuilt';
}

export interface SeriesPaletteFactoryParams {
    takeColors: (count: number) => { fills: string[]; strokes: string[] };
    colorsCount: number;
    userPalette: PaletteType;
    palette: Required<AgChartThemePalette & { altUp: AgPaletteColors; altDown: AgPaletteColors }>;
    themeTemplateParameters: Map<string, string | string[]>;
}

export type SeriesPaletteFactory<SeriesOpts> = (params: SeriesPaletteFactoryParams) => SeriesPaletteOptions<SeriesOpts>;

type SeriesPaletteOptions<
    SeriesOpts,
    ColourKeys = 'stroke' | 'fill' | 'fills' | 'strokes' | 'colors',
    NestedKeys = 'marker' | 'calloutLine',
> = {
    [K in keyof SeriesOpts & ColourKeys]?: NonNullable<SeriesOpts[K]>;
} & {
    [K in keyof SeriesOpts & NestedKeys]?: {
        [K2 in keyof NonNullable<SeriesOpts[K]> & ColourKeys]?: NonNullable<NonNullable<SeriesOpts[K]>[K2]>;
    };
};
