const express = require('express')
const { WebSocketServer } = require('ws')
const https = require('https')
const os = require('os')
const path = require('path')
const selfsigned = require('selfsigned')

const PHONE_PORT = 9457

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

async function createServer({ onPhoneConnected, onPhoneDisconnected, onPhoneMessage }) {
  const ip = getLocalIP()
  const app = express()

  const pems = await generateCert(ip)
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app)
  const wss = new WebSocketServer({ server: httpsServer })

  app.use(express.static(path.join(__dirname, 'phone')))

  let phoneSocket = null

  wss.on('connection', (ws) => {
    phoneSocket = ws
    console.log('[server] iPhone connected')
    onPhoneConnected?.()

    ws.on('message', (data) => {
      // Передаём signaling сообщение от iPhone в main процесс
      onPhoneMessage?.(JSON.parse(data))
    })

    ws.on('close', () => {
      phoneSocket = null
      console.log('[server] iPhone disconnected')
      onPhoneDisconnected?.()
    })

    ws.on('error', (e) => console.error('[phone ws]', e.message))
  })

  // Отправить signaling сообщение на iPhone
  function sendToPhone(msg) {
    if (phoneSocket?.readyState === 1) {
      phoneSocket.send(JSON.stringify(msg))
    }
  }

  await new Promise((resolve, reject) => {
    httpsServer.listen(PHONE_PORT, '0.0.0.0', () => {
      console.log(`[server] HTTPS → https://${ip}:${PHONE_PORT}`)
      resolve()
    })
    httpsServer.on('error', reject)
  })

  return { ip, port: PHONE_PORT, sendToPhone }
}

module.exports = { createServer, PHONE_PORT }
