const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { createServer } = require('./server')

let mainWindow

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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(async () => {
  createWindow()

  try {
    const { ip, port } = await createServer(
      () => {
        // iPhone подключился
        mainWindow?.webContents.send('phone-connected')
      },
      () => {
        // iPhone отключился
        mainWindow?.webContents.send('phone-disconnected')
      }
    )

    // Сообщаем renderer адрес сервера
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('server-ready', { ip, port })
    })

    // Если окно уже загружено до старта сервера
    mainWindow?.webContents.send('server-ready', { ip, port })

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
