<script setup>



const props = defineProps({
  currentUser: Object,
  friends: Array,
  activeId: Number,
  invites: {
    type: Array,
    default: () => []
  }
})

import { declineInvite } from '../api.js'

const emit = defineEmits(['selectFriend', 'openInvite', 'accept-invite', 'decline-invite'])


const copied = ref(false)
const copyIdToClipboard = () => {
  debugger;
  if (typeof window !== 'undefined' && window.navigator && window.navigator.clipboard) {
    window.navigator.clipboard.writeText(props.currentUser.id)
      .then(() => {
        copied.value = true
        setTimeout(() => { copied.value = false }, 1200)
      })
      .catch(() => alert('Failed to copy ID.'))
  } else {
    alert('Clipboard API not supported.')
  }
}

import { ref, watch, onMounted } from 'vue'
import { Settings, UserPlus } from 'lucide-vue-next'

const localInvites = ref([...props.invites])
watch(() => props.invites, (newVal) => {
  localInvites.value = [...newVal]
})

const isSettingsOpen = ref(false)
const theme = ref('light')

const applyTheme = (value) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-dark', value === 'dark')
  root.dataset.theme = value
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || savedTheme === 'light') {
    theme.value = savedTheme
  }
  applyTheme(theme.value)
})

watch(theme, (value) => {
  localStorage.setItem('theme', value)
  applyTheme(value)
})

const handleDeclineInvite = async (inviteId) => {
  try {
    await declineInvite(inviteId)
    localInvites.value = localInvites.value.filter(invite => invite.id !== inviteId)
    emit('decline-invite', inviteId)
  } catch (e) {
    alert('Failed to decline invite.')
  }
}
</script>

<template>
  <div class="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col justify-between z-10 h-full">
    
    <div class="p-6 border-b border-slate-100 flex items-center space-x-3 bg-white">
      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg shadow-sm">
        {{ currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '?' }}
      </div>
      <div>
        <h2 class="font-bold text-slate-800">{{ currentUser.username }}</h2>
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span>ID: {{ currentUser.id }}</span>
          <button
            @click="copyIdToClipboard"
            class="ml-1 px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold transition relative"
            title="Copy ID"
            :disabled="copied"
          >
            <span v-if="!copied">Copy</span>
            <span v-else class="text-green-600">Copied!</span>
          </button>
        </div>
        <div class="flex items-center space-x-1 mt-1">
          <span :class="['w-2 h-2 rounded-full', currentUser.status === 'online' ? 'bg-green-500' : 'bg-gray-400']"></span>
          <span class="text-xs text-slate-500 font-medium">{{ currentUser.status === 'online' ? 'Active Now' : 'Offline' }}</span>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-1">
      <div class="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Friends</div>
      <template v-if="!friends || friends.length === 0">
        <div class="text-center text-slate-400 py-8">
          No friends yet
        </div>
      </template>
      <template v-else>
        <button
          v-for="friend in friends"
          :key="friend.id"
          @click="emit('selectFriend', friend.id)"
          :class="[
            'w-full flex items-center p-3 rounded-xl transition-all duration-200',
            activeId === friend.id ? 'bg-indigo-50 shadow-sm' : 'hover:bg-slate-50',
            friend.pending ? 'opacity-60 cursor-not-allowed' : ''
          ]"
          :disabled="friend.pending"
        >
          <span class="relative">
            <img :src="friend.avatar" :alt="friend.name || friend.email" class="w-10 h-10 rounded-full object-cover" />
            <span
              class="absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full"
              :class="{
                'bg-green-500': friend.status === 'online',
                'bg-gray-400': friend.status === 'offline',
                'bg-red-500': friend.status === 'busy'
              }"
            ></span>
            <span v-if="friend.pending" class="absolute -top-1 -right-1 bg-yellow-400 text-white text-[10px] px-1.5 py-0.5 rounded shadow font-bold">Pending</span>
          </span>
          <span class="ml-3 text-left overflow-hidden">
            <span class="text-sm font-semibold text-slate-700 truncate block">{{ friend.name }}</span>
            <span class="text-xs text-slate-500 truncate block">{{ friend.lastMessage }}</span>
          </span>
        </button>
      </template>

      <template v-if="localInvites && localInvites.length">
        <div class="px-3 pb-2 text-xs font-semibold text-yellow-600 uppercase tracking-wider">Invites</div>
        <div v-for="invite in localInvites" :key="invite.id" class="flex flex-col md:flex-row md:items-center p-3 rounded-xl bg-yellow-50 border border-yellow-100 mb-2 overflow-hidden">
          <div class="flex-1 min-w-0">
            <span class="text-sm font-semibold text-yellow-800 truncate block">From: {{ invite.username || invite.email || invite.sender_id }}</span>
            <span class="text-xs text-yellow-700 truncate block">Invite ID: {{ invite.id }}</span>
          </div>
          <div class="flex flex-row mt-2 md:mt-0 md:ml-2 shrink-0 gap-1">
            <button
              class="px-2 py-1 rounded bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition"
              @click="$emit('accept-invite', invite.id)"
            >Accept</button>
            <button
              class="px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition"
              @click="handleDeclineInvite(invite.id)"
            >Decline</button>
          </div>
        </div>
      </template>
    </div>

    <div class="p-4 border-t border-slate-100 bg-white space-y-2">
      <button
        @click="isSettingsOpen = true"
        class="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl transition-colors font-medium"
      >
        <Settings class="h-5 w-5 shrink-0" />
        <span class="leading-none">Settings</span>
      </button>
      <button 
        @click="emit('openInvite')"
        class="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl transition-colors font-medium shadow-md shadow-indigo-200 active:scale-95"
      >
        <UserPlus class="h-5 w-5" />
        <span>Invite Friend</span>
      </button>
    </div>
  </div>

  <div v-if="isSettingsOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="isSettingsOpen = false"></div>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-slate-800">Settings</h3>
          <button @click="isSettingsOpen = false" class="text-slate-400 hover:text-slate-600" aria-label="Close settings">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase mb-2">Theme</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="theme = 'light'"
                :class="[
                  'px-3 py-2 rounded-lg border text-sm font-semibold transition',
                  theme === 'light'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                ]"
              >
                Light
              </button>
              <button
                type="button"
                @click="theme = 'dark'"
                :class="[
                  'px-3 py-2 rounded-lg border text-sm font-semibold transition',
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                ]"
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>