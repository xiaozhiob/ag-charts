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

// packages/ag-charts-locale/src/ja-JP.ts
var ja_JP_exports = {};
__export(ja_JP_exports, {
  AG_CHARTS_LOCALE_JA_JP: () => AG_CHARTS_LOCALE_JA_JP
});
module.exports = __toCommonJS(ja_JP_exports);
var AG_CHARTS_LOCALE_JA_JP = {
  ariaAnnounceChart: "\u30C1\u30E3\u30FC\u30C8\u3001${seriesCount}[number] \u30B7\u30EA\u30FC\u30BA\u3001${caption}",
  ariaAnnounceFlowProportionLink: "\u30EA\u30F3\u30AF ${index} / ${count}\u3001${from} \u304B\u3089 ${to} \u3078\u3001${sizeName} ${size}",
  ariaAnnounceFlowProportionNode: "\u30CE\u30FC\u30C9 ${index} / ${count}\u3001${description}",
  ariaAnnounceHidden: "\u975E\u8868\u793A",
  ariaAnnounceHierarchyDatum: "\u30EC\u30D9\u30EB ${level}[number]\u3001${count}[number] \u306E\u5B50\u4F9B\u3001${description}",
  ariaAnnounceHoverDatum: "${datum}\u306B\u30D5\u30A9\u30FC\u30AB\u30B9\u3057\u3066\u3044\u307E\u3059",
  ariaAnnounceVisible: "\u8868\u793A",
  ariaLabelAnnotationOptionsToolbar: "\u6CE8\u91C8\u30AA\u30D7\u30B7\u30E7\u30F3",
  ariaLabelAnnotationsToolbar: "\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3",
  ariaLabelLegend: "\u51E1\u4F8B",
  ariaLabelLegendItem: "${label}, \u51E1\u4F8B\u9805\u76EE ${index}[number] \u306E ${count}[number], ",
  ariaLabelLegendItemUnknown: "\u4E0D\u660E\u306A\u51E1\u4F8B\u9805\u76EE",
  ariaLabelLegendPageNext: "\u6B21\u306E\u51E1\u4F8B\u30DA\u30FC\u30B8",
  ariaLabelLegendPagePrevious: "\u524D\u306E\u51E1\u4F8B\u30DA\u30FC\u30B8",
  ariaLabelLegendPagination: "\u51E1\u4F8B\u30DA\u30FC\u30B8\u30CD\u30FC\u30B7\u30E7\u30F3",
  ariaLabelNavigator: "\u30CA\u30D3\u30B2\u30FC\u30BF\u30FC",
  ariaLabelNavigatorMaximum: "\u6700\u5927",
  ariaLabelNavigatorMinimum: "\u6700\u5C0F",
  ariaLabelNavigatorRange: "\u7BC4\u56F2",
  ariaLabelRangesToolbar: "\u7BC4\u56F2",
  ariaLabelZoomToolbar: "\u30BA\u30FC\u30E0",
  ariaValuePanRange: "${min}[percent] \u304B\u3089 ${max}[percent]",
  contextMenuDownload: "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9",
  contextMenuPanToCursor: "\u3053\u3053\u306B\u30D1\u30F3\u3059\u308B",
  contextMenuToggleOtherSeries: "\u4ED6\u306E\u30B7\u30EA\u30FC\u30BA\u3092\u5207\u308A\u66FF\u3048\u308B",
  contextMenuToggleSeriesVisibility: "\u8868\u793A\u3092\u5207\u308A\u66FF\u3048\u308B",
  contextMenuZoomToCursor: "\u3053\u3053\u306B\u30BA\u30FC\u30E0",
  overlayLoadingData: "\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D...",
  overlayNoData: "\u8868\u793A\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
  overlayNoVisibleSeries: "\u8868\u793A\u53EF\u80FD\u306A\u30B7\u30EA\u30FC\u30BA\u304C\u3042\u308A\u307E\u305B\u3093",
  toolbarAnnotationsClearAll: "\u3059\u3079\u3066\u306E\u6CE8\u91C8\u3092\u30AF\u30EA\u30A2",
  toolbarAnnotationsColor: "\u6CE8\u91C8\u306E\u8272\u3092\u9078\u629E",
  toolbarAnnotationsDelete: "\u6CE8\u91C8\u3092\u524A\u9664",
  toolbarAnnotationsDisjointChannel: "\u975E\u9023\u7D50\u30C1\u30E3\u30CD\u30EB",
  toolbarAnnotationsHorizontalLine: "\u6C34\u5E73\u7DDA",
  toolbarAnnotationsLock: "\u6CE8\u91C8\u3092\u30ED\u30C3\u30AF",
  toolbarAnnotationsParallelChannel: "\u5E73\u884C\u30C1\u30E3\u30CD\u30EB",
  toolbarAnnotationsTrendLine: "\u30C8\u30EC\u30F3\u30C9\u30E9\u30A4\u30F3",
  toolbarAnnotationsUnlock: "\u6CE8\u91C8\u306E\u30ED\u30C3\u30AF\u3092\u89E3\u9664",
  toolbarAnnotationsVerticalLine: "\u5782\u76F4\u7DDA",
  toolbarRange1Month: "1\u304B\u6708",
  toolbarRange1MonthAria: "1\u304B\u6708",
  toolbarRange1Year: "1\u5E74",
  toolbarRange1YearAria: "1\u5E74",
  toolbarRange3Months: "3\u30F6\u6708",
  toolbarRange3MonthsAria: "3\u30F6\u6708",
  toolbarRange6Months: "6\u30F6\u6708",
  toolbarRange6MonthsAria: "6\u304B\u6708",
  toolbarRangeAll: "\u3059\u3079\u3066",
  toolbarRangeAllAria: "\u3059\u3079\u3066",
  toolbarRangeYearToDate: "\u5E74\u521D\u6765",
  toolbarRangeYearToDateAria: "\u5E74\u521D\u6765",
  toolbarZoomPanEnd: "\u6700\u5F8C\u307E\u3067\u30D1\u30F3",
  toolbarZoomPanLeft: "\u5DE6\u306B\u30D1\u30F3",
  toolbarZoomPanRight: "\u53F3\u306B\u30D1\u30F3",
  toolbarZoomPanStart: "\u6700\u521D\u306B\u30D1\u30F3\u3059\u308B",
  toolbarZoomReset: "\u30BA\u30FC\u30E0\u3092\u30EA\u30BB\u30C3\u30C8",
  toolbarZoomZoomIn: "\u30BA\u30FC\u30E0\u30A4\u30F3",
  toolbarZoomZoomOut: "\u30BA\u30FC\u30E0\u30A2\u30A6\u30C8"
};
