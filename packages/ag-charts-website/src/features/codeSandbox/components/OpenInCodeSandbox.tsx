import type { InternalFramework } from '@ag-grid-types';
import { OpenInCTA } from '@components/open-in-cta/OpenInCTA';
import type { FileContents } from '@features/examples-generator/types';
import { fetchTextFile } from '@utils/fetchTextFile';
import type { FunctionComponent } from 'react';

import { createNewCodeSandbox, getCodeSandboxUrl } from '../utils/codeSandbox';

interface Props {
    title: string;
    internalFramework: InternalFramework;
    files: FileContents;
    htmlUrl: string;
    boilerPlateFiles?: FileContents;
    packageJson: Record<string, any>;
}

export const OpenInCodeSandbox: FunctionComponent<Props> = ({
    title,
    internalFramework,
    files,
    htmlUrl,
    boilerPlateFiles,
    packageJson,
}) => {
    return (
        <OpenInCTA
            type="codesandbox"
            onClick={async () => {
                const html = await fetchTextFile(htmlUrl);
                const sandboxFiles = {
                    ...files,
                    'package.json': JSON.stringify(packageJson, null, 2),
                    'index.html': html,
                };
                const { sandboxId } = await createNewCodeSandbox({
                    title,
                    files: sandboxFiles,
                    boilerPlateFiles,
                    internalFramework,
                });
                const url = getCodeSandboxUrl(sandboxId);
                if (url) {
                    window.open(url);
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('Error opening code sandbox url');
                }
            }}
        />
    );
};
