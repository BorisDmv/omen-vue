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

const emit = defineEmits(['selectFriend', 'openInvite'])

const copyIdToClipboard = () => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.clipboard) {
    window.navigator.clipboard.writeText(props.currentUser.id)
      .catch(() => alert('Failed to copy ID.'))
  } else {
    alert('Clipboard API not supported.')
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
            class="ml-1 px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold transition"
            title="Copy ID"
          >Copy</button>
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

      <template v-if="invites && invites.length">
        <div class="px-3 pb-2 text-xs font-semibold text-yellow-600 uppercase tracking-wider">Invites</div>
        <div v-for="invite in invites" :key="invite.id" class="flex flex-col md:flex-row md:items-center p-3 rounded-xl bg-yellow-50 border border-yellow-100 mb-2 overflow-hidden">
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
              @click="$emit('decline-invite', invite.id)"
            >Decline</button>
          </div>
        </div>
      </template>
    </div>

    <div class="p-4 border-t border-slate-100 bg-white">
      <button 
        @click="emit('openInvite')"
        class="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl transition-colors font-medium shadow-md shadow-indigo-200 active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0 1 1 0 002 0zM16 9a1 1 0 10-2 0 1 1 0 002 0z" />
        </svg>
        <span>Invite Friend</span>
      </button>
    </div>
  </div>
</template>