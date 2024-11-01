import type { AgChartTheme, AgChartThemeName } from 'ag-charts-types';

import { type ThemeMap, themes as themeFactories } from './chart/mapping/themes';

export { getChartTheme } from './chart/mapping/themes';
export { ChartTheme } from './chart/themes/chartTheme';
export * from './chart/themes/symbols';
export * from './chart/themes/constants';
export * from './chart/themes/util';
export * from './module/theme';

export const themes: Record<AgChartThemeName, AgChartTheme> = {} as any;

// AG-13304 - Lazy evaluation, so that module registries are initialized before this is used.
for (const theme of Object.keys(themeFactories) as (keyof ThemeMap)[]) {
    Object.defineProperty(themes, theme, {
        get() {
            return themeFactories[theme]?.();
        },
    });
}
