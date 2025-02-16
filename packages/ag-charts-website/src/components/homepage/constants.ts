import type { InternalFramework } from '@ag-grid-types';

import type { ExampleType } from '../examples-generator/types';

export const GALLERY_INTERNAL_FRAMEWORK: InternalFramework = 'vanilla';
export const GALLERY_EXAMPLE_TYPE: ExampleType = 'generated';

// Main file endpoint name for plain chart example
export const PLAIN_ENTRY_FILE_NAME = 'plain-main';

export const DEFAULT_THUMBNAIL_ASPECT_RATIO = 16 / 10;
export const DEFAULT_THUMBNAIL_WIDTH = 600;
export const DEFAULT_THUMBNAIL_HEIGHT = DEFAULT_THUMBNAIL_WIDTH / DEFAULT_THUMBNAIL_ASPECT_RATIO;
