export function createTask(parentProject: string, srcRelativeInputPath: string) {
    const generatedExamplePath = `dist/generated-examples/${parentProject}/${srcRelativeInputPath}`;
    const dependsOn = ['generate-example', { projects: 'ag-charts-build-tools', target: 'build' }];

    return {
        'generate-thumbnail': {
            dependsOn,
            inputs: [{ env: 'PUBLIC_PACKAGE_VERSION' }],
            executor: 'ag-charts-build-tools:generate-chart-thumbnail',
            outputPath: '{options.outputPath}',
            cache: true,
            options: {
                mode: 'dev',
                generatedExamplePath,
                outputPath: `dist/generated-thumbnails/${parentProject}/${srcRelativeInputPath}`,
            },
        },
    };
}
