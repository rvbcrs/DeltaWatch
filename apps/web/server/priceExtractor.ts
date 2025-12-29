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
    raw: string; // Original string for debugging
    selector?: string; // CSS Selector if found via DOM
}

/* ... existing code ... */



// Currency symbols to currency codes
const CURRENCY_MAP: Record<string, string> = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
    '¥': 'JPY',
    'CHF': 'CHF',
    'kr': 'SEK',
    'zł': 'PLN',
};

/**
 * Parse a price string like "€ 89,99" or "$149.00" into a number
 */
function parsePrice(priceStr: string): { price: number; currency: string } | null {
    if (!priceStr || typeof priceStr !== 'string') return null;
    
    // Clean the string
    let cleaned = priceStr.trim();
    
    // Find currency
    let currency = 'EUR'; // Default
    for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
        if (cleaned.includes(symbol)) {
            currency = code;
            cleaned = cleaned.replace(symbol, '');
            break;
        }
    }
    
    // Also check for currency codes like "EUR", "USD"
    const currencyCodeMatch = cleaned.match(/\b(EUR|USD|GBP|CHF|SEK|PLN|JPY)\b/i);
    if (currencyCodeMatch) {
        currency = currencyCodeMatch[1].toUpperCase();
        cleaned = cleaned.replace(currencyCodeMatch[0], '');
    }
    
    // Remove all non-numeric characters except . and ,
    cleaned = cleaned.replace(/[^\d.,]/g, '').trim();
    
    if (!cleaned) return null;
    
    // Handle European format (1.234,56) vs US format (1,234.56)
    // If comma comes after period, it's European format
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');
    
    let price: number;
    if (lastComma > lastPeriod) {
        // European format: 1.234,56 -> 1234.56
        price = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
        // US format: 1,234.56 -> 1234.56
        price = parseFloat(cleaned.replace(/,/g, ''));
    }
    
    if (isNaN(price) || price <= 0) return null;
    
    return { price, currency };
}

/**
 * Collect all valid price candidates from an offer object, recursively checking nested offers
 */
function collectPriceCandidates(offer: any, depth = 0): { priority: number, result: ExtractedPrice }[] {
    if (depth > 5) return []; // Prevent infinite recursion
    
    const candidates: { priority: number, result: ExtractedPrice }[] = [];

    // Log the offer we are inspecting
    console.log(`[PriceExtractor] Inspecting offer (depth ${depth}, type: ${offer['@type']}): price=${offer.price}, lowPrice=${offer.lowPrice}`);

    // 1. Check standard price field (Highest Priority)
    if (offer.price !== undefined && offer.price !== null) {
        const priceNum = typeof offer.price === 'string' 
            ? parseFloat(offer.price) 
            : offer.price;
        if (!isNaN(priceNum) && priceNum > 0) {
            candidates.push({
                priority: 1, // Highest priority
                result: {
                    price: priceNum,
                    currency: offer.priceCurrency || 'EUR',
                    source: 'json-ld',
                    raw: `${offer.priceCurrency || '€'}${offer.price}`
                }
            });
        }
    }
    
    // 2. Check priceSpecification
    if (offer.priceSpecification) {
        const spec = Array.isArray(offer.priceSpecification) 
            ? offer.priceSpecification[0] 
            : offer.priceSpecification;
        if (spec?.price) {
            const priceNum = typeof spec.price === 'string' 
                ? parseFloat(spec.price) 
                : spec.price;
            if (!isNaN(priceNum) && priceNum > 0) {
                candidates.push({
                    priority: 2, // Second highest
                    result: {
                        price: priceNum,
                        currency: spec.priceCurrency || offer.priceCurrency || 'EUR',
                        source: 'json-ld',
                        raw: `${spec.priceCurrency || '€'}${spec.price}`
                    }
                });
            }
        }
    }
    
    // 3. Check AggregateOffer
    if (offer['@type'] === 'AggregateOffer' || offer.lowPrice) {
        // Try highPrice (if high=low)
        if (offer.highPrice !== undefined && offer.highPrice === offer.lowPrice) {
            const priceNum = typeof offer.highPrice === 'string' 
                ? parseFloat(offer.highPrice) 
                : offer.highPrice;
            if (!isNaN(priceNum) && priceNum > 0) {
                    candidates.push({
                    priority: 3,
                    result: {
                        price: priceNum,
                        currency: offer.priceCurrency || 'EUR',
                        source: 'json-ld',
                        raw: `${offer.priceCurrency || '€'}${offer.highPrice}`
                    }
                });
            }
        }
        
        // LowPrice (Last resort for Product, but okay)
        if (offer.lowPrice !== undefined) {
            const priceNum = typeof offer.lowPrice === 'string' 
                ? parseFloat(offer.lowPrice) 
                : offer.lowPrice;
            if (!isNaN(priceNum) && priceNum > 0) {
                candidates.push({
                    priority: 4, // Lowest priority for JSON-LD
                    result: {
                        price: priceNum,
                        currency: offer.priceCurrency || 'EUR',
                        source: 'json-ld',
                        raw: `${offer.priceCurrency || '€'}${offer.lowPrice}`
                    }
                });
            }
        }
    }

    // 4. Recurse into nested offers
    if (offer.offers) {
        const nested = Array.isArray(offer.offers) ? offer.offers : [offer.offers];
        for (const nestedOffer of nested) {
            candidates.push(...collectPriceCandidates(nestedOffer, depth + 1));
        }
    }

    return candidates;
}

/**
 * Extract price from JSON-LD structured data
 */
async function extractFromJsonLd(page: Page): Promise<ExtractedPrice | null> {
    try {
        const jsonLdData = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const results: any[] = [];
            
            scripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent || '');
                    results.push(data);
                } catch (e) {}
            });
            
            return results;
        });
        
        console.log(`[PriceExtractor] Found ${jsonLdData.length} JSON-LD blocks`);
        
        for (const data of jsonLdData) {
            // Handle arrays
            const items = Array.isArray(data) ? data : [data];
            
            for (const item of items) {
                console.log(`[PriceExtractor] JSON-LD item @type: ${item['@type']}`);
                
                // Determine if this is a Product or ProductGroup
                const isProduct = item['@type'] === 'Product';
                const isProductGroup = item['@type'] === 'ProductGroup';
                const isProductType = isProduct || isProductGroup || item['@type']?.includes?.('Product');
                
                if (isProductType) {
                    console.log(`[PriceExtractor] Processing ${item['@type']}, name: "${item.name?.substring(0, 50)}..."`);
                    
                    const offers = item.offers;
                    if (offers) {
                        // Handle single offer or array of offers
                        const offerList = Array.isArray(offers) ? offers : [offers];
                        
                        // For logging, show what we found
                        console.log(`[PriceExtractor] Found ${offerList.length} offer(s)`);
                        
                        // Collect all valid price candidates
                        const candidates: { priority: number, result: ExtractedPrice }[] = [];

                        for (const offer of offerList) {
                            candidates.push(...collectPriceCandidates(offer));
                        }

                        // Select best candidate if any found
                        if (candidates.length > 0) {
                            // Sort by priority (asc)
                            candidates.sort((a, b) => a.priority - b.priority);
                            const best = candidates[0];
                            console.log(`[PriceExtractor] best candidate selected (priority ${best.priority}):`, best.result.price);
                            return best.result;
                        }
                    }
                }
                
                // Also check for nested @graph structure
                if (item['@graph']) {
                    for (const graphItem of item['@graph']) {
                        if (graphItem['@type'] === 'Product' && graphItem.offers) {
                            const offer = Array.isArray(graphItem.offers) 
                                ? graphItem.offers[0] 
                                : graphItem.offers;
                            if (offer?.price) {
                                const priceNum = typeof offer.price === 'string' 
                                    ? parseFloat(offer.price) 
                                    : offer.price;
                                if (!isNaN(priceNum) && priceNum > 0) {
                                    return {
                                        price: priceNum,
                                        currency: offer.priceCurrency || 'EUR',
                                        source: 'json-ld',
                                        raw: `${offer.priceCurrency || '€'}${offer.price}`
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log('[PriceExtractor] JSON-LD extraction failed:', e);
    }
    
    return null;
}

/**
 * Extract price from Open Graph meta tags
 */
async function extractFromOpenGraph(page: Page): Promise<ExtractedPrice | null> {
    try {
        const ogData = await page.evaluate(() => {
            const priceAmount = document.querySelector('meta[property="og:price:amount"], meta[property="product:price:amount"]');
            const priceCurrency = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"]');
            
            return {
                amount: priceAmount?.getAttribute('content'),
                currency: priceCurrency?.getAttribute('content')
            };
        });
        
        if (ogData.amount) {
            const parsed = parsePrice(ogData.amount);
            if (parsed) {
                return {
                    price: parsed.price,
                    currency: ogData.currency || parsed.currency,
                    source: 'og-meta',
                    raw: `${ogData.currency || ''}${ogData.amount}`
                };
            }
        }
    } catch (e) {
        console.log('[PriceExtractor] Open Graph extraction failed:', e);
    }
    
    return null;
}

/**
 * Extract price from schema.org microdata
 */
async function extractFromMicrodata(page: Page): Promise<ExtractedPrice | null> {
    try {
        const microdataPrice = await page.evaluate(() => {
            // Look for itemprop="price"
            const priceEl = document.querySelector('[itemprop="price"]');
            const currencyEl = document.querySelector('[itemprop="priceCurrency"]');
            
            if (priceEl) {
                return {
                    price: priceEl.getAttribute('content') || priceEl.textContent,
                    currency: currencyEl?.getAttribute('content') || currencyEl?.textContent
                };
            }
            
            return null;
        });
        
        if (microdataPrice?.price) {
            const parsed = parsePrice(microdataPrice.price);
            if (parsed) {
                return {
                    price: parsed.price,
                    currency: microdataPrice.currency || parsed.currency,
                    source: 'microdata',
                    raw: `${microdataPrice.currency || ''}${microdataPrice.price}`
                };
            }
        }
    } catch (e) {
        console.log('[PriceExtractor] Microdata extraction failed:', e);
    }
    
    return null;
}

/**
 * Extract price from common DOM selectors (Amazon, Bol.com, etc.)
 */
async function extractFromDomSelectors(page: Page): Promise<ExtractedPrice | null> {
    try {
        // Log all potential price elements to help debug
        const debugInfo = await page.evaluate(() => {
            const results: Array<{selector: string; text: string | null}> = [];
            
            // Ordered by specificity - most reliable first
            const selectors = [
                // Amazon - very specific selectors
                '#corePrice_feature_div .a-price .a-offscreen',
                '.priceToPay .a-offscreen',
                '.a-price[data-a-size="xl"] .a-offscreen',
                '.a-price[data-a-size="l"] .a-offscreen',
                '.a-price[data-a-size="b"] .a-offscreen', // Added 'b' size
                '.a-price[data-a-color="base"] .a-offscreen',
                '.a-price .a-offscreen',
                
                // Amazon fallback: Whole + Fraction (sometimes offscreen is missing/hidden)
                '.a-price-whole', 
                
                '#priceblock_ourprice',
                '#priceblock_dealprice',
                '#priceblock_saleprice',
                '[data-a-color="price"] .a-offscreen',
                '#apex_offerDisplay_desktop .a-offscreen',
                '.apexPriceToPay .a-offscreen',
                // Amazon NL/DE specific
                '#price_inside_buybox',
                '#newBuyBoxPrice',
                '#buybox .a-price .a-offscreen',
                // Bol.com
                '.promo-price',
                '.buy-block__price',
                '[data-test="price"]',
                // Other e-commerce
                '.product-price',
                '.price-value',
                '[itemprop="price"]',
                '[data-price]',
                // Generic fallbacks
                '.price',
                '.current-price', 
                '.amount'
            ];
            
            for (const sel of selectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el) {
                        const text = el.textContent?.trim() || el.getAttribute('content') || el.getAttribute('data-price');
                        results.push({ selector: sel, text });
                    }
                } catch (e) {}
            }
            
            return results;
        });
        
        console.log('[PriceExtractor] DOM selector scan results:', JSON.stringify(debugInfo, null, 2));
        
        // Try to parse prices from found elements
        for (const info of debugInfo) {
            if (info.text && /[\d]/.test(info.text)) {
                const parsed = parsePrice(info.text);
                if (parsed && parsed.price > 0) {
                    console.log(`[PriceExtractor] Found via DOM selector "${info.selector}":`, info.text, '-> parsed:', parsed);
                    return {
                        price: parsed.price,
                        currency: parsed.currency,
                        source: 'text-pattern',
                        raw: info.text,
                        selector: info.selector
                    };
                }
            }
        }
    } catch (e) {
        console.log('[PriceExtractor] DOM selector extraction failed:', e);
    }
    
    return null;
}

/**
 * Extract price from text content using patterns
 * This is a fallback when structured data is not available
 */
function extractFromText(text: string): ExtractedPrice | null {
    if (!text) return null;
    
    // Common price patterns
    const patterns = [
        // €89,99 or € 89,99 or EUR 89,99
        /(?:€|EUR)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
        // $89.99 or $ 89.99 or USD 89.99
        /(?:\$|USD)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
        // £89.99 or GBP 89.99
        /(?:£|GBP)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
        // 89,99 € or 89.99 EUR (European format)
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR)/gi,
        // 89.99 $ or 89.99 USD
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:\$|USD)/gi,
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[0]) {
            const parsed = parsePrice(match[0]);
            if (parsed && parsed.price > 0) {
                return {
                    price: parsed.price,
                    currency: parsed.currency,
                    source: 'text-pattern',
                    raw: match[0]
                };
            }
        }
    }
    
    return null;
}

/**
 * Main function to extract price from a page
 * Tries multiple methods in order of reliability
 */
export async function extractPrice(page: Page, elementText?: string): Promise<ExtractedPrice | null> {
    console.log('[PriceExtractor] Starting price extraction...');
    
    // 1. Try JSON-LD (most reliable)
    let result = await extractFromJsonLd(page);
    if (result) {
        console.log(`[PriceExtractor] Found via JSON-LD: ${result.currency} ${result.price}`);
        return result;
    }
    
    // 2. Try Open Graph
    result = await extractFromOpenGraph(page);
    if (result) {
        console.log(`[PriceExtractor] Found via Open Graph: ${result.currency} ${result.price}`);
        return result;
    }
    
    // 3. Try Microdata
    result = await extractFromMicrodata(page);
    if (result) {
        console.log(`[PriceExtractor] Found via Microdata: ${result.currency} ${result.price}`);
        return result;
    }
    
    // 4. Try common DOM selectors (Amazon, Bol.com, etc.)
    result = await extractFromDomSelectors(page);
    if (result) {
        console.log(`[PriceExtractor] Found via DOM selectors: ${result.currency} ${result.price}`);
        return result;
    }
    
    // 5. Try text pattern matching on element text or full body
    const textToScan = elementText || await page.innerText('body').catch(() => '') || '';
    if (textToScan) {
        // Limit text length to avoid performance issues
        const truncated = textToScan.substring(0, 50000); 
        result = extractFromText(truncated);
        if (result) {
            console.log(`[PriceExtractor] Found via text pattern: ${result.currency} ${result.price}`);
            return result;
        }
    }
    
    console.log('[PriceExtractor] No price found');
    return null;
}

/**
 * Format a price for display
 */
export function formatPrice(price: number, currency: string): string {
    const formatter = new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: currency || 'EUR',
    });
    return formatter.format(price);
}
