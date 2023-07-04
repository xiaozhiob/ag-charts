import { _ModuleSupport, _Scale } from 'ag-charts-community';
import { AngleCategoryAxis } from './angleCategoryAxis';
import { ANGLE_CATEGORY_AXIS_THEME } from './angleCategoryAxisThemes';
import { AngleCrossLine } from './angleCrossLine';

export const AngleCategoryAxisModule: _ModuleSupport.AxisModule = {
    type: 'axis',
    optionsKey: 'axes[]',

    packageType: 'enterprise',
    chartTypes: ['polar'],

    identifier: 'angle-category',
    instanceConstructor: AngleCategoryAxis,
    optionConstructors: {
        'axes[].crossLines[]': AngleCrossLine,
    },
    themeTemplate: ANGLE_CATEGORY_AXIS_THEME,
};
