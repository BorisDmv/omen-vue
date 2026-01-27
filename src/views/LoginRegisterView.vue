<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100">
    <div class="w-full max-w-md bg-white rounded-lg shadow p-8">
      <h2 class="text-2xl font-bold mb-6 text-center">{{ isLogin ? 'Login' : 'Register' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label class="block mb-1 font-medium">Email</label>
          <input v-model="form.email" type="email" required class="w-full border rounded px-3 py-2" />
        </div>
        <div class="mb-4">
          <label class="block mb-1 font-medium">Password</label>
          <input v-model="form.password" type="password" required class="w-full border rounded px-3 py-2" />
        </div>
        <div v-if="!isLogin" class="mb-4">
          <label class="block mb-1 font-medium">Username</label>
          <input v-model="form.username" type="text" required class="w-full border rounded px-3 py-2" />
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">{{ isLogin ? 'Login' : 'Register' }}</button>
      </form>
      <div class="mt-4 text-center">
        <button @click="isLogin = !isLogin" class="text-blue-600 hover:underline">
          {{ isLogin ? 'Need an account? Register' : 'Already have an account? Login' }}
        </button>
      </div>
      <div v-if="error" class="mt-4 text-red-500 text-center">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '@/api'
import { useRouter } from 'vue-router'

const isLogin = ref(true)
const form = ref({ email: '', password: '', username: '' })
const error = ref('')
const router = useRouter()

const handleSubmit = async () => {
  error.value = ''
  try {
    if (isLogin.value) {
      const res = await api.post('/user/login', {
        email: form.value.email,
        password: form.value.password,
      })
      if (res.data.token) {
        localStorage.setItem('jwt', res.data.token)
        router.push('/')
      } else {
        error.value = 'Invalid response from server.'
      }
    } else {
      await api.post('/user/register', {
        email: form.value.email,
        password: form.value.password,
        username: form.value.username,
      })
      isLogin.value = true
    }
  } catch (e) {
    error.value = e.response?.data?.message || 'An error occurred.'
  }
}
</script>
