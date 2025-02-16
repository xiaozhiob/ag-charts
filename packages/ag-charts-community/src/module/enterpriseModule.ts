import type { AgChartOptions } from 'ag-charts-types';

import type { DOMManager } from '../dom/domManager';

export interface LicenseManager {
    setLicenseKey: (key?: string, gridContext?: boolean) => void;
    validateLicense: () => void;
    isDisplayWatermark: () => boolean;
    getWatermarkMessage: () => string;
    getLicenseDetails: (licenseKey: string) => object;
}

interface EnterpriseModuleOptions {
    isEnterprise: boolean;
    styles?: string;
    licenseManager?: (options: AgChartOptions) => LicenseManager;
    injectWatermark?: (domManager: DOMManager, text: string) => void;
}

export const enterpriseModule: EnterpriseModuleOptions = {
    isEnterprise: false,
};
