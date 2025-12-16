# DeltaWatch Mobile

A React Native mobile companion app for the DeltaWatch website monitoring service. Monitor your websites on the go with a beautiful dark-themed interface.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

## Screenshots

| Monitors List | Monitor Details | Settings |
|:-------------:|:---------------:|:--------:|
| 10-bar history sparkline, type badges, quick actions | Timeline with diff view, screenshots | Account info, server status |

## Features

### Monitor Management
- **Monitor List** - View all monitors with live sparkline history
- **Type Badges** - Visual indicators for TEXT, VISUAL, and FULL PAGE monitors
- **Quick Actions** - Trigger checks and toggle status with one tap
- **Swipe to Delete** - Remove monitors with swipe gesture

### Monitor Details
- **History Timeline** - Visual timeline with status indicators
- **Diff Visualization** - Word-by-word change highlighting
- **Screenshot Viewer** - Fullscreen modal for visual monitors
- **Filter Options** - Show all, changed, unchanged, or errors

### Additional Features
- **Pull to Refresh** - Always up-to-date data
- **Search** - Find monitors quickly
- **Secure Storage** - JWT tokens stored securely
- **Native Navigation** - iOS-style navigation with Expo Router

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | React Native 0.81, Expo SDK 54 |
| **Navigation** | Expo Router (file-based) |
| **State** | React Context + Hooks |
| **Styling** | StyleSheet API |
| **Storage** | expo-secure-store |
| **Gestures** | react-native-gesture-handler |
| **Animations** | react-native-reanimated |
| **Diff** | diff (npm package) |

## Project Structure

```
deltawatch-mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Monitors list
│   │   ├── two.tsx        # Settings
│   │   └── _layout.tsx    # Tab bar config
│   ├── monitor/
│   │   └── [id].tsx       # Monitor details
│   ├── login.tsx          # Login screen
│   └── _layout.tsx        # Root navigation
├── components/
│   ├── SwipeableRow.tsx   # Swipe-to-delete component
│   └── Themed.tsx         # Themed components
├── contexts/
│   └── AuthContext.tsx    # Authentication state
├── services/
│   └── api.ts             # API client
└── assets/
    └── images/
```

## Getting Started

### Prerequisites
- Node.js v20+ (required)
- npm or pnpm
- Expo Go app on your phone (iOS/Android)
- Running DeltaWatch server

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/deltawatch-mobile.git
cd deltawatch-mobile

# Install dependencies
npm install

# Start Expo development server
nvm use 20  # Important: Node 20+ is required
npx expo start
```

### Connect to Your Server

On first launch, you'll need to configure the server URL:

1. Open the app on your phone
2. Enter your DeltaWatch server URL (e.g., `http://192.168.0.177:3000`)
3. Login with your credentials

The server URL is stored securely on your device.

## Development

### Running on Physical Device

```bash
# Start Expo server
npx expo start

# Scan QR code with:
# - iOS: Camera app
# - Android: Expo Go app
```

### Running on Simulator

```bash
# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android
```

### Hot Reload

Press `r` in the terminal to reload the app after making changes.

## API Requirements

The mobile app requires a running DeltaWatch server with these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User authentication |
| `GET` | `/monitors` | List all monitors with history |
| `POST` | `/monitors/:id/check` | Trigger manual check |
| `PUT` | `/monitors/:id` | Update monitor (toggle status) |
| `DELETE` | `/monitors/:id` | Delete monitor |
| `DELETE` | `/monitors/:id/history/:hid` | Delete history record |
| `GET` | `/api/health` | Server health check |

## Building for Production

### Expo EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build

```bash
# iOS (requires macOS + Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android
```

## Related Projects

- **[DeltaWatch Server](https://github.com/yourusername/website-change-monitor)** - Main server and web client

## Known Issues

- Requires Node.js v20+ due to Expo SDK 54 requirements
- Server must be accessible from mobile device (same network or public URL)

## License

MIT
