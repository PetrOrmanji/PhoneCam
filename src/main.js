const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const QRCode = require('qrcode')
const { createServer } = require('./server')

let mainWindow
let sendToPhone = null

// ── Запоминаем размер и позицию окна ──────────
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { width: 960, height: 640 } // дефолт при первом запуске
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return
  const b = mainWindow.getBounds()
  fs.writeFileSync(STATE_FILE, JSON.stringify(b))
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('wss://localhost') || url.startsWith('https://localhost')) {
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 400,
    minHeight: 300,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin' ? false : true,
    roundedCorners: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Сохраняем состояние при изменении размера/позиции
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move',   saveWindowState)
  mainWindow.on('close',  saveWindowState)
}

app.whenReady().then(async () => {
  createWindow()

  ipcMain.on('pc-signal', (_, msg) => {
    sendToPhone?.(msg)
  })

  try {
    const result = await createServer({
      onPhoneConnected: () => mainWindow?.webContents.send('phone-connected'),
      onPhoneDisconnected: () => mainWindow?.webContents.send('phone-disconnected'),
      onPhoneMessage: (msg) => mainWindow?.webContents.send('phone-signal', msg)
    })

    sendToPhone = result.sendToPhone

    const url = `https://${result.ip}:${result.port}`
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: '#e8ff00', light: '#141414' }
    })

    const serverInfo = { ip: result.ip, phonePort: result.port, qr: qrDataUrl }

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('server-ready', serverInfo)
    })
    mainWindow?.webContents.send('server-ready', serverInfo)

  } catch (err) {
    console.error('[main] Failed to start server:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
