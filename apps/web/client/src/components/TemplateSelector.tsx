import { useState } from 'react';
import { ShoppingCart, Package, Globe, Zap, Newspaper, DollarSign, HelpCircle, X, type LucideIcon } from 'lucide-react';

export interface MonitorTemplate {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    iconColor: string;
    bgColor: string;
    borderColor: string;
    // Pre-filled values
    type: 'text' | 'visual' | 'price';
    selectors?: {
        label: string;
        selector: string;
        description: string;
    }[];
    interval?: string;
    priceDetection?: boolean;
    // Extended help info
    helpTitle: string;
    helpContent: string;
    useCases: string[];
    example: string;
}

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
    {
        id: 'price',
        name: 'Price Tracker',
        description: 'Automatically detect and track product prices on any e-commerce site',
        icon: DollarSign,
        iconColor: 'text-emerald-400',
        bgColor: 'bg-emerald-900/20',
        borderColor: 'hover:border-emerald-500',
        type: 'price',
        interval: '*/30 * * * *',
        priceDetection: true,
        helpTitle: '💰 Automatic Price Detection',
        helpContent: 'This template uses AI to automatically find and extract the main product price from any webpage. No need to manually select elements - DeltaWatch scans the page and identifies prices in any format (€, $, £, etc.).',
        useCases: [
            'Track product prices on any webshop',
            'Get notified when prices drop below a threshold',
            'Monitor competitor pricing',
            'Wait for sales on specific items'
        ],
        example: 'Add amazon.nl/products/iphone → DeltaWatch automatically finds "€ 1.199,00" and tracks it.'
    },
    {
        id: 'shopify',
        name: 'Shopify Store',
        description: 'Track products on Shopify-powered stores',
        icon: ShoppingCart,
        iconColor: 'text-green-400',
        bgColor: 'bg-green-900/20',
        borderColor: 'hover:border-green-500',
        type: 'text',
        selectors: [
            { label: 'Product Price', selector: '.price__regular .money, .product__price .money, [data-product-price]', description: 'Main product price' },
            { label: 'Sale Price', selector: '.price__sale .money, .product__price--sale .money', description: 'Discounted price' },
            { label: 'Stock Status', selector: '.product-form__inventory, [data-inventory], .product__availability', description: 'In stock / Out of stock' },
            { label: 'Product Title', selector: '.product__title h1, .product-title, h1.title', description: 'Product name' },
        ],
        interval: '*/30 * * * *',
        helpTitle: '🛒 Shopify Store Monitoring',
        helpContent: 'Pre-configured CSS selectors for Shopify-powered webshops. Shopify uses specific HTML structures that this template already knows. You still need to select the exact element, but the picker will prioritize Shopify-specific selectors.',
        useCases: [
            'Monitor stock status (In Stock / Sold Out)',
            'Track prices on Shopify stores',
            'Watch for new products or restocks',
            'Detect when limited editions become available'
        ],
        example: 'Works with: Allbirds, Gymshark, Kylie Cosmetics, and millions of Shopify stores.'
    },
    {
        id: 'woocommerce',
        name: 'WooCommerce',
        description: 'Track products on WordPress WooCommerce stores',
        icon: Package,
        iconColor: 'text-purple-400',
        bgColor: 'bg-purple-900/20',
        borderColor: 'hover:border-purple-500',
        type: 'text',
        selectors: [
            { label: 'Product Price', selector: '.woocommerce-Price-amount, .price ins .amount, .price .amount', description: 'Main product price' },
            { label: 'Stock Status', selector: '.stock, .availability, .in-stock, .out-of-stock', description: 'Availability status' },
            { label: 'Product Title', selector: '.product_title, h1.entry-title', description: 'Product name' },
        ],
        interval: '*/30 * * * *',
        helpTitle: '📦 WooCommerce (WordPress) Stores',
        helpContent: 'Optimized for WordPress websites using WooCommerce. This is the most popular e-commerce plugin for WordPress. The template includes common selectors used by WooCommerce themes.',
        useCases: [
            'Monitor prices on WordPress shops',
            'Track stock availability',
            'Watch for product description changes',
            'Detect when items come back in stock'
        ],
        example: 'Works with: Most WordPress-based online stores using WooCommerce plugin.'
    },
    {
        id: 'amazon',
        name: 'Amazon',
        description: 'Track prices and availability on Amazon',
        icon: ShoppingCart,
        iconColor: 'text-orange-400',
        bgColor: 'bg-orange-900/20',
        borderColor: 'hover:border-orange-500',
        type: 'text',
        selectors: [
            { label: 'Price', selector: '#priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen, #corePrice_feature_div .a-offscreen', description: 'Current price' },
            { label: 'Availability', selector: '#availability span, #outOfStock', description: 'In Stock status' },
            { label: 'Title', selector: '#productTitle', description: 'Product title' },
        ],
        interval: '0 * * * *',
        helpTitle: '🛒 Amazon Product Tracking',
        helpContent: 'Specialized selectors for Amazon product pages. Note: Amazon actively blocks scrapers, so this uses stealth mode and hourly checks to avoid detection. For better reliability, consider using the Price Tracker template instead.',
        useCases: [
            'Track Amazon prices for deals',
            'Monitor Lightning Deals availability',
            'Watch for Prime Day price drops',
            'Get notified when items are back in stock'
        ],
        example: 'Add any Amazon product URL → Tracks price, availability, and title changes.'
    },
    {
        id: 'news',
        name: 'News / Blog',
        description: 'Track headlines, articles, or blog posts',
        icon: Newspaper,
        iconColor: 'text-blue-400',
        bgColor: 'bg-blue-900/20',
        borderColor: 'hover:border-blue-500',
        type: 'text',
        selectors: [
            { label: 'Latest Headline', selector: 'h1, h2.headline, .post-title, article h2', description: 'Main headline' },
            { label: 'Article Summary', selector: '.excerpt, .summary, .post-excerpt, article p:first-of-type', description: 'Article preview' },
        ],
        interval: '*/15 * * * *',
        helpTitle: '📰 News & Blog Monitoring',
        helpContent: 'Track when new articles are published or headlines change. Perfect for monitoring news websites, company blogs, or any page with regularly updated content.',
        useCases: [
            'Get notified when a blog publishes new posts',
            'Monitor breaking news on specific topics',
            'Track competitor announcements',
            'Watch for job postings or press releases'
        ],
        example: 'Monitor a company\'s blog → Get notified when they publish a new article.'
    },
    {
        id: 'visual',
        name: 'Visual Screenshot',
        description: 'Capture full-page screenshots and detect visual changes',
        icon: Globe,
        iconColor: 'text-pink-400',
        bgColor: 'bg-pink-900/20',
        borderColor: 'hover:border-pink-500',
        type: 'visual',
        interval: '0 * * * *',
        helpTitle: '🖼️ Visual Change Detection',
        helpContent: 'Takes a full-page screenshot and compares it pixel-by-pixel with the previous version. Detects ANY visual change, including images, layout, colors, or design updates. Best for pages where text extraction isn\'t enough.',
        useCases: [
            'Monitor landing pages for design changes',
            'Detect when competitors update their website',
            'Watch for homepage banner updates',
            'Track visual bugs or layout issues'
        ],
        example: 'Monitor a competitor\'s homepage → See highlighted diff when anything changes visually.'
    },
    {
        id: 'custom',
        name: 'Custom Element',
        description: 'Select any element on any page with the visual picker',
        icon: Zap,
        iconColor: 'text-yellow-400',
        bgColor: 'bg-yellow-900/20',
        borderColor: 'hover:border-yellow-500',
        type: 'text',
        interval: '*/30 * * * *',
        helpTitle: '⚡ Custom Element Selection',
        helpContent: 'Maximum flexibility: visually select any element on any webpage. The page loads in an interactive preview where you can click to select exactly what you want to track.',
        useCases: [
            'Track specific text on any page',
            'Monitor custom web applications',
            'Watch for changes in specific sections',
            'Track data from any source'
        ],
        example: 'Load any URL → Click on the exact element you want to track → Done!'
    },
];

interface HelpModalProps {
    template: MonitorTemplate;
    onClose: () => void;
}

function HelpModal({ template, onClose }: HelpModalProps) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-[#161b22] border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 ${template.bgColor} rounded-xl flex items-center justify-center`}>
                            <template.icon size={24} className={template.iconColor} />
                        </div>
                        <h3 className="text-xl font-bold text-white">{template.helpTitle}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-gray-300 mb-4 leading-relaxed">{template.helpContent}</p>
                
                <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Use Cases</h4>
                    <ul className="space-y-1">
                        {template.useCases.map((useCase, idx) => (
                            <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">✓</span>
                                {useCase}
                            </li>
                        ))}
                    </ul>
                </div>
                
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Example</h4>
                    <p className="text-gray-300 text-sm">{template.example}</p>
                </div>
                
                <button 
                    onClick={onClose}
                    className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
}

interface TemplateSelectorProps {
    onSelect: (template: MonitorTemplate) => void;
    onSkip: () => void;
}

export function TemplateSelector({ onSelect, onSkip }: TemplateSelectorProps) {
    const [helpTemplate, setHelpTemplate] = useState<MonitorTemplate | null>(null);

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Choose a Template</h2>
                <p className="text-gray-400">Start with a pre-configured template or create a custom monitor</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {MONITOR_TEMPLATES.map((template) => (
                    <div key={template.id} className="relative group">
                        <button
                            onClick={() => onSelect(template)}
                            className={`w-full h-44 bg-[#161b22] hover:bg-[#1c2128] p-5 rounded-xl border border-gray-700 ${template.borderColor} transition-all text-left flex flex-col`}
                        >
                            <div className={`w-10 h-10 ${template.bgColor} rounded-lg flex items-center justify-center mb-3 flex-shrink-0`}>
                                <template.icon size={20} className={template.iconColor} />
                            </div>
                            <h3 className="text-white font-semibold mb-1 pr-6">{template.name}</h3>
                            <p className="text-gray-500 text-sm line-clamp-2 flex-grow">{template.description}</p>
                            {template.selectors && (
                                <div className="mt-auto pt-2 flex flex-wrap gap-1">
                                    {template.selectors.slice(0, 2).map((s) => (
                                        <span key={s.label} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                                            {s.label}
                                        </span>
                                    ))}
                                    {template.selectors.length > 2 && (
                                        <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-xs rounded">
                                            +{template.selectors.length - 2} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </button>
                        
                        {/* Help button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setHelpTemplate(template);
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-800/80 text-gray-500 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100"
                            title="Learn more about this template"
                        >
                            <HelpCircle size={16} />
                        </button>
                    </div>
                ))}
            </div>
            
            <div className="text-center">
                <button
                    onClick={onSkip}
                    className="text-gray-500 hover:text-gray-300 text-sm underline transition-colors"
                >
                    Skip templates and start from scratch
                </button>
            </div>
            
            {/* Help Modal */}
            {helpTemplate && (
                <HelpModal template={helpTemplate} onClose={() => setHelpTemplate(null)} />
            )}
        </div>
    );
}

export default TemplateSelector;
