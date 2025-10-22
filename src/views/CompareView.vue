<template>
  <div class="compare-view">
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">NEO</div>
          <div class="view-toggle">
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Today' }"
              @click="navigateToToday"
            >
              Today
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Compare' }"
              @click="navigateToCompare"
            >
              Compare
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Logging' }"
              @click="navigateToLogging"
            >
              Logging
            </button>
            <button
              class="toggle-option"
              :class="{ active: activeView === 'Tasks' }"
              @click="navigateToTasks"
            >
              Tasks
            </button>
          </div>
        </div>
        <div class="header-right">
          <div class="date-navigation">
            <button class="nav-button" @click="goToPreviousDay" title="Previous day">
              ‹
            </button>
            <button
              class="nav-button today-button"
              :class="{ active: isToday() }"
              @click="goToToday"
              title="Go to today"
            >
              {{ selectedDate }}
            </button>
            <button class="nav-button" @click="goToNextDay" title="Next day">
              ›
            </button>
          </div>
          <div class="user-section">
            <span class="username">{{ authStore.getCurrentUsername() }}</span>
            <button class="logout-button" @click="handleLogout" title="Log out">
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="comparison-stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalTasks }}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.perfectMatch }}</div>
          <div class="stat-label">Perfect Match</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.mismatched }}</div>
          <div class="stat-label">Mismatched</div>
        </div>
        <div class="stat-card variance">
          <div class="stat-value">{{ stats.timeVariance }}</div>
          <div class="stat-label">Time Variance</div>
        </div>
      </div>

      <div class="optimize-button-container">
        <button class="optimize-schedule-button" @click="handleOptimizeSchedule">Optimize Schedule</button>
      </div>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-icon planned"></div>
          <span>Planned</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon actual"></div>
          <span>Actual</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon overlap"></div>
          <span>Perfect Match</span>
        </div>
      </div>

      <div class="timeline-wrapper" ref="timelineContainerRef">
        <div class="unified-timeline">
          <div class="time-axis">
            <div
              v-for="marker in timeMarkers"
              :key="`${marker.time}-${marker.label}`"
              class="time-marker"
              :style="{ top: marker.position + 'px' }"
            >
              {{ marker.label }}
              <div class="time-dot"></div>
            </div>
          </div>

          <div class="current-time-line" :style="{ top: currentTimePosition + 'px' }"></div>

          <!-- Empty time slots (for adding tasks) -->
          <div
            v-for="slot in emptyTimeSlots"
            :key="`empty-${slot.hour}-${slot.minute}`"
            class="empty-time-slot"
            :style="{ top: slot.position + 'px', height: slot.height + 'px' }"
          >
            <div
              class="empty-slot-panel"
              @click="openAddTaskForTimeSlot(slot.hour, slot.minute)"
            >
              <div class="add-task-content">
                <span class="add-icon">+</span>
                <span class="add-text">Add Task</span>
              </div>
            </div>
          </div>

          <!-- Adaptive blocks (right side) -->
          <div
            v-for="(adaptiveBlock, index) in adaptiveBlocksWithTasks"
            :key="`adaptive-${index}`"
            class="adaptive-block-slot"
            :style="{
              top: getComparisonPosition(adaptiveBlock.start) + 'px',
              height: getAdaptiveBlockHeight(adaptiveBlock) + 'px'
            }"
          >
            <button
              class="delete-adaptive-block-btn"
              @click="deleteAdaptiveBlock(adaptiveBlock.timeBlockId)"
              title="Delete this adaptive block"
            >
              ✕
            </button>
            <div
              v-for="task in adaptiveBlock.tasks"
              :key="task.taskId"
              class="adaptive-task"
            >
              <div class="task-time">{{ formatTime(adaptiveBlock.start) }} - {{ formatTime(adaptiveBlock.end) }}</div>
              <div class="task-title">{{ task.taskName }}</div>
              <div class="task-duration">{{ formatDuration(adaptiveBlock.end - adaptiveBlock.start) }} • {{ task.category }}</div>
            </div>
          </div>

          <!-- Comparison slots -->
          <div
            v-for="(comparison, index) in comparisons"
            :key="index"
            class="time-slot"
            :class="{ 'major-mismatch': comparison.isMismatch }"
            :style="{
              top: getComparisonPosition(comparison.startTime || 0) + 'px',
              height: getComparisonHeight(comparison) + 'px'
            }"
          >
            <div class="task-comparison">
              <!-- Perfect Match -->
              <div v-if="comparison.isPerfectMatch" class="task-perfect-match">
                <div class="task-time">{{ comparison.timeRange }}</div>
                <div class="task-title">{{ comparison.taskName }}</div>
                <div v-if="!isShortSession(comparison.duration)" class="task-meta">
                  <span class="task-duration">{{ comparison.duration }} • {{ comparison.category }}</span>
                </div>
              </div>

              <!-- Mismatch -->
              <template v-else>
                <div v-if="comparison.planned" class="planned-task" :class="{ 'short-task': isShortSession(comparison.planned.duration) }">
                  <!-- Short task: only show task name with inline label -->
                  <div class="task-title-inline" v-if="isShortSession(comparison.planned.duration)">
                    {{ comparison.planned.taskName }} <span class="inline-label">PLANNED</span>
                  </div>
                  <!-- Regular task: show time, title, and metadata -->
                  <template v-else>
                    <div class="task-time">{{ comparison.planned.timeRange }}</div>
                    <div class="task-title">{{ comparison.planned.taskName }}</div>
                    <div class="task-meta">
                      <span class="task-duration">{{ comparison.planned.duration }} • {{ comparison.planned.category }}</span>
                      <span v-if="comparison.planned.varianceText" class="variance-badge" :class="{ 'skipped': comparison.planned.varianceText === 'Skipped' }">
                        {{ comparison.planned.varianceText }}
                      </span>
                    </div>
                  </template>
                </div>
                <div v-else class="no-task">{{ comparison.noPlannedText || 'No planned task' }}</div>

                <div v-if="comparison.mismatchIcon" class="mismatch-indicator">
                  {{ comparison.mismatchIcon }}
                </div>

                <div v-if="comparison.actual" class="actual-task" :class="{ 'short-task': isShortSession(comparison.actual.duration) }">
                  <!-- Short task: only show task name with inline label -->
                  <div class="task-title-inline" v-if="isShortSession(comparison.actual.duration)">
                    {{ comparison.actual.taskName }} <span class="inline-label">ACTUAL</span>
                  </div>
                  <!-- Regular task: show time, title, and metadata -->
                  <template v-else>
                    <div class="task-time">{{ comparison.actual.timeRange }}</div>
                    <div class="task-title">{{ comparison.actual.taskName }}</div>
                    <div class="task-meta">
                      <span class="task-duration">{{ comparison.actual.duration }} • {{ comparison.actual.category }}</span>
                      <span v-if="comparison.actual.varianceText" class="variance-badge">
                        {{ comparison.actual.varianceText }}
                      </span>
                    </div>
                  </template>
                </div>
                <div v-else class="no-task">{{ comparison.noActualText || 'Task skipped' }}</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Task Modal -->
    <AddTaskModal
      :show="showAddTaskModal"
      :selected-hour="selectedHourForNewTask"
      :selected-minute="selectedMinuteForNewTask"
      @close="closeAddTaskModal"
      @submit="handleTaskSubmit"
    />

    <!-- Preference Modal -->
    <PreferenceModal
      :show="showPreferenceModal"
      @close="closePreferenceModal"
      @proceed="handlePreferenceProceed"
    />

    <!-- Loading Modal -->
    <LoadingModal
      :show="showLoadingModal"
      title="AI is Thinking..."
      description="Creating your optimized schedule. This may take a moment."
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AddTaskModal from '../components/AddTaskModal.vue'
import PreferenceModal from '../components/PreferenceModal.vue'
import LoadingModal from '../components/LoadingModal.vue'
import { TaskCatalogAPI, RoutineLogAPI, ScheduleTimeAPI, AdaptiveScheduleAPI, type Task, type Session, type TimeBlock, type AdaptiveBlock, type DroppedTask } from '../services/api'
import { useAuthStore } from '../stores/auth'

// Auth store
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'

const handleLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    authStore.clearUser()
    router.push('/login')
  }
}

// Helper to round timestamp to nearest 30 minutes
const roundToNearest30Min = (timestamp: number): number => {
  const date = new Date(timestamp)
  const minutes = date.getMinutes()
  const roundedMinutes = Math.round(minutes / 30) * 30
  date.setMinutes(roundedMinutes, 0, 0)
  return date.getTime()
}

// Helper to format time from timestamp
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

// Helper to format duration in minutes
const formatDuration = (milliseconds: number): string => {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60))
  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  return `${hours}h ${minutes}m`
}

const router = useRouter()

// Active view
const activeView = ref('Compare')

// Date navigation
const currentDate = ref(new Date())
const selectedDate = ref('')

// Format date for display
const formatDisplayDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Navigation functions
const goToPreviousDay = async () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  await fetchComparisons()
}

const goToToday = async () => {
  currentDate.value = new Date()
  selectedDate.value = formatDisplayDate(currentDate.value)
  await fetchComparisons()
}

const goToNextDay = async () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  await fetchComparisons()
}

// Check if current date is today
const isToday = () => {
  const today = new Date()
  return currentDate.value.toDateString() === today.toDateString()
}

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

// Stats
const stats = ref({
  totalTasks: 0,
  perfectMatch: 0,
  mismatched: 0,
  timeVariance: '0m'
})

// Timeline constants - optimized for 1-hour task fitting with padding
const HOUR_HEIGHT = 120  // 120px per hour (increased to accommodate padding)
const START_HOUR = 0     // Start at midnight (full 24 hours)
const END_HOUR = 24      // End at midnight next day

// Time markers for timeline - every hour (24 total)
const timeMarkers = computed(() => {
  const markers = []

  // Generate markers for every hour (24 total in 24 hours)
  for (let hour = 0; hour < 24; hour++) {
    const position = hour * HOUR_HEIGHT

    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    let label = ''
    if (hour === 0) {
      label = 'Midnight'
    } else if (hour === 12) {
      label = 'Noon'
    } else {
      label = `${displayHour} ${period}`
    }

    markers.push({
      time: hour,
      position,
      label,
      isFullHour: true // All markers are full hours
    })
  }
  return markers
})

// Current time position
const currentTimePosition = ref(0)
const updateCurrentTimePosition = () => {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  // Use full 24-hour timeline
  currentTimePosition.value = hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Timeline container ref for scrolling
const timelineContainerRef = ref<HTMLElement | null>(null)

// Calculate position for a comparison based on its start time
const getComparisonPosition = (timestamp: number) => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  // Use full 24-hour timeline (no START_HOUR offset)
  return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Calculate height for a comparison based on its duration
const getComparisonHeight = (comparison: Comparison) => {
  if (comparison.isPerfectMatch || comparison.planned) {
    // Parse duration string like "1 hour", "30 minutes", "1h 30m"
    const durationStr = comparison.duration || comparison.planned?.duration || '1 hour'
    const baseHeight = parseDurationToPixels(durationStr)
    // Add padding for visual spacing between task clusters
    return baseHeight + 16 // 8px top + 8px bottom padding
  }
  // Default to 1 hour + padding if no duration available
  return HOUR_HEIGHT + 16
}

// Calculate height for an adaptive block
const getAdaptiveBlockHeight = (block: AdaptiveBlock) => {
  const durationMs = block.end - block.start
  const durationMinutes = durationMs / (1000 * 60)
  return (durationMinutes / 60) * HOUR_HEIGHT + 16 // Add padding
}

// Helper function to parse duration strings to minutes
const parseDurationToMinutes = (durationStr: string): number => {
  let totalMinutes = 0

  // Extract hours
  const hourMatch = durationStr.match(/(\d+)\s*h(?:our)?s?/i)
  if (hourMatch && hourMatch[1]) {
    totalMinutes += parseInt(hourMatch[1]) * 60
  }

  // Extract minutes
  const minuteMatch = durationStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i)
  if (minuteMatch && minuteMatch[1]) {
    totalMinutes += parseInt(minuteMatch[1])
  }

  // If no hours or minutes found, try to parse just numbers (assume minutes)
  if (totalMinutes === 0) {
    const numberMatch = durationStr.match(/(\d+)/)
    if (numberMatch && numberMatch[1]) {
      totalMinutes = parseInt(numberMatch[1])
    } else {
      // Default to 60 minutes (1 hour)
      totalMinutes = 60
    }
  }

  return totalMinutes
}

// Helper to check if a session is short (30 minutes or less)
const isShortSession = (durationStr: string | undefined): boolean => {
  if (!durationStr) return false
  const totalMinutes = parseDurationToMinutes(durationStr)
  return totalMinutes <= 30
}

// Helper function to parse duration strings to pixel height
const parseDurationToPixels = (durationStr: string): number => {
  // Handle formats like "1 hour", "30 minutes", "1h 30m", "1 hour 30 minutes"
  let totalMinutes = 0

  // Extract hours
  const hourMatch = durationStr.match(/(\d+)\s*h(?:our)?s?/i)
  if (hourMatch && hourMatch[1]) {
    totalMinutes += parseInt(hourMatch[1]) * 60
  }

  // Extract minutes
  const minuteMatch = durationStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i)
  if (minuteMatch && minuteMatch[1]) {
    totalMinutes += parseInt(minuteMatch[1])
  }

  // If no hours or minutes found, try to parse just numbers (assume minutes)
  if (totalMinutes === 0) {
    const numberMatch = durationStr.match(/(\d+)/)
    if (numberMatch && numberMatch[1]) {
      totalMinutes = parseInt(numberMatch[1])
    } else {
      // Default to 60 minutes (1 hour)
      totalMinutes = 60
    }
  }

  // Convert minutes to pixels (HOUR_HEIGHT pixels per 60 minutes)
  return (totalMinutes / 60) * HOUR_HEIGHT
}

// Comparisons data
interface Comparison {
  isPerfectMatch?: boolean
  isMismatch?: boolean
  timeRange?: string
  taskName?: string
  duration?: string
  category?: string
  varianceText?: string
  startTime?: number  // For sorting
  timeDeviationMs?: number  // Time deviation in milliseconds
  planned?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
  }
  actual?: {
    timeRange: string
    taskName: string
    duration: string
    category: string
    varianceText?: string
  }
  mismatchIcon?: string
  noPlannedText?: string
  noActualText?: string
}

const comparisons = ref<Comparison[]>([])
const isLoadingComparisons = ref(false)

// Add Task Modal state
const showAddTaskModal = ref(false)
const selectedHourForNewTask = ref(9)
const selectedMinuteForNewTask = ref(0)

// Preference Modal state
const showPreferenceModal = ref(false)
const showLoadingModal = ref(false)

// Adaptive schedule state
interface AdaptiveBlockWithTasks extends AdaptiveBlock {
  tasks: Task[]
}

const adaptiveBlocksWithTasks = ref<AdaptiveBlockWithTasks[]>([])

// Empty time slots for adding tasks
interface EmptyTimeSlot {
  hour: number
  minute: number
  position: number
  height: number
}

const emptyTimeSlots = computed(() => {
  const slots: EmptyTimeSlot[] = []
  const SLOT_DURATION = 60 // 60 minutes per slot (1 hour)

  // Create occupied time ranges from comparisons
  const occupiedRanges = comparisons.value.map(c => {
    if (!c.startTime) return null
    const date = new Date(c.startTime)
    const durationStr = c.duration || c.planned?.duration || '1 hour'
    const durationMinutes = parseDurationToMinutes(durationStr)

    return {
      startHour: date.getHours(),
      startMinute: date.getMinutes(),
      endHour: Math.floor((date.getHours() * 60 + date.getMinutes() + durationMinutes) / 60),
      endMinute: (date.getMinutes() + durationMinutes) % 60
    }
  }).filter(r => r !== null)

  // Generate slots for each hour across full 24 hours
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    // Check if this hour slot is occupied
    const isOccupied = occupiedRanges.some(range => {
      if (!range) return false
      const slotStart = hour * 60
      const slotEnd = (hour + 1) * 60
      const rangeStart = range.startHour * 60 + range.startMinute
      const rangeEnd = range.endHour * 60 + range.endMinute
      // Check if there's any overlap
      return !(slotEnd <= rangeStart || slotStart >= rangeEnd)
    })

    if (!isOccupied) {
      const position = hour * HOUR_HEIGHT
      const height = HOUR_HEIGHT

      slots.push({
        hour,
        minute: 0,
        position,
        height
      })
    }
  }

  return slots
})

const openAddTaskForTimeSlot = (hour: number, minute: number) => {
  selectedHourForNewTask.value = hour
  selectedMinuteForNewTask.value = minute
  showAddTaskModal.value = true
}

const closeAddTaskModal = () => {
  showAddTaskModal.value = false
}

// Handle task submission
const handleTaskSubmit = async (taskData: any) => {
  try {
    console.log('Creating new task:', taskData)

    // Convert start and end time to Unix timestamps
    const today = new Date()
    const [startHour, startMinute] = taskData.startTime.split(':')
    const [endHour, endMinute] = taskData.endTime.split(':')

    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startHour), parseInt(startMinute))
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endHour), parseInt(endMinute))

    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // Create the task first
    const newTask = await TaskCatalogAPI.createTask({
      owner: CURRENT_USER,
      taskName: taskData.taskName,
      category: taskData.category,
      duration: taskData.duration, // already in minutes
      priority: taskData.priority,
      splittable: taskData.splittable,
      ...(taskData.deadline && { deadline: taskData.deadline }),
      ...(taskData.slack && taskData.slack > 0 && { slack: taskData.slack }),
      ...(taskData.notes && { note: taskData.notes })
    })

    if (!newTask.taskId) {
      console.error('ERROR: Task created but taskId is missing!', newTask)
      throw new Error('Task was created but taskId is missing')
    }

    // Check if a time block already exists for this time range
    let allSchedules: TimeBlock[] = []
    try {
      allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    } catch (error: any) {
      if (error.message?.includes('No future time blocks found')) {
        allSchedules = []
      } else {
        throw error
      }
    }

    // Find a time block with matching start and end times
    const existingBlock = allSchedules.find(block =>
      block.start === startTimestamp && block.end === endTimestamp
    )

    let timeBlockId: string

    if (existingBlock) {
      timeBlockId = existingBlock.timeBlockId
      if (!existingBlock.taskIdSet.includes(newTask.taskId)) {
        await ScheduleTimeAPI.assignTimeBlock({
          owner: CURRENT_USER,
          taskId: newTask.taskId,
          start: startTimestamp,
          end: endTimestamp
        })
      }
    } else {
      const timeBlockResult = await ScheduleTimeAPI.assignTimeBlock({
        owner: CURRENT_USER,
        taskId: newTask.taskId,
        start: startTimestamp,
        end: endTimestamp
      })
      timeBlockId = timeBlockResult.timeBlockId
    }

    // Update the task to reference this time block
    await TaskCatalogAPI.assignSchedule(
      CURRENT_USER,
      newTask.taskId,
      timeBlockId
    )

    // Wait a bit before refreshing to ensure backend is updated
    await new Promise(resolve => setTimeout(resolve, 500))

    // Refresh the comparisons to show the new task
    await fetchComparisons()

    showAddTaskModal.value = false
  } catch (error: any) {
    console.error('Failed to create task:', error)
    const errorMessage = error.message || 'Unknown error occurred'
    alert(`Failed to create task: ${errorMessage}`)
  }
}

// Optimize Schedule handlers
const handleOptimizeSchedule = () => {
  showPreferenceModal.value = true
}

const closePreferenceModal = () => {
  showPreferenceModal.value = false
}

const createAdaptiveSchedulePrompt = (
  owner: string,
  tasks: Task[],
  timeBlocks: TimeBlock[],
  sessions: Session[],
  preference: string
): string => {
  const currentTime = new Date().toISOString()

  // Helper to format tasks
  const tasksToString = (tasks: Task[]) => {
    return tasks.map(t => {
      let taskStr = `- Task ID: ${t.taskId}\n`
      taskStr += `  Name: ${t.taskName}\n`
      taskStr += `  Category: ${t.category}\n`
      taskStr += `  Duration: ${t.duration} minutes\n`
      taskStr += `  Priority: ${t.priority}\n`
      taskStr += `  Splittable: ${t.splittable}\n`
      if (t.deadline) taskStr += `  Deadline: ${t.deadline}\n`
      if (t.slack) taskStr += `  Slack: ${t.slack} minutes\n`
      if (t.preDependence && t.preDependence.length > 0) {
        taskStr += `  Pre-dependencies: ${t.preDependence.join(', ')}\n`
      }
      if (t.note) taskStr += `  Note: ${t.note}\n`
      return taskStr
    }).join('\n')
  }

  // Helper to format schedule
  const scheduleToString = (blocks: TimeBlock[]) => {
    return blocks.map(b => {
      const start = new Date(b.start).toISOString()
      const end = new Date(b.end).toISOString()
      return `- Time Block: ${start} to ${end}\n  Tasks: ${b.taskIdSet.join(', ')}`
    }).join('\n')
  }

  // Helper to format routine
  const routineToString = (sessions: Session[]) => {
    return sessions.filter(s => s.start && s.end).map(s => {
      return `- Session: ${s.sessionName}\n  Start: ${s.start}\n  End: ${s.end}\n  Linked Task: ${s.linkedTaskId || 'None'}`
    }).join('\n')
  }

  return `
You are a helpful AI assistant that creates optimal adaptive schedules for users based on task analysis, planned schedules, actual routines, and user preferences.

USER: ${owner}
CURRENT TIME: ${currentTime}
** CRITICAL: You MUST schedule all time blocks to start at or after this current time. Do NOT schedule anything before ${currentTime}. **

USER PREFERENCES:
${preference}

TASKS TO SCHEDULE:
** CRITICAL: ALL tasks listed below MUST be scheduled. Each task represents work that still needs to be done. **
${tasksToString(tasks)}

PLANNED SCHEDULE (Original Plan):
${scheduleToString(timeBlocks)}

ACTUAL ROUTINE (What Actually Happened):
${routineToString(sessions)}

TASK PRIORITY SCALE (1-5), determines how urgent the task is:
- Priority 1 (Critical): Must be done ASAP - urgent deadlines, emergencies
- Priority 2 (Important): Should be done soon - upcoming deadlines, high impact
- Priority 3 (Regular): Necessary but not urgent
- Priority 4 (Low): Can be done later
- Priority 5 (Optional): Can be done if time permits - not time-sensitive or important

ANALYSIS REQUIREMENTS:
1. Analyze the deviation between the planned schedule and actual routine
2. Identify tasks that were not completed or were interrupted
3. Consider task priorities (1 = highest priority, 5 = lowest priority), deadlines, and dependencies
4. Schedule critical tasks (priority 1-2) before lower priority tasks
5. Consider user preferences for scheduling
6. Respect task constraints (duration, splittable, slack)
7. **CONCURRENCY OPTIMIZATION (ALWAYS APPLY): Whenever you have a PASSIVE/BACKGROUND task (laundry, dishwashing - tasks that run automatically), you MUST ALWAYS schedule it concurrently with an active task by creating OVERLAPPING time blocks. This is MANDATORY, not optional. Active tasks (cleaning room, organizing notes, studying) CANNOT be done concurrently with each other. RULE: If you see "Do Laundry" or "Dishwashing", immediately find an active task to overlap it with.**

SCHEDULING CONSTRAINTS:
- Times must be in ISO 8601 format (e.g., "2025-10-04T14:00:00Z")
- Start time must be before end time
- ALL time blocks MUST start at or after the CURRENT TIME if provided
- **CRITICAL DURATION RULE: Each time block's duration MUST be at least as long as the longest task in that block (NOT the sum). When tasks are concurrent/overlapping in separate blocks, each block is evaluated independently.**
- For non-splittable tasks, the block must be at least as long as the task duration
- For splittable tasks, you can either: (1) create a single block with duration >= task duration, OR (2) split across multiple blocks where sum of block durations >= task duration
- **CONCURRENCY CLARIFICATION: When creating overlapping blocks, each block duration only needs to match its own task duration. Example: Laundry (60 min) in Block A from 1:40-2:40 PM, Study (120 min) in Block B from 1:40-3:40 PM - this is CORRECT and maximizes time savings.**
- High priority tasks should be scheduled first
- Respect task deadlines
- Consider dependencies (preDependence tasks must be scheduled before dependent tasks)
- If a task is splittable, it can be divided across multiple blocks. Otherwise, do not divide it across multiple **non-consecutive blocks**.
- **MANDATORY: You MUST ALWAYS create overlapping/concurrent blocks for passive tasks (laundry, dishwashing, etc.). This means creating separate blocks with the same or overlapping time ranges. For example, if you have laundry and studying, ALWAYS create two blocks that overlap in time - NEVER schedule passive tasks sequentially. This is required even if you have enough time, as it frees up time for additional tasks.**

CRITICAL REQUIREMENTS:
1. ONLY schedule the tasks listed above - do NOT add any new tasks
2. Ensure all scheduled blocks have valid ISO timestamps
3. Assign tasks based on priority and deadline urgency
4. **ABSOLUTE DEADLINE CONSTRAINT: If a task has a deadline, it MUST be completed BEFORE that deadline. Do NOT schedule any part of the task after its deadline.**
5. **If there is insufficient time to complete all tasks before their deadlines, prioritize higher priority tasks first**
6. **DURATION CONSTRAINT (FLEXIBLE WHEN CONSTRAINED): Ideally give each task its FULL required duration. However, when time is severely constrained and you have leftover time that can't fit a full task, it's acceptable to schedule a partial task duration rather than leaving the time empty. For example, if you have 20 minutes left and a 60-minute task, schedule it for 20 minutes rather than dropping it entirely.**
7. Consider the actual routine and how it deviates from the schedule to understand what time blocks are realistic
8. Provide reasoning for why actual routine deviated from the original planned schedule
9. For a task with a long duration and is splittable, consider splitting it into multiple non-consecutive time blocks for better focus
10. If time is insufficient to schedule all tasks, prioritize tasks with urgent deadlines (approaching soon) or higher priority (1-2); only drop tasks if absolutely no time remains

Return your response as a JSON object with this exact structure:
{
  "analysis": "Brief analysis of why the schedule deviated from the routine and key insights",
  "adaptiveBlocks": [
    {
      "start": "ISO timestamp",
      "end": "ISO timestamp",
      "taskIds": ["taskId1", "taskId2"]
    }
  ],
  "droppedTaskIds": ["taskId3", "taskId4"]
}

EXAMPLE 1 - Deadline constraint:
- If task-1 has deadline at 5 PM and current time is 12 PM
- Available time: 5 hours (300 minutes)
- If task-1 needs 100 min + other high priority tasks need 200 min = 300 min total
- Low priority tasks (task-5, task-6) CANNOT fit before deadline
- CORRECT: Put task-5 and task-6 in droppedTaskIds
- WRONG: Schedule tasks after the 5 PM deadline

EXAMPLE 2 - Concurrency optimization (ALWAYS REQUIRED FOR PASSIVE TASKS):
- Laundry (60 min, PASSIVE) + Study (120 min, ACTIVE)
- MANDATORY APPROACH: Always overlap passive tasks - create these blocks:
  Block A: {"start": "2025-10-04T14:00:00Z", "end": "2025-10-04T15:00:00Z", "taskIds": ["laundry-task-id"]},
  Block B: {"start": "2025-10-04T14:00:00Z", "end": "2025-10-04T16:00:00Z", "taskIds": ["study-task-id"]}
- Result: Both complete by 4:00 PM, saving 60 minutes for other tasks
- WRONG: Scheduling laundry sequentially (3:40-4:40) after studying wastes 60 minutes
- WRONG: Clean Room + Organize Notes overlapping (both ACTIVE - cannot be concurrent)
- WRONG: Any scheduling that extends past the deadline

Return ONLY the JSON object, no additional text.`
}

const handlePreferenceProceed = async (preference: string) => {
  try {
    // Close preference modal and show loading
    showPreferenceModal.value = false
    showLoadingModal.value = true

    // Fetch all required data
    const tasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
    const timeBlocks = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER).catch(() => [])
    const sessions = await RoutineLogAPI.getUserSessions(CURRENT_USER).catch(() => [])

    // Create prompt
    const prompt = createAdaptiveSchedulePrompt(
      CURRENT_USER,
      tasks,
      timeBlocks,
      sessions,
      preference
    )

    // Call AI API
    const result = await AdaptiveScheduleAPI.requestAdaptiveScheduleAI(CURRENT_USER, prompt)

    // Fetch task details for each adaptive block
    const blocksWithTasks: AdaptiveBlockWithTasks[] = []
    for (const block of result.adaptiveBlockTable) {
      const blockTasks: Task[] = []
      for (const taskId of block.taskIdSet) {
        try {
          const task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
          blockTasks.push(task)
        } catch (error) {
          console.error(`Failed to fetch task ${taskId}:`, error)
        }
      }
      blocksWithTasks.push({
        ...block,
        tasks: blockTasks
      })
    }

    // Store results
    adaptiveBlocksWithTasks.value = blocksWithTasks

    // Refresh the view to show adaptive blocks
    await fetchComparisons()

    showLoadingModal.value = false
  } catch (error) {
    console.error('Failed to generate adaptive schedule:', error)
    showLoadingModal.value = false
    alert('Failed to generate adaptive schedule. Please try again.')
  }
}

// Delete an adaptive block
const deleteAdaptiveBlock = async (timeBlockId: string) => {
  try {
    if (!confirm('Are you sure you want to delete this adaptive block?')) {
      return
    }

    await AdaptiveScheduleAPI.deleteAdaptiveBlock(CURRENT_USER, timeBlockId)

    // Remove from local state
    adaptiveBlocksWithTasks.value = adaptiveBlocksWithTasks.value.filter(
      block => block.timeBlockId !== timeBlockId
    )

    console.log(`Deleted adaptive block ${timeBlockId}`)
  } catch (error) {
    console.error('Failed to delete adaptive block:', error)
    alert('Failed to delete adaptive block. Please try again.')
  }
}

// Helper to check if a timestamp is on the selected date
const isOnSelectedDate = (timestamp: number): boolean => {
  const date = new Date(timestamp)
  const selected = currentDate.value
  return date.getFullYear() === selected.getFullYear() &&
         date.getMonth() === selected.getMonth() &&
         date.getDate() === selected.getDate()
}

// Fetch and process comparisons
const fetchComparisons = async () => {
  try {
    isLoadingComparisons.value = true

    // 1. Get all planned schedules
    let plannedSchedules: TimeBlock[] = []
    try {
      const allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
      // Filter schedules for the selected date
      plannedSchedules = allSchedules.filter(block => isOnSelectedDate(block.start))
      console.log(`Fetched ${plannedSchedules.length} planned time blocks for ${selectedDate.value}:`, plannedSchedules)
    } catch (error: any) {
      console.error('Error fetching planned schedules:', error)
      if (error.message?.includes('No future time blocks found')) {
        plannedSchedules = []
      } else {
        throw error
      }
    }

    // 2. Get all user sessions
    let userSessions: Session[] = []
    try {
      const allSessions = await RoutineLogAPI.getUserSessions(CURRENT_USER)
      // Filter sessions for the selected date
      userSessions = allSessions.filter(session => {
        if (!session.start) return false
        return isOnSelectedDate(new Date(session.start).getTime())
      })
      console.log(`Fetched ${userSessions.length} sessions for ${selectedDate.value}:`, userSessions)
    } catch (error: any) {
      if (!Array.isArray(userSessions)) {
        userSessions = []
      }
    }

    // Create a map to track which sessions have been matched
    const matchedSessions = new Set<string>()
    const processedComparisons: Comparison[] = []

    // 3. Iterate through all planned schedules
    console.log(`Processing ${plannedSchedules.length} planned schedules`)
    for (const timeBlock of plannedSchedules) {
      console.log(`TimeBlock: ${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}, tasks: ${timeBlock.taskIdSet.length}`)
      for (const taskId of timeBlock.taskIdSet) {
        // Get task details
        let task: Task | null = null
        try {
          task = await TaskCatalogAPI.getTask(CURRENT_USER, taskId)
        } catch (error) {
          console.error(`Failed to fetch task ${taskId}:`, error)
          continue
        }

        console.log(`Processing planned task: ${task.taskName} (${taskId})`)

        const plannedStart = roundToNearest30Min(timeBlock.start)
        const plannedEnd = roundToNearest30Min(timeBlock.end)

        // Find matching session
        const matchingSession = userSessions.find(session => {
          const hasTime = session.start && session.end
          const linkedMatches = session.linkedTaskId === taskId
          if (!hasTime || !linkedMatches || !session.start || !session.end) {
            return false
          }
          const sessionStart = roundToNearest30Min(new Date(session.start).getTime())
          const sessionEnd = roundToNearest30Min(new Date(session.end).getTime())
          const timeMatches = sessionStart === plannedStart && sessionEnd === plannedEnd
          return timeMatches
        })

        if (matchingSession) {
          // Perfect match case
          console.log(`Matched session ${matchingSession.sessionName} to task ${task.taskName}`)
          matchedSessions.add(matchingSession.sessionId)
          processedComparisons.push({
            isPerfectMatch: true,
            startTime: timeBlock.start,
            timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
            taskName: task.taskName,
            duration: formatDuration(timeBlock.end - timeBlock.start),
            category: task.category,
            varianceText: 'Perfect timing ✓',
            timeDeviationMs: 0
          })
        } else {
          // Check if there's a session for this task at a different time
          const sessionForTask = userSessions.find(s => s.linkedTaskId === taskId && s.start && s.end)

          if (sessionForTask && !matchedSessions.has(sessionForTask.sessionId)) {
            // Task was done but at different time
            matchedSessions.add(sessionForTask.sessionId)
            const sessionStart = new Date(sessionForTask.start!).getTime()
            const sessionEnd = new Date(sessionForTask.end!).getTime()
            const plannedDuration = timeBlock.end - timeBlock.start
            const actualDuration = sessionEnd - sessionStart
            const timeDiff = actualDuration - plannedDuration

            let varianceText = ''
            if (Math.abs(timeDiff) < 60000) {
              varianceText = 'Same duration'
            } else if (timeDiff > 0) {
              varianceText = `+${formatDuration(timeDiff)} overtime`
            } else {
              varianceText = `-${formatDuration(Math.abs(timeDiff))} under`
            }

            processedComparisons.push({
              isMismatch: true,
              startTime: Math.min(timeBlock.start, sessionStart),
              timeDeviationMs: Math.abs(timeDiff),
              planned: {
                timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
                taskName: task.taskName,
                duration: formatDuration(plannedDuration),
                category: task.category
              },
              actual: {
                timeRange: `${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
                taskName: task.taskName,
                duration: formatDuration(actualDuration),
                category: task.category,
                varianceText
              },
              mismatchIcon: '⚠️'
            })
          } else {
            // Planned but not logged - count the entire planned duration as deviation
            const plannedDuration = timeBlock.end - timeBlock.start
            processedComparisons.push({
              isMismatch: true,
              startTime: timeBlock.start,
              timeDeviationMs: plannedDuration,
              planned: {
                timeRange: `${formatTime(timeBlock.start)} - ${formatTime(timeBlock.end)}`,
                taskName: task.taskName,
                duration: formatDuration(plannedDuration),
                category: task.category,
                varianceText: 'Skipped'
              },
              mismatchIcon: '✕',
              noActualText: 'No logged session, click to start logging'
            })
          }
        }
      }
    }

    // Add unplanned sessions (sessions without matching planned tasks)
    console.log('Checking for unplanned sessions...')
    console.log('Total sessions:', userSessions.length)
    console.log('Matched sessions:', matchedSessions.size)
    console.log('Matched session IDs:', Array.from(matchedSessions))

    for (const session of userSessions) {
      const isMatched = matchedSessions.has(session.sessionId)
      const hasStart = !!session.start
      const hasEnd = !!session.end
      console.log(`Session: ${session.sessionName}`)
      console.log(`  - sessionId: ${session.sessionId}`)
      console.log(`  - start: ${session.start} (has: ${hasStart})`)
      console.log(`  - end: ${session.end} (has: ${hasEnd})`)
      console.log(`  - linkedTaskId: ${session.linkedTaskId}`)
      console.log(`  - isMatched: ${isMatched}`)
      console.log(`  - Will add to unplanned: ${!isMatched && hasStart && hasEnd}`)

      if (!matchedSessions.has(session.sessionId) && session.start && session.end) {
        console.log(`✓ ADDING unplanned session: ${session.sessionName}`)
        const sessionStart = new Date(session.start).getTime()
        const sessionEnd = new Date(session.end).getTime()
        const actualDuration = sessionEnd - sessionStart

        let category = ''
        if (session.linkedTaskId) {
          try {
            const task = await TaskCatalogAPI.getTask(CURRENT_USER, session.linkedTaskId)
            category = task.category
          } catch (error) {
            console.error(`Failed to fetch task ${session.linkedTaskId} for session ${session.sessionId}:`, error)
          }
        }

        processedComparisons.push({
          isMismatch: true,
          startTime: sessionStart,
          timeDeviationMs: actualDuration, // Entire unplanned session duration counts as deviation
          actual: {
            timeRange: `${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
            taskName: session.sessionName,
            duration: formatDuration(actualDuration),
            category: category || 'Ad-hoc',
            varianceText: 'Unplanned'
          },
          mismatchIcon: '+',
          noPlannedText: 'No planned task'
        })
      }
    }

    // Sort comparisons by start time
    processedComparisons.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))

    comparisons.value = processedComparisons

    // Update stats
    stats.value.totalTasks = processedComparisons.length
    stats.value.perfectMatch = processedComparisons.filter(c => c.isPerfectMatch).length
    stats.value.mismatched = processedComparisons.filter(c => c.isMismatch).length

    // Calculate total time variance as sum of absolute deviations
    let totalVarianceMs = 0
    for (const comparison of processedComparisons) {
      if (comparison.timeDeviationMs !== undefined) {
        totalVarianceMs += comparison.timeDeviationMs
      }
    }

    stats.value.timeVariance = formatDuration(totalVarianceMs)

  } catch (error) {
    console.error('Failed to fetch comparisons:', error)
    comparisons.value = []
  } finally {
    isLoadingComparisons.value = false
  }
}

onMounted(async () => {
  // Initialize selected date
  selectedDate.value = formatDisplayDate(currentDate.value)

  updateCurrentTimePosition()
  // Update current time every minute
  const interval = setInterval(updateCurrentTimePosition, 60000)

  // Fetch comparisons
  await fetchComparisons()

  // Auto-scroll to current time (center it in viewport) like Today view
  if (timelineContainerRef.value) {
    const currentPos = currentTimePosition.value
    // Center the current time in the viewport (adjust for more compact timeline)
    timelineContainerRef.value.scrollTop = currentPos - 150
  }

  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<style scoped>
.compare-view {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #1a1a1a;
  min-height: 100vh;
  color: #F5E8D8;
  line-height: 1.5;
  width: 100vw;
}

.header {
  background: #2a2a2a;
  color: #F5E8D8;
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
  color: #FF6F61;
}

.view-toggle {
  display: flex;
  background: rgba(245, 232, 216, 0.1);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  border: 1px solid rgba(245, 232, 216, 0.2);
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
  color: #FF6F61;
  backdrop-filter: blur(10px);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 4px;
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

.nav-button {
  background: transparent;
  border: none;
  color: rgba(245, 232, 216, 0.8);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-button:hover {
  background: rgba(245, 232, 216, 0.15);
  color: #F5E8D8;
}

.nav-button.today-button {
  padding: 8px 16px;
}

.nav-button.today-button.active {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px 120px;
}

.comparison-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.stat-card.variance {
  border-color: #FF6F61;
  background: linear-gradient(135deg, #2A1F1A 0%, #3A2A20 100%);
}

.stat-card.variance .stat-value {
  color: #FF6F61;
}

.optimize-button-container {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.optimize-schedule-button {
  background: rgba(255, 198, 54, 0.5);
  border: 2px solid #FFC636;
  border-radius: 10px;
  padding: 16px 48px;
  font-size: 16px;
  font-weight: 700;
  color: #FFC636;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  letter-spacing: 0.5px;
}

.optimize-schedule-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  background: rgba(255, 198, 54, 0.65);
  border-color: #FFC636;
}

.optimize-schedule-button:active {
  transform: translateY(0px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #F5E8D8;
}

.legend-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.legend-icon.planned {
  background: rgba(245, 232, 216, 0.3);
  border: 2px solid #F5E8D8;
}

.legend-icon.actual {
  background: rgba(255, 111, 97, 0.3);
  border: 2px solid #FF6F61;
}

.legend-icon.overlap {
  background: linear-gradient(45deg, rgba(245, 232, 216, 0.3) 50%, rgba(255, 111, 97, 0.3) 50%);
}

.timeline-wrapper {
  position: relative;
  width: 100%;
  height: calc(100vh - 350px);
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 32px;
}

.timeline-wrapper::-webkit-scrollbar {
  width: 8px;
}

.timeline-wrapper::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.timeline-wrapper::-webkit-scrollbar-thumb {
  background: #3a3a3a;
  border-radius: 4px;
}

.timeline-wrapper::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}

.unified-timeline {
  position: relative;
  padding-left: 100px;
  width: 100%;
  min-height: 2880px; /* 24 hours * 120px per hour = 2880px */
  height: 2880px;
}

.time-axis {
  position: absolute;
  left: 0;
  top: 0;
  height: 2880px;
  width: 90px;
  border-right: 2px solid #444;
}

.time-marker {
  position: absolute;
  left: 0;
  width: 85px;
  text-align: right;
  transform: translateY(-8px);
  padding-right: 12px;
  font-size: 12px;
  color: #F5E8D8;
  font-weight: 700;
}

.time-dot {
  position: absolute;
  right: -6px;
  top: -1px;
  width: 8px;
  height: 8px;
  background: #DAA520;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(218, 165, 32, 0.4);
}

.current-time-line {
  position: absolute;
  left: 88px;
  width: calc(100% - 88px);
  height: 3px;
  background: linear-gradient(90deg, #FF4500 0%, #FF6F61 100%);
  border-radius: 2px;
  z-index: 50;
  box-shadow: 0 2px 12px rgba(255, 69, 0, 0.5);
}

.current-time-line::before {
  content: 'NOW';
  position: absolute;
  right: 8px;
  top: -20px;
  font-size: 10px;
  color: #FF4500;
  font-weight: 700;
  letter-spacing: 1px;
}

.time-slot {
  position: absolute;
  left: 100px;
  right: 0;
  /* Remove min-height - let slots size based on task duration */
  /* Remove border-left - no orange line for compare view */
  padding: 8px 0; /* Add vertical padding for spacing between task clusters */
  box-sizing: border-box;
}

.task-comparison {
  position: relative;
  display: flex;
  gap: 12px;
  height: calc(100% - 16px); /* Account for time-slot padding (8px top + 8px bottom) */
  margin: 0; /* Remove any existing margin */
}

.planned-task,
.actual-task {
  flex: 1;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1.5px solid;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  height: 100%; /* Fill the full height of task-comparison */
  box-sizing: border-box; /* Include padding in height calculation */
  margin: 2px 0; /* Add subtle vertical margin for visual separation */
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.planned-task {
  border-color: #F5E8D8;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
}

.actual-task {
  border-color: #FF6F61;
  background: linear-gradient(135deg, #2A1F1A 0%, #3A2A20 100%);
}

.planned-task::before {
  content: 'PLANNED';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A2A2A;
  color: #CCC;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(245, 232, 216, 0.3);
  opacity: 0.7;
}

.actual-task::before {
  content: 'ACTUAL';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A1F1A;
  color: #DDD;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(255, 111, 97, 0.3);
  opacity: 0.7;
}

/* Hide label for short tasks (30 min or less) */
.planned-task.short-task::before,
.actual-task.short-task::before {
  display: none;
}

/* Inline title for short tasks */
.task-title-inline {
  font-size: 12px;
  font-weight: 600;
  color: #F5E8D8;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-label {
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  vertical-align: middle;
}

.planned-task .inline-label {
  background: #2A2A2A;
  color: #CCC;
  border: 1px solid rgba(245, 232, 216, 0.3);
}

.actual-task .inline-label {
  background: #2A1F1A;
  color: #DDD;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.task-perfect-match {
  flex: 1;
  background: linear-gradient(135deg, #1A2A1A 0%, #2A3A2A 100%);
  border: 2px solid #4CAF50;
  border-radius: 8px;
  padding: 8px 10px;
  position: relative;
  height: 100%; /* Fill the full height of task-comparison */
  box-sizing: border-box; /* Include padding in height calculation */
  margin: 2px 0; /* Add subtle vertical margin for visual separation */
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.task-perfect-match::before {
  content: 'PERFECT MATCH ✓';
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  background: #1A2A1A;
  color: #4CAF50;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #4CAF50;
  opacity: 0.7;
}

.planned-task:hover,
.actual-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.empty-time-slot {
  position: absolute;
  left: 100px;
  width: calc(50% - 46px); /* Match planned task width: 50% minus half the gap (12px/2 = 6px) */
  transition: all 0.2s ease;
  padding: 8px 0; /* Match time-slot padding */
  box-sizing: border-box;
}

.empty-slot-panel {
  position: relative;
  width: 100%;
  height: calc(100% - 16px); /* Account for padding like task-comparison */
  background: transparent;
  border: 2px dashed rgba(245, 232, 216, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0;
  margin: 2px 0; /* Match task component margins */
}

.empty-time-slot:hover .empty-slot-panel {
  opacity: 1;
  background: linear-gradient(135deg, rgba(42, 42, 42, 0.8) 0%, rgba(51, 51, 51, 0.8) 100%);
  border-color: rgba(245, 232, 216, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.add-task-content {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.empty-time-slot:hover .add-task-content {
  opacity: 1;
}

.add-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(245, 232, 216, 0.1);
  border: 1.5px solid rgba(245, 232, 216, 0.4);
  color: #F5E8D8;
  font-size: 18px;
  font-weight: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.empty-slot-panel:hover .add-icon {
  background: rgba(245, 232, 216, 0.15);
  border-color: #F5E8D8;
  transform: scale(1.1);
}

.add-text {
  color: #F5E8D8;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.task-time {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  margin-bottom: 4px;
  display: inline-block;
  letter-spacing: 0.2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.planned-task .task-time {
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
  border: 1px solid rgba(245, 232, 216, 0.2);
}

.actual-task .task-time {
  background: rgba(255, 111, 97, 0.1);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.2);
}

.task-perfect-match .task-time {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.task-title {
  font-size: 13px;
  font-weight: 600;
  color: #F5E8D8;
  margin-bottom: 2px;
  line-height: 1.2;
  letter-spacing: -0.2px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.task-duration {
  font-size: 9px;
  font-weight: 400;
  color: #999;
  letter-spacing: 0.1px;
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mismatch-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: #FF4500;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  font-weight: bold;
  z-index: 10;
  animation: pulse 2s infinite;
  box-shadow: 0 0 12px rgba(255, 69, 0, 0.6);
}

@keyframes pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.variance-badge {
  font-size: 8px;
  font-weight: 600;
  color: #FF4500;
  background: rgba(255, 69, 0, 0.15);
  padding: 2px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.variance-badge.skipped {
  color: #FF6F61;
  background: rgba(255, 111, 97, 0.15);
}

.variance-text {
  position: absolute;
  bottom: 3px;
  right: 6px;
  font-size: 8px;
  font-weight: 600;
  color: #FF4500;
  background: rgba(255, 69, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid rgba(255, 69, 0, 0.3);
  white-space: nowrap;
}

.variance-text.positive {
  color: #4CAF50;
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
}

.no-task {
  flex: 1;
  background: rgba(245, 232, 216, 0.05);
  border: 2px dashed #555;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 10px;
  font-style: italic;
}

.time-slot.major-mismatch {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 69, 0, 0.1) 50%, transparent 100%);
  border-left-color: #FF4500;
  border-radius: 0 8px 8px 0;
}

.adaptive-block-slot {
  position: absolute;
  left: calc(50% + 6px); /* Right half of the timeline, accounting for gap */
  right: 0;
  padding: 8px 0;
  box-sizing: border-box;
}

.delete-adaptive-block-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.9);
  color: white;
  border: none;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.2s ease;
  line-height: 1;
  padding: 0;
}

.delete-adaptive-block-btn:hover {
  opacity: 1;
  background: rgba(220, 38, 38, 1);
  transform: scale(1.1);
}

.adaptive-task {
  background: rgba(218, 165, 32, 0.2);
  border: 2px solid #DAA520;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  height: calc(100% - 16px);
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.adaptive-task:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(218, 165, 32, 0.3);
  background: rgba(218, 165, 32, 0.3);
}

.adaptive-task::before {
  content: 'ADAPTIVE';
  position: absolute;
  top: 6px;
  left: 8px;
  background: #2A2A2A;
  color: #DAA520;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #DAA520;
  opacity: 0.7;
}

.adaptive-task .task-time {
  background: rgba(218, 165, 32, 0.1);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.2);
}

.adaptive-task .task-title {
  color: #DAA520;
}

.adaptive-task .task-duration {
  color: #B8944A;
}

.floating-insights {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 320px;
  background: linear-gradient(135deg, #2A2A2A 0%, #333 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #444;
  z-index: 200;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.floating-insights.collapsed {
  width: 60px;
  height: 60px;
}

.insights-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid #444;
}

.insights-header:hover {
  background: rgba(255, 111, 97, 0.05);
}

.insights-title {
  font-size: 16px;
  font-weight: 700;
  color: #F5E8D8;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.3s ease;
}

.floating-insights.collapsed .insights-title {
  opacity: 0;
}

.toggle-icon {
  font-size: 18px;
  color: #FF6F61;
  transition: all 0.3s ease;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 111, 97, 0.1);
}

.toggle-icon:hover {
  background: rgba(255, 111, 97, 0.2);
  transform: scale(1.1);
}

.floating-insights.collapsed .toggle-icon {
  transform: rotate(180deg);
}

.insights-content {
  padding: 0 20px 20px 20px;
  max-height: 400px;
  opacity: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-insights.collapsed .insights-content {
  max-height: 0;
  opacity: 0;
  padding: 0;
}

.insights-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #FF6F61;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(255, 111, 97, 0.4);
  transition: all 0.3s ease;
}

.floating-insights.collapsed .insights-badge {
  top: 5px;
  right: 5px;
  transform: scale(0.8);
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #444;
  font-size: 13px;
  line-height: 1.4;
}

.insight-item:last-child {
  border-bottom: none;
}

.insight-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.insight-icon.warning {
  background: rgba(255, 69, 0, 0.2);
  color: #FF4500;
  border: 1px solid rgba(255, 69, 0, 0.3);
}

.insight-icon.success {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.insight-icon.info {
  background: rgba(218, 165, 32, 0.2);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.insight-text {
  color: #F5E8D8;
  flex: 1;
}
</style>
