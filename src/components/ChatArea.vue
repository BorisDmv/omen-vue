<script setup>
import { ref, watch, nextTick, toRef, computed } from 'vue'
import { sendMessage as apiSendMessage } from '@/api'
import websocket from '@/services/websocket'

const props = defineProps({
  friend: Object,
  chatHistory: Array,
  conversationId: String,
  currentUserId: String,
  wsConnected: Boolean
})

const emit = defineEmits(['back'])

const messageInput = ref('')
const messagesContainer = ref(null)
const messages = ref([])
// Track optimistic messages (not yet confirmed by server)
const optimisticMessages = ref([])

// Create a reactive reference to conversationId
const conversationId = toRef(props, 'conversationId')

// Define scrollToBottom before it's used in watch
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Watch conversationId to debug
watch(conversationId, (newId) => {
  console.log('ChatArea conversationId changed:', newId)
}, { immediate: true })


// Merge chatHistory with optimistic messages
watch(() => props.chatHistory, (newHistory, oldHistory) => {
  console.log('🔄 ChatArea watch triggered!')
  console.log('   Old history length:', oldHistory?.length || 0)
  console.log('   New history length:', newHistory?.length || 0)
  console.log('   ChatArea received chatHistory:', newHistory)
  console.log('   ChatArea currentUserId:', props.currentUserId)

  if (!newHistory || newHistory.length === 0) {
    console.log('   ⚠️ Empty history, clearing messages and optimistic messages')
    messages.value = []
    optimisticMessages.value = []
    return
  }

  // Map history to messages format
  const mappedMessages = (newHistory || []).map((msg, index) => {
    if (!msg.content && !msg.text) {
      console.warn(`   ⚠️ Message at index ${index} has no content:`, msg)
    }
    const isFromMe = msg.sender_id === props.currentUserId
    const mapped = {
      id: msg.id || `msg-${index}`,
      sender: isFromMe ? 'me' : 'them',
      text: msg.content || msg.text || '',
      time: new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (index < 3 || index >= newHistory.length - 3) {
      console.log(`   Mapped message ${index}:`, mapped)
    }
    return mapped
  })

  // Remove optimistic messages that have been confirmed by the server (matched by content and sender)
  const confirmedIds = new Set(mappedMessages.map(m => m.id))
  optimisticMessages.value = optimisticMessages.value.filter(optMsg => {
    // If a message with the same text, sender, and time exists in mappedMessages, consider it confirmed
    // (You may want to use a better matching strategy, e.g., by content and sender only)
    return !mappedMessages.some(m => m.sender === 'me' && m.text === optMsg.text)
  })

  // Merge mappedMessages and remaining optimisticMessages, then sort by time
  const allMessages = [...mappedMessages, ...optimisticMessages.value]
  // Sort by time (using Date.parse for robustness)
  allMessages.sort((a, b) => {
    // Try to parse time from created_at if available, else fallback to time string
    const aTime = (a.created_at ? new Date(a.created_at) : new Date(`1970-01-01T${a.time}`)).getTime()
    const bTime = (b.created_at ? new Date(b.created_at) : new Date(`1970-01-01T${b.time}`)).getTime()
    return aTime - bTime
  })
  messages.value = allMessages

  nextTick(() => {
    console.log('   ✅ Messages updated after nextTick, new count:', messages.value.length)
    console.log('   ✅ Messages array:', messages.value)
    scrollToBottom()
  })
}, { immediate: true, deep: true })

const sendMessage = async () => {
  const currentConversationId = conversationId.value
  console.log('sendMessage called - conversationId:', currentConversationId)

  if (!messageInput.value.trim()) {
    console.log('Message input is empty')
    return
  }

  if (!currentConversationId) {
    console.error('conversationId is null or undefined!')
    return
  }

  const messageContent = messageInput.value
  const tempMessageId = `temp-${Date.now()}`

  // Optimistically add message to UI immediately (to optimisticMessages)
  const optimisticMsg = {
    id: tempMessageId,
    sender: 'me',
    text: messageContent,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  optimisticMessages.value.push(optimisticMsg)
  messages.value.push(optimisticMsg)
  scrollToBottom()

  messageInput.value = ''

  // Try to send via WebSocket first (real-time)
  const wsSent = websocket.sendMessage(messageContent)

  if (!wsSent) {
    // Fallback to HTTP if WebSocket is not connected
    console.log('WebSocket not connected, falling back to HTTP')
    try {
      const payload = {
        conversation_id: currentConversationId,
        content: messageContent
      }
      const response = await apiSendMessage(payload)
      console.log('HTTP message sent successfully:', response)

      // Replace optimistic message with real one from server if available
      if (response.data && response.data.id) {
        // Remove from optimisticMessages
        const optIdx = optimisticMessages.value.findIndex(m => m.id === tempMessageId)
        if (optIdx !== -1) optimisticMessages.value.splice(optIdx, 1)
        // Replace in messages
        const index = messages.value.findIndex(m => m.id === tempMessageId)
        if (index !== -1) {
          messages.value[index] = {
            id: response.data.id,
            sender: 'me',
            text: messageContent,
            time: new Date(response.data.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        }
      }
    } catch (error) {
      console.error('POST /chat/message error:', error)
      // Remove optimistic message on error
      const optIdx = optimisticMessages.value.findIndex(m => m.id === tempMessageId)
      if (optIdx !== -1) optimisticMessages.value.splice(optIdx, 1)
      const index = messages.value.findIndex(m => m.id === tempMessageId)
      if (index !== -1) {
        messages.value.splice(index, 1)
      }
      // Restore message input on error
      messageInput.value = messageContent
    }
  } else {
    console.log('Message sent via WebSocket, waiting for server response...')
    // The WebSocket message handler will update the message when server responds
    // For now, keep the optimistic message
  }
}

watch(() => props.friend?.id, () => {
  messages.value = []
  optimisticMessages.value = []
})

// WebSocket messages are handled by ChatView, which updates chatHistory
// ChatArea just watches chatHistory and displays messages
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-slate-50 w-full">
    
    <div class="h-16 md:h-20 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white/90 backdrop-blur-sm sticky top-0 z-20">
      <div class="flex items-center space-x-3">
        
        <button @click="emit('back')" class="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>

        <img :src="friend.avatar" :alt="friend.name" class="w-9 h-9 md:w-10 md:h-10 rounded-full border border-slate-200 shadow-sm" />
        <div>
          <h3 class="text-sm md:text-lg font-bold text-slate-800 leading-tight">{{ friend.name }}</h3>
          <p class="text-[10px] md:text-xs text-slate-500 flex items-center gap-1">
             <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
             <span v-if="!wsConnected" class="text-orange-500 ml-1">(Polling)</span>
          </p>
        </div>
      </div>
      
      <div class="flex space-x-2 md:space-x-4 text-slate-400">
        <button class="p-2 hover:bg-slate-100 rounded-full transition"><svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 bg-slate-50" ref="messagesContainer">
      <!-- Debug: Show message count -->
      <div v-if="false" class="text-xs text-gray-500 mb-2">
        Messages in array: {{ messages.length }} | History length: {{ props.chatHistory?.length || 0 }}
      </div>
      
      <div 
        v-for="msg in messages" 
        :key="msg.id"
        :class="['flex', msg.sender === 'me' ? 'justify-end' : 'justify-start']"
      >
        <div 
          :class="[
            'max-w-[80%] md:max-w-md px-4 py-2 md:px-6 md:py-3 rounded-2xl shadow-sm relative text-sm leading-relaxed wrap-break-word',
            msg.sender === 'me'
              ? 'bg-indigo-600 text-white rounded-br-none' 
              : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
          ]"
        >
          {{ msg.text }}
          <span 
            :class="[
              'text-[10px] block mt-1 opacity-70 text-right',
              msg.sender === 'me' ? 'text-indigo-100' : 'text-slate-400'
            ]"
          >
            {{ msg.time }}
          </span>
        </div>
      </div>
    </div>

    <div class="p-3 md:p-6 bg-white border-t border-slate-100">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-2 md:space-x-4">
        
        <input 
          v-model="messageInput"
          type="text" 
          placeholder="Message..." 
          class="flex-1 bg-slate-100 text-slate-800 placeholder-slate-400 px-4 py-2.5 md:py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm md:text-base"
        />
        
        <button 
          type="submit"
          class="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 md:p-3 rounded-xl shadow-md shadow-indigo-200 transition-transform active:scale-95 shrink-0"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
        </button>
      </form>
    </div>

  </div>
</template>