import fs from 'fs';

// HA Addon Fallback: Read from /data/options.json if available
// This must run immediately upon import to ensure process.env is set 
// BEFORE other modules (like db.ts) read from it.
try {
    if (fs.existsSync('/data/options.json')) {
        const options = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
        console.log('Preload: Loaded configuration from Home Assistant /data/options.json:', JSON.stringify(options, null, 2));
        
        // Map HA options to Env vars - PREFER HA OPTIONS over existing env vars
        if (options.log_level) process.env.LOG_LEVEL = options.log_level;
        if (options.google_client_id) process.env.GOOGLE_CLIENT_ID = options.google_client_id;
        if (options.access_token_secret) process.env.ACCESS_TOKEN_SECRET = options.access_token_secret;
        if (options.app_url) process.env.APP_URL = options.app_url;
        if (options.data_dir) {
            console.log(`Preload: Overwriting DATA_DIR. Old: '${process.env.DATA_DIR}', New: '${options.data_dir}'`);
            process.env.DATA_DIR = options.data_dir;
        }
        
        // Force production mode in HA if not set
        if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
    }
} catch (err) {
    console.error('Preload: Failed to load HA options:', err);
}
