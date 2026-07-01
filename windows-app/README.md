# Casino Aurelius — Windows Desktop App

An Electron wrapper that runs Casino Aurelius as a native Windows application.

## How it works

The app starts the Express backend server locally, then opens a BrowserWindow pointing to `localhost:3000`. All game logic runs on your machine — no internet required after initial setup.

## Build the Windows installer (.exe)

### Prerequisites
- Node.js 18+
- Windows or cross-compilation via Wine

### Steps

1. **Build the backend first** (from the project root):
   ```bash
   npm install
   npm run build
   npx prisma generate
   ```

2. **Install Electron dependencies**:
   ```bash
   cd windows-app
   npm install
   ```

3. **Build the installer**:
   ```bash
   npm run dist:win
   ```
   This creates `release/Casino Aurelius Setup 1.0.0.exe`

4. **Run the installer** on any Windows PC — no Node.js or server setup required.

## Development (run without building)

```bash
cd windows-app
npm install
npm start
```

## App data

- Database is stored in `%APPDATA%\casino-aurelius-desktop\casino.db`
- This persists between sessions and app updates
