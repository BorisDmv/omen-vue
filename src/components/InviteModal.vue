<script setup>
import { ref } from 'vue'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'invite'])
const email = ref('')

const send = () => {
  if (email.value) {
    emit('invite', email.value)
    email.value = ''
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')"></div>
      
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden transform transition-all">
        
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-slate-800">Invite a Friend</h3>
            <button @click="emit('close')" class="text-slate-400 hover:text-slate-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <p class="text-slate-500 mb-6 text-sm">Enter the email address of the person you would like to chat with.</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-2">Email Address</label>
              <input 
                v-model="email"
                type="email" 
                placeholder="friend@example.com" 
                class="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                @keyup.enter="send"
              />
            </div>
          </div>
        </div>

        <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
          <button 
            @click="emit('close')"
            class="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            @click="send"
            class="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            Send Invite
          </button>
        </div>

      </div>
    </div>
  </Transition>
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