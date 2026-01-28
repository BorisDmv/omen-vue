// Decline invite handler
const declineInvite = async (inviteId) => {
  try {
    await api.post('/user/invite/decline', { invite_id: inviteId })
    await fetchInvites()
  } catch (e) {
    alert('Failed to decline invite.')
  }
}
<script setup>
import { ref, onUnmounted, watch, onMounted } from 'vue'
// Global presence WebSocket
let presenceWS = null

const connectPresenceWebSocket = () => {
  if (presenceWS && presenceWS.readyState === WebSocket.OPEN) return
  const token = localStorage.getItem('jwt')
  if (!token) return
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host
  const wsUrl = `${wsProtocol}//${wsHost}/api/v1/presence/socket?token=${encodeURIComponent(token)}`
  presenceWS = new WebSocket(wsUrl)
  presenceWS.onopen = () => {
    console.log('🌐 Presence WebSocket connected')
  }
  presenceWS.onclose = () => {
    console.log('🌐 Presence WebSocket closed')
  }
  presenceWS.onerror = (e) => {
    console.error('🌐 Presence WebSocket error', e)
  }
}

onMounted(() => {
  connectPresenceWebSocket()
})

onUnmounted(() => {
  if (presenceWS) {
    presenceWS.close()
    presenceWS = null
  }
})
import api, { startChat, getChatHistory, getCurrentUserId } from '@/api'
// Accept invite handler
const acceptInvite = async (inviteId) => {
  try {
    await api.post('/user/invite/accept', { invite_id: inviteId })
    await fetchInvites()
    await fetchFriends()
  } catch (e) {
    alert('Failed to accept invite.')
  }
}
// Helper: Check if JWT is expired
function isJwtExpired(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    return Date.now() / 1000 > payload.exp
  } catch {
    return true
  }
}

function logout() {
  localStorage.removeItem('jwt')
  window.location.reload()
}
// Check JWT on app load
const jwt = localStorage.getItem('jwt')
if (isJwtExpired(jwt)) {
  logout()
}
import websocket from '@/services/websocket'
import Sidebar from '@/components/Sidebar.vue'
import ChatArea from '@/components/ChatArea.vue'
import InviteModal from '@/components/InviteModal.vue'


const currentUserId = ref(getCurrentUserId())
const currentUser = ref({
  id: currentUserId.value,
  username: '',
  email: '',
  status: 'online'
})

const friends = ref([])
const invites = ref([])
// Fetch pending invites
const fetchInvites = async () => {
  try {
    const res = await api.get('/user/invites')
    invites.value = res.data.invites || []
  } catch (e) {
    invites.value = []
  }
}

const activeFriendId = ref(null)
const conversationId = ref(null)
const chatHistory = ref([])
const showInviteModal = ref(false)
const wsConnected = ref(false)
const wsStats = ref({ messageCount: 0, handlerCount: 0 })
let messagePollInterval = null

// WebSocket message handler (chat and presence)
const handleWebSocketMessage = (data) => {
  console.log('🔔 WebSocket message received in ChatView:', data)
  console.log('🔔 WebSocket message type:', typeof data)
  console.log('🔔 WebSocket message keys:', Object.keys(data || {}))
  console.log('🔔 Full data object:', JSON.stringify(data, null, 2))
  
  // PRESENCE EVENT HANDLING
  if (data && data.type === 'presence' && data.user_id) {
    // Example: { type: 'presence', user_id: 123, is_online: true }
    const idx = friends.value.findIndex(f => f.id === data.user_id)
    if (idx !== -1) {
      friends.value[idx].status = data.is_online ? 'online' : 'offline'
      // Force reactivity
      friends.value = [...friends.value]
    }
    return
  }

  // ...existing code for chat message handling...
  // Handle different message formats from the server
  let message = null
  let msgConversationId = null
  // Try different possible message structures - be more lenient
  if (data.message) {
    // Format: { message: { ... } }
    message = data.message
    msgConversationId = message.conversation_id || data.conversation_id
    console.log('📦 Detected format: nested message object')
  } else if (data.content || data.text || data.message_text) {
    // Format: { content: "...", sender_id: "...", conversation_id: "..." }
    message = data
    msgConversationId = data.conversation_id || data.room || data.room_id
    console.log('📦 Detected format: flat message object')
  } else if (data.type === 'message' && data.data) {
    // Format: { type: 'message', data: { ... } }
    message = data.data
    msgConversationId = message.conversation_id || data.conversation_id
    console.log('📦 Detected format: type + data')
  } else if (data.type === 'new_message' || data.type === 'message_received') {
    // Format: { type: 'new_message', ... }
    message = data
    msgConversationId = data.conversation_id || data.room || data.room_id
    console.log('📦 Detected format: type-based')
  } else if (data.sender_id || data.user_id) {
    // Format: Any object with sender_id - likely a message
    message = data
    msgConversationId = data.conversation_id || data.room || data.room_id || conversationId.value
    console.log('📦 Detected format: has sender_id')
  }
  if (!message) {
    console.warn('⚠️ Unknown WebSocket message format, attempting to process anyway:', data)
    // Try to process anyway if it looks like a message
    if (typeof data === 'object' && data !== null) {
      message = data
      msgConversationId = data.conversation_id || data.room || data.room_id || conversationId.value
      console.log('📦 Attempting to process as generic message object')
    } else {
      console.error('❌ Cannot process message - invalid format')
      return
    }
  }
  msgConversationId = msgConversationId || conversationId.value
  const messageContent = message.content || message.text || message.message_text || message.message || ''
  const messageSenderId = message.sender_id || message.user_id || message.from_user_id || message.from
  const messageId = message.id || message.message_id || `ws-${Date.now()}`
  const messageCreatedAt = message.created_at || message.timestamp || message.time || new Date().toISOString()
  console.log('✅ Processed message details:')
  console.log('   Content:', messageContent)
  console.log('   Sender ID:', messageSenderId)
  console.log('   Current User ID:', currentUserId.value)
  console.log('   Is from me?', messageSenderId === currentUserId.value)
  console.log('   Message ID:', messageId)
  console.log('   Created At:', messageCreatedAt)
  console.log('   Message conversation ID:', msgConversationId)
  console.log('   Current conversation ID:', conversationId.value)
  const isForCurrentConversation = !msgConversationId || 
                                    msgConversationId === conversationId.value ||
                                    !conversationId.value
  if (isForCurrentConversation && messageContent) {
    let existingIndex = chatHistory.value.findIndex(m => {
      if (m.id === messageId) return true
      if (m.content === messageContent && 
          m.sender_id === messageSenderId && 
          messageCreatedAt &&
          Math.abs(new Date(m.created_at) - new Date(messageCreatedAt)) < 5000) {
        return true
      }
      return false
    })
    if (existingIndex === -1 && messageSenderId === currentUserId.value && !messageId.startsWith('temp-')) {
      existingIndex = chatHistory.value.findIndex(m => m.sender_id === currentUserId.value && m.content === messageContent && m.id && m.id.startsWith('temp-'))
    }
    if (existingIndex === -1) {
      const newMessage = {
        id: messageId,
        content: messageContent,
        sender_id: messageSenderId,
        created_at: messageCreatedAt
      }
      chatHistory.value = [...chatHistory.value, newMessage]
    } else {
      const existingMsg = chatHistory.value[existingIndex]
      if (existingMsg.id && existingMsg.id.startsWith('temp-') && messageId && !messageId.startsWith('temp-')) {
        chatHistory.value = [
          ...chatHistory.value.slice(0, existingIndex),
          {
            id: messageId,
            content: messageContent,
            sender_id: messageSenderId,
            created_at: messageCreatedAt
          },
          ...chatHistory.value.slice(existingIndex + 1)
        ]
      }
    }
  } else {
    console.log('⚠️ Message is for different conversation or missing content')
    console.log('   Is for current conversation:', isForCurrentConversation)
    console.log('   Has content:', !!messageContent)
  }
}

// Poll for new messages as fallback
// Add optimistic message to chatHistory when sending
const sendOptimisticMessage = (content) => {
  const tempMessageId = `temp-${Date.now()}`
  const newMessage = {
    id: tempMessageId,
    content,
    sender_id: currentUserId.value,
    created_at: new Date().toISOString()
  }
  chatHistory.value = [...chatHistory.value, newMessage]
  return tempMessageId
}
const pollForNewMessages = async () => {
  if (!conversationId.value) return
  
  try {
    // Only update chatHistory from polling if WebSocket is NOT connected
    if (wsConnected.value) {
      // WebSocket is connected, do not update chatHistory from polling
      return;
    }
    const historyRes = await getChatHistory(conversationId.value)
    const newHistory = historyRes.data.history || []
    if (newHistory.length === 0) return;
    if (newHistory.length === 1) {
      // Only one message returned, treat as new message, never replace chatHistory
      const msg = newHistory[0];
      const exists = chatHistory.value.some(m => m.id === msg.id);
      if (!exists) {
        chatHistory.value = [...chatHistory.value, msg];
      }
    } else if (newHistory.length > 1 && newHistory.length >= chatHistory.value.length) {
      // Only replace if we are sure we have the full history
      const isFullHistory = chatHistory.value.length === 0 ||
        (chatHistory.value[0]?.id === newHistory[0]?.id && chatHistory.value.length <= newHistory.length);
      if (isFullHistory) {
        chatHistory.value = newHistory;
      } else {
        // Append only truly new messages
        const existingIds = new Set(chatHistory.value.map(m => m.id));
        const toAdd = newHistory.filter(m => !existingIds.has(m.id));
        if (toAdd.length > 0) {
          chatHistory.value = [...chatHistory.value, ...toAdd];
        }
      }
    }
  } catch (error) {
    console.error('Error polling for messages:', error)
  }
}

// Watch conversationId to connect/disconnect WebSocket
watch(conversationId, (newId, oldId) => {
  // Clear polling interval
  if (messagePollInterval) {
    clearInterval(messagePollInterval)
    messagePollInterval = null
  }
  
  if (oldId) {
    // Disconnect from previous conversation
    websocket.disconnect()
    wsConnected.value = false
  }
  
  if (newId) {
    // Connect to new conversation
    console.log('🔌 Connecting WebSocket for conversation:', newId)
    websocket.connect(newId)
    
    // Register message handler with logging
    console.log('📝 Registering WebSocket message handler')
    const unsubscribe = websocket.onMessage(handleWebSocketMessage)
    console.log('✅ Message handler registered')
    
    // Store unsubscribe function for cleanup
    watch(() => conversationId.value, () => {
      if (unsubscribe) unsubscribe()
    })
    
    // Check connection status after a short delay
    setTimeout(() => {
      wsConnected.value = websocket.isConnected()
      console.log('🔌 WebSocket connection status:', wsConnected.value)
      console.log('🔌 WebSocket readyState:', websocket.ws?.readyState)
      console.log('🔌 WebSocket URL:', websocket.ws?.url?.replace(/token=[^&]+/, 'token=HIDDEN'))
      
      // Set up polling as fallback if WebSocket is not connected
      if (!wsConnected.value) {
        console.log('⚠️ WebSocket not connected, enabling polling fallback')
        messagePollInterval = setInterval(pollForNewMessages, 5000) // Poll every 5 seconds
      } else {
        console.log('✅ WebSocket is connected and ready')
        // Send a test message to verify connection (optional - can remove if server doesn't support)
        console.log('🧪 WebSocket connection verified')
      }
    }, 1000)
    
    // Set up periodic connection check and stats update
    const connectionCheck = setInterval(() => {
      const isConnected = websocket.isConnected()
      if (wsConnected.value !== isConnected) {
        wsConnected.value = isConnected
        console.log('WebSocket connection status changed:', isConnected)
        
        // Enable/disable polling based on connection status
        if (isConnected) {
          // WebSocket connected, stop polling
          if (messagePollInterval) {
            clearInterval(messagePollInterval)
            messagePollInterval = null
            console.log('WebSocket connected, stopping polling')
          }
        } else {
          // WebSocket disconnected, start polling
          if (!messagePollInterval && newId === conversationId.value) {
            console.log('WebSocket disconnected, starting polling fallback')
            messagePollInterval = setInterval(pollForNewMessages, 5000)
          }
          
          // Try to reconnect if disconnected and we still have a conversation
          if (newId === conversationId.value) {
            console.log('Attempting to reconnect WebSocket...')
            websocket.connect(newId)
          }
        }
      }
      
      // Update stats
      const stats = websocket.getStats()
      wsStats.value = {
        messageCount: stats.messageCount || 0,
        handlerCount: stats.handlerCount || 0
      }
    }, 3000)
    
    // Clean up interval when conversation changes
    watch(() => conversationId.value, () => {
      clearInterval(connectionCheck)
    })
  }
})

const selectFriend = async (id) => {
  activeFriendId.value = id
  // Start or get conversation
  try {
    const res = await startChat(id)
    console.log('POST /chat/start response:', res.data)
    console.log('POST /chat/start response.data.conversation_id:', res.data.conversation_id)
    conversationId.value = res.data.conversation_id
    console.log('conversationId.value after assignment:', conversationId.value)
    
    // Fetch chat history - don't fail if this errors, just use empty history
    try {
      const historyRes = await getChatHistory(conversationId.value)
      console.log('GET /chat/history response:', historyRes.data)
      const newHistory = historyRes.data.history || []
      if (newHistory.length === 0) {
        chatHistory.value = []
      } else if (newHistory.length === 1) {
        // Only one message returned, treat as new message, never replace chatHistory
        const msg = newHistory[0];
        const exists = chatHistory.value.some(m => m.id === msg.id);
        if (!exists) {
          chatHistory.value = [...chatHistory.value, msg];
        }
      } else if (newHistory.length > 1 && newHistory.length >= chatHistory.value.length) {
        // Only replace if we are sure we have the full history
        const isFullHistory = chatHistory.value.length === 0 ||
          (chatHistory.value[0]?.id === newHistory[0]?.id && chatHistory.value.length <= newHistory.length);
        if (isFullHistory) {
          chatHistory.value = newHistory;
        } else {
          // Append only truly new messages
          const existingIds = new Set(chatHistory.value.map(m => m.id));
          const toAdd = newHistory.filter(m => !existingIds.has(m.id));
          if (toAdd.length > 0) {
            chatHistory.value = [...chatHistory.value, ...toAdd];
          }
        }
      }
    } catch (historyError) {
      console.warn('Failed to fetch chat history (this is okay for new conversations):', historyError)
      chatHistory.value = []
      // Don't reset conversationId - it's valid even if history fetch fails
    }
  } catch (e) {
    console.error('Error starting chat:', e)
    chatHistory.value = []
    conversationId.value = null
  }
}

// New function to handle "Back" on mobile
const closeChat = () => {
  // Disconnect WebSocket when leaving chat
  websocket.disconnect()
  activeFriendId.value = null
  conversationId.value = null
  chatHistory.value = []
}

// Cleanup on unmount
onUnmounted(() => {
  websocket.disconnect()
  if (messagePollInterval) {
    clearInterval(messagePollInterval)
    messagePollInterval = null
  }
})

const handleInvite = (email) => {
  console.log(`Inviting ${email}...`)
  showInviteModal.value = false
}

const fetchCurrentUser = async () => {
  try {
    const res = await api.get('/user/me')
    currentUser.value = {
      id: res.data.id || currentUserId.value,
      username: res.data.username,
      email: res.data.email,
      status: 'online'
    }
  } catch (e) {
    // If 401 or JWT expired, log out
    if (e?.response?.status === 401 || isJwtExpired(localStorage.getItem('jwt'))) {
      logout()
    }
    currentUser.value = {
      id: currentUserId.value,
      username: 'Unknown',
      email: '',
      status: 'offline'
    }
  }
}

const fetchFriends = async () => {
  try {
    const res = await api.get('/user/friends')
    friends.value = (res.data.friends || []).map(f => ({
      id: f.id,
      name: f.username,
      email: f.email,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(f.username)}`,
      status: f.is_online ? 'online' : 'offline',
      lastMessage: ''
    }))
  } catch (e) {
    if (e?.response?.status === 401 || isJwtExpired(localStorage.getItem('jwt'))) {
      logout()
    }
    friends.value = []
  }
}

fetchCurrentUser()
fetchFriends()
fetchInvites()
</script>

<template>
  <div class="flex h-dvh bg-slate-100 font-sans overflow-hidden relative">

    <Sidebar 
      class="transition-all duration-300"
      :class="[
        activeFriendId ? 'hidden md:flex' : 'flex w-full',
      ]"
      :current-user="currentUser" 
      :friends="friends" 
      :active-id="activeFriendId"
      :invites="invites"
      @select-friend="selectFriend"
      @open-invite="showInviteModal = true"
      @accept-invite="acceptInvite"
      @decline-invite="declineInvite"
    />

    <ChatArea 
      v-if="activeFriendId"
      class="w-full h-full"
      :class="[
        activeFriendId ? 'flex z-20 absolute inset-0 md:static' : 'hidden md:flex',
      ]"
      :friend="friends.find(f => f.id === activeFriendId)"
      :chat-history="chatHistory"
      :conversation-id="conversationId"
      :current-user-id="currentUserId"
      :ws-connected="wsConnected"
      @back="closeChat"
    />

    <div v-else class="hidden md:flex flex-1 items-center justify-center text-slate-400 bg-slate-50">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        <p>Select a friend to start chatting</p>
      </div>
    </div>

    <InviteModal 
      :is-open="showInviteModal" 
      @close="showInviteModal = false"
      @invite="handleInvite"
    />
    
  </div>
</template>