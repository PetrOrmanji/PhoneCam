const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('phonecam', {
  platform: process.platform,

  // Сервер готов — передаёт IP и порт
  onServerReady: (cb) => ipcRenderer.on('server-ready', (_, data) => cb(data)),

  // iPhone подключился / отключился
  onPhoneConnected:    (cb) => ipcRenderer.on('phone-connected',    () => cb()),
  onPhoneDisconnected: (cb) => ipcRenderer.on('phone-disconnected', () => cb()),

  // Signaling: получить сообщение от iPhone (offer / ICE)
  onPhoneSignal: (cb) => ipcRenderer.on('phone-signal', (_, msg) => cb(msg)),

  // Signaling: отправить сообщение на iPhone (answer / ICE)
  sendSignal: (msg) => ipcRenderer.send('pc-signal', msg),
})
