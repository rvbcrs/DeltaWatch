import type { BrowserContext } from 'playwright-core';
/**
 * Acquire a browser context from the pool
 */
export declare function acquireBrowser(): Promise<{
    context: BrowserContext;
    release: () => Promise<void>;
}>;
/**
 * Shutdown the browser pool
 */
export declare function shutdownPool(): Promise<void>;
/**
 * Get pool statistics
 */
export declare function getPoolStats(): {
    total: number;
    inUse: number;
    available: number;
    consecutiveErrors: number;
    healthy: boolean;
};
/**
 * Force reset the entire browser pool (emergency recovery)
 */
export declare function forceResetPool(): Promise<void>;
//# sourceMappingURL=browserPool.d.ts.map