const { contextBridge } = require('electron')

// В будущих этапах здесь будем пробрасывать API из main процесса в renderer
contextBridge.exposeInMainWorld('phonecam', {
  platform: process.platform
})
