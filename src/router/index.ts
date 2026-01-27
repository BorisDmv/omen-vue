import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import LoginRegisterView from '../views/LoginRegisterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginRegisterView,
    },
    {
      path: '/',
      name: 'home',
      component: ChatView,
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation guard for auth
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('jwt')
  if (to.meta.requiresAuth && !token) {
    next({ name: 'login' })
  } else if (to.name === 'login' && token) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
