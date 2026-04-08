const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { createServer } = require('./server')

let mainWindow
let sendToPhone = null

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('wss://localhost') || url.startsWith('https://localhost')) {
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())
}

app.whenReady().then(async () => {
  createWindow()

  // Renderer → Main: signaling ответ (answer / ICE от PC)
  ipcMain.on('pc-signal', (_, msg) => {
    sendToPhone?.(msg)
  })

  try {
    const result = await createServer({
      onPhoneConnected: () => {
        mainWindow?.webContents.send('phone-connected')
      },
      onPhoneDisconnected: () => {
        mainWindow?.webContents.send('phone-disconnected')
      },
      onPhoneMessage: (msg) => {
        // Main → Renderer: signaling от iPhone (offer / ICE от телефона)
        mainWindow?.webContents.send('phone-signal', msg)
      }
    })

    sendToPhone = result.sendToPhone

    const serverInfo = { ip: result.ip, phonePort: result.port }

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
