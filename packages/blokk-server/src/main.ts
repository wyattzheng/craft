console.log('blokk-server starting...')

setInterval(() => {
  console.log(`[${new Date().toISOString()}] server alive`)
}, 30000)
