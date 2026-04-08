const express = require('express')
const { WebSocketServer } = require('ws')
const http = require('http')
const os = require('os')
const path = require('path')

const PORT = 9457

function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

function createServer(onClientConnected, onClientDisconnected) {
  const app = express()
  const httpServer = http.createServer(app)
  const wss = new WebSocketServer({ server: httpServer })

  // Отдаем страницу для iPhone
  app.use(express.static(path.join(__dirname, 'phone')))

  // WebRTC signaling
  let pcSocket = null   // WebSocket Electron-окна
  let phoneSocket = null // WebSocket iPhone

  wss.on('connection', (ws, req) => {
    const clientType = new URL(req.url, `http://localhost`).searchParams.get('type')

    if (clientType === 'pc') {
      pcSocket = ws
      console.log('[server] PC renderer connected to signaling')
    } else {
      phoneSocket = ws
      console.log('[server] iPhone connected')
      onClientConnected?.()

      ws.on('close', () => {
        phoneSocket = null
        console.log('[server] iPhone disconnected')
        onClientDisconnected?.()
      })
    }

    ws.on('message', (data) => {
      const msg = JSON.parse(data)

      // Пересылаем signaling сообщения между сторонами
      if (clientType === 'phone' && pcSocket?.readyState === 1) {
        pcSocket.send(JSON.stringify(msg))
      } else if (clientType === 'pc' && phoneSocket?.readyState === 1) {
        phoneSocket.send(JSON.stringify(msg))
      }
    })

    ws.on('error', (err) => {
      console.error('[server] WS error:', err.message)
    })
  })

  return new Promise((resolve, reject) => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      const ip = getLocalIP()
      console.log(`[server] Running at http://${ip}:${PORT}`)
      resolve({ ip, port: PORT })
    })
    httpServer.on('error', reject)
  })
}

module.exports = { createServer, getLocalIP, PORT }
