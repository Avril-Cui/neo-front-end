<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthAPI } from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isSignup = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

// Login form
const loginEmail = ref('')
const loginPassword = ref('')

// Signup form
const signupUsername = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirmPassword = ref('')

const handleLogin = async () => {
  errorMessage.value = ''

  if (!loginEmail.value || !loginPassword.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }

  isLoading.value = true

  try {
    const user = await AuthAPI.authenticateUser({
      email: loginEmail.value,
      password: loginPassword.value,
    })

    authStore.setUser({
      userId: user.userId,
      username: user.username,
      email: loginEmail.value,
      sessionToken: user.sessionToken,
    })

    // Redirect to home page
    router.push('/')
  } catch (error: any) {
    console.error('Login failed:', error)
    errorMessage.value = error.message || 'Login failed. Please check your credentials.'
  } finally {
    isLoading.value = false
  }
}

const handleSignup = async () => {
  errorMessage.value = ''

  if (!signupUsername.value || !signupEmail.value || !signupPassword.value || !signupConfirmPassword.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }

  if (signupPassword.value !== signupConfirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  if (signupPassword.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters'
    return
  }

  isLoading.value = true

  try {
    const user = await AuthAPI.registerUser({
      username: signupUsername.value,
      email: signupEmail.value,
      password: signupPassword.value,
    })

    authStore.setUser({
      userId: user.userId,
      username: user.username,
      email: signupEmail.value,
      sessionToken: user.sessionToken,
    })

    // Redirect to home page
    router.push('/')
  } catch (error: any) {
    console.error('Signup failed:', error)
    errorMessage.value = error.message || 'Signup failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const toggleMode = () => {
  isSignup.value = !isSignup.value
  errorMessage.value = ''
  // Clear form fields
  loginEmail.value = ''
  loginPassword.value = ''
  signupUsername.value = ''
  signupEmail.value = ''
  signupPassword.value = ''
  signupConfirmPassword.value = ''
}
</script>

<template>
  <div class="login-view">
    <div class="login-container">
      <div class="login-card">
        <div class="logo-section">
          <div class="logo">NEO</div>
          <p class="tagline">The ONE calendar app you need.</p>
        </div>

        <div class="form-section">
          <h2 class="form-title">{{ isSignup ? 'Create Account' : 'Welcome Back' }}</h2>

          <!-- Error Message -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Login Form -->
          <form v-if="!isSignup" @submit.prevent="handleLogin" class="auth-form">
            <div class="form-group">
              <label for="login-email">Email</label>
              <input
                id="login-email"
                v-model="loginEmail"
                type="email"
                placeholder="Enter your email"
                required
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="login-password">Password</label>
              <input
                id="login-password"
                v-model="loginPassword"
                type="password"
                placeholder="Enter your password"
                required
                :disabled="isLoading"
              />
            </div>

            <button type="submit" class="submit-button" :disabled="isLoading">
              {{ isLoading ? 'Logging in...' : 'Log In' }}
            </button>
          </form>

          <!-- Signup Form -->
          <form v-else @submit.prevent="handleSignup" class="auth-form">
            <div class="form-group">
              <label for="signup-username">Username</label>
              <input
                id="signup-username"
                v-model="signupUsername"
                type="text"
                placeholder="Choose a username"
                required
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="signup-email">Email</label>
              <input
                id="signup-email"
                v-model="signupEmail"
                type="email"
                placeholder="Enter your email"
                required
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="signup-password">Password</label>
              <input
                id="signup-password"
                v-model="signupPassword"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                required
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="signup-confirm-password">Confirm Password</label>
              <input
                id="signup-confirm-password"
                v-model="signupConfirmPassword"
                type="password"
                placeholder="Confirm your password"
                required
                :disabled="isLoading"
              />
            </div>

            <button type="submit" class="submit-button" :disabled="isLoading">
              {{ isLoading ? 'Creating account...' : 'Sign Up' }}
            </button>
          </form>

          <!-- Toggle Mode -->
          <div class="toggle-mode">
            <p v-if="!isSignup">
              Don't have an account?
              <button @click="toggleMode" class="toggle-button" :disabled="isLoading">
                Sign up
              </button>
            </p>
            <p v-else>
              Already have an account?
              <button @click="toggleMode" class="toggle-button" :disabled="isLoading">
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-view {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  width: 100vw;
}

.login-container {
  width: 100%;
  max-width: 440px;
}

.login-card {
  background: #2a2a2a;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #3a3a3a;
  overflow: hidden;
}

.logo-section {
  background: linear-gradient(135deg, #FF6F61 0%, #FF4500 100%);
  padding: 40px 32px;
  text-align: center;
}

.logo {
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -1px;
  color: white;
  margin-bottom: 8px;
}

.tagline {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.form-section {
  padding: 40px 32px;
}

.form-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 24px;
  text-align: center;
}

.error-message {
  background: rgba(255, 50, 50, 0.1);
  border: 1px solid rgba(255, 50, 50, 0.3);
  color: #FF6F61;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
}

.form-group input {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #F5E8D8;
  transition: all 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #FF6F61;
  box-shadow: 0 0 0 3px rgba(255, 111, 97, 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group input::placeholder {
  color: #666;
}

.submit-button {
  background: linear-gradient(135deg, #FF6F61 0%, #FF4500 100%);
  border: none;
  border-radius: 8px;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 111, 97, 0.4);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-mode {
  margin-top: 24px;
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid #3a3a3a;
}

.toggle-mode p {
  font-size: 14px;
  color: #AAA;
}

.toggle-button {
  background: none;
  border: none;
  color: #FF6F61;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  transition: all 0.2s ease;
}

.toggle-button:hover:not(:disabled) {
  color: #FF4500;
  text-decoration: underline;
}

.toggle-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
