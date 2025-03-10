import { expect, test } from './fixture';
import { SELECTORS, dragCanvas, gotoExample, locateCanvas, setupIntrinsicAssertions, toExamplePageUrl } from './util';

test.describe('zoom', () => {
    setupIntrinsicAssertions();

    test('navigator', async ({ page }) => {
        const { url } = toExamplePageUrl('financial-charts-test', 'e2e-zoom-navigator', 'vanilla');

        await gotoExample(page, url);

        const { width } = await locateCanvas(page);
        let height = 0;
        const updateCanvasSize = async () => {
            const { height: newHeight } = await locateCanvas(page);
            height = newHeight;
        };

        await updateCanvasSize();

        const withoutNavigatorYAxisTop = { x: width - 30, y: height / 4 };
        const withoutNavigatorYAxisBottom = { x: width - 30, y: (height * 3) / 4 };

        const withoutNavigatorXAxisLeft = { x: width / 4, y: height - 10 };
        const withoutNavigatorXAxisRight = { x: (width * 3) / 4, y: height - 10 };

        const withNavigatorYAxisTop = { x: width - 30, y: height / 4 };
        const withNavigatorYAxisBottom = { x: width - 30, y: (height * 3) / 4 };

        const withNavigatorXAxisLeft = { x: (width * 3) / 4, y: height - 80 };
        const withNavigatorXAxisRight = { x: width / 4, y: height - 80 };

        // 1. Click the zoom-in button the floating zoom buttons
        await page.hover(SELECTORS.canvas, { position: { x: 100, y: height - 100 } });
        const zoomIn = await page.getByTitle('Zoom in');
        await zoomIn.click();
        await zoomIn.click();
        await zoomIn.click();
        await zoomIn.click();
        await zoomIn.click();
        await zoomIn.click();
        await expect(page).toHaveScreenshot('zoom-1-before-navigator-zoom-in.png', { animations: 'disabled' });

        // 2. Drag the y-axis with the navigator hidden to zoom in
        await dragCanvas(page, withoutNavigatorYAxisBottom, withoutNavigatorYAxisTop);
        await expect(page).toHaveScreenshot('zoom-2-before-navigator-drag-y-axis.png', { animations: 'disabled' });

        // Show navigator with minichart
        await page.locator('.toolbar button').getByText('Toggle Navigator').click();
        await updateCanvasSize();

        // 3. Drag the y-axis with the navigator visible to zoom in
        await dragCanvas(page, withNavigatorYAxisBottom, withNavigatorYAxisTop);
        await expect(page).toHaveScreenshot('zoom-3-with-navigator-drag-y-axis.png', { animations: 'disabled' });

        // 4. Drag the x-axis with the navigator visible to zoom in
        await dragCanvas(page, withNavigatorXAxisLeft, withNavigatorXAxisRight);
        await expect(page).toHaveScreenshot('zoom-4-with-navigator-drag-x-axis.png', { animations: 'disabled' });

        // Hide navigator
        await page.locator('.toolbar button').getByText('Toggle Navigator').click();
        await updateCanvasSize();

        // 5. Drag the y-axis twice with the navigator hidden again to zoom out
        await dragCanvas(page, withoutNavigatorYAxisTop, withoutNavigatorYAxisBottom);
        await dragCanvas(page, withoutNavigatorYAxisTop, withoutNavigatorYAxisBottom);
        await expect(page).toHaveScreenshot('zoom-5-after-navigator-drag-y-axis.png', { animations: 'disabled' });

        // 6. Drag the x-axis twice with the navigator hidden again to zoom out
        await dragCanvas(page, withoutNavigatorXAxisLeft, withoutNavigatorXAxisRight);
        await dragCanvas(page, withoutNavigatorXAxisLeft, withoutNavigatorXAxisRight);
        await expect(page).toHaveScreenshot('zoom-6-after-navigator-drag-x-axis.png', { animations: 'disabled' });
    });

    test('crosshairs', async ({ page }) => {
        const xAxisLabel = '.ag-crosshair-label[data-key="pointer"][data-axis-id="NumberAxis-2"]';
        const yAxisLabel = '.ag-crosshair-label[data-key="yKey"]';
        const { url } = toExamplePageUrl('zoom-test', 'e2e-zoom-crosshairs', 'vanilla');

        await gotoExample(page, url);

        const { canvas, width, height } = await locateCanvas(page);
        const midPoint = { x: Math.round(width / 2), y: Math.round(height / 2) };

        // Expect crosshairs to be visible on first hover.
        await canvas.hover({ position: midPoint });
        await expect(page.locator(xAxisLabel)).toBeVisible();
        await expect(page.locator(yAxisLabel)).toBeVisible();

        // Mousewheel to zoom should remove crosshairs.
        await page.mouse.wheel(0, -100);
        await expect(page.locator(xAxisLabel)).not.toBeVisible();
        await expect(page.locator(yAxisLabel)).not.toBeVisible();

        await expect(page).toHaveScreenshot('zoom-crosshairs-after-wheel-zoom.png', { animations: 'disabled' });

        // Expect crosshairs to become visible on second hover.
        await canvas.hover({ position: midPoint });
        await expect(page.locator(xAxisLabel)).toBeVisible();
        await expect(page.locator(yAxisLabel)).toBeVisible();

        // Drag canvas (pan zoom)
        await dragCanvas(page, midPoint, { x: midPoint.x + 50, y: midPoint.y });
        await expect(page.locator(xAxisLabel)).not.toBeVisible();
        await expect(page.locator(yAxisLabel)).not.toBeVisible();
    });

    test('AG-13166 zoom keynav focus-visible', async ({ page }) => {
        const { url } = toExamplePageUrl('financial-charts-configuration', 'default-configuration', 'vanilla');
        await gotoExample(page, url);
        await page.mouse.click(20, 20);

        await page.keyboard.type('+');
        await expect(page).toHaveScreenshot('zoom-pluskey-no-focus-visible.png', { animations: 'disabled' });
        await page.keyboard.type('-');
        await expect(page).toHaveScreenshot('zoom-minuskey-no-focus-visible.png', { animations: 'disabled' });

        await page.keyboard.press('ArrowLeft');
        await page.keyboard.type('+');
        await expect(page).toHaveScreenshot('zoom-pluskey-focus-visible.png', { animations: 'disabled' });
        await page.keyboard.type('-');
        await expect(page).toHaveScreenshot('zoom-minuskey-focus-visible.png', { animations: 'disabled' });
    });
});
