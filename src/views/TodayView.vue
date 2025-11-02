<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AddTaskModal from '../components/AddTaskModal.vue'
import { ScheduleTimeAPI, TaskCatalogAPI, type Task, type TimeBlock } from '../services/api'
import { getCurrentDate } from '../utils/time'
import { useAuthStore } from '../stores/auth'

// Router
const router = useRouter()

// Auth store
const authStore = useAuthStore()
const CURRENT_USER = authStore.getCurrentUserId() || 'Friday'

// Modal state
const showAddTaskModal = ref(false)
const selectedHourForNewTask = ref<number | undefined>(undefined)
const isEditMode = ref(false)
const editingTask = ref<Task | null>(null)

// Task interface for display
interface DisplayTask {
  id: string
  taskId: string
  timeBlockId: string  // Added to track which time block this task belongs to
  timeStart: string
  timeEnd: string
  duration: number
  title: string
  category: string
  priority: string
  progress: number
  completed: boolean
  active?: boolean
  breakBefore?: number
}

// Real data from API
const stats = ref({
  totalTasks: 0,
  highPriority: 0,
  focusedTime: '0h 0m'
})

const tasks = ref<DisplayTask[]>([])
const isLoading = ref(true)

// Date navigation (using mock time for development)
const currentDate = ref(getCurrentDate())
const selectedDate = ref('Friday, September 27')
const activeView = ref('Today')

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
  await fetchScheduleData()
  scheduleTaskNotifications()
}

const goToToday = async () => {
  currentDate.value = getCurrentDate()
  selectedDate.value = formatDisplayDate(currentDate.value)
  await fetchScheduleData()
  scheduleTaskNotifications()
}

const goToNextDay = async () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  await fetchScheduleData()
  scheduleTaskNotifications()
}

// Check if current date is today
const isToday = () => {
  const today = getCurrentDate()
  return currentDate.value.toDateString() === today.toDateString()
}

// Helper to check if a timestamp is on the selected date
const isOnSelectedDate = (timestamp: number): boolean => {
  const date = new Date(timestamp)
  const selected = currentDate.value
  return date.getFullYear() === selected.getFullYear() &&
         date.getMonth() === selected.getMonth() &&
         date.getDate() === selected.getDate()
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

// Logout functionality
const handleLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    authStore.clearUser()
    router.push('/login')
  }
}

// Helper to convert timestamp (number or string) to 12-hour format
const formatTime = (timestamp: number | string) => {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

// Helper to get priority label (1-5 to text)
const getPriorityLabel = (priority: number): string => {
  const labels = ['lowest', 'low', 'medium', 'high', 'highest']
  return labels[priority - 1] || 'medium'
}

// Fetch schedule and tasks from API
const fetchScheduleData = async () => {
  try {
    isLoading.value = true

    console.log('📅 Fetching schedule for user:', CURRENT_USER)

    // Get all user's tasks first
    let allTasks = []
    try {
      allTasks = await TaskCatalogAPI.getUserTasks(CURRENT_USER)
      console.log('📝 Received tasks:', allTasks.length, 'total tasks')
      console.log('📝 Task data:', JSON.stringify(allTasks, null, 2))
    } catch (error: any) {
      // If no tasks exist yet, that's okay
      if (!error.message?.includes('No tasks found')) {
        throw error
      }
      console.log('⚠️ No tasks found in catalog')
      allTasks = []
    }

    if (allTasks.length === 0) {
      console.log('⚠️ No tasks found, clearing timeline')
      tasks.value = []
      updateStats()
      return
    }

    // Get user's schedule to get time block details
    const allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    console.log('📋 Received schedules:', allSchedules.length, 'time blocks total')

    // Filter schedules to only show those on the selected date
    const schedules = allSchedules.filter(block => isOnSelectedDate(block.start))
    console.log('📋 Filtered to', schedules.length, 'time blocks on selected date')
    console.log('📋 Schedule data:', JSON.stringify(schedules, null, 2))

    // Create a map of time blocks by ID for quick lookup
    const timeBlockMap = new Map(schedules.map(block => [block.timeBlockId, block]))
    console.log('🗺️ Time block map created with', timeBlockMap.size, 'blocks')

    // Build display tasks from tasks (not time blocks) since tasks have the correct timeBlockSet
    const displayTasks: DisplayTask[] = []

    for (const task of allTasks) {
      console.log('📝 Processing task:', task.taskName, 'with timeBlockSet:', task.timeBlockSet)

      if (!task.timeBlockSet || task.timeBlockSet.length === 0) {
        console.log('⚠️ Task has no time blocks assigned, skipping')
        continue
      }

      // A task can be in multiple time blocks
      for (const timeBlockId of task.timeBlockSet) {
        console.log('🔍 Looking for time block:', timeBlockId)
        const timeBlock = timeBlockMap.get(timeBlockId)
        console.log('🔍 Found time block:', timeBlock ? 'YES' : 'NO')

        if (timeBlock) {
          const displayTask = {
            id: `${task.taskId}-${timeBlockId}`,  // Unique ID for each task-timeblock combination
            taskId: task.taskId,
            timeBlockId: timeBlock.timeBlockId,
            timeStart: formatTime(timeBlock.start),
            timeEnd: formatTime(timeBlock.end),
            duration: task.duration,
            title: task.taskName,
            category: task.category,
            priority: getPriorityLabel(task.priority),
            progress: 0,
            completed: false,
            active: false
          }
          console.log('✅ Created display task:', displayTask.title, 'at', displayTask.timeStart)
          displayTasks.push(displayTask)
        } else {
          console.warn(`❌ Time block ${timeBlockId} not found for task ${task.taskName}`)
        }
      }
    }

    console.log('📊 Total display tasks created:', displayTasks.length)
    tasks.value = displayTasks
    updateStats()
    scheduleTaskNotifications()
  } catch (error: any) {
    console.error('❌ Failed to fetch schedule:', error)
    tasks.value = []
    updateStats()
    scheduleTaskNotifications()
  } finally {
    isLoading.value = false
  }
}

// Update statistics based on tasks
const updateStats = () => {
  const total = tasks.value.length
  const totalMinutes = tasks.value.reduce((sum, t) => sum + t.duration, 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  // Count tasks with priority "High" or "Highest" (priority 4 or 5)
  const highPriorityCount = tasks.value.filter(t =>
    t.priority === 'High' || t.priority === 'Highest'
  ).length

  stats.value = {
    totalTasks: total,
    highPriority: highPriorityCount,
    focusedTime: `${hours}h ${minutes}m`
  }
}

// Get current time (mock time: 9:00 AM for development)
const currentTime = ref(getCurrentDate())
const getCurrentTimePosition = () => {
  const hours = currentTime.value.getHours()
  const minutes = currentTime.value.getMinutes()
  return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Reference to timeline container for scrolling
const timelineContainerRef = ref<HTMLElement | null>(null)
const timelineContentRef = ref<HTMLElement | null>(null)

// Hour chunks for hover detection
const hoveredHour = ref<number | null>(null)

// Track hovered task for delete button
const hoveredTaskId = ref<string | null>(null)

// Track hovered task for details panel
const hoveredTaskDetails = ref<Task | null>(null)
const isLoadingTaskDetails = ref(false)
const preDependencyTasks = ref<Task[]>([])

const setHoveredTask = (taskId: string | null) => {
  hoveredTaskId.value = taskId
}

// Load full task details when hovering
const loadTaskDetails = async (displayTask: DisplayTask) => {
  try {
    isLoadingTaskDetails.value = true
    const fullTask = await TaskCatalogAPI.getTask(CURRENT_USER, displayTask.taskId)
    hoveredTaskDetails.value = fullTask

    // Load pre-dependency tasks if they exist
    if (fullTask.preDependence && fullTask.preDependence.length > 0) {
      const preDeps = await Promise.all(
        fullTask.preDependence.map(depId => TaskCatalogAPI.getTask(CURRENT_USER, depId))
      )
      preDependencyTasks.value = preDeps
    } else {
      preDependencyTasks.value = []
    }
  } catch (error: any) {
    console.error('Failed to load task details:', error)
    hoveredTaskDetails.value = null
    preDependencyTasks.value = []
  } finally {
    isLoadingTaskDetails.value = false
  }
}

const clearTaskDetails = () => {
  hoveredTaskDetails.value = null
  preDependencyTasks.value = []
  isLoadingTaskDetails.value = false
}

// Generate hour chunks (24 hours) - 200px per hour for more space
const HOUR_HEIGHT = 200
const MINUTE_HEIGHT = HOUR_HEIGHT / 60  // Height per minute
const BLOCK_DURATION = 15  // 15-minute blocks
const BLOCK_HEIGHT = MINUTE_HEIGHT * BLOCK_DURATION  // Height of each 15-min block

// Generate 15-minute blocks (24 hours * 4 blocks per hour = 96 blocks)
const timeBlocks = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMinutes = i * BLOCK_DURATION
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return {
    index: i,
    hour,
    minute,
    position: i * BLOCK_HEIGHT,
    height: BLOCK_HEIGHT
  }
})

// Half-hour chunks for hover (48 half-hour blocks in 24 hours)
const halfHourChunks = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return {
    index: i,
    hour,
    minute,
    position: (totalMinutes / 60) * HOUR_HEIGHT,
    height: HOUR_HEIGHT / 2  // Half hour = 100px
  }
})

const hourChunks = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  position: i * HOUR_HEIGHT,
  height: HOUR_HEIGHT
}))

// Check if a half-hour chunk has any tasks
const hasTaskInHalfHour = (position: number, height: number) => {
  return tasks.value.some(task => {
    const taskStartPos = getTaskPosition(task.timeStart)
    const taskEndPos = taskStartPos + getTaskHeight(task.timeStart, task.timeEnd)
    const chunkEndPos = position + height

    // Check if task overlaps with this chunk
    return (taskStartPos < chunkEndPos && taskEndPos > position)
  })
}

// Open add task modal for specific time
const openAddTaskModal = (hour: number, minute: number = 0) => {
  selectedHourForNewTask.value = hour + (minute / 60)
  showAddTaskModal.value = true
}

// Delete task from time block
const deleteTask = async (task: DisplayTask) => {
  console.log('🗑️ DELETE BUTTON CLICKED for task:', task.title, task.taskId)

  if (!confirm(`Are you sure you want to remove "${task.title}" from the schedule?`)) {
    console.log('🗑️ Delete cancelled by user')
    return
  }

  try {
    console.log('🗑️ Deleting task:', task.taskId, 'from time block:', task.timeBlockId)

    // 1. Remove the task from the time block (may fail if already removed)
    try {
      await ScheduleTimeAPI.removeTask(CURRENT_USER, task.taskId, task.timeBlockId)
      console.log('🗑️ Task removed from time block successfully')
    } catch (error: any) {
      // If task not found in time block, it may have already been removed
      if (error.message?.includes('not found in time block')) {
        console.log('🗑️ Task already removed from time block, continuing...')
      } else {
        throw error
      }
    }

    // 2. Delete the schedule from the task's timeBlockSet (may also fail if already removed)
    try {
      await TaskCatalogAPI.deleteSchedule(CURRENT_USER, task.taskId, task.timeBlockId)
      console.log('🗑️ Schedule deleted from task successfully')
    } catch (error: any) {
      // If schedule not found, it may have already been removed
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        console.log('🗑️ Schedule already removed from task, continuing...')
      } else {
        throw error
      }
    }

    // 3. Always refresh the schedule to sync UI with backend state
    await fetchScheduleData()
    console.log('🗑️ Schedule refreshed successfully')
  } catch (error: any) {
    console.error('🗑️ Failed to delete task:', error)
    alert(`Failed to delete task: ${error.message || 'Unknown error'}`)

    // Try to refresh anyway to sync UI state
    try {
      await fetchScheduleData()
    } catch (refreshError) {
      console.error('🗑️ Failed to refresh after error:', refreshError)
    }
  }
}

// Handle task card click - open for editing
const handleTaskCardClick = async (displayTask: DisplayTask) => {
  console.log('📝 Opening task for editing:', displayTask.title, displayTask.taskId)

  try {
    // Fetch full task details from API
    const fullTask = await TaskCatalogAPI.getTask(CURRENT_USER, displayTask.taskId)
    console.log('Full task details:', fullTask)

    editingTask.value = fullTask
    isEditMode.value = true
    showAddTaskModal.value = true
  } catch (error: any) {
    console.error('Failed to fetch task details:', error)
    alert(`Failed to load task details: ${error.message || 'Unknown error'}`)
  }
}

// Handle task update
const handleTaskUpdate = async (taskData: any) => {
  try {
    console.log('Updating task:', taskData)

    if (!taskData.taskId) {
      throw new Error('Task ID is missing')
    }

    // Check if start/end time has changed
    const hasTimeChanged = taskData.startTime || taskData.endTime

    // Find the current task's time block
    const currentTask = tasks.value.find(t => t.taskId === taskData.taskId)

    if (hasTimeChanged && currentTask) {
      console.log('Time changed - updating time block assignment')

      // Parse new start and end times
      const selectedDay = currentDate.value
      const [startHour, startMinute] = taskData.startTime.split(':')
      const [endHour, endMinute] = taskData.endTime.split(':')

      const startDate = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), parseInt(startHour), parseInt(startMinute))
      const endDate = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), parseInt(endHour), parseInt(endMinute))

      const newStartTimestamp = startDate.getTime()
      const newEndTimestamp = endDate.getTime()

      // Step 1: Remove task from current time block
      console.log('Step 1: Removing task from old time block:', currentTask.timeBlockId)
      await ScheduleTimeAPI.removeTask(CURRENT_USER, taskData.taskId, currentTask.timeBlockId)

      // Step 2: Delete old schedule from task
      console.log('Step 2: Deleting old schedule from task')
      await TaskCatalogAPI.deleteSchedule(CURRENT_USER, taskData.taskId, currentTask.timeBlockId)

      // Step 3: Assign task to new time block
      console.log('Step 3: Assigning task to new time block')
      const timeBlockResult = await ScheduleTimeAPI.assignTimeBlock({
        owner: CURRENT_USER,
        taskId: taskData.taskId,
        start: newStartTimestamp,
        end: newEndTimestamp
      })

      // Step 4: Assign new schedule to task
      console.log('Step 4: Assigning new schedule to task')
      await TaskCatalogAPI.assignSchedule(CURRENT_USER, taskData.taskId, timeBlockResult.timeBlockId)
    }

    // Call update APIs for each changed field (excluding time-related fields)
    await Promise.all([
      TaskCatalogAPI.updateTaskName(CURRENT_USER, taskData.taskId, taskData.taskName),
      TaskCatalogAPI.updateTaskCategory(CURRENT_USER, taskData.taskId, taskData.category),
      TaskCatalogAPI.updateTaskDuration(CURRENT_USER, taskData.taskId, taskData.duration),
      TaskCatalogAPI.updateTaskPriority(CURRENT_USER, taskData.taskId, taskData.priority),
      TaskCatalogAPI.updateTaskSplittable(CURRENT_USER, taskData.taskId, taskData.splittable),
      taskData.deadline ? TaskCatalogAPI.updateTaskDeadline(CURRENT_USER, taskData.taskId, taskData.deadline) : Promise.resolve(),
      taskData.slack ? TaskCatalogAPI.updateTaskSlack(CURRENT_USER, taskData.taskId, taskData.slack) : Promise.resolve(),
      taskData.notes ? TaskCatalogAPI.updateTaskNote(CURRENT_USER, taskData.taskId, taskData.notes) : Promise.resolve(),
    ])

    // Add pre-dependencies if any were selected
    if (taskData.preDependencies && taskData.preDependencies.length > 0) {
      for (const preDependencyId of taskData.preDependencies) {
        await TaskCatalogAPI.addPreDependence(CURRENT_USER, taskData.taskId, preDependencyId)
      }
    }

    console.log('Task updated successfully')

    // Reset edit mode
    isEditMode.value = false
    editingTask.value = null

    // Refresh the schedule
    await fetchScheduleData()

    alert('Task updated successfully!')
  } catch (error: any) {
    console.error('Failed to update task:', error)
    alert(`Failed to update task: ${error.message || 'Unknown error'}`)
  }
}

// Handle task submission
const handleTaskSubmit = async (taskData: any) => {
  try {
    console.log('Creating new task:', taskData)

    // Convert start and end time to Unix timestamps using the SELECTED date
    const selectedDay = currentDate.value
    const [startHour, startMinute] = taskData.startTime.split(':')
    const [endHour, endMinute] = taskData.endTime.split(':')

    const startDate = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), parseInt(startHour), parseInt(startMinute))
    const endDate = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), parseInt(endHour), parseInt(endMinute))

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

    // Add pre-dependencies if any were selected
    if (taskData.preDependencies && taskData.preDependencies.length > 0) {
      for (const preDependencyId of taskData.preDependencies) {
        await TaskCatalogAPI.addPreDependence(CURRENT_USER, newTask.taskId, preDependencyId)
      }
    }

    console.log('Task created - full object:', JSON.stringify(newTask, null, 2))
    console.log('Task ID for time block assignment:', newTask.taskId)
    console.log('Task ID type:', typeof newTask.taskId)

    if (!newTask.taskId) {
      console.error('ERROR: Task created but taskId is missing!', newTask)
      throw new Error('Task was created but taskId is missing')
    }

    // Check if a time block already exists for this time range
    console.log('🔍 Checking for existing time blocks at this time...')
    let allSchedules = []
    try {
      allSchedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    } catch (error: any) {
      // If no time blocks exist yet, that's fine - we'll create one
      if (error.message?.includes('No time blocks found') || error.message?.includes('No future time blocks found')) {
        console.log('📋 No existing time blocks found (this is normal for first task)')
        allSchedules = []
      } else {
        throw error
      }
    }
    console.log('📋 Found', allSchedules.length, 'existing time blocks')

    // Find a time block with matching start and end times
    const existingBlock = allSchedules.find(block =>
      block.start === startTimestamp && block.end === endTimestamp
    )

    let timeBlockId: string

    if (existingBlock) {
      console.log('✅ Found existing time block:', existingBlock.timeBlockId)
      console.log('✅ Current tasks in block:', existingBlock.taskIdSet)
      timeBlockId = existingBlock.timeBlockId

      // Check if task is already in the time block
      if (!existingBlock.taskIdSet.includes(newTask.taskId)) {
        console.log('➕ Adding task to existing time block via assignTimeBlock')
        // Use assignTimeBlock which will add to existing block
        const result = await ScheduleTimeAPI.assignTimeBlock({
          owner: CURRENT_USER,
          taskId: newTask.taskId,
          start: startTimestamp,
          end: endTimestamp
        })
        console.log('✅ Task added to time block:', result.timeBlockId)
      } else {
        console.log('⚠️ Task already in time block')
      }
    } else {
      console.log('➕ No existing time block found, creating new one')
      // Create new time block with this task
      const timeBlockResult = await ScheduleTimeAPI.assignTimeBlock({
        owner: CURRENT_USER,
        taskId: newTask.taskId,
        start: startTimestamp,
        end: endTimestamp
      })
      console.log('✅ New time block created:', timeBlockResult.timeBlockId)
      timeBlockId = timeBlockResult.timeBlockId
    }

    console.log('🔗 Calling TaskCatalog.assignSchedule with:', {
      owner: CURRENT_USER,
      taskId: newTask.taskId,
      timeBlockId: timeBlockId
    })

    // Update the task to reference this time block
    await TaskCatalogAPI.assignSchedule(
      CURRENT_USER,
      newTask.taskId,
      timeBlockId
    )

    console.log('✅ Task linked to time block')

    // Wait a bit before refreshing to ensure backend is updated
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log('🔄 Refreshing schedule data...')
    // Refresh the schedule to show the new task
    await fetchScheduleData()

    console.log('✅ Schedule refreshed, closing modal')
    showAddTaskModal.value = false
  } catch (error: any) {
    console.error('Failed to create task:', error)
    const errorMessage = error.message || 'Unknown error occurred'
    alert(`Failed to create task: ${errorMessage}`)
  }
}

// Notification management
const notificationTimeouts = ref<number[]>([])

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

// Schedule notifications for upcoming tasks (5 minutes before)
const scheduleTaskNotifications = () => {
  // Clear existing timeouts
  notificationTimeouts.value.forEach(timeout => clearTimeout(timeout))
  notificationTimeouts.value = []

  const now = Date.now()

  tasks.value.forEach(task => {
    // Parse task start time
    const [hours, minutes] = task.timeStart.split(':').map(Number)
    const taskStartDate = new Date(currentDate.value)
    taskStartDate.setHours(hours, minutes, 0, 0)
    const taskStartTime = taskStartDate.getTime()

    // Calculate time until 5 minutes before task
    const fiveMinutesBefore = taskStartTime - (5 * 60 * 1000)
    const timeUntilNotification = fiveMinutesBefore - now

    // Only schedule if the notification time is in the future
    if (timeUntilNotification > 0 && timeUntilNotification < 24 * 60 * 60 * 1000) { // Within 24 hours
      const timeoutId = window.setTimeout(() => {
        sendTaskReminder(task)
      }, timeUntilNotification)

      notificationTimeouts.value.push(timeoutId)
      console.log(`Scheduled notification for "${task.title}" in ${Math.round(timeUntilNotification / 1000 / 60)} minutes`)
    }
  })
}

// Send browser notification for upcoming task
const sendTaskReminder = (task: DisplayTask) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('📅 Upcoming Task Reminder', {
      body: `"${task.title}" starts in 5 minutes at ${task.timeStart}`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `task-reminder-${task.taskId}`,
      requireInteraction: false
    })
  }
}

// Scroll to current time on mount and fetch data
onMounted(async () => {
  // Initialize selected date
  selectedDate.value = formatDisplayDate(currentDate.value)

  // Request notification permission
  await requestNotificationPermission()

  // Fetch schedule data first
  await fetchScheduleData()

  // Schedule notifications for tasks
  scheduleTaskNotifications()

  // Then scroll to current time
  if (timelineContainerRef.value) {
    const currentPos = getCurrentTimePosition()
    // Center the current time in the viewport
    timelineContainerRef.value.scrollTop = currentPos - 200
  }
})

// Clean up timeouts on unmount
onUnmounted(() => {
  notificationTimeouts.value.forEach(timeout => clearTimeout(timeout))
  notificationTimeouts.value = []
})

// Generate time markers for both full hours and half hours
const timeMarkers = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const isFullHour = minute === 0

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

  let label = ''
  if (isFullHour) {
    label = hour === 0 ? 'Midnight' : hour === 12 ? 'Noon' : `${displayHour} ${period}`
  } else {
    label = `:${minute}`
  }

  return {
    hour,
    minute,
    label,
    position: (totalMinutes / 60) * HOUR_HEIGHT,
    isFullHour
  }
})

// Calculate task position based on time (in pixels from top)
const getTaskPosition = (timeString: string) => {
  // Parse time like "9:00 AM" or "2:30 PM"
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match || !match[1] || !match[2] || !match[3]) return 0

  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const period = match[3].toUpperCase()

  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  // Calculate position using HOUR_HEIGHT
  return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
}

// Calculate task height based on time range (more accurate than stored duration)
const getTaskHeight = (timeStart: string, timeEnd: string) => {
  const startPos = getTaskPosition(timeStart)
  const endPos = getTaskPosition(timeEnd)
  return endPos - startPos
}

// Interface for task layout with positioning info
interface TaskLayout extends DisplayTask {
  layoutWidth: number  // Width as percentage (e.g., 50 for 50%)
  layoutLeft: number   // Left offset as percentage (e.g., 0, 50)
  layoutColumn: number // Column index for rendering
}

// Detect overlapping tasks and calculate layout
const calculateTaskLayouts = computed(() => {
  if (tasks.value.length === 0) return []

  // Create task layout objects with time positions
  const taskLayouts: TaskLayout[] = tasks.value.map(task => ({
    ...task,
    layoutWidth: 100,
    layoutLeft: 0,
    layoutColumn: 0
  }))

  // Helper to check if two tasks overlap
  const tasksOverlap = (task1: TaskLayout, task2: TaskLayout) => {
    const start1 = getTaskPosition(task1.timeStart)
    const end1 = start1 + getTaskHeight(task1.timeStart, task1.timeEnd)
    const start2 = getTaskPosition(task2.timeStart)
    const end2 = start2 + getTaskHeight(task2.timeStart, task2.timeEnd)

    return start1 < end2 && start2 < end1
  }

  // Group overlapping tasks
  const processedTasks = new Set<string>()
  const overlapGroups: TaskLayout[][] = []

  for (const task of taskLayouts) {
    if (processedTasks.has(task.id)) continue

    const group: TaskLayout[] = [task]
    processedTasks.add(task.id)

    // Find all tasks that overlap with this task or any task in the group
    for (const otherTask of taskLayouts) {
      if (processedTasks.has(otherTask.id)) continue

      // Check if this task overlaps with any task in the current group
      if (group.some(groupTask => tasksOverlap(groupTask, otherTask))) {
        group.push(otherTask)
        processedTasks.add(otherTask.id)
      }
    }

    overlapGroups.push(group)
  }

  // Calculate layout for each group
  for (const group of overlapGroups) {
    if (group.length === 1) {
      // Single task - full width
      group[0].layoutWidth = 100
      group[0].layoutLeft = 0
      group[0].layoutColumn = 0
    } else {
      // Multiple overlapping tasks - arrange side by side
      // Sort by start time, then by duration (shorter first for better visual)
      group.sort((a, b) => {
        const startA = getTaskPosition(a.timeStart)
        const startB = getTaskPosition(b.timeStart)
        if (startA !== startB) return startA - startB

        const durationA = getTaskHeight(a.timeStart, a.timeEnd)
        const durationB = getTaskHeight(b.timeStart, b.timeEnd)
        return durationA - durationB
      })

      // Calculate columns needed
      const columns: TaskLayout[][] = []

      for (const task of group) {
        // Find the first column where this task doesn't overlap with existing tasks
        let placed = false
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]
          const hasOverlap = column.some(existingTask => tasksOverlap(task, existingTask))

          if (!hasOverlap) {
            column.push(task)
            task.layoutColumn = i
            placed = true
            break
          }
        }

        // If no suitable column found, create a new one
        if (!placed) {
          columns.push([task])
          task.layoutColumn = columns.length - 1
        }
      }

      // Set width and left position based on column count
      const columnCount = columns.length
      const widthPercent = 100 / columnCount

      for (const task of group) {
        task.layoutWidth = widthPercent
        task.layoutLeft = task.layoutColumn * widthPercent
      }
    }
  }

  return taskLayouts
})
</script>

<template>
  <div class="today-view">
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
      <div v-if="isLoading" class="loading-message">
        Loading schedule...
      </div>

      <div class="main-content-wrapper">
        <!-- Stats Panel on the Left -->
        <div class="today-stats">
          <div class="stat-card">
            <div class="stat-value">{{ stats.totalTasks }}</div>
            <div class="stat-label">Total Tasks</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.focusedTime }}</div>
            <div class="stat-label">Focus Time</div>
          </div>
          <div class="stat-card high-priority">
            <div class="stat-value">{{ stats.highPriority }}</div>
            <div class="stat-label">High Priority</div>
          </div>
        </div>

        <!-- Timeline on the Right -->
        <div class="timeline-wrapper" ref="timelineContainerRef">
        <div class="timeline-container">
          <div class="time-axis">
            <div
              v-for="marker in timeMarkers"
              :key="marker.hour"
              class="time-marker"
              :style="{ top: marker.position + 'px' }"
            >
              {{ marker.label }}
              <div class="time-dot"></div>
            </div>
          </div>

          <div class="timeline-content" ref="timelineContentRef">
            <!-- Half-hour chunks for hover detection -->
            <div
              v-for="chunk in halfHourChunks"
              :key="`${chunk.hour}-${chunk.minute}`"
              class="hour-chunk"
              :style="{ top: chunk.position + 'px', height: chunk.height + 'px' }"
              @mouseenter="hoveredHour = chunk.index"
              @mouseleave="hoveredHour = null"
            >
              <!-- Shadow task box for this half-hour (only show if no tasks in this half-hour) -->
              <div
                v-if="hoveredHour === chunk.index && !hasTaskInHalfHour(chunk.position, chunk.height)"
                class="shadow-task-box"
                @click="openAddTaskModal(chunk.hour, chunk.minute)"
              >
                <span class="shadow-task-text">Add Task</span>
                <button class="shadow-task-button">+</button>
              </div>
            </div>

            <!-- Current time indicator -->
            <div
              class="current-time-indicator"
              :style="{ top: getCurrentTimePosition() + 'px' }"
            ></div>

            <div
              v-for="task in calculateTaskLayouts"
              :key="task.id"
              class="task-card"
              :class="[
                `${task.priority}-priority`,
                {
                  active: task.active,
                  completed: task.completed,
                  'glow-effect': task.active
                }
              ]"
              :style="{
                top: getTaskPosition(task.timeStart) + 'px',
                height: getTaskHeight(task.timeStart, task.timeEnd) + 'px',
                width: task.layoutWidth + '%',
                left: task.layoutLeft + '%'
              }"
              @click="handleTaskCardClick(task)"
              @mouseenter="setHoveredTask(task.id); loadTaskDetails(task)"
              @mouseleave="setHoveredTask(null); clearTaskDetails()"
            >
              <div class="task-header">
                <div class="task-time">{{ task.timeStart }} - {{ task.timeEnd }}</div>
                <div class="task-duration">{{ task.duration }} min</div>
              </div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-meta">
                <div class="task-type">{{ task.category }}</div>
                <div class="priority-badge">{{ task.priority }}</div>
              </div>
              <div class="task-progress">
                <div class="task-progress-bar" :style="{ width: task.progress + '%' }"></div>
              </div>

              <!-- Delete button (shown on hover) -->
              <button
                v-if="hoveredTaskId === task.id"
                class="task-delete-button"
                @click.stop="deleteTask(task)"
                title="Remove from schedule"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

        <!-- Pre-dependency visualization above task details panel -->
        <transition name="slide-fade">
          <div v-if="hoveredTaskDetails && preDependencyTasks.length > 0" class="predependency-panel-container">
            <!-- Header label -->
            <div class="predependency-label">
              <span class="label-icon">⚠</span>
              <span class="label-text">Required First</span>
            </div>

            <!-- Dependency cards -->
            <div class="predependency-cards-wrapper">
              <div
                v-for="(preDep, index) in preDependencyTasks"
                :key="preDep.taskId"
                class="predependency-card"
                :style="{
                  top: `${index * 95}px`
                }"
              >
                <div class="predependency-badge">PREDEPENDENCY</div>
                <div class="predependency-content">
                  <div class="predependency-title">{{ preDep.taskName }}</div>
                  <div class="predependency-meta">
                    <span class="meta-category">{{ preDep.category }}</span>
                    <span class="meta-dot">•</span>
                    <span class="meta-duration">{{ preDep.duration }}m</span>
                    <span class="meta-dot">•</span>
                    <span class="meta-priority" :class="`priority-${preDep.priority}`">
                      {{ getPriorityLabel(preDep.priority) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Task Details Panel -->
        <transition name="slide-fade">
          <div
            v-if="hoveredTaskDetails"
            class="task-details-panel"
            :style="{
              top: preDependencyTasks.length > 0 ? `${200 + (preDependencyTasks.length * 95)}px` : '140px'
            }"
          >
            <div class="details-header">
              <div class="details-title">{{ hoveredTaskDetails.taskName }}</div>
              <div class="details-category-badge">{{ hoveredTaskDetails.category }}</div>
            </div>

            <div class="details-content">
              <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value priority-value" :class="`priority-${hoveredTaskDetails.priority}`">
                  {{ getPriorityLabel(hoveredTaskDetails.priority) }}
                </span>
              </div>

              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">{{ hoveredTaskDetails.duration }} minutes</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">Splittable:</span>
                <span class="detail-value">{{ hoveredTaskDetails.splittable ? 'Yes' : 'No' }}</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">Deadline:</span>
                <span class="detail-value">{{ hoveredTaskDetails.deadline ? new Date(hoveredTaskDetails.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'None' }}</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">Buffer Time:</span>
                <span class="detail-value">{{ hoveredTaskDetails.slack !== undefined && hoveredTaskDetails.slack > 0 ? hoveredTaskDetails.slack + ' minutes' : 'None' }}</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">Scheduled:</span>
                <span class="detail-value">{{ hoveredTaskDetails.timeBlockSet?.length || 0 }} time block(s)</span>
              </div>

              <div v-if="hoveredTaskDetails.note" class="detail-row notes-row">
                <span class="detail-label">Notes:</span>
                <span class="detail-value notes-value">{{ hoveredTaskDetails.note }}</span>
              </div>
            </div>
          </div>
        </transition>
      </div> <!-- Close main-content-wrapper -->
    </div>

    <button class="add-button">+</button>

    <!-- Add Task Modal -->
    <AddTaskModal
      :show="showAddTaskModal"
      :selected-hour="selectedHourForNewTask"
      :edit-mode="isEditMode"
      :task-data="editingTask ? {
        taskId: editingTask.taskId,
        taskName: editingTask.taskName,
        category: editingTask.category,
        duration: editingTask.duration,
        priority: editingTask.priority,
        splittable: editingTask.splittable,
        deadline: editingTask.deadline,
        slack: editingTask.slack,
        note: editingTask.note
      } : undefined"
      @close="showAddTaskModal = false; isEditMode = false; editingTask = null"
      @submit="handleTaskSubmit"
      @update="handleTaskUpdate"
    />
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.today-view {
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
  width: 100vw;
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

.date-selector {
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  color: #F5E8D8;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  display: none;
}

.date-selector:hover {
  background: rgba(245, 232, 216, 0.15);
  border-color: rgba(245, 232, 216, 0.3);
}

.container {
  width: 100%;
  margin: 0 auto;
  padding: 32px 40px 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loading-message {
  color: #799EFF;
  font-size: 16px;
  padding: 20px;
  text-align: center;
  margin-bottom: 20px;
}

.main-content-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  /* width: 100%; */
}

.today-stats {
  margin-top: 4em;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 200px;
  max-width: 200px;
  margin-right: 2em;
  /* flex-shrink: 0; */
}

.stat-card {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 20px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a3a;
  text-align: center;
  width: 100%;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 10px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 500;
}

.stat-card.high-priority {
  border-color: #FF6F61;
  background: #2a2a2a;
}

.stat-card.high-priority .stat-value {
  color: #FF6F61;
}

.timeline-wrapper {
  position: relative;
  flex: 1;
  height: calc(100vh - 200px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
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

.timeline-container {
  position: relative;
  padding-left: 100px;
  width: 600px;
  min-height: 2400px;
}

.timeline-content {
  position: relative;
  width: 100%;
  height: 2400px;
  min-height: 2400px;
}

.hour-chunk {
  position: absolute;
  left: 0;
  width: 100%;
  cursor: pointer;
  z-index: 1;
}

.time-axis {
  position: absolute;
  left: 0;
  top: 0;
  height: 2400px;
  width: 90px;
  border-right: 1px solid #333;
}

.time-marker {
  position: absolute;
  left: 0;
  width: 85px;
  text-align: right;
  transform: translateY(-8px);
  padding-right: 12px;
}

/* Full hour markers - more prominent */
.time-marker:nth-child(odd) {
  font-size: 12px;
  color: #AAA;
  font-weight: bold;
}

/* Half hour markers - subtle */
.time-marker:nth-child(even) {
  font-size: 10px;
  color: #666;
  font-weight: 400;
}

.time-dot {
  position: absolute;
  right: -3px;
  top: -1px;
  border-radius: 50%;
}

/* Full hour dots - blue and larger */
.time-marker:nth-child(odd) .time-dot {
  width: 5px;
  height: 5px;
  background: #799EFF;
}

/* Half hour dots - dark and smaller */
.time-marker:nth-child(even) .time-dot {
  width: 3px;
  height: 3px;
  background: #444;
  top: 0px;
  right: -2px;
}

.current-time-indicator {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: #FF4500;
  z-index: 10;
  pointer-events: none;
}

.current-time-indicator::before {
  content: '';
  position: absolute;
  left: -6px;
  top: -4px;
  width: 10px;
  height: 10px;
  background: #FF4500;
  border-radius: 50%;
  border: 2px solid #1a1a1a;
}

.shadow-task-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  border: 2px dashed rgba(255, 111, 97, 0.6);
  border-radius: 8px;
  pointer-events: auto;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.shadow-task-box:hover {
  background: rgba(255, 111, 97, 0.05);
  border-color: rgba(255, 111, 97, 0.8);
}

.shadow-task-text {
  font-size: 16px;
  color: #888;
  font-weight: 500;
}

.shadow-task-button {
  width: 40px;
  height: 40px;
  background: #FF6F61;
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(255, 111, 97, 0.4);
  transition: all 0.2s ease;
}

.shadow-task-box:hover .shadow-task-button {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(255, 111, 97, 0.6);
}

.task-card {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a3a;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  overflow: visible;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 80px;
  z-index: 10;
}

.task-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: var(--priority-color);
}

.task-card.highest-priority {
  --priority-color: linear-gradient(180deg, #FF3D00 0%, #FF5722 100%);
}

.task-card.high-priority {
  --priority-color: linear-gradient(180deg, #FF6F61 0%, #FF8575 100%);
}

.task-card.medium-priority {
  --priority-color: linear-gradient(180deg, #FF8C00 0%, #FFA500 100%);
}

.task-card.low-priority {
  --priority-color: linear-gradient(180deg, #F4C430 0%, #FFD700 100%);
}

.task-card.lowest-priority {
  --priority-color: linear-gradient(180deg, #999 0%, #BBB 100%);
}

.task-card.active {
  --priority-color: linear-gradient(180deg, #FF6F61 0%, #FF4500 100%);
  background: #352a26;
  border-color: #FF6F61;
  box-shadow: 0 4px 16px rgba(255, 111, 97, 0.2);
  transform: translateX(4px);
}

.task-card:hover {
  transform: translateX(6px) translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  border-color: #555;
  z-index: 20;
  overflow: visible !important;
}

.task-card.is-dragging {
  opacity: 0.3;
  cursor: grabbing !important;
  z-index: 5;
  pointer-events: none;
}

.task-card:not(.is-dragging) {
  cursor: grab;
}

/* Drag preview shadow box */
.drag-preview-box {
  position: absolute;
  left: 0;
  width: 100%;
  background: rgba(121, 158, 255, 0.15);
  border: 2px dashed rgba(121, 158, 255, 0.8);
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  z-index: 50;
  pointer-events: none;
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-color: rgba(121, 158, 255, 0.8);
    background: rgba(121, 158, 255, 0.15);
  }
  50% {
    border-color: rgba(121, 158, 255, 1);
    background: rgba(121, 158, 255, 0.25);
  }
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.preview-time {
  font-size: 11px;
  color: #799EFF;
  font-weight: 600;
  background: rgba(121, 158, 255, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(121, 158, 255, 0.3);
  white-space: nowrap;
}

.preview-duration {
  font-size: 10px;
  color: #799EFF;
  background: rgba(121, 158, 255, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  border: 1px solid rgba(121, 158, 255, 0.3);
  white-space: nowrap;
}

.preview-title {
  font-size: 18px;
  font-weight: 700;
  color: #799EFF;
  margin-bottom: 12px;
  line-height: 1.3;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.preview-type {
  font-size: 11px;
  color: #799EFF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.preview-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(121, 158, 255, 0.3);
  color: #799EFF;
  border: 1px solid rgba(121, 158, 255, 0.4);
}

.task-delete-button {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border: none;
  background: #FF3232;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(255, 50, 50, 0.6);
  padding: 0;
  margin: 0;
  pointer-events: auto;
}

.task-delete-button:hover {
  background: #FF0000;
  transform: scale(1.15);
  box-shadow: 0 6px 16px rgba(255, 0, 0, 0.8);
}

.task-delete-button:active {
  transform: scale(0.95);
}

.task-card.completed {
  opacity: 0.6;
  background: #252a25;
  border-color: #3a3a3a;
}

.task-card.completed .task-title {
  text-decoration: line-through;
  color: #AAA;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.task-time {
  font-size: 9px;
  color: #888;
  font-weight: 500;
  background: rgba(245, 232, 216, 0.05);
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid rgba(245, 232, 216, 0.1);
  white-space: nowrap;
  line-height: 1.2;
}

.task-duration {
  font-size: 9px;
  color: #888;
  background: rgba(218, 165, 32, 0.1);
  padding: 3px 6px;
  border-radius: 4px;
  font-weight: 500;
  border: 1px solid rgba(218, 165, 32, 0.2);
  white-space: nowrap;
  line-height: 1.2;
}

.task-title {
  font-size: 14px;
  font-weight: 700;
  color: #F5E8D8;
  line-height: 1.2;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.task-type {
  font-size: 9px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  line-height: 1.2;
}

.priority-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.highest-priority .priority-badge {
  background: rgba(255, 61, 0, 0.2);
  color: #FF3D00;
  border: 1px solid rgba(255, 61, 0, 0.3);
}

.high-priority .priority-badge {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.medium-priority .priority-badge {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
  border: 1px solid rgba(255, 140, 0, 0.3);
}

.low-priority .priority-badge {
  background: rgba(244, 196, 48, 0.2);
  color: #F4C430;
  border: 1px solid rgba(244, 196, 48, 0.3);
}

.lowest-priority .priority-badge {
  background: rgba(153, 153, 153, 0.2);
  color: #999;
  border: 1px solid rgba(153, 153, 153, 0.3);
}

.task-progress {
  width: 100%;
  height: 3px;
  background: rgba(245, 232, 216, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0;
}

.task-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #FF6F61 0%, #FF4500 100%);
  border-radius: 3px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 8px rgba(255, 111, 97, 0.3);
}

.task-progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-20px); }
  100% { transform: translateX(20px); }
}

.add-button {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #FF6F61 0%, #FF4500 100%);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(255, 111, 97, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 40px rgba(255, 111, 97, 0.6);
}

.add-button:active {
  transform: scale(0.95);
}

.glow-effect {
  box-shadow: 0 0 20px rgba(255, 111, 97, 0.3);
}

/* Task Details Panel */
.task-details-panel {
  position: fixed;
  right: 40px;
  width: 240px;
  background: #2a2a2a;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 1000;
  border: 1px solid #3a3a3a;
  transition: top 0.3s ease;
}

.details-header {
  background: rgba(255, 111, 97, 0.08);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(245, 232, 216, 0.08);
}

.details-title {
  font-size: 14px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 5px;
  line-height: 1.3;
  word-wrap: break-word;
}

.details-category-badge {
  display: inline-block;
  background: rgba(255, 111, 97, 0.15);
  color: #FF6F61;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 111, 97, 0.25);
}

.details-content {
  padding: 10px 16px 10px;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  gap: 8px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-row.notes-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  margin-top: 2px;
}

.detail-label {
  font-size: 9px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  flex-shrink: 0;
}

.detail-value {
  font-size: 11px;
  color: #F5E8D8;
  font-weight: 500;
  text-align: right;
}

.priority-value {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: capitalize;
  font-size: 10px;
}

.priority-value.priority-1 {
  background: rgba(153, 153, 153, 0.2);
  color: #999;
  border: 1px solid rgba(153, 153, 153, 0.3);
}

.priority-value.priority-2 {
  background: rgba(244, 196, 48, 0.2);
  color: #F4C430;
  border: 1px solid rgba(244, 196, 48, 0.3);
}

.priority-value.priority-3 {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
  border: 1px solid rgba(255, 140, 0, 0.3);
}

.priority-value.priority-4 {
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.priority-value.priority-5 {
  background: rgba(255, 61, 0, 0.2);
  color: #FF3D00;
  border: 1px solid rgba(255, 61, 0, 0.3);
}

.notes-row .notes-value {
  font-size: 10px;
  color: #AAA;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-style: italic;
  background: rgba(245, 232, 216, 0.02);
  padding: 6px 8px;
  border-radius: 4px;
  width: 100%;
  text-align: left;
  border-left: 2px solid rgba(255, 111, 97, 0.2);
  padding-left: 8px;
}

/* Slide-fade transition */
.slide-fade-enter-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from {
  transform: translateX(12px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(12px);
  opacity: 0;
}

/* Pre-dependency visualization above task details panel */
.predependency-panel-container {
  position: fixed;
  top: 140px;
  right: 40px;
  width: 240px;
  pointer-events: none;
  z-index: 999;
}

/* "Required First" header label */
.predependency-label {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 111, 97, 0.15);
  border: 1px solid rgba(255, 111, 97, 0.3);
  border-radius: 8px;
  padding: 7px 14px;
  width: fit-content;
  margin-bottom: 12px;
  animation: fadeInDown 0.3s ease;
}

.label-icon {
  font-size: 14px;
  color: #FF6F61;
}

.label-text {
  font-size: 10px;
  font-weight: 700;
  color: #FF6F61;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.predependency-cards-wrapper {
  position: relative;
  width: 100%;
  margin-top: 8px;
}

.predependency-card {
  position: absolute;
  width: 240px;
  background: #2a2a2a;
  border: 1.5px solid rgba(255, 111, 97, 0.3);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: fadeInDown 0.3s ease;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 78px;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.predependency-badge {
  align-self: flex-start;
  background: rgba(255, 111, 97, 0.2);
  color: #FF6F61;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.predependency-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.predependency-title {
  font-size: 13px;
  font-weight: 600;
  color: #F5E8D8;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.predependency-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: #888;
}

.meta-category {
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #AAA;
}

.meta-dot {
  color: #555;
}

.meta-duration {
  color: #AAA;
}

.meta-priority {
  font-weight: 600;
  text-transform: capitalize;
  padding: 1px 6px;
  border-radius: 3px;
}

.meta-priority.priority-1 {
  background: rgba(153, 153, 153, 0.15);
  color: #999;
}

.meta-priority.priority-2 {
  background: rgba(244, 196, 48, 0.15);
  color: #F4C430;
}

.meta-priority.priority-3 {
  background: rgba(255, 140, 0, 0.15);
  color: #FF8C00;
}

.meta-priority.priority-4 {
  background: rgba(255, 111, 97, 0.15);
  color: #FF6F61;
}

.meta-priority.priority-5 {
  background: rgba(255, 61, 0, 0.15);
  color: #FF3D00;
}

</style>
