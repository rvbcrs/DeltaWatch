/**
 * Price Extractor Module
 * Extracts product prices from web pages using various methods:
 * 1. JSON-LD structured data (schema.org Product)
 * 2. Open Graph meta tags
 * 3. Schema.org microdata
 * 4. Text pattern matching
 */
import type { Page } from 'playwright-core';
export interface ExtractedPrice {
    price: number;
    currency: string;
    source: 'json-ld' | 'og-meta' | 'microdata' | 'text-pattern';
    raw: string;
}
/**
 * Main function to extract price from a page
 * Tries multiple methods in order of reliability
 */
export declare function extractPrice(page: Page, elementText?: string): Promise<ExtractedPrice | null>;
/**
 * Format a price for display
 */
export declare function formatPrice(price: number, currency: string): string;
//# sourceMappingURL=priceExtractor.d.ts.map