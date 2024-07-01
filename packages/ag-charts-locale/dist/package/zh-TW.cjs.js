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

// packages/ag-charts-locale/src/zh-TW.ts
var zh_TW_exports = {};
__export(zh_TW_exports, {
  AG_CHARTS_LOCALE_ZH_TW: () => AG_CHARTS_LOCALE_ZH_TW
});
module.exports = __toCommonJS(zh_TW_exports);
var AG_CHARTS_LOCALE_ZH_TW = {
  ariaAnnounceChart: "\u5716\u8868\uFF0C${seriesCount}[number] \u7CFB\u5217\uFF0C${caption}",
  ariaAnnounceFlowProportionLink: "\u9023\u7D50 ${index} / ${count}\uFF0C\u5F9E ${from} \u5230 ${to}\uFF0C${sizeName} ${size}",
  ariaAnnounceFlowProportionNode: "\u7BC0\u9EDE ${index} \u4E4B ${count}, ${description}",
  ariaAnnounceHidden: "\u96B1\u85CF",
  ariaAnnounceHierarchyDatum: "\u5C64\u7D1A ${level}[number]\uFF0C${count}[number] \u500B\u5B50\u9805\u76EE\uFF0C${description}",
  ariaAnnounceHoverDatum: "${datum}",
  ariaAnnounceVisible: "\u53EF\u898B",
  ariaLabelAnnotationOptionsToolbar: "\u8A3B\u89E3\u9078\u9805",
  ariaLabelAnnotationsToolbar: "\u8A3B\u91CB",
  ariaLabelLegend: "\u5716\u4F8B",
  ariaLabelLegendItem: "${label}\uFF0C\u5716\u4F8B\u9805\u76EE ${index}[number] \u5171 ${count}[number]\uFF0C",
  ariaLabelLegendItemUnknown: "\u672A\u77E5\u7684\u5716\u4F8B\u9805\u76EE",
  ariaLabelLegendPageNext: "\u4E0B\u4E00\u9801\u5716\u4F8B",
  ariaLabelLegendPagePrevious: "\u524D\u4E00\u5716\u4F8B\u9801\u9762",
  ariaLabelLegendPagination: "\u5716\u4F8B\u5206\u9801",
  ariaLabelNavigator: "\u5C0E\u822A\u5668",
  ariaLabelNavigatorMaximum: "\u6700\u5927\u503C",
  ariaLabelNavigatorMinimum: "\u6700\u5C0F",
  ariaLabelNavigatorRange: "\u7BC4\u570D",
  ariaLabelRangesToolbar: "\u7BC4\u570D",
  ariaLabelZoomToolbar: "\u7E2E\u653E",
  ariaValuePanRange: "${min}[percent] \u5230 ${max}[percent]",
  contextMenuDownload: "\u4E0B\u8F7D",
  contextMenuPanToCursor: "\u5E73\u79FB\u5230\u6B64\u8655",
  contextMenuToggleOtherSeries: "\u5207\u63DB\u5176\u4ED6\u7CFB\u5217",
  contextMenuToggleSeriesVisibility: "\u5207\u63DB\u53EF\u898B\u6027",
  contextMenuZoomToCursor: "\u7E2E\u653E\u81F3\u6B64",
  overlayLoadingData: "\u6B63\u5728\u8F09\u5165\u6578\u64DA...",
  overlayNoData: "\u6C92\u6709\u8CC7\u6599\u53EF\u986F\u793A",
  overlayNoVisibleSeries: "\u6C92\u6709\u53EF\u898B\u7684\u7CFB\u5217",
  toolbarAnnotationsClearAll: "\u6E05\u9664\u6240\u6709\u8A3B\u89E3",
  toolbarAnnotationsColor: "\u9078\u64C7\u8A3B\u89E3\u984F\u8272",
  toolbarAnnotationsDelete: "\u522A\u9664\u8A3B\u89E3",
  toolbarAnnotationsDisjointChannel: "\u4E0D\u76F8\u4EA4\u7684\u983B\u9053",
  toolbarAnnotationsHorizontalLine: "\u6C34\u5E73\u7DDA",
  toolbarAnnotationsLock: "\u9396\u5B9A\u8A3B\u89E3",
  toolbarAnnotationsParallelChannel: "\u5E73\u884C\u901A\u9053",
  toolbarAnnotationsTrendLine: "\u8DA8\u52E2\u7DDA",
  toolbarAnnotationsUnlock: "\u89E3\u9396\u8A3B\u89E3",
  toolbarAnnotationsVerticalLine: "\u5782\u76F4\u7DDA",
  toolbarRange1Month: "1\u500B\u6708",
  toolbarRange1MonthAria: "1\u500B\u6708",
  toolbarRange1Year: "1\u5E74",
  toolbarRange1YearAria: "1\u5E74",
  toolbarRange3Months: "3\u500B\u6708",
  toolbarRange3MonthsAria: "3\u500B\u6708",
  toolbarRange6Months: "6\u500B\u6708",
  toolbarRange6MonthsAria: "6\u500B\u6708",
  toolbarRangeAll: "\u5168\u90E8",
  toolbarRangeAllAria: "\u5168\u90E8",
  toolbarRangeYearToDate: "\u5E74\u521D\u81F3\u4ECA",
  toolbarRangeYearToDateAria: "\u4ECA\u5E74\u8FC4\u4ECA",
  toolbarZoomPanEnd: "\u79FB\u52D5\u5230\u7D50\u5C3E",
  toolbarZoomPanLeft: "\u5411\u5DE6\u5E73\u79FB",
  toolbarZoomPanRight: "\u5411\u53F3\u5E73\u79FB",
  toolbarZoomPanStart: "\u79FB\u52D5\u5230\u8D77\u9EDE",
  toolbarZoomReset: "\u91CD\u8A2D\u7E2E\u653E",
  toolbarZoomZoomIn: "\u653E\u5927",
  toolbarZoomZoomOut: "\u7E2E\u5C0F"
};
