const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('phonecam', {
  platform: process.platform,

  onServerReady: (cb) => ipcRenderer.on('server-ready', (_, data) => cb(data)),
  onPhoneConnected: (cb) => ipcRenderer.on('phone-connected', () => cb()),
  onPhoneDisconnected: (cb) => ipcRenderer.on('phone-disconnected', () => cb()),
})
