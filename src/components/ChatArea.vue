<script setup>
import { ref, watch, nextTick, toRef, onMounted, onUnmounted } from 'vue'
import { sendMessage as apiSendMessage } from '@/api'
import websocket from '@/services/websocket'
import { Picker } from 'emoji-mart'

const props = defineProps({
  friend: Object,
  chatHistory: Array,
  conversationId: String,
  currentUserId: String,
  wsConnected: Boolean
})

// Debug: Log friend status whenever it changes
watch(() => props.friend, (newFriend) => {
  console.log('ChatArea: friend prop changed:', newFriend)
  if (newFriend) {
    console.log('ChatArea: friend.status =', newFriend.status)
  }
}, { immediate: true, deep: true })

const emit = defineEmits(['back'])

const messageInput = ref('')
const messageInputRef = ref(null)
const messagesContainer = ref(null)
const messages = ref([])
const showEmojiPicker = ref(false)
const emojiPickerRef = ref(null)
const emojiPickerContainerRef = ref(null)
const emojiButtonRef = ref(null)
let emojiPickerInstance = null
let emojiPickerTheme = null
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

  // Merge mappedMessages and remaining optimisticMessages, then sort by timestamp
  const allMessages = [...mappedMessages, ...optimisticMessages.value]
  // Use a reliable timestamp for sorting
  allMessages.sort((a, b) => {
    // Prefer created_at if available, else fallback to a numeric timestamp
    const aTimestamp = a.created_at
      ? new Date(a.created_at).getTime()
      : (a.timestamp ? a.timestamp : Date.now());
    const bTimestamp = b.created_at
      ? new Date(b.created_at).getTime()
      : (b.timestamp ? b.timestamp : Date.now());
    return aTimestamp - bTimestamp;
  });
  messages.value = allMessages;

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

  showEmojiPicker.value = false

  if (!currentConversationId) {
    console.error('conversationId is null or undefined!')
    return
  }

  const messageContent = messageInput.value
  const tempMessageId = `temp-${Date.now()}`

  // Optimistically add message to UI immediately (to optimisticMessages)
  const now = Date.now();
  const optimisticMsg = {
    id: tempMessageId,
    sender: 'me',
    text: messageContent,
    time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: now // Add a numeric timestamp for sorting
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

const isEmojiOnly = (text) => {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  const emojiRegex = /^([\p{Extended_Pictographic}\u200D\uFE0F]+)$/u
  const compact = trimmed.replace(/\s+/g, '')
  return emojiRegex.test(compact)
}

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const addEmoji = (emoji) => {
  const emojiValue = typeof emoji === 'string' ? emoji : (emoji?.native || '')
  if (!emojiValue) return
  messageInput.value += emojiValue
  nextTick(() => {
    messageInputRef.value?.focus()
  })
}

const getCurrentTheme = () => {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

const mountEmojiPicker = () => {
  if (!emojiPickerContainerRef.value) return
  const currentTheme = getCurrentTheme()
  if (!emojiPickerInstance || emojiPickerTheme !== currentTheme) {
    emojiPickerInstance = new Picker({
      data: async () => {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data')
        return response.json()
      },
      onEmojiSelect: addEmoji,
      set: 'native',
      theme: currentTheme,
      previewPosition: 'none',
      navPosition: 'top',
      perLine: 8,
      emojiSize: 20,
      emojiButtonSize: 36
    })
    emojiPickerTheme = currentTheme
  }
  emojiPickerContainerRef.value.replaceChildren(emojiPickerInstance)
}

const handleDocumentClick = (event) => {
  if (!showEmojiPicker.value) return
  const path = event.composedPath ? event.composedPath() : []
  const clickedInsidePicker = path.includes(emojiPickerRef.value)
  const clickedEmojiButton = path.includes(emojiButtonRef.value)

  if (clickedInsidePicker || clickedEmojiButton) {
    return
  }

  showEmojiPicker.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(showEmojiPicker, (isOpen) => {
  if (!isOpen) return
  nextTick(() => {
    mountEmojiPicker()
  })
})

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
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="(friend && friend.status === 'online') ? 'bg-green-500' : 'bg-gray-400'"
            ></span>
            <span v-if="friend && friend.status === 'online'">Online</span>
            <span v-else-if="friend && friend.status === 'offline'">Offline</span>
            <span v-else>—</span>
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 md:space-x-4 text-slate-400 relative">
        <!-- WebSocket status indicator -->
        <div v-if="wsConnected" class="flex items-center ml-2 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold shadow-sm border border-green-200 animate-fade-in">
          <svg class="w-3.5 h-3.5 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10"/></svg>
          WS Connected
        </div>
        <div v-else class="flex items-center ml-2 px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-semibold shadow-sm border border-orange-200 animate-fade-in">
          <svg class="w-3.5 h-3.5 mr-1 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10"/></svg>
          Polling
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 bg-slate-50" ref="messagesContainer">
      <!-- Debug: Show message count removed for cleaner UI -->
      
      <div 
        v-for="msg in messages" 
        :key="msg.id"
        :class="[
          'flex',
          msg.sender === 'me' ? 'justify-end' : 'justify-start',
          'w-full'
        ]"
      >
        <div
          :class="[
            'flex flex-col',
            msg.sender === 'me' ? 'items-end ml-auto max-w-[80%] md:max-w-md' : 'items-start max-w-[80%] md:max-w-md'
          ]"
        >
          <span v-if="msg.sender !== 'me'" class="text-xs font-semibold text-slate-500 mb-1 ml-1">{{ friend.name }}</span>
          <span v-else class="text-xs font-semibold text-indigo-400 mb-1 mr-1">me</span>
          <div 
            :class="[
              'px-4 py-2 md:px-6 md:py-3 rounded-2xl shadow-sm relative text-sm leading-relaxed wrap-break-word',
              msg.sender === 'me'
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
            ]"
          >
            <span :class="isEmojiOnly(msg.text) ? 'text-3xl leading-none' : ''">
              {{ msg.text }}
            </span>
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
    </div>

    <div class="p-3 md:p-6 bg-white border-t border-slate-100">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-2 md:space-x-4 relative">
        <input 
          v-model="messageInput"
          ref="messageInputRef"
          type="text" 
          placeholder="Message..." 
          class="flex-1 bg-slate-100 text-slate-800 placeholder-slate-400 px-4 py-3 md:py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-base md:text-lg"
        />
        <div class="relative">
          <button
            ref="emojiButtonRef"
            type="button"
            @click.stop="toggleEmojiPicker"
            class="p-2.5 md:p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition active:scale-95 shrink-0"
            aria-label="Open emoji picker"
            title="Emoji"
          >
            <span class="text-base md:text-lg">🙂</span>
          </button>
          <div
            v-if="showEmojiPicker"
            ref="emojiPickerRef"
            class="absolute bottom-full right-0 mb-2 z-30 rounded-xl overflow-hidden border border-slate-200 shadow-lg bg-white"
          >
            <div ref="emojiPickerContainerRef"></div>
          </div>
        </div>
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