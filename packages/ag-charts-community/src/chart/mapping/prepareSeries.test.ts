import { describe, expect, test } from '@jest/globals';
import 'jest-canvas-mock';

import type { AgAreaSeriesOptions, AgBarSeriesOptions, AgLineSeriesOptions } from '../../options/agChartOptions';
import { clearDoOnceFlags } from '../../util/function';

function switchSeriesType(
    type: 'bar' | 'line' | 'area',
    series: AgBarSeriesOptions | AgLineSeriesOptions | AgAreaSeriesOptions
): AgBarSeriesOptions | AgLineSeriesOptions | AgAreaSeriesOptions {
    return {
        ...series,
        type,
    } as any;
}

const baseSeriesIPhone = {
    xKey: 'quarter',
    yKey: 'iphone',
    yName: 'IPhone',
};
const baseSeriesMac = {
    xKey: 'quarter',
    yKey: 'mac',
    yName: 'Mac',
};
const baseSeriesWearables = {
    xKey: 'quarter',
    yKey: 'wearables',
    yName: 'Wearables',
};
const baseSeriesServices = {
    xKey: 'quarter',
    yKey: 'services',
    yName: 'Services',
};

const colSeriesIPhone = switchSeriesType('bar', baseSeriesIPhone);
const colSeriesMac = switchSeriesType('bar', baseSeriesMac);
const colSeriesWearables = switchSeriesType('bar', baseSeriesWearables);
const colSeriesServices = switchSeriesType('bar', baseSeriesServices);
const lineSeriesIPhone = switchSeriesType('line', baseSeriesIPhone);
const lineSeriesMac = switchSeriesType('line', baseSeriesMac);
const areaSeriesIPhone = switchSeriesType('area', baseSeriesIPhone);
const areaSeriesMac = switchSeriesType('area', baseSeriesMac);
const areaSeriesWearables = switchSeriesType('area', baseSeriesWearables);
const areaSeriesServices = switchSeriesType('area', baseSeriesServices);

const seriesOptions: Array<AgBarSeriesOptions | AgLineSeriesOptions | AgAreaSeriesOptions> = [
    {
        ...colSeriesIPhone,
        fill: 'pink',
        showInLegend: true,
    } as AgBarSeriesOptions,
    lineSeriesMac,
    {
        ...colSeriesMac,
        fill: 'red',
        showInLegend: false,
    } as AgBarSeriesOptions,
    lineSeriesIPhone,
    {
        ...colSeriesWearables,
        showInLegend: true,
        grouped: true,
    } as AgBarSeriesOptions,
    {
        ...colSeriesServices,
        showInLegend: false,
        grouped: true,
    } as AgBarSeriesOptions,
];

const areas = [areaSeriesIPhone, areaSeriesMac, areaSeriesWearables, areaSeriesServices];
const lines = [lineSeriesIPhone, lineSeriesMac];
const columns = [colSeriesIPhone, colSeriesMac, colSeriesWearables, colSeriesServices];
const rangeColumns = [
    {
        type: 'range-bar',
        xKey: 'date',
        yLowKey: 'low',
        yHighKey: 'high',
    },
    {
        type: 'range-bar',
        xKey: 'date',
        yLowKey: 'low2',
        yHighKey: 'high2',
    },
];

const nightingales = [
    {
        type: 'nightingale',
        angleKey: 'product',
        radiusKey: 'A sales',
    },
    {
        type: 'nightingale',
        angleKey: 'product',
        radiusKey: 'B sales',
    },
];

describe.skip('prepareSeries', () => {
    beforeEach(() => {
        console.warn = jest.fn();
        clearDoOnceFlags();
    });

    test('to remove', () => {
        expect(true).toBe(true);
    });

    // test('groupSeriesByType', () => {
    //     const result = groupSeriesByType(seriesOptions);
    //
    //     expect(result).toMatchInlineSnapshot(`
    //         [
    //           {
    //             "opts": [
    //               {
    //                 "fill": "pink",
    //                 "showInLegend": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //             ],
    //             "type": "ungrouped",
    //           },
    //           {
    //             "opts": [
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //             ],
    //             "type": "ungrouped",
    //           },
    //           {
    //             "opts": [
    //               {
    //                 "fill": "red",
    //                 "showInLegend": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //             ],
    //             "type": "ungrouped",
    //           },
    //           {
    //             "opts": [
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //             ],
    //             "type": "ungrouped",
    //           },
    //           {
    //             "opts": [
    //               {
    //                 "grouped": true,
    //                 "showInLegend": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "wearables",
    //                 "yName": "Wearables",
    //               },
    //               {
    //                 "grouped": true,
    //                 "showInLegend": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "services",
    //                 "yName": "Services",
    //               },
    //             ],
    //             "type": "group",
    //           },
    //         ]
    //     `);
    // });

    // describe('#processSeriesOptions', () => {
    //     describe('Stacking and grouping configuration combinations', () => {
    //         const seriesTypes = {
    //             area: { stackable: true, groupable: false, stackedByDefault: false },
    //             bar: { stackable: true, groupable: true, stackedByDefault: false },
    //             line: { stackable: false, groupable: false, stackedByDefault: false },
    //             nightingale: { stackable: true, groupable: true, stackedByDefault: true },
    //             'range-bar': { stackable: false, groupable: true, stackedByDefault: false },
    //         };
    //
    //         const seriesOptionsMap: Record<keyof typeof seriesTypes, any[]> = {
    //             area: areas,
    //             bar: columns,
    //             line: lines,
    //             nightingale: nightingales,
    //             'range-bar': rangeColumns,
    //         };
    //
    //         Object.entries(seriesTypes).forEach(([seriesType, { stackable, groupable, stackedByDefault }]) => {
    //             if (stackable) {
    //                 addStackableSeriesType(seriesType as SeriesType);
    //             }
    //             if (groupable) {
    //                 addGroupableSeriesType(seriesType as SeriesType);
    //             }
    //             if (stackedByDefault) {
    //                 addStackedByDefaultSeriesType(seriesType as SeriesType);
    //             }
    //         });
    //
    //         beforeEach(() => {
    //             console.warn = jest.fn();
    //         });
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle stacked property 'true' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, stacked: true }))
    //                 );
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = stackable;
    //                 const grouped = !stacked && groupable;
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(undefined);
    //                         expect(s.stacked).toBe(true);
    //                     }
    //                     if (!stackable) {
    //                         expect(console.warn).toHaveBeenCalledWith(
    //                             `AG Charts - unsupported stacking of series type: ${sType}`
    //                         );
    //                     } else {
    //                         expect(console.warn).not.toHaveBeenCalled();
    //                     }
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle stacked property 'false' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, stacked: false }))
    //                 );
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = false;
    //                 const grouped = !stacked && groupable;
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(undefined);
    //                         expect(s.stacked).toBe(false);
    //                     }
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             'handle omitted stacked property for series type [%s] appropriately',
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, stacked: undefined }))
    //                 );
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = seriesTypes[sType].stackedByDefault;
    //                 const grouped = !stacked && groupable;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(undefined);
    //                         expect(s.stacked).toBe(undefined);
    //                     }
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'true' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: true }))
    //                 );
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stackedByDefault = seriesTypes[sType].stackedByDefault;
    //                 const stacked = !groupable && stackedByDefault;
    //                 const grouped = groupable;
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(true);
    //                         expect(s.stacked).toBe(undefined);
    //                     }
    //                     if (!groupable) {
    //                         expect(console.warn).toHaveBeenCalledWith(
    //                             `AG Charts - unsupported grouping of series type: ${sType}`
    //                         );
    //                     } else {
    //                         expect(console.warn).not.toHaveBeenCalled();
    //                     }
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'false' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: false }))
    //                 );
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stackedByDefault = seriesTypes[sType].stackedByDefault;
    //                 const stacked = stackable && stackedByDefault;
    //                 const grouped = false;
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(false);
    //                         expect(s.stacked).toBe(undefined);
    //                     }
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             'handle omitted grouped property for series type [%s] appropriately',
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: undefined }))
    //                 );
    //
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = seriesTypes[sType].stackedByDefault;
    //                 const grouped = groupable ? !stacked : false;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(undefined);
    //                         expect(s.stacked).toBe(undefined);
    //                     }
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'true', stacked property 'true' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: true, stacked: true }))
    //                 );
    //
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stacked = stackable;
    //                 const grouped = !stacked;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(true);
    //                         expect(s.stacked).toBe(true);
    //                     }
    //                     if (groupable && stackable) {
    //                         expect(console.warn).not.toHaveBeenCalled();
    //                     } else {
    //                         if (!groupable) {
    //                             expect(console.warn).toHaveBeenCalledWith(
    //                                 `AG Charts - unsupported grouping of series type: ${sType}`
    //                             );
    //                         }
    //                         if (!stackable) {
    //                             expect(console.warn).toHaveBeenCalledWith(
    //                                 `AG Charts - unsupported stacking of series type: ${sType}`
    //                             );
    //                         }
    //                     }
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'false', stacked property 'false' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: false, stacked: false }))
    //                 );
    //
    //                 const stacked = false;
    //                 const grouped = false;
    //
    //                 result.forEach((s) => {
    //                     expect(s.grouped).toBe(grouped);
    //                     expect(s.stacked).toBe(stacked);
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'true', stacked property 'false' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: true, stacked: false }))
    //                 );
    //
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stacked = false;
    //                 const grouped = groupable;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(true);
    //                         expect(s.stacked).toBe(false);
    //                     }
    //                     if (!groupable) {
    //                         expect(console.warn).toHaveBeenCalledWith(
    //                             `AG Charts - unsupported grouping of series type: ${sType}`
    //                         );
    //                     } else {
    //                         expect(console.warn).not.toHaveBeenCalled();
    //                     }
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             "handle grouped property 'false', stacked property 'true' for series type [%s] appropriately",
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: false, stacked: true }))
    //                 );
    //
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = stackable;
    //                 const grouped = false;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(false);
    //                         expect(s.stacked).toBe(true);
    //                     }
    //                     if (!stackable) {
    //                         expect(console.warn).toHaveBeenCalledWith(
    //                             `AG Charts - unsupported stacking of series type: ${sType}`
    //                         );
    //                     } else {
    //                         expect(console.warn).not.toHaveBeenCalled();
    //                     }
    //                 });
    //             }
    //         );
    //
    //         it.each(Object.keys(seriesTypes))(
    //             'handle omitted grouped and stacked properties for series type [%s] appropriately',
    //             (seriesType) => {
    //                 const sType = seriesType as keyof typeof seriesTypes;
    //                 const sOptions = seriesOptionsMap[sType];
    //                 const result: typeof sOptions = processSeriesOptions(
    //                     sOptions.map((s) => ({ ...s, grouped: undefined, stacked: undefined }))
    //                 );
    //
    //                 const groupable = seriesTypes[sType].groupable;
    //                 const stackable = seriesTypes[sType].stackable;
    //                 const stacked = seriesTypes[sType].stackedByDefault;
    //                 const grouped = groupable ? !stacked : false;
    //
    //                 result.forEach((s) => {
    //                     if (groupable || stackable) {
    //                         expect(s.grouped).toBe(grouped);
    //                         expect(s.stacked).toBe(stacked);
    //                     } else {
    //                         expect(s.grouped).toBe(undefined);
    //                         expect(s.stacked).toBe(undefined);
    //                     }
    //                     expect(console.warn).not.toHaveBeenCalled();
    //                 });
    //             }
    //         );
    //     });
    //
    //     test('processSeriesOptions', () => {
    //         const result = processSeriesOptions(seriesOptions);
    //
    //         expect(result).toMatchInlineSnapshot(`
    //             [
    //               {
    //                 "fill": "pink",
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 0,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //               {
    //                 "fill": "red",
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 1,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 2,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "wearables",
    //                 "yName": "Wearables",
    //               },
    //               {
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 3,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "services",
    //                 "yName": "Services",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //             ]
    //         `);
    //     });
    //
    //     test('processSeriesOptions with grouped columns', () => {
    //         const result = processSeriesOptions(
    //             seriesOptions.map((s) => (s.type === 'bar' ? { ...s, grouped: true } : s))
    //         );
    //
    //         expect(result).toMatchInlineSnapshot(`
    //             [
    //               {
    //                 "fill": "pink",
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 0,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //               {
    //                 "fill": "red",
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 1,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 2,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "wearables",
    //                 "yName": "Wearables",
    //               },
    //               {
    //                 "grouped": true,
    //                 "seriesGrouping": {
    //                   "groupCount": 4,
    //                   "groupIndex": 3,
    //                   "stackCount": 0,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": false,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "services",
    //                 "yName": "Services",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //             ]
    //         `);
    //     });
    //
    //     test('processSeriesOptions with stacked columns', () => {
    //         const result = processSeriesOptions(
    //             seriesOptions.map((s) => (s.type === 'bar' ? { ...s, stacked: true, grouped: undefined } : s))
    //         );
    //
    //         expect(result).toMatchInlineSnapshot(`
    //             [
    //               {
    //                 "fill": "pink",
    //                 "grouped": false,
    //                 "seriesGrouping": {
    //                   "groupCount": 1,
    //                   "groupIndex": 0,
    //                   "stackCount": 4,
    //                   "stackIndex": 0,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //               {
    //                 "fill": "red",
    //                 "grouped": false,
    //                 "seriesGrouping": {
    //                   "groupCount": 1,
    //                   "groupIndex": 0,
    //                   "stackCount": 4,
    //                   "stackIndex": 1,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "grouped": false,
    //                 "seriesGrouping": {
    //                   "groupCount": 1,
    //                   "groupIndex": 0,
    //                   "stackCount": 4,
    //                   "stackIndex": 2,
    //                 },
    //                 "showInLegend": true,
    //                 "stacked": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "wearables",
    //                 "yName": "Wearables",
    //               },
    //               {
    //                 "grouped": false,
    //                 "seriesGrouping": {
    //                   "groupCount": 1,
    //                   "groupIndex": 0,
    //                   "stackCount": 4,
    //                   "stackIndex": 3,
    //                 },
    //                 "showInLegend": false,
    //                 "stacked": true,
    //                 "type": "bar",
    //                 "xKey": "quarter",
    //                 "yKey": "services",
    //                 "yName": "Services",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "mac",
    //                 "yName": "Mac",
    //               },
    //               {
    //                 "type": "line",
    //                 "xKey": "quarter",
    //                 "yKey": "iphone",
    //                 "yName": "IPhone",
    //               },
    //             ]
    //         `);
    //     });
    // });
});
