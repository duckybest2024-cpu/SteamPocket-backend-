const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { fork } = require("child_process");

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// ── Start embedded backend server ────────────────────────────────────────────

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, "..", "dist", "server.js");

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        DATABASE_URL: `file:${path.join(app.getPath("userData"), "casino.db")}`,
        NODE_ENV: "production",
      },
      stdio: "pipe",
    });

    serverProcess.stdout?.on("data", (d) => console.log("[server]", d.toString().trim()));
    serverProcess.stderr?.on("data", (d) => console.error("[server err]", d.toString().trim()));

    serverProcess.on("error", reject);

    // Poll until server responds
    let attempts = 0;
    const check = () => {
      http.get(SERVER_URL + "/health", (res) => {
        if (res.statusCode === 200) {
          console.log("Server ready at", SERVER_URL);
          resolve();
        } else {
          retry();
        }
      }).on("error", retry);
    };

    const retry = () => {
      if (++attempts > 30) return reject(new Error("Server failed to start after 30s"));
      setTimeout(check, 1000);
    };

    setTimeout(check, 2000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ── Create the main window ────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "icon.ico"),
    title: "GrilledCoin",
    backgroundColor: "#0f212e",
    show: false,
  });

  // Remove default menu bar
  Menu.setApplicationMenu(buildMenu());

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL)) shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── App menu ─────────────────────────────────────────────────────────────────

function buildMenu() {
  const template = [
    {
      label: "GrilledCoin",
      submenu: [
        { label: "Home", click: () => mainWindow?.loadURL(SERVER_URL) },
        { type: "separator" },
        {
          label: "Open in Browser",
          click: () => shell.openExternal(SERVER_URL),
        },
        { type: "separator" },
        { label: "Quit", role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About GrilledCoin",
              message: "GrilledCoin",
              detail: "Provably fair online casino\nVersion 1.0.0",
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ── Splash loading window ─────────────────────────────────────────────────────

function createSplash() {
  const splash = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: { nodeIntegration: false },
    backgroundColor: "#0f212e",
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const splash = createSplash();

  try {
    await startServer();
    splash.close();
    createWindow();
  } catch (err) {
    splash.close();
    dialog.showErrorBox(
      "Startup Error",
      "Failed to start the GrilledCoin server:\n" + err.message
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", stopServer);
