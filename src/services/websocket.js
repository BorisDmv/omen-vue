// WebSocket service for real-time chat
class ChatWebSocket {
  constructor() {
    this.ws = null
    this.conversationId = null
    this.messageHandlers = []
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
    this.isManualClose = false
    this.messageCount = 0 // Track total messages received
  }

  connect(conversationId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.conversationId === conversationId) {
      console.log('WebSocket already connected to conversation:', conversationId)
      return
    }

    // Close existing connection if switching conversations
    if (this.ws) {
      this.isManualClose = false
      this.disconnect()
    }

    this.conversationId = conversationId
    const token = localStorage.getItem('jwt')
    
    if (!token) {
      console.error('No JWT token found')
      return
    }

    // Construct WebSocket URL with token and room (conversation_id)
    // Use ws:// for localhost, wss:// for production
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host
    const wsUrl = `${wsProtocol}//${wsHost}/api/v1/chat/socket?token=${encodeURIComponent(token)}&room=${encodeURIComponent(conversationId)}`
    
    console.log('Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'))
    
    try {
      this.ws = new WebSocket(wsUrl)
      this.setupEventHandlers()
    } catch (error) {
      console.error('WebSocket connection error:', error)
      this.scheduleReconnect()
    }
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected successfully')
      console.log('WebSocket readyState:', this.ws.readyState)
      console.log('WebSocket URL:', this.ws.url.replace(/token=[^&]+/, 'token=HIDDEN'))
      console.log('WebSocket protocol:', this.ws.protocol)
      console.log('WebSocket extensions:', this.ws.extensions)
      this.reconnectAttempts = 0
      this.isManualClose = false
      
      // Test: Send a ping or test message to verify bidirectional communication
      // (Only if server supports it - comment out if server doesn't expect this)
      console.log('🧪 WebSocket connection established, ready to receive messages')
    }

    this.ws.onmessage = (event) => {
      this.messageCount++
      console.log(`📨📨📨 RAW WebSocket message #${this.messageCount} received!`)
      console.log('📨 Event object:', event)
      console.log('📨 Event.data type:', typeof event.data)
      console.log('📨 Event.data:', event.data)
      console.log('📨 Event.data length:', event.data?.length)
      
      // Try to parse as JSON
      let data = null
      try {
        data = JSON.parse(event.data)
        console.log('✅ Successfully parsed as JSON')
        console.log('📨 Parsed WebSocket message:', data)
        console.log('📨 Message type:', data.type)
        console.log('📨 Message keys:', Object.keys(data))
        console.log('📨 Full message structure:', JSON.stringify(data, null, 2))
      } catch (error) {
        console.warn('⚠️ Not JSON, treating as string or other format')
        console.warn('📨 Raw message data:', event.data)
        // Try to handle as string or other format
        data = event.data
      }
      
      // Always call handleMessage, even if parsing failed
      this.handleMessage(data)
    }

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error event fired')
      console.error('❌ Error object:', error)
      console.error('❌ Error type:', error.type)
      console.error('❌ WebSocket readyState:', this.ws?.readyState)
      console.error('❌ WebSocket URL:', this.ws?.url?.replace(/token=[^&]+/, 'token=HIDDEN'))
    }

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed')
      console.log('   Code:', event.code)
      console.log('   Reason:', event.reason || 'No reason provided')
      console.log('   Was clean:', event.wasClean)
      console.log('   Manual close:', this.isManualClose)
      
      // Only reconnect if it wasn't a manual close and we haven't exceeded max attempts
      if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect()
      }
    }
  }

  scheduleReconnect() {
    if (this.isManualClose) return
    
    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    
    setTimeout(() => {
      if (this.conversationId && !this.isManualClose) {
        console.log('Attempting to reconnect...')
        this.connect(this.conversationId)
      }
    }, delay)
  }

  handleMessage(data) {
    console.log('🔔🔔🔔 handleMessage called!')
    console.log('🔔 Data received:', data)
    console.log('🔔 Data type:', typeof data)
    console.log('🔔 Number of registered handlers:', this.messageHandlers.length)
    
    if (this.messageHandlers.length === 0) {
      console.warn('⚠️ No message handlers registered! Message will be lost!')
      console.warn('⚠️ This usually means the component hasn\'t registered a handler yet')
    }
    
    // Notify all registered message handlers
    this.messageHandlers.forEach((handler, index) => {
      try {
        console.log(`🔔 Calling handler ${index + 1}/${this.messageHandlers.length}`)
        const result = handler(data)
        console.log(`✅ Handler ${index + 1} completed successfully`, result)
      } catch (error) {
        console.error(`❌ Error in message handler ${index + 1}:`, error)
        console.error('❌ Error stack:', error.stack)
      }
    })
    
    console.log('🔔 Finished processing message through all handlers')
  }

  sendMessage(content) {
    if (!this.ws) {
      console.error('❌ WebSocket is null')
      return false
    }
    
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket is not connected. ReadyState:', this.ws.readyState)
      console.error('   WebSocket.OPEN =', WebSocket.OPEN)
      console.error('   WebSocket.CONNECTING =', WebSocket.CONNECTING)
      console.error('   WebSocket.CLOSING =', WebSocket.CLOSING)
      console.error('   WebSocket.CLOSED =', WebSocket.CLOSED)
      return false
    }

    const message = {
      type: 'message',
      conversation_id: this.conversationId,
      content: content
    }

    try {
      const messageStr = JSON.stringify(message)
      this.ws.send(messageStr)
      console.log('✅ Message sent via WebSocket:', message)
      console.log('   Raw message string:', messageStr)
      return true
    } catch (error) {
      console.error('❌ Error sending message via WebSocket:', error)
      return false
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler)
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler)
      if (index > -1) {
        this.messageHandlers.splice(index, 1)
      }
    }
  }

  disconnect() {
    this.isManualClose = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.conversationId = null
    this.messageHandlers = []
  }

  isConnected() {
    const connected = this.ws && this.ws.readyState === WebSocket.OPEN
    return connected
  }
  
  getStats() {
    return {
      connected: this.isConnected(),
      conversationId: this.conversationId,
      messageCount: this.messageCount,
      handlerCount: this.messageHandlers.length,
      readyState: this.ws?.readyState
    }
  }
}

// Export singleton instance
export default new ChatWebSocket()
