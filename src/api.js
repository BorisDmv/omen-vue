import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
})

// Add JWT token to requests if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jwt')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Utility to decode JWT and get user ID
export const getCurrentUserId = () => {
  try {
    const token = localStorage.getItem('jwt')
    if (!token) return null
    // JWT format: header.payload.signature
    const payload = token.split('.')[1]
    if (!payload) return null
    // Decode base64
    const decoded = JSON.parse(atob(payload))
    // Return user_id or id or sub (common JWT fields for user ID)
    return decoded.user_id || decoded.id || decoded.sub || null
  } catch (e) {
    console.error('Error decoding JWT:', e)
    return null
  }
}

// Chat API methods
export const startChat = (friendId) => api.post('/chat/start', { friend_id: friendId })
export const sendMessage = ({ conversation_id, content }) => {
  console.log('api.sendMessage called with:', { conversation_id, content })
  console.log('api.sendMessage conversation_id value:', conversation_id)
  console.log('api.sendMessage conversation_id type:', typeof conversation_id)
  const payload = { conversation_id, content }
  console.log('api.sendMessage payload:', payload)
  return api.post('/chat/message', payload)
}
export const getChatHistory = (conversationId) => api.get(`/chat/history?room=${conversationId}`)
export const getFriends = () => api.get('/user/friends')

// Invite API methods
export const acceptInvite = (inviteId) => api.post('/accept', { invite_id: inviteId })
export const declineInvite = (inviteId) => api.post('/decline', { invite_id: inviteId })

export default api
