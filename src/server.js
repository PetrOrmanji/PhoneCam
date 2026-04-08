const express = require('express')
const { WebSocketServer } = require('ws')
const https = require('https')
const os = require('os')
const path = require('path')
const selfsigned = require('selfsigned')

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

async function generateCert(ip) {
  const attrs = [{ name: 'commonName', value: 'PhoneCam' }]
  const opts = {
    keySize: 2048,
    days: 3650,
    extensions: [
      { name: 'subjectAltName', altNames: [
        { type: 7, ip },
        { type: 7, ip: '127.0.0.1' }
      ]}
    ]
  }
  return selfsigned.generate(attrs, opts)
}

async function createServer(onClientConnected, onClientDisconnected) {
  const ip = getLocalIP()
  const app = express()

  const pems = await generateCert(ip)
  const httpsServer = https.createServer(
    { key: pems.private, cert: pems.cert },
    app
  )

  const wss = new WebSocketServer({ server: httpsServer })

  // Отдаём страницу для iPhone
  app.use(express.static(path.join(__dirname, 'phone')))

  // WebRTC signaling
  let pcSocket    = null
  let phoneSocket = null

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `https://localhost`)
    const clientType = url.searchParams.get('type')

    if (clientType === 'pc') {
      pcSocket = ws
      console.log('[server] PC renderer connected')
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
      if (clientType === 'phone' && pcSocket?.readyState === 1) {
        pcSocket.send(JSON.stringify(msg))
      } else if (clientType === 'pc' && phoneSocket?.readyState === 1) {
        phoneSocket.send(JSON.stringify(msg))
      }
    })

    ws.on('error', (err) => console.error('[server] WS error:', err.message))
  })

  return new Promise((resolve, reject) => {
    httpsServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] HTTPS running at https://${ip}:${PORT}`)
      resolve({ ip, port: PORT })
    })
    httpsServer.on('error', reject)
  })
}

module.exports = { createServer, getLocalIP, PORT }
