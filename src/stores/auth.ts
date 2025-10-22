import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface User {
  userId: string
  username: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  // Load user from localStorage on initialization
  const storedUser = localStorage.getItem('user')
  if (storedUser) {
    try {
      user.value = JSON.parse(storedUser)
    } catch (e) {
      console.error('Failed to parse stored user:', e)
      localStorage.removeItem('user')
    }
  }

  function setUser(userData: User) {
    user.value = userData
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function clearUser() {
    user.value = null
    localStorage.removeItem('user')
  }

  function getCurrentUser() {
    return user.value
  }

  function getCurrentUserId() {
    return user.value?.userId || null
  }

  function getCurrentUsername() {
    return user.value?.username || null
  }

  return {
    user,
    isAuthenticated,
    setUser,
    clearUser,
    getCurrentUser,
    getCurrentUserId,
    getCurrentUsername,
  }
})
