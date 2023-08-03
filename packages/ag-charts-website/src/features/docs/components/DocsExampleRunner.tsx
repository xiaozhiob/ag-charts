import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import type { ExampleOptions } from '../../example-runner/types';
import { getFrameworkFromInternalFramework } from '../../../utils/framework';
import { $internalFramework, updateInternalFrameworkBasedOnFramework } from '../../../stores/frameworkStore';
import type { Framework } from '../../../types/ag-grid';
import { OpenInPlunkr } from '../../plunkr/components/OpenInPlunkr';
import type { ExampleType } from '../../examples-generator/types';
import { ExampleRunner } from '../../example-runner/components/ExampleRunner';
import { getExampleContentsUrl, getExampleUrl, getExampleWithRelativePathUrl } from '../utils/urlPaths';

interface Props {
    name: string;
    title: string;
    exampleType?: ExampleType;
    options?: ExampleOptions;
    framework: Framework;
    pageName: string;
}

// NOTE: Not on the layout level, as that is generated at build time, and queryClient needs to be
// loaded on the client side
const queryClient = new QueryClient();

/**
 * Update the internal framework if it is different to the framework in the URL
 *
 * @param framework Framework from the URL
 */
function useUpdateInternalFrameworkFromFramework(framework: Framework) {
    const internalFramework = useStore($internalFramework);

    useEffect(() => {
        const frameworkFromInternalFramework = getFrameworkFromInternalFramework(internalFramework);
        if (frameworkFromInternalFramework !== framework) {
            updateInternalFrameworkBasedOnFramework(framework);
        }
    }, [internalFramework, framework]);
}

const queryOptions = {
    retry: 3,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
};

const DocsExampleRunnerInner = ({ name, title, exampleType, options, framework, pageName }: Props) => {
    const internalFramework = useStore($internalFramework);
    const [initialSelectedFile, setInitialSelectedFile] = useState();
    const [exampleUrl, setExampleUrl] = useState<string>();
    const [plunkrHtmlUrl, setPlunkrHtmlUrl] = useState<string>();
    const [exampleFiles, setExampleFiles] = useState();
    const [exampleBoilerPlateFiles, setExampleBoilerPlateFiles] = useState();

    const exampleName = name;
    const id = `example-${name}`;

    // NOTE: Plunkr only works for these internal frameworks for now
    const supportsPlunkr = [
        'vanilla',
        'typescript',
        'react',
        'reactFunctional',
        'reactFunctionalTs',
        'vue',
        'vue3',
    ].includes(internalFramework);

    const {
        isLoading: exampleFilesIsLoading,
        isError: exampleFilesIsError,
        data,
    } = useQuery(
        ['docsExampleFiles', internalFramework, pageName, exampleName],
        () =>
            fetch(
                getExampleContentsUrl({
                    internalFramework,
                    pageName,
                    exampleName,
                })
            ).then((res) => res.json()),
        queryOptions
    );

    const { data: exampleFileHtml } = useQuery(
        ['docsExampleHtml', internalFramework, pageName, exampleName],
        () =>
            fetch(
                getExampleUrl({
                    internalFramework,
                    pageName,
                    exampleName,
                })
            ).then((res) => res.text()),
        queryOptions
    );

    useEffect(() => {
        setExampleUrl(
            getExampleUrl({
                internalFramework,
                pageName,
                exampleName,
            })
        );
    }, [internalFramework, pageName, exampleName]);

    useEffect(() => {
        if (!data || exampleFilesIsLoading || exampleFilesIsError) {
            return;
        }
        setInitialSelectedFile(data?.entryFileName);
    }, [data, exampleFilesIsLoading, exampleFilesIsError]);

    useEffect(() => {
        setPlunkrHtmlUrl(
            getExampleWithRelativePathUrl({
                internalFramework,
                pageName,
                exampleName,
            })
        );
    }, [internalFramework, pageName, exampleName]);

    // Override `index.html` with generated file as
    // exampleFiles endpoint only gets the index html fragment
    useEffect(() => {
        if (!data || exampleFilesIsLoading || exampleFilesIsError || !exampleFileHtml) {
            return;
        }
        const files = {
            ...data.files,
            'index.html': exampleFileHtml,
        };

        setExampleFiles(files);
        setExampleBoilerPlateFiles(data.boilerPlateFiles);
    }, [data, exampleFilesIsLoading, exampleFilesIsError, exampleFileHtml]);

    useUpdateInternalFrameworkFromFramework(framework);

    const externalLinkButton =
        !options?.noPlunker && supportsPlunkr && plunkrHtmlUrl && exampleFiles ? (
            <OpenInPlunkr
                title={title}
                files={exampleFiles}
                plunkrHtmlUrl={plunkrHtmlUrl}
                boilerPlateFiles={exampleBoilerPlateFiles}
                fileToOpen={initialSelectedFile!}
                internalFramework={internalFramework}
                pageName={pageName}
                exampleName={exampleName}
            />
        ) : undefined;

    return (
        <ExampleRunner
            id={id}
            exampleUrl={exampleUrl}
            exampleType={exampleType}
            exampleHeight={options?.exampleHeight}
            exampleFiles={exampleFiles}
            initialShowCode={options?.showCode}
            initialSelectedFile={initialSelectedFile}
            internalFramework={internalFramework}
            externalLinkButton={externalLinkButton}
        />
    );
};

export const DocsExampleRunner = (props: Props) => {
    return (
        <QueryClientProvider client={queryClient}>
            <DocsExampleRunnerInner {...props} />
        </QueryClientProvider>
    );
};
