"use strict";
/**
 * Price Extractor Module
 * Extracts product prices from web pages using various methods:
 * 1. JSON-LD structured data (schema.org Product)
 * 2. Open Graph meta tags
 * 3. Schema.org microdata
 * 4. Text pattern matching
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPrice = extractPrice;
exports.formatPrice = formatPrice;
// Currency symbols to currency codes
const CURRENCY_MAP = {
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
function parsePrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string')
        return null;
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
    if (!cleaned)
        return null;
    // Handle European format (1.234,56) vs US format (1,234.56)
    // If comma comes after period, it's European format
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');
    let price;
    if (lastComma > lastPeriod) {
        // European format: 1.234,56 -> 1234.56
        price = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    else {
        // US format: 1,234.56 -> 1234.56
        price = parseFloat(cleaned.replace(/,/g, ''));
    }
    if (isNaN(price) || price <= 0)
        return null;
    return { price, currency };
}
/**
 * Extract price from JSON-LD structured data
 */
async function extractFromJsonLd(page) {
    try {
        const jsonLdData = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const results = [];
            scripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent || '');
                    results.push(data);
                }
                catch (e) { }
            });
            return results;
        });
        for (const data of jsonLdData) {
            // Handle arrays
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
                // Look for Product type
                if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
                    const offers = item.offers;
                    if (offers) {
                        // Handle single offer or array of offers
                        const offerList = Array.isArray(offers) ? offers : [offers];
                        for (const offer of offerList) {
                            if (offer.price) {
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
    }
    catch (e) {
        console.log('[PriceExtractor] JSON-LD extraction failed:', e);
    }
    return null;
}
/**
 * Extract price from Open Graph meta tags
 */
async function extractFromOpenGraph(page) {
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
    }
    catch (e) {
        console.log('[PriceExtractor] Open Graph extraction failed:', e);
    }
    return null;
}
/**
 * Extract price from schema.org microdata
 */
async function extractFromMicrodata(page) {
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
    }
    catch (e) {
        console.log('[PriceExtractor] Microdata extraction failed:', e);
    }
    return null;
}
/**
 * Extract price from text content using patterns
 * This is a fallback when structured data is not available
 */
function extractFromText(text) {
    if (!text)
        return null;
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
async function extractPrice(page, elementText) {
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
    // 4. Try text pattern matching on element text
    if (elementText) {
        result = extractFromText(elementText);
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
function formatPrice(price, currency) {
    const formatter = new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: currency || 'EUR',
    });
    return formatter.format(price);
}
//# sourceMappingURL=priceExtractor.js.map