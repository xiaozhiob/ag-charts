import type { CreateDependencies, CreateNodes } from 'nx/src/utils/nx-plugin';
import { dirname } from 'path';

import * as generateChartThumbnails from './generate-chart-thumbnails';
import * as generateExampleFiles from './generate-example-files';

const PROJECTS = ['ag-charts-website'];
const NON_UNIQUE_PATH_ELEMENTS = ['src', 'content', 'docs', '_examples'];
const NON_UNIQUE_PATH_ELEMENTS_MAP = NON_UNIQUE_PATH_ELEMENTS.reduce((r, n) => {
    r[n] = true;
    return r;
}, {});

const IGNORE_THUMBNAILS = [
    // Too large to generate, isn't visible in the gallery either.
    'ag-charts-website-gallery_large-datasets_main.ts',
];

function generateThumbnails(projectName: string) {
    return projectName.indexOf('gallery') >= 0 && !IGNORE_THUMBNAILS.includes(projectName);
}

export const createNodes: CreateNodes = [
    'packages/*/src/**/_examples/*/main.ts',
    (configFilePath, options, context) => {
        const parentProject = PROJECTS.find((p) => configFilePath.startsWith(`packages/${p}`));

        if (!parentProject) {
            return {};
        }

        const uniqueName = configFilePath
            .split('/')
            .slice(2)
            .filter((p) => !NON_UNIQUE_PATH_ELEMENTS_MAP[p])
            .join('_');
        const parentPath = `packages/${parentProject}`;
        const examplePath = dirname(configFilePath).replace(`packages/${parentProject}/`, '{projectRoot}/');
        const projectRelativeInputPath = examplePath.split('/').slice(2).join('/');
        const srcRelativeInputPath = projectRelativeInputPath.split('/').slice(1).join('/');

        const projectName = `${parentProject}-${uniqueName}`;
        const thumbnails = generateThumbnails(projectName);
        return {
            projects: {
                [parentProject]: {
                    root: parentPath,
                    targets: {
                        'generate-examples': {
                            executor: 'nx:noop',
                            dependsOn: ['^generate-example'],
                        },
                        'generate-thumbnails': {
                            executor: 'nx:noop',
                            dependsOn: ['^generate-thumbnail'],
                        },
                    },
                },
                [projectName]: {
                    root: dirname(configFilePath),
                    tags: [`scope:${parentProject}`, 'type:generated-example'],
                    targets: {
                        ...generateExampleFiles.createTask(parentProject, srcRelativeInputPath),
                        ...(thumbnails ? generateChartThumbnails.createTask(parentProject, srcRelativeInputPath) : {}),
                    },
                },
            },
        };
    },
];

export const createDependencies: CreateDependencies = async (opts, ctx) => {
    return [...(await generateExampleFiles.createDependencies(opts, ctx))];
};
