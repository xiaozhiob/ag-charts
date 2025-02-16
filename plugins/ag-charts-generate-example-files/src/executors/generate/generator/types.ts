export type ExampleType = 'generated' | 'mixed' | 'typescript' | 'multi';

export type TransformTsFileExt = undefined | '.js' | '.tsx';

export interface ExampleSettings {
    enterprise?: boolean;
    skipContainerCheck?: boolean;
}

export type FileContents = Record<string, string>;

export type Layout = 'grid' | 'toolbar' | 'none';

export interface ExampleConfig {
    /**
     * Shadow DOM selector that the chart is inserted into
     */
    shadowDomSelector?: string;
    /**
     * iframe DOM selector that the chart is inserted into
     */
    iframeSelector?: string;
}

export interface GeneratedContents {
    files: FileContents;
    entryFileName: string;
    mainFileName: string;
    scriptFiles: string[];
    styleFiles: string[];
    htmlFiles: string[];
    isEnterprise: boolean;
    hasLocale: boolean;
    layout: Layout;
    sourceFileList: string[];
    boilerPlateFiles: FileContents;
    providedExamples: FileContents;
    generatedFiles: FileContents;
    packageJson: Record<string, any>;
    exampleConfig: ExampleConfig;
}

export type InternalFramework = 'vanilla' | 'typescript' | 'reactFunctional' | 'reactFunctionalTs' | 'angular' | 'vue3';

export const FRAMEWORKS: InternalFramework[] = [
    'vanilla',
    'typescript',
    'reactFunctional',
    'reactFunctionalTs',
    'angular',
    'vue3',
];
export const TYPESCRIPT_INTERNAL_FRAMEWORKS: InternalFramework[] = ['typescript', 'reactFunctionalTs', 'angular'];
