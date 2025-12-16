# DeltaWatch - Website Change Monitor

A powerful web application for monitoring website changes, with support for text extraction, visual comparisons, and automated notifications.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

## Features

### Monitor Types
- **Text Monitoring** - Extract and track text content using CSS selectors
- **Full Page Monitoring** - Track entire page content changes
- **Visual Monitoring** - Screenshot comparison with pixel-level diff detection

### Notifications
- Email notifications (SMTP)
- Push notifications (Pushover, Gotify)
- Webhook integrations
- AI-powered change summaries (OpenAI)

### Additional Features
- **Browser Extension** - Create monitors directly from any webpage
- **Scheduled Checks** - Configurable intervals (1m to 24h)
- **History Timeline** - Track all changes with diff visualization
- **Tags & Filtering** - Organize monitors with custom tags
- **Keyword Alerts** - Trigger notifications when specific keywords appear/disappear
- **Multi-user Support** - Admin and user roles with email verification
- **Public Status Page** - Share monitor status publicly

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Server** | Express 5, TypeScript, SQLite3 |
| **Client** | React 18, Vite, Tailwind CSS |
| **Browser Automation** | Playwright |
| **Charts** | Recharts |
| **Auth** | JWT, bcrypt, Google OAuth |

## Project Structure

```
website-change-monitor/
├── server/             # Express API server
│   ├── index.ts       # Main entry point
│   ├── browserPool.ts # Playwright browser management
│   ├── env.ts         # Environment configuration
│   └── openapi.json   # API documentation
├── client/             # React frontend
│   ├── src/
│   │   ├── Dashboard.tsx
│   │   ├── MonitorDetails.tsx
│   │   ├── Editor.tsx      # Visual selector tool
│   │   └── contexts/       # Auth, Toast, Dialog
│   └── vite.config.ts
├── extension/          # Chrome browser extension
│   ├── popup.html
│   ├── popup.js
│   └── content.js
├── Dockerfile
└── docker-compose.yml
```

## Getting Started

### Prerequisites
- Node.js v20+ (required for Playwright)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/website-change-monitor.git
cd website-change-monitor

# Install all dependencies
npm run install:all

# Start development servers (client + server)
npm start
```

The app will be available at:
- **Frontend**: http://localhost:5174
- **API**: http://localhost:3000

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Required
JWT_SECRET=your-secret-key

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com

# AI Summaries (optional)
OPENAI_API_KEY=sk-...

# Push Notifications (optional)
PUSHOVER_USER_KEY=...
PUSHOVER_APP_TOKEN=...
GOTIFY_URL=https://gotify.example.com
GOTIFY_TOKEN=...

# Proxy (optional)
PROXY_URL=http://user:pass@proxy:port
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t deltawatch .
docker run -p 3000:3000 -v ./data:/app/server/data deltawatch
```

## Browser Extension

The Chrome extension allows you to create monitors directly from any webpage:

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. Configure your server URL in the extension popup

## API Documentation

Interactive API documentation is available at `/api/docs` when the server is running.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login |
| `GET` | `/monitors` | List all monitors |
| `POST` | `/monitors` | Create new monitor |
| `POST` | `/monitors/:id/check` | Trigger manual check |
| `DELETE` | `/monitors/:id` | Delete monitor |
| `DELETE` | `/monitors/:id/history/:hid` | Delete history record |

## Related Projects

- **[DeltaWatch Mobile](https://github.com/yourusername/deltawatch-mobile)** - React Native mobile app companion

## License

MIT
