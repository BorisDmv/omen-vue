<script setup>
import { ref, watch } from 'vue'
import { inviteFriend } from '../api.js'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'invite'])
const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const send = async () => {
  error.value = ''
  success.value = ''
  if (!email.value) {
    error.value = 'Please enter a user ID (UUID).'
    return
  }
  loading.value = true
  try {
    await inviteFriend(email.value)
    success.value = 'Invitation sent!'
    emit('invite', email.value)
    email.value = ''
  } catch (e) {
    error.value = e?.response?.data?.message || 'Failed to send invite.'
  } finally {
    loading.value = false
  }

// Clear messages when dialog is closed
watch(() => props.isOpen, (open) => {
  if (!open) {
    error.value = ''
    success.value = ''
  }
})  
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')"></div>
    <Transition name="fade">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden transform transition-all">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-slate-800">Invite a Friend</h3>
            <button @click="emit('close')" class="text-slate-400 hover:text-slate-600" aria-label="Close invite dialog">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <p class="text-slate-500 mb-6 text-sm">Enter the user ID (UUID) of the person you would like to invite to chat. This should be the unique identifier of the user you want to invite.</p>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-2" for="invite-uuid">User ID (UUID)</label>
              <input
                id="invite-uuid"
                v-model="email"
                type="text"
                placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                class="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                :disabled="loading"
                @keyup.enter="send"
                autocomplete="off"
                aria-label="User ID (UUID)"
              />
            </div>
            <div v-if="error" class="text-red-500 text-xs">{{ error }}</div>
            <div v-if="success" class="text-green-600 text-xs">{{ success }}</div>
          </div>
        </div>
        <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
          <button
            @click="emit('close')"
            :disabled="loading"
            class="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            @click="send"
            :disabled="loading"
            class="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
          >
            <span v-if="loading">Sending...</span>
            <span v-else>Send Invite</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>