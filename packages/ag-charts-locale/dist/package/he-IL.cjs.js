"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/ag-charts-locale/src/he-IL.ts
var he_IL_exports = {};
__export(he_IL_exports, {
  AG_CHARTS_LOCALE_HE_IL: () => AG_CHARTS_LOCALE_HE_IL
});
module.exports = __toCommonJS(he_IL_exports);
var AG_CHARTS_LOCALE_HE_IL = {
  ariaAnnounceChart: "\u05EA\u05E8\u05E9\u05D9\u05DD, ${seriesCount}[number] \u05E1\u05D3\u05E8\u05D5\u05EA, ${caption}",
  ariaAnnounceFlowProportionLink: "\u05E7\u05D9\u05E9\u05D5\u05E8 ${index} \u05DE\u05EA\u05D5\u05DA ${count}, \u05DE-${from} \u05DC-${to}, ${sizeName} ${size}",
  ariaAnnounceFlowProportionNode: "\u05E6\u05D5\u05DE\u05EA ${index} \u05DE\u05EA\u05D5\u05DA ${count}, ${description}",
  ariaAnnounceHidden: "\u05E0\u05E1\u05EA\u05E8",
  ariaAnnounceHierarchyDatum: "\u05E8\u05DE\u05D4 ${level}[number], ${count}[number] \u05D9\u05DC\u05D3\u05D9\u05DD, ${description}",
  ariaAnnounceHoverDatum: "${datum}",
  ariaAnnounceVisible: "\u05D2\u05DC\u05D5\u05D9",
  ariaLabelAnnotationOptionsToolbar: "\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05E2\u05E8\u05D5\u05EA",
  ariaLabelAnnotationsToolbar: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05E9\u05D5\u05DC\u05D9\u05D9\u05DD",
  ariaLabelLegend: "\u05DE\u05E7\u05E8\u05D0",
  ariaLabelLegendItem: "${label}, \u05E4\u05E8\u05D9\u05D8 \u05DE\u05E7\u05E8\u05D0 ${index}[number] \u05DE\u05EA\u05D5\u05DA ${count}[number], ",
  ariaLabelLegendItemUnknown: "\u05E4\u05E8\u05D9\u05D8 \u05D0\u05D2\u05D3\u05D4 \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2",
  ariaLabelLegendPageNext: "\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D0\u05D2\u05D3\u05D4 \u05D4\u05D1\u05D0",
  ariaLabelLegendPagePrevious: "\u05E2\u05DE\u05D5\u05D3 \u05DE\u05E7\u05E8\u05D0 \u05E7\u05D5\u05D3\u05DD",
  ariaLabelLegendPagination: "\u05E0\u05D5\u05D5\u05D8 \u05D1\u05D3\u05E4\u05D9 \u05D4\u05DE\u05E7\u05E8\u05D0",
  ariaLabelNavigator: "\u05E0\u05D5\u05D5\u05D8",
  ariaLabelNavigatorMaximum: "\u05DE\u05E7\u05E1\u05D9\u05DE\u05D5\u05DD",
  ariaLabelNavigatorMinimum: "\u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD",
  ariaLabelNavigatorRange: "\u05D8\u05D5\u05D5\u05D7",
  ariaLabelRangesToolbar: "\u05D8\u05D5\u05D5\u05D7\u05D9\u05DD",
  ariaLabelZoomToolbar: "\u05D6\u05D5\u05DD",
  ariaValuePanRange: "${min}[percent] \u05E2\u05D3 ${max}[percent]",
  contextMenuDownload: "\u05D4\u05D5\u05E8\u05D3",
  contextMenuPanToCursor: "\u05D4\u05E1\u05D8 \u05DC\u05E4\u05D4",
  contextMenuToggleOtherSeries: "\u05D4\u05D7\u05DC\u05E3 \u05E1\u05D3\u05E8\u05D5\u05EA \u05D0\u05D7\u05E8\u05D5\u05EA",
  contextMenuToggleSeriesVisibility: "\u05D4\u05D7\u05DC\u05E3 \u05E0\u05E8\u05D0\u05D5\u05EA",
  contextMenuZoomToCursor: "\u05D6\u05D5\u05DD \u05DC\u05DB\u05D0\u05DF",
  overlayLoadingData: "\u05D8\u05D5\u05E2\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD...",
  overlayNoData: "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DC\u05D4\u05E6\u05D2\u05D4",
  overlayNoVisibleSeries: "\u05D0\u05D9\u05DF \u05E1\u05D3\u05E8\u05D5\u05EA \u05D2\u05DC\u05D5\u05D9\u05D9\u05DD",
  toolbarAnnotationsClearAll: "\u05E0\u05E7\u05D4 \u05D0\u05EA \u05DB\u05DC \u05D4\u05D4\u05E2\u05E8\u05D5\u05EA",
  toolbarAnnotationsColor: "\u05D1\u05D7\u05E8 \u05E6\u05D1\u05E2 \u05D4\u05E2\u05E8\u05D4",
  toolbarAnnotationsDelete: "\u05DE\u05D7\u05E7 \u05D4\u05E2\u05E8\u05D4",
  toolbarAnnotationsDisjointChannel: "\u05E2\u05E8\u05D5\u05E5 \u05D1\u05DC\u05EA\u05D9 \u05DE\u05D7\u05D5\u05D1\u05E8",
  toolbarAnnotationsHorizontalLine: "\u05E7\u05D5 \u05D0\u05D5\u05E4\u05E7\u05D9",
  toolbarAnnotationsLock: "\u05E0\u05E2\u05DC \u05D4\u05E2\u05E8\u05D4",
  toolbarAnnotationsParallelChannel: "\u05E2\u05E8\u05D5\u05E5 \u05DE\u05E7\u05D1\u05D9\u05DC\u05D9",
  toolbarAnnotationsTrendLine: "\u05E7\u05D5 \u05DE\u05D2\u05DE\u05D4",
  toolbarAnnotationsUnlock: "\u05E9\u05D7\u05E8\u05E8 \u05D1\u05D9\u05D0\u05D5\u05E8",
  toolbarAnnotationsVerticalLine: "\u05E7\u05D5 \u05D0\u05E0\u05DB\u05D9",
  toolbarRange1Month: "1\u05D7",
  toolbarRange1MonthAria: "\u05D7\u05D5\u05D3\u05E9 \u05D0\u05D7\u05D3",
  toolbarRange1Year: "\u05E9\u05E0\u05D4",
  toolbarRange1YearAria: "\u05E9\u05E0\u05D4 \u05D0\u05D7\u05EA",
  toolbarRange3Months: "3 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD",
  toolbarRange3MonthsAria: "3 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD",
  toolbarRange6Months: "6\u05D7",
  toolbarRange6MonthsAria: "6 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD",
  toolbarRangeAll: "\u05D4\u05DB\u05DC",
  toolbarRangeAllAria: "\u05D4\u05DB\u05DC",
  toolbarRangeYearToDate: "\u05DE.\u05EA.\u05E9",
  toolbarRangeYearToDateAria: "\u05D4\u05E9\u05E0\u05D4 \u05E2\u05D3 \u05DB\u05D4",
  toolbarZoomPanEnd: "\u05D2\u05DC\u05D5\u05DC \u05DC\u05E1\u05D5\u05E3",
  toolbarZoomPanLeft: "\u05D4\u05D6\u05D6 \u05E9\u05DE\u05D0\u05DC\u05D4",
  toolbarZoomPanRight: "\u05D4\u05D6\u05D6 \u05D9\u05DE\u05D9\u05E0\u05D4",
  toolbarZoomPanStart: "\u05D4\u05D6\u05D6\u05D4 \u05DC\u05EA\u05D7\u05D9\u05DC\u05EA \u05D4\u05E6\u05D9\u05E8",
  toolbarZoomReset: "\u05D0\u05E4\u05E1 \u05D0\u05EA \u05D4\u05D6\u05D5\u05DD",
  toolbarZoomZoomIn: "\u05D4\u05EA\u05E7\u05E8\u05D1",
  toolbarZoomZoomOut: "\u05D4\u05EA\u05E7\u05E8\u05D1\u05D5\u05EA \u05D4\u05D7\u05D5\u05E6\u05D4"
};
