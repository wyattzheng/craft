export type MessageHandler = (data: ArrayBuffer) => void

export class GameNetwork {
  private ws: WebSocket | null = null
  private url: string
  private onMessage: MessageHandler
  private reconnectTimer: number | null = null

  constructor(url: string, onMessage: MessageHandler) {
    this.url = url
    this.onMessage = onMessage
    this.connect()
  }

  private connect() {
    this.ws = new WebSocket(this.url)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      console.log('connected to server')
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
    }

    this.ws.onmessage = (e) => {
      this.onMessage(e.data)
    }

    this.ws.onclose = () => {
      console.log('disconnected, reconnecting...')
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1000)
    }
  }

  send(data: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  close() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}
