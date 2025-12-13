const OpenAI = require('openai');
const db = require('./db');

function getSettings() {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
        });
    });
}

async function summarizeChange(oldText, newText) {
    console.log("AI: summarizeChange called");
    try {
        const settings = await getSettings();
        console.log(`AI: Settings loaded. Enabled=${settings.ai_enabled}, Provider=${settings.ai_provider}, Model=${settings.ai_model}`);

        if (!settings.ai_enabled) {
            console.log("AI: Disabled in settings. Returning null.");
            return null;
        }

        const provider = settings.ai_provider || 'openai';
        const apiKey = settings.ai_api_key;
        const model = settings.ai_model || 'gpt-3.5-turbo';
        const baseUrl = settings.ai_base_url;

        // Skip if configured but missing keys (for OpenAI)
        if (provider === 'openai' && !apiKey) {
            console.log("AI: Missing API Key for OpenAI. Returning null.");
            return null;
        }

        const config = {
            apiKey: apiKey || 'ollama', // Ollama needs a key but it ignores it
        };
        if (baseUrl) {
            config.baseURL = baseUrl;
        }

        const openai = new OpenAI(config);

        // Truncate texts to avoid token limits
        // A rough estimate: 2000 chars each.
        const truncOld = (oldText || '').substring(0, 2000);
        const truncNew = (newText || '').substring(0, 2000);

        const prompt = `
You are a helpful assistant for a website change monitor.
The following is a diff of a website check.
Summarize the key changes (like price, status, content, numbers) in ONE short, natural language sentence for a notification.
Do not mention technical details like HTML tags unless relevant.
Focus on what changed for the user.

Old Content:
"${truncOld}"

New Content:
"${truncNew}"

Summary:
`;

        const requestOptions = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100,
        };

        // Newer models (o1-, o3-) use max_completion_tokens instead of max_tokens
        if (model.startsWith('o1') || model.startsWith('o3')) {
            delete requestOptions.max_tokens;
            requestOptions.max_completion_tokens = 100;
        }

        let response;
        try {
            console.log(`AI: Sending request to ${model}...`);
            response = await openai.chat.completions.create(requestOptions);
        } catch (e) {
            // Compatibility retry: If max_tokens failed, try max_completion_tokens
            if (e.status === 400 && e.message && (e.message.includes('max_completion_tokens') || e.message.includes('supported parameters'))) {
                console.log("AI: Retrying with max_completion_tokens...");
                delete requestOptions.max_tokens;
                requestOptions.max_completion_tokens = 100;
                response = await openai.chat.completions.create(requestOptions);
            } else {
                throw e;
            }
        }

        const summary = response.choices[0].message.content.trim();
        console.log(`AI: Success. Summary: "${summary}"`);
        return summary;

    } catch (e) {
        console.error("AI Summary Error:", e.message);
        return `⚠️ AI Failed: ${e.message}`;
    }
}

async function getModels(provider, apiKey, baseUrl) {
    if (provider === 'openai') {
        if (!apiKey) throw new Error("API Key required for OpenAI");
        const openai = new OpenAI({ apiKey: apiKey });
        const list = await openai.models.list();
        return list.data.map(m => m.id).sort();
    } else if (provider === 'ollama') {
        // Native Ollama API: GET /api/tags
        let url = baseUrl || 'http://localhost:11434';
        // Strip /v1 if present for the native call logic, or just assume user puts base like http://localhost:11434
        if (url.endsWith('/v1')) url = url.slice(0, -3);
        if (url.endsWith('/')) url = url.slice(0, -1);

        try {
            const res = await fetch(`${url}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                return data.models.map(m => m.name).sort();
            } else {
                throw new Error(`Ollama connection failed: ${res.statusText}`);
            }
        } catch (e) {
            // Fallback: try /v1/models (OpenAI compatible endpoint)
            try {
                const openai = new OpenAI({
                    apiKey: 'ollama',
                    baseURL: (baseUrl || 'http://localhost:11434') + (baseUrl?.includes('/v1') ? '' : '/v1')
                });
                const list = await openai.models.list();
                return list.data.map(m => m.id).sort();
            } catch (e2) {
                throw new Error("Could not fetch models from Ollama. Ensure it's running.");
            }
        }
    }
    return [];
}

const fs = require('fs');

async function summarizeVisualChange(oldImagePath, newImagePath, customPrompt = null) {
    console.log("AI: summarizeVisualChange called");
    try {
        const settings = await getSettings();
        if (!settings.ai_enabled) return null;

        const provider = settings.ai_provider || 'openai';
        const apiKey = settings.ai_api_key;
        const model = settings.ai_model || 'gpt-4o-mini';

        if (!apiKey && provider === 'openai') return null;

        const config = { apiKey: apiKey || 'ollama' };
        if (settings.ai_base_url) config.baseURL = settings.ai_base_url;

        const openai = new OpenAI(config);

        // Access checks
        if (!oldImagePath || !fs.existsSync(oldImagePath)) {
            console.log("AI: Old image missing, skipping visual check.");
            return null;
        }
        if (!newImagePath || !fs.existsSync(newImagePath)) {
            console.log("AI: New image missing, skipping visual check.");
            return null;
        }

        const oldImage = fs.readFileSync(oldImagePath, { encoding: 'base64' });
        const newImage = fs.readFileSync(newImagePath, { encoding: 'base64' });

        // Build a more intelligent prompt
        let prompt = `You are an expert visual change detector for a website monitoring system.

I'm showing you two screenshots of the SAME webpage taken at different times:
- IMAGE 1: The OLD/previous state
- IMAGE 2: The NEW/current state

Your task:
1. Compare both screenshots carefully
2. Identify ALL meaningful visual differences
3. Ignore irrelevant changes like: timestamps, ads, random images, minor styling flickers
4. Focus on important changes like: prices, stock status, content text, buttons, error messages, layout shifts

`;

        if (customPrompt) {
            prompt += `\nADDITIONAL CONTEXT from the user:\n"${customPrompt}"\n\n`;
        }

        prompt += `Respond with a concise summary of what changed. If nothing significant changed, say "No significant visual changes detected."
Format: Start directly with what changed, e.g. "The price changed from €299 to €249" or "A new banner appeared at the top".`;

        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${oldImage}` } },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${newImage}` } },
                    ],
                },
            ],
            max_tokens: 400,
        });

        const summary = response.choices[0].message.content.trim();
        console.log(`AI: Visual Summary: "${summary}"`);
        return summary;

    } catch (e) {
        console.error("AI Visual Summary Error:", e.message);
        // Fallback or just return error string
        return `⚠️ AI Visual Failed: ${e.message}`;
    }
}

module.exports = { summarizeChange, summarizeVisualChange, getModels };
