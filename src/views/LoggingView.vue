<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { TaskCatalogAPI, RoutineLogAPI, ScheduleTimeAPI, type Task, type Session } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { getCurrentDate } from '../utils/time'

// Router
const router = useRouter()

// Auth store
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'

const handleLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    authStore.clearUser()
    router.push('/login')
  }
}

// Timer state
const isRunning = ref(false)
const isPaused = ref(false)
const startTime = ref(0)
const elapsedTime = ref(0)
const plannedDuration = ref(60) // minutes
let timerInterval: number | null = null
const has100PercentNotificationSent = ref(false) // Track if 100% notification was sent

// Session state
const currentSessionName = ref('Select a task')
const taskInput = ref('Select a task or create a new session')
const durationValue = ref(1) // hours
const isSplitActive = ref(true)
const showNewSessionForm = ref(false)
const showPauseModal = ref(false)
const showTaskSuggestions = ref(false)
const selectedPauseReason = ref('')

// User tasks from API
const userTasks = ref<Task[]>([])
const isLoadingTasks = ref(false)

// Schedule data
const schedules = ref<any[]>([])

// Current session tracking
const currentSessionId = ref<string | null>(null)
const selectedTaskId = ref<string | null>(null)

// New session form
const newSessionName = ref('')

// Created sessions (sessions created via the form)
const createdSessions = ref<Array<{ sessionId: string; sessionName: string }>>([])

// Active view
const activeView = ref('Logging')

// Navigation functions
const navigateToToday = () => {
  router.push('/')
}

const navigateToCompare = () => {
  router.push('/compare')
}

const navigateToLogging = () => {
  router.push('/logging')
}

const navigateToTasks = () => {
  router.push('/tasks')
}

// Computed stats
const elapsedMinutes = computed(() => Math.floor(elapsedTime.value / 60000))
const remainingMinutes = computed(() => Math.max(0, plannedDuration.value - elapsedMinutes.value))
const progressPercent = computed(() =>
  Math.min(100, (elapsedMinutes.value / plannedDuration.value) * 100),
)

// Format time display
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const timerDisplay = computed(() => formatTime(elapsedTime.value))

// Computed: Map tasks to their scheduled times
const taskScheduleTimes = computed(() => {
  const taskTimeMap = new Map<string, { start: number; end: number }>()

  schedules.value.forEach(schedule => {
    schedule.taskIdSet.forEach((taskId: string) => {
      // Store the earliest scheduled time for each task
      if (!taskTimeMap.has(taskId) || schedule.start < taskTimeMap.get(taskId)!.start) {
        taskTimeMap.set(taskId, { start: schedule.start, end: schedule.end })
      }
    })
  })

  return taskTimeMap
})

// Helper: Get scheduled time for a task
const getScheduledTime = (taskId: string): string | null => {
  const scheduleTime = taskScheduleTimes.value.get(taskId)
  if (!scheduleTime) return null

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  const dateStr = formatDate(scheduleTime.start)
  const timeRange = `${formatTime(scheduleTime.start)} - ${formatTime(scheduleTime.end)}`

  return `${dateStr} • ${timeRange}`
}

// Timer controls
const startTimer = async () => {
  try {
    // Validate that a task is selected
    if (!currentSessionName.value || currentSessionName.value === 'Select a task') {
      alert('Please select a task before starting the timer')
      return
    }

    // Always create a new session (don't reuse existing sessionId)
    // This prevents issues with trying to start an already-active session
    console.log('Creating session:', {
      owner: CURRENT_USER,
      sessionName: currentSessionName.value,
      linkedTaskId: selectedTaskId.value
    })

    // 1. Create the session
    const createParams: any = {
      owner: CURRENT_USER,
      sessionName: currentSessionName.value
    }

    // Only add linkedTaskId if a task was selected
    if (selectedTaskId.value) {
      createParams.linkedTaskId = selectedTaskId.value
    }

    const createResult = await RoutineLogAPI.createSession(createParams)

    // Extract the session ID from the returned session object
    const sessionId = typeof createResult.session === 'string'
      ? createResult.session
      : (createResult.session as any)._id

    currentSessionId.value = sessionId

    console.log('Session created with ID:', sessionId)

    // 2. Start the session
    await RoutineLogAPI.startSession(CURRENT_USER, { _id: sessionId })

    console.log('Session started:', currentSessionId.value)

    // 3. Start the local timer
    isRunning.value = true
    isPaused.value = false
    startTime.value = Date.now() - elapsedTime.value
    has100PercentNotificationSent.value = false // Reset notification flag for new session

    timerInterval = window.setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
      checkAndSendProgressNotification()
    }, 100)
  } catch (error: any) {
    console.error('Failed to start session:', error)
    alert(`Failed to start session: ${error.message || 'Unknown error'}`)

    // Clear the session ID so next attempt creates a new session
    currentSessionId.value = null

    // Stop the timer if it was started
    isRunning.value = false
    isPaused.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }
}

// Check progress and send notification if 100% is reached
const checkAndSendProgressNotification = () => {
  // Check if progress has reached 100% and notification hasn't been sent yet
  if (progressPercent.value >= 100 && !has100PercentNotificationSent.value) {
    has100PercentNotificationSent.value = true
    sendProgressNotification()
  }
}

// Send browser notification for 100% progress
const sendProgressNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const taskName = currentSessionName.value !== 'Select a task'
      ? currentSessionName.value
      : 'Current task'

    new Notification('🎉 100% Progress Reached!', {
      body: `You've completed the planned duration for "${taskName}". Great work!`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'progress-100',
      requireInteraction: false
    })
  }
}

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch (error) {
      console.error('Failed to request notification permission:', error)
    }
  }
}

const showCompletionModal = ref(false)

const stopTimer = async () => {
  // Show completion modal instead of confirm dialog
  showCompletionModal.value = true
}

const confirmCompletion = async (isCompleted: boolean) => {
  try {
    // End the session in the backend if we have a session ID
    if (currentSessionId.value) {
      await RoutineLogAPI.endSession(CURRENT_USER, { _id: currentSessionId.value }, isCompleted)
      console.log('Session ended:', currentSessionId.value, 'isCompleted:', isCompleted)
    }

    isRunning.value = false
    isPaused.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    showCompletionModal.value = false

    const statusText = isCompleted ? 'completed' : 'not completed'
    alert(`Session ended (${statusText})! Time: ${formatTime(elapsedTime.value)}`)

    // Reset session tracking
    currentSessionId.value = null

    // Reset the timer
    elapsedTime.value = 0

    // Refresh session logs
    await fetchUserSessions()
  } catch (error: any) {
    console.error('Failed to end session:', error)
    alert(`Failed to end session: ${error.message || 'Unknown error'}`)
  }
}

const cancelCompletion = () => {
  showCompletionModal.value = false
}

const interruptTimer = () => {
  showPauseModal.value = true
}

const confirmInterrupt = async () => {
  if (!selectedPauseReason.value) {
    alert('Please select a reason for interrupting')
    return
  }

  try {
    // Interrupt the session in the backend if we have a session ID
    if (currentSessionId.value) {
      await RoutineLogAPI.interruptSession(
        CURRENT_USER,
        { _id: currentSessionId.value },
        selectedPauseReason.value
      )
      console.log('Session interrupted:', currentSessionId.value, selectedPauseReason.value)
    }

    // Stop the timer completely when interrupted
    isPaused.value = false
    isRunning.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    console.log('Session interrupted:', selectedPauseReason.value)
    showPauseModal.value = false
    selectedPauseReason.value = ''

    // Reset session tracking
    currentSessionId.value = null

    // Reset the timer
    elapsedTime.value = 0

    // Refresh session logs
    await fetchUserSessions()
  } catch (error: any) {
    console.error('Failed to interrupt session:', error)
    alert(`Failed to interrupt session: ${error.message || 'Unknown error'}`)
  }
}

const resetTimer = () => {
  isRunning.value = false
  isPaused.value = false
  elapsedTime.value = 0
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

const toggleTimer = () => {
  if (!isRunning.value) {
    startTimer()
  } else {
    stopTimer()
  }
}

// Duration controls
const adjustDuration = (change: number) => {
  const newValue = durationValue.value + change
  if (newValue >= 1 && newValue <= 8) {
    durationValue.value = newValue
    plannedDuration.value = newValue * 60
  }
}

// Session controls
const toggleSplit = () => {
  isSplitActive.value = !isSplitActive.value
}

const toggleNewSession = () => {
  showNewSessionForm.value = !showNewSessionForm.value
}

const createNewSession = async () => {
  if (!newSessionName.value.trim()) {
    alert('Please enter a session name')
    return
  }

  try {
    // Create session in backend without linkedTaskId
    const response = await RoutineLogAPI.createSession({
      owner: CURRENT_USER,
      sessionName: newSessionName.value.trim()
    })

    console.log('Created session:', response)

    // Store the created session
    createdSessions.value.push({
      sessionId: response.session,
      sessionName: newSessionName.value.trim()
    })

    // Set it as the current session name
    taskInput.value = newSessionName.value.trim()
    currentSessionName.value = newSessionName.value.trim()

    // Close form and clear input
    showNewSessionForm.value = false
    newSessionName.value = ''

    alert(`Session "${currentSessionName.value}" created! Click Start to begin.`)
  } catch (error: any) {
    console.error('Failed to create session:', error)
    alert(`Failed to create session: ${error.message || 'Unknown error'}`)
  }
}

const cancelNewSession = () => {
  showNewSessionForm.value = false
  newSessionName.value = ''
}

const selectPauseReason = (reason: string) => {
  selectedPauseReason.value = reason
}

const hidePauseModal = () => {
  showPauseModal.value = false
  selectedPauseReason.value = ''
}

// Computed: Sort tasks by scheduled time proximity to current time
const sortedUserTasks = computed(() => {
  const now = Date.now()

  return [...userTasks.value].sort((a, b) => {
    const aSchedule = taskScheduleTimes.value.get(a.taskId)
    const bSchedule = taskScheduleTimes.value.get(b.taskId)

    // Tasks without schedules go to the end
    if (!aSchedule && !bSchedule) return 0
    if (!aSchedule) return 1
    if (!bSchedule) return -1

    // Calculate time difference from now (absolute value)
    const aDiff = Math.abs(aSchedule.start - now)
    const bDiff = Math.abs(bSchedule.start - now)

    // Sort by proximity (closest to current time first)
    return aDiff - bDiff
  })
})

// Fetch user tasks from API
const fetchUserTasks = async () => {
  try {
    isLoadingTasks.value = true
    const tasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    userTasks.value = tasks
    console.log('Fetched user tasks:', userTasks.value)
  } catch (error: any) {
    console.error('Failed to fetch user tasks:', error)
    if (!error.message?.includes('No tasks found')) {
      alert(`Failed to load tasks: ${error.message || 'Unknown error'}`)
    }
    userTasks.value = []
  } finally {
    isLoadingTasks.value = false
  }
}

// Fetch schedule data
const fetchSchedules = async () => {
  try {
    schedules.value = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    console.log('Fetched schedules:', schedules.value)
  } catch (error: any) {
    console.error('Failed to fetch schedules:', error)
    schedules.value = []
  }
}

// Show task suggestions when clicking on task input
const showTaskSuggestionsDropdown = () => {
  showTaskSuggestions.value = true
}

// Hide task suggestions
const hideTaskSuggestionsDropdown = () => {
  setTimeout(() => {
    showTaskSuggestions.value = false
  }, 200)
}

// Select a task from suggestions
const selectTaskFromSuggestions = (task: Task) => {
  taskInput.value = task.taskName
  currentSessionName.value = task.taskName
  plannedDuration.value = task.duration
  durationValue.value = Math.ceil(task.duration / 60)
  selectedTaskId.value = task.taskId  // Save the task ID for session creation
  showTaskSuggestions.value = false
}

// Select a created session
const selectCreatedSession = (session: { sessionId: string; sessionName: string }) => {
  taskInput.value = session.sessionName
  currentSessionName.value = session.sessionName
  // For ad-hoc sessions, we can use the existing session ID
  currentSessionId.value = session.sessionId
  selectedTaskId.value = null  // No linked task
  showTaskSuggestions.value = false
}

// Helper to get priority label
const getPriorityLabel = (priority: number): string => {
  const labels = ['lowest', 'low', 'medium', 'high', 'highest']
  return labels[priority - 1] || 'medium'
}

// Mock data for existing tasks
const existingTasks = [
  {
    name: 'Data Analysis & Review',
    category: 'work',
    type: 'planned',
    time: '2:30 - 4:00 PM',
    categoryLabel: 'Work',
  },
  {
    name: 'Evening Study Session',
    category: 'education',
    type: 'planned',
    time: '5:30 - 6:30 PM',
    categoryLabel: 'Education',
  },
  {
    name: 'Project Planning',
    category: 'work',
    type: 'planned',
    time: '7:00 - 8:00 PM',
    categoryLabel: 'Work',
  },
  {
    name: 'Morning Workout',
    category: 'health',
    type: 'planned',
    time: '7:00 - 8:30 AM',
    categoryLabel: 'Health & Fitness',
  },
]

// Session logs from API
interface SessionLog {
  id: string
  name: string
  category?: string
  type: string
  time: string
  duration?: string
  progress?: number
  remaining?: string
  planned?: string
  status?: string
  deviation?: string
  deviationType?: string
  active: boolean
  isDone?: boolean
  timeSaved?: string
}

const sessionLogs = ref<SessionLog[]>([])
const isLoadingSessions = ref(false)

// Helper to format time from timestamp
const formatTimeFromTimestamp = (timestamp: string | number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

// Helper to format duration in hours and minutes
const formatDuration = (milliseconds: number): string => {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

// Calculate duration between two timestamps
const calculateDuration = (start: string | number, end: string | number): number => {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  return endTime - startTime
}

// Delete a session
const deleteSession = async (sessionLog: SessionLog, event: MouseEvent) => {
  // Stop propagation to prevent triggering the resume action
  event.stopPropagation()

  if (!confirm(`Are you sure you want to delete the session "${sessionLog.name}"?`)) {
    return
  }

  try {
    await RoutineLogAPI.deleteSession(CURRENT_USER, { _id: sessionLog.id })
    console.log('Session deleted:', sessionLog.id)

    // Refresh the session list
    await fetchUserSessions()

    alert('Session deleted successfully')
  } catch (error: any) {
    console.error('Failed to delete session:', error)
    alert(`Failed to delete session: ${error.message || 'Unknown error'}`)
  }
}

// Resume an active session by clicking on it
const resumeActiveSession = async (sessionLog: SessionLog) => {
  // Only allow resuming active sessions
  if (!sessionLog.active) {
    return
  }

  try {
    // Fetch all sessions to get the full session data
    const sessions = await RoutineLogAPI.getUserSessions(CURRENT_USER)
    const session = sessions.find(s => s.sessionId === sessionLog.id)

    if (!session || !session.isActive || !session.start) {
      alert('Cannot resume this session')
      return
    }

    // Set current session info
    currentSessionId.value = session.sessionId
    currentSessionName.value = session.sessionName
    selectedTaskId.value = session.linkedTaskId || null

    // Calculate elapsed time since session started
    const startTimestamp = new Date(session.start).getTime()
    const now = Date.now()
    const elapsed = now - startTimestamp

    // Update timer state
    startTime.value = startTimestamp
    elapsedTime.value = elapsed
    isRunning.value = true
    isPaused.value = session.isPaused

    // Reset or set notification flag based on current progress
    // If already past 100%, mark as sent to avoid duplicate notifications
    const elapsedMinutes = Math.floor(elapsed / 60000)

    // If session has a linked task, get its duration
    if (session.linkedTaskId) {
      try {
        const task = await TaskCatalogAPI.getTask(CURRENT_USER, session.linkedTaskId)
        plannedDuration.value = task.duration
        taskInput.value = task.taskName
      } catch (error) {
        console.error('Failed to fetch linked task:', error)
      }
    } else {
      // For ad-hoc sessions, use default duration
      plannedDuration.value = durationValue.value * 60
      taskInput.value = session.sessionName
    }

    // Check if session already exceeded 100% to avoid duplicate notifications
    has100PercentNotificationSent.value = elapsedMinutes >= plannedDuration.value

    // Start the timer interval
    if (timerInterval) {
      clearInterval(timerInterval)
    }
    timerInterval = window.setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
      checkAndSendProgressNotification()
    }, 100)

    console.log('Resumed active session:', session.sessionName)
  } catch (error) {
    console.error('Failed to resume session:', error)
    alert('Failed to resume session')
  }
}

// Fetch and process user sessions
// Helper to check if a timestamp is today
const isToday = (timestamp: string | number): boolean => {
  const date = new Date(timestamp)
  const today = getCurrentDate()
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate()
}

const fetchUserSessions = async () => {
  try {
    isLoadingSessions.value = true
    const allSessions = await RoutineLogAPI.getUserSessions(CURRENT_USER)

    // Check if sessions is an array (successful response)
    if (!Array.isArray(allSessions)) {
      console.log('No sessions found or invalid response')
      sessionLogs.value = []
      return
    }

    // Filter sessions to only show those from today
    const sessions = allSessions.filter(session => {
      // Only show sessions that started today
      if (session.start) {
        return isToday(session.start)
      }
      // For sessions without a start time (not yet started), show them
      return true
    })

    console.log(`Filtered ${sessions.length} sessions for today from ${allSessions.length} total sessions`)

    // Process each session to build the session log data
    const logs: SessionLog[] = []

    for (const session of sessions) {
      const log: SessionLog = {
        id: session.sessionId,
        name: session.sessionName,
        type: session.linkedTaskId ? 'Planned' : 'Ad-hoc',
        active: session.isActive,
        isDone: session.isDone,
        time: '',
        duration: undefined,
        category: undefined,
        progress: undefined,
        planned: undefined,
        remaining: undefined,
        status: undefined,
        deviation: undefined,
        deviationType: undefined,
        timeSaved: undefined
      }

      // Fetch linked task if exists
      if (session.linkedTaskId) {
        try {
          const task = await TaskCatalogAPI.getTask(CURRENT_USER, session.linkedTaskId)
          log.category = task.category

          // Calculate planned duration from time blocks
          let totalPlannedDuration = 0
          for (const timeBlockId of task.timeBlockSet) {
            try {
              const timeBlock = await ScheduleTimeAPI.getTaskSchedule(CURRENT_USER, timeBlockId)
              totalPlannedDuration += calculateDuration(timeBlock.start, timeBlock.end)
            } catch (error) {
              console.error(`Failed to fetch time block ${timeBlockId}:`, error)
            }
          }

          if (totalPlannedDuration > 0) {
            log.planned = formatDuration(totalPlannedDuration)

            // Calculate progress and remaining if session has ended
            if (session.start && session.end) {
              const sessionDuration = calculateDuration(session.start, session.end)
              const progressPercent = Math.round((sessionDuration / totalPlannedDuration) * 100)
              log.progress = progressPercent

              const remainingDuration = totalPlannedDuration - sessionDuration
              log.remaining = remainingDuration > 0 ? formatDuration(remainingDuration) : '0m'

              // Calculate deviation
              const deviationMs = sessionDuration - totalPlannedDuration
              if (Math.abs(deviationMs) < 60000) { // Within 1 minute
                log.deviation = '✓ Perfect timing'
                log.deviationType = 'positive'
              } else if (deviationMs > 0) {
                log.deviation = `+${formatDuration(deviationMs)} overtime`
                log.deviationType = 'negative'
              } else {
                // If task was finished and completed early, show "faster"
                if (session.isDone) {
                  log.deviation = `${formatDuration(Math.abs(deviationMs))} faster`
                  log.timeSaved = formatDuration(Math.abs(deviationMs))
                } else {
                  log.deviation = `-${formatDuration(Math.abs(deviationMs))} under`
                }
                log.deviationType = 'positive'
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch task ${session.linkedTaskId}:`, error)
        }
      }

      // Format time display
      if (session.isActive && session.start) {
        log.time = `Started ${formatTimeFromTimestamp(session.start)}`
        log.duration = 'ACTIVE'
      } else if (session.start && session.end) {
        log.time = `${formatTimeFromTimestamp(session.start)} - ${formatTimeFromTimestamp(session.end)}`
        const sessionDuration = calculateDuration(session.start, session.end)
        log.duration = formatDuration(sessionDuration)
      } else if (session.start) {
        log.time = `Started ${formatTimeFromTimestamp(session.start)}`
      }

      logs.push(log)
    }

    sessionLogs.value = logs
  } catch (error: any) {
    console.error('Failed to fetch user sessions:', error)
    if (!error.message?.includes('No sessions found')) {
      // Don't alert for no sessions, just show empty list
      console.warn('No sessions found for user')
    }
    sessionLogs.value = []
  } finally {
    isLoadingSessions.value = false
  }
}

const pauseReasons = [
  { emoji: '☕', text: 'Break - Coffee/Water' },
  { emoji: '🚻', text: 'Break - Bathroom' },
  { emoji: '📞', text: 'Interruption - Call/Meeting' },
  { emoji: '👥', text: 'Interruption - Colleague' },
  { emoji: '🚨', text: 'Task Switch - Urgent' },
  { emoji: '🧠', text: 'Mental Break - Overwhelmed' },
  { emoji: '💻', text: 'Technical Issue' },
  { emoji: '❓', text: 'Other Reason' },
]

// Fetch tasks and sessions on mount
onMounted(() => {
  fetchUserTasks()
  fetchUserSessions()
  fetchSchedules()
  requestNotificationPermission()
})

// Cleanup
onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <div class="logging-view">
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">NEO</div>
          <div class="view-toggle">
            <button class="toggle-option" @click="navigateToToday">Today</button>
            <button class="toggle-option" @click="navigateToCompare">Compare</button>
            <button class="toggle-option active" @click="navigateToLogging">Logging</button>
            <button class="toggle-option" @click="navigateToTasks">Tasks</button>
          </div>
        </div>
        <div class="user-section">
          <span class="username">{{ authStore.getCurrentUsername() }}</span>
          <button class="logout-button" @click="handleLogout" title="Log out">
            Log Out
          </button>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="session-header">
        <div class="session-title-main">Record Session</div>
        <div class="session-subtitle">Track your focused work time</div>
      </div>

      <div class="task-input-field">
        <input
          type="text"
          class="task-input"
          v-model="taskInput"
          placeholder="Task name..."
          readonly
          @click="showTaskSuggestionsDropdown"
          @blur="hideTaskSuggestionsDropdown"
        />

        <!-- Task Suggestions Dropdown -->
        <div class="suggestions-dropdown" :class="{ active: showTaskSuggestions }">
          <div v-if="isLoadingTasks" class="suggestion-item">
            <div class="suggestion-main">
              <div class="suggestion-name">Loading tasks...</div>
            </div>
          </div>
          <template v-else>
            <!-- Created Sessions Section -->
            <div v-if="createdSessions.length > 0">
              <div class="suggestions-section-header">Created Sessions</div>
              <div
                v-for="session in createdSessions"
                :key="session.sessionId"
                class="suggestion-item"
                @mousedown="selectCreatedSession(session)"
              >
                <div class="suggestion-main">
                  <div class="suggestion-name">{{ session.sessionName }}</div>
                  <div class="suggestion-details">Ad-hoc session</div>
                </div>
                <div class="suggestion-badge session-badge">Session</div>
              </div>
              <div class="suggestions-divider"></div>
            </div>

            <!-- Planned Tasks Section -->
            <div v-if="userTasks.length === 0 && createdSessions.length === 0" class="suggestion-item">
              <div class="suggestion-main">
                <div class="suggestion-name">No tasks or sessions</div>
                <div class="suggestion-details">Create a task in Today view or create a session below</div>
              </div>
            </div>
            <template v-else>
              <div v-if="userTasks.length > 0" class="suggestions-section-header">Planned Tasks</div>
              <div
                v-for="task in sortedUserTasks"
                :key="task.taskId"
                class="suggestion-item"
                @mousedown="selectTaskFromSuggestions(task)"
              >
                <div class="suggestion-main">
                  <div class="suggestion-name">
                    {{ task.taskName }}
                    <span v-if="getScheduledTime(task.taskId)" class="scheduled-time-badge">
                      {{ getScheduledTime(task.taskId) }}
                    </span>
                  </div>
                  <div class="suggestion-details">
                    {{ task.category }} • {{ task.duration }} min
                    <span v-if="task.deadline"> • Due: {{ new Date(task.deadline).toLocaleDateString() }}</span>
                  </div>
                </div>
                <div class="suggestion-badge">{{ getPriorityLabel(task.priority) }}</div>
              </div>
            </template>
          </template>
        </div>

        <button class="new-session-toggle" @click="toggleNewSession">+ Create new session</button>
        <div class="new-session-form" :class="{ active: showNewSessionForm }">
          <div class="form-row">
            <div class="form-field" style="grid-column: 1 / -1">
              <label class="form-label">Session Name</label>
              <textarea
                class="form-textarea session-name-input"
                v-model="newSessionName"
                placeholder="Enter session name (e.g., Deep work on project report, Morning workout, Team meeting prep)"
                rows="3"
                @keydown.enter.prevent="createNewSession"
              ></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="form-btn primary" @click="createNewSession">Create Session</button>
            <button class="form-btn secondary" @click="cancelNewSession">Cancel</button>
          </div>
        </div>
      </div>


      <div class="timer-section">
        <div class="current-session-name">
          <div class="session-title">{{ currentSessionName }}</div>
          <div class="session-subtitle">Current Session</div>
        </div>
        <div class="timer-display" :class="{ running: isRunning }">
          {{ timerDisplay }}
        </div>
        <div class="timer-controls">
          <button class="start-button" :class="{ stop: isRunning }" @click="toggleTimer">
            {{ isRunning ? 'END' : 'START' }}
          </button>
          <button v-if="isRunning" class="start-button interrupt-button" @click="interruptTimer">
            INTERRUPT
          </button>
        </div>
      </div>

      <div class="session-stats">
        <div class="stat-card elapsed">
          <div class="stat-value">{{ String(elapsedMinutes).padStart(2, '0') }}m</div>
          <div class="stat-label">Elapsed</div>
          <div class="progress-indicator" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="stat-card remaining">
          <div class="stat-value">{{ String(remainingMinutes).padStart(2, '0') }}m</div>
          <div class="stat-label">Remaining</div>
          <div class="progress-indicator" :style="{ width: 100 - progressPercent + '%' }"></div>
        </div>
        <div class="stat-card progress">
          <div class="stat-value">{{ Math.round(progressPercent) }}%</div>
          <div class="stat-label">Progress</div>
          <div class="progress-indicator" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="stat-card session">
          <div class="stat-value">01</div>
          <div class="stat-label">Session</div>
          <div class="progress-indicator" style="width: 25%"></div>
        </div>
      </div>

      <!-- Session Logs -->
      <div class="session-logs">
        <div class="logs-title">📊 Today's Sessions</div>
        <div class="session-list">
          <div
            v-for="log in sessionLogs"
            :key="log.id"
            class="session-item"
            :class="{ active: log.active, clickable: log.active }"
            @click="log.active ? resumeActiveSession(log) : null"
          >
            <button
              class="delete-session-button"
              @click="deleteSession(log, $event)"
              title="Delete session"
            >
              ✕
            </button>
            <div class="session-header-item">
              <div class="session-info">
                <div class="session-name">{{ log.name }}</div>
                <div class="session-meta">
                  <span v-if="log.category" class="session-category">{{ log.category }}</span>
                  <span class="session-type">{{ log.type }}</span>
                  <span v-if="!log.active && log.isDone !== undefined"
                        class="session-completion"
                        :class="{ finished: log.isDone, incomplete: !log.isDone }">
                    {{ log.isDone ? 'Finished' : 'Incomplete' }}
                  </span>
                  <span>{{ log.time }}</span>
                </div>
              </div>
              <div v-if="log.active" class="session-active-tag">ACTIVE</div>
              <div v-else class="session-duration">{{ log.duration }}</div>
            </div>
            <div v-if="log.type === 'Planned' && (log.progress || log.planned)" class="session-progress">
              <div v-if="log.progress" class="progress-item">
                <div class="progress-value">{{ log.progress }}%</div>
                <div class="progress-label">Progress</div>
              </div>
              <div v-if="log.planned" class="progress-item">
                <div class="progress-value">{{ log.planned }}</div>
                <div class="progress-label">Planned</div>
              </div>
              <div v-if="log.remaining" class="progress-item">
                <div class="progress-value">{{ log.remaining }}</div>
                <div class="progress-label">Remaining</div>
              </div>
              <div v-if="log.deviation" class="progress-item">
                <div class="deviation-indicator" :class="log.deviationType || 'neutral'">
                  {{ log.deviation }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="floating-controls">
      <button class="control-button reset" @click="resetTimer" title="Reset">🔄</button>
    </div>

    <!-- Completion Modal -->
    <div class="pause-modal" :class="{ active: showCompletionModal }">
      <div class="pause-dialog">
        <div class="pause-title">Did you complete the task?</div>
        <div class="pause-subtitle">Let us know if you finished what you planned to do</div>
        <div class="completion-actions">
          <button class="completion-btn completed" @click="confirmCompletion(true)">
            ✓ Completed
          </button>
          <button class="completion-btn not-completed" @click="confirmCompletion(false)">
            ✕ Not Completed
          </button>
        </div>
        <button class="completion-cancel" @click="cancelCompletion">Cancel</button>
      </div>
    </div>

    <!-- Interrupt Reason Modal -->
    <div class="pause-modal" :class="{ active: showPauseModal }">
      <div class="pause-dialog">
        <div class="pause-title">Why are you interrupting?</div>
        <div class="pause-reasons">
          <div
            v-for="reason in pauseReasons"
            :key="reason.text"
            class="pause-reason"
            :class="{ selected: selectedPauseReason === reason.text }"
            @click="selectPauseReason(reason.text)"
          >
            {{ reason.emoji }} {{ reason.text }}
          </div>
        </div>
        <div class="pause-actions">
          <button class="pause-btn cancel" @click="hidePauseModal">Cancel</button>
          <button class="pause-btn confirm" @click="confirmInterrupt">Interrupt Session</button>
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

.logging-view {
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    system-ui,
    sans-serif;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  min-height: 100vh;
  color: #f5e8d8;
  line-height: 1.5;
  width: 100vw;
}

.header {
  background: #2a2a2a;
  color: #f5e8d8;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid #333;
  width: 100%;
}

.header-content {
  width: 100%;
  max-width: 1400px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #ff6f61;
}

.view-toggle {
  display: flex;
  background: rgba(245, 232, 216, 0.1);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 8px 16px;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: #F5E8D8;
}

.logout-button {
  background: rgba(255, 111, 97, 0.2);
  border: 1px solid rgba(255, 111, 97, 0.3);
  color: #FF6F61;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-button:hover {
  background: rgba(255, 111, 97, 0.3);
  border-color: rgba(255, 111, 97, 0.5);
  transform: translateY(-1px);
}

.toggle-option {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  color: rgba(245, 232, 216, 0.8);
}

.toggle-option.active {
  background: rgba(255, 111, 97, 0.2);
  color: #ff6f61;
  backdrop-filter: blur(10px);
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px 120px;
}

.session-header {
  text-align: center;
  margin-bottom: 32px;
}

.session-title-main {
  font-size: 24px;
  font-weight: 700;
  color: #f5e8d8;
  margin-bottom: 8px;
}

.session-subtitle {
  font-size: 14px;
  color: #aaa;
  opacity: 0.9;
}

.task-input-field {
  position: relative;
  margin-bottom: 32px;
}

.task-input {
  width: 100%;
  padding: 20px 16px;
  background: transparent;
  border: 2px solid rgba(121, 158, 255, 0.3);
  border-radius: 16px;
  color: #f5e8d8;
  font-size: 18px;
  font-weight: 500;
  transition: all 0.3s ease;
  outline: none;
  cursor: pointer;
}

.task-input:focus {
  border-color: #799eff;
  box-shadow: 0 0 0 4px rgba(121, 158, 255, 0.1);
}

.task-input::placeholder {
  color: #666;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(42, 42, 42, 0.95);
  border: 1px solid #444;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  display: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.suggestions-dropdown.active {
  display: block;
}

.suggestion-item {
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(68, 68, 68, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: rgba(255, 111, 97, 0.1);
}

.suggestion-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggestion-name {
  font-size: 16px;
  font-weight: 600;
  color: #f5e8d8;
}

.suggestion-details {
  font-size: 12px;
  color: #aaa;
}

.suggestion-badge {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(218, 165, 32, 0.2);
  color: #daa520;
  font-weight: 600;
  text-transform: uppercase;
}

.scheduled-time-badge {
  display: inline-block;
  font-size: 11px;
  padding: 3px 8px;
  margin-left: 8px;
  border-radius: 4px;
  background: rgba(255, 111, 97, 0.15);
  color: #FF6F61;
  font-weight: 500;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.new-session-toggle {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 111, 97, 0.1);
  border: 2px dashed #ff6f61;
  border-radius: 12px;
  color: #ff6f61;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  margin-top: 8px;
}

.new-session-toggle:hover {
  background: rgba(255, 111, 97, 0.15);
}

.suggestions-section-header {
  padding: 12px 20px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #ff6f61;
  border-bottom: 1px solid rgba(255, 111, 97, 0.2);
  background: rgba(255, 111, 97, 0.05);
}

.suggestions-divider {
  height: 1px;
  background: rgba(245, 232, 216, 0.1);
  margin: 8px 0;
}

.session-badge {
  background: rgba(147, 112, 219, 0.2);
  color: #9370db;
}

.new-session-form {
  background: rgba(42, 42, 42, 0.95);
  border: 1px solid #444;
  border-radius: 12px;
  padding: 20px;
  margin-top: 8px;
  backdrop-filter: blur(20px);
  display: none;
}

.new-session-form.active {
  display: block;
}

.session-input-wrapper {
  position: relative;
}

.session-input {
  cursor: pointer;
}

.task-options-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(42, 42, 42, 0.98);
  border: 1px solid #444;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  display: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.task-options-dropdown.active {
  display: block;
}

.task-option-section {
  padding: 12px 0;
}

.task-option-header {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(68, 68, 68, 0.5);
  margin-bottom: 4px;
}

.task-option-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(68, 68, 68, 0.3);
}

.task-option-item:last-child {
  border-bottom: none;
}

.task-option-item:hover {
  background: rgba(255, 111, 97, 0.1);
}

.task-option-item.custom-task {
  border-top: 1px solid rgba(68, 68, 68, 0.5);
  background: rgba(255, 111, 97, 0.05);
}

.task-option-item.custom-task:hover {
  background: rgba(255, 111, 97, 0.15);
}

.task-option-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-option-name {
  font-size: 14px;
  font-weight: 600;
  color: #f5e8d8;
}

.task-option-meta {
  font-size: 12px;
  color: #aaa;
}

.task-option-divider {
  height: 1px;
  background: rgba(68, 68, 68, 0.5);
  margin: 8px 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: #aaa;
  font-weight: 600;
}

.form-input {
  padding: 10px 12px;
  background: transparent;
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  color: #f5e8d8;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.form-input:focus {
  border-color: #ff6f61;
}

.form-textarea {
  padding: 12px;
  background: transparent;
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  color: #f5e8d8;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
  resize: vertical;
  width: 100%;
  min-height: 80px;
  line-height: 1.5;
}

.form-textarea:focus {
  border-color: #ff6f61;
}

.form-textarea::placeholder {
  color: rgba(245, 232, 216, 0.4);
}

.form-select {
  padding: 10px 12px;
  background: rgba(42, 42, 42, 0.8);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  color: #f5e8d8;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.form-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: rgba(42, 42, 42, 0.4);
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-btn.primary {
  background: #ff6f61;
  color: #1c1c1c;
}

.form-btn.secondary {
  background: transparent;
  color: #aaa;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.field-group {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  margin-bottom: 32px;
  align-items: center;
}

.duration-field {
  position: relative;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.duration-field:focus-within {
  border-color: #ff6f61;
}

.duration-value {
  font-size: 24px;
  font-weight: 700;
  color: #f5e8d8;
  background: transparent;
  border: none;
  outline: none;
  width: 60px;
}

.duration-unit {
  font-size: 16px;
  color: #aaa;
}

.duration-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.duration-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 111, 97, 0.2);
  color: #ff6f61;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.duration-btn:hover {
  background: rgba(255, 111, 97, 0.3);
}

.split-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: 2px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.split-toggle.active {
  border-color: #ff6f61;
  background: rgba(255, 111, 97, 0.1);
}

.split-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #ff6f61;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: all 0.2s ease;
  color: transparent;
}

.split-toggle.active .split-checkbox {
  background: #ff6f61;
  color: #1c1c1c;
}

.split-label {
  font-size: 16px;
  font-weight: 500;
  color: #f5e8d8;
}

.timer-section {
  text-align: center;
  margin-bottom: 32px;
}

.current-session-name {
  text-align: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(255, 111, 97, 0.1);
  border: 1px solid rgba(255, 111, 97, 0.2);
  border-radius: 12px;
}

.session-title {
  font-size: 18px;
  font-weight: 600;
  color: #ff6f61;
  margin-bottom: 4px;
}

.timer-display {
  font-size: 72px;
  font-weight: 300;
  color: #f5e8d8;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  margin-bottom: 24px;
  text-shadow: 0 0 20px rgba(245, 232, 216, 0.3);
}

.timer-display.running {
  color: #ff6f61;
  text-shadow: 0 0 30px rgba(255, 111, 97, 0.4);
}

.timer-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 0 auto 32px;
}

.start-button {
  width: 120px;
  height: 48px;
  border-radius: 24px;
  border: 2px solid #ff6f61;
  background: transparent;
  color: #ff6f61;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

.start-button:hover {
  background: rgba(255, 111, 97, 0.1);
  transform: translateY(-2px);
}

.start-button:active {
  transform: translateY(0);
}

.start-button.stop {
  background: #ff6f61;
  color: #1c1c1c;
}

.start-button.stop:hover {
  background: #ff4500;
}

.start-button.interrupt-button {
  border-color: #daa520;
  color: #daa520;
}

.start-button.interrupt-button:hover {
  background: rgba(218, 165, 32, 0.1);
}

.session-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: rgba(245, 232, 216, 0.02);
  border: 1px solid rgba(245, 232, 216, 0.1);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-color, rgba(245, 232, 216, 0.2));
}

.stat-card:hover {
  background: rgba(245, 232, 216, 0.05);
  border-color: rgba(245, 232, 216, 0.2);
  transform: translateY(-2px);
}

.stat-value {
  font-size: 32px;
  font-weight: 300;
  color: #f5e8d8;
  margin-bottom: 8px;
  font-family: 'SF Mono', Monaco, monospace;
}

.stat-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

.stat-card.elapsed {
  --accent-color: #ff6f61;
}

.stat-card.remaining {
  --accent-color: #daa520;
}

.stat-card.progress {
  --accent-color: #ff6f61;
}

.stat-card.session {
  --accent-color: #f5e8d8;
}

.progress-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--accent-color);
  transition: width 0.5s ease;
  border-radius: 0 3px 0 0;
}

.session-logs {
  margin-top: 40px;
}

.logs-title {
  font-size: 18px;
  font-weight: 700;
  color: #f5e8d8;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  background: linear-gradient(135deg, #2a2a2a 0%, #333 100%);
  border-radius: 12px;
  padding: 16px 20px;
  border: 1px solid #444;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.delete-session-button {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 111, 97, 0.3);
  background: rgba(255, 111, 97, 0.1);
  color: #ff6f61;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.session-item:hover .delete-session-button {
  opacity: 1;
}

.delete-session-button:hover {
  background: rgba(255, 111, 97, 0.2);
  border-color: rgba(255, 111, 97, 0.5);
  transform: scale(1.1);
}

.session-item.active {
  border-color: #ff6f61;
  background: linear-gradient(135deg, #2a1f1a 0%, #3a2a20 100%);
  box-shadow: 0 4px 16px rgba(255, 111, 97, 0.15);
}

.session-item.clickable {
  cursor: pointer;
}

.session-item.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 111, 97, 0.25);
  border-color: #ff8875;
}

.session-item.active::before {
  content: 'ACTIVE';
  position: absolute;
  top: 8px;
  right: 12px;
  background: #ff6f61;
  color: #1c1c1c;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.session-header-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.session-info {
  flex: 1;
}

.session-name {
  font-size: 16px;
  font-weight: 600;
  color: #f5e8d8;
  margin-bottom: 4px;
}

.session-meta {
  font-size: 12px;
  color: #aaa;
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-category {
  background: rgba(255, 111, 97, 0.2);
  color: #ff6f61;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.session-type {
  background: rgba(218, 165, 32, 0.2);
  color: #daa520;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.session-completion {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 11px;
}

.session-completion.finished {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.session-completion.incomplete {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.session-duration {
  font-size: 18px;
  font-weight: 700;
  color: #f5e8d8;
  font-family: 'SF Mono', Monaco, monospace;
}

.session-active-tag {
  font-size: 12px;
  font-weight: 700;
  color: #FF6F61;
  background: rgba(255, 111, 97, 0.2);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 111, 97, 0.4);
  letter-spacing: 0.5px;
}

.session-progress {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  font-size: 12px;
}

.progress-item {
  text-align: center;
}

.progress-value {
  font-weight: 600;
  color: #f5e8d8;
  margin-bottom: 2px;
}

.progress-label {
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.deviation-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  justify-content: center;
}

.deviation-indicator.positive {
  color: #4caf50;
}

.deviation-indicator.negative {
  color: #ff6f61;
}

.deviation-indicator.neutral {
  color: #daa520;
}

.floating-controls {
  position: fixed;
  bottom: 32px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 200;
}

.control-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #2a2a2a 0%, #333 100%);
  color: #f5e8d8;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-button:hover {
  transform: scale(1.1);
  background: linear-gradient(135deg, #333 0%, #444 100%);
}

.control-button.reset {
  background: linear-gradient(135deg, #ff4500 0%, #dc2626 100%);
  color: white;
}

.pause-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  display: none;
}

.pause-modal.active {
  display: flex;
}

.pause-dialog {
  background: linear-gradient(135deg, #2a2a2a 0%, #333 100%);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  border: 1px solid #444;
}

.pause-title {
  font-size: 18px;
  font-weight: 700;
  color: #f5e8d8;
  margin-bottom: 16px;
  text-align: center;
}

.pause-reasons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.pause-reason {
  padding: 12px 16px;
  background: rgba(245, 232, 216, 0.05);
  border: 1px solid rgba(245, 232, 216, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.pause-reason:hover,
.pause-reason.selected {
  background: rgba(255, 111, 97, 0.1);
  border-color: #ff6f61;
}

.pause-actions {
  display: flex;
  gap: 12px;
}

.pause-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pause-btn.cancel {
  background: transparent;
  color: #aaa;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.pause-btn.confirm {
  background: #daa520;
  color: #1c1c1c;
}

/* Completion Modal Styles */
.pause-subtitle {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 24px;
  text-align: center;
}

.completion-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.completion-btn {
  flex: 1;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.completion-btn.completed {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.completion-btn.completed:hover {
  background: linear-gradient(135deg, #66bb6a 0%, #81c784 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

.completion-btn.not-completed {
  background: linear-gradient(135deg, #ff6f61 0%, #ff8575 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 111, 97, 0.3);
}

.completion-btn.not-completed:hover {
  background: linear-gradient(135deg, #ff8575 0%, #ffa590 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 111, 97, 0.4);
}

.completion-cancel {
  width: 100%;
  padding: 12px;
  background: transparent;
  color: #aaa;
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.completion-cancel:hover {
  background: rgba(245, 232, 216, 0.05);
  color: #f5e8d8;
}
</style>
