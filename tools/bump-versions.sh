#!/bin/bash

# Usage:
# ./tools/bump-versions.sh 9.0.0-beta.7

set -eu

NEW_VERSION="$1"
TOOLS_DIR=$(dirname $0)

PACKAGES=(
    ag-charts
    ag-charts-community
    ag-charts-enterprise
    ag-charts-types
    ag-charts-locale
    ag-charts-angular
    ag-charts-react
    ag-charts-vue3
    ag-charts-test
    ag-charts-generate-example-files
    ag-charts-generate-code-reference-files
    ag-charts-generate-chart-thumbnail
)

for package in ${PACKAGES[@]}; do
    node ${TOOLS_DIR}/update-package-json-deps.js $package "$NEW_VERSION"
done

echo >./packages/ag-charts-community/src/version.ts "// DO NOT UPDATE MANUALLY: Generated from script during build time
export const VERSION = '${NEW_VERSION}';"

for envFile in ./packages/ag-charts-website/.env* ./.env ; do
    echo "Updating ${envFile}"
    if [[ $(uname) == "Darwin" ]] ; then
        sed -i "" -e '/PUBLIC_PACKAGE_VERSION=/ d' ${envFile}
    else
        sed -i"" -e '/PUBLIC_PACKAGE_VERSION=/ d' ${envFile}
    fi
    echo "PUBLIC_PACKAGE_VERSION=${NEW_VERSION}" >>${envFile}
done

# Update grid version
GRID_VERSION=$(node ${TOOLS_DIR}/calculate-grid-version.js "$NEW_VERSION")
node ${TOOLS_DIR}/update-grid-version.js "$GRID_VERSION"

# Ensure consistent package.json formatting.
npx prettier -w $(git status -s | grep package.json | awk '{ print $2 }')
