<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AddTaskModal from '../components/AddTaskModal.vue'
import { ScheduleTimeAPI, TaskCatalogAPI, CURRENT_USER, type Task, type TimeBlock } from '../services/api'

// Router
const router = useRouter()

// Modal state
const showAddTaskModal = ref(false)
const selectedHourForNewTask = ref<number | undefined>(undefined)

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
  completed: 0,
  focusedTime: '0h 0m',
  progress: 0
})

const tasks = ref<DisplayTask[]>([])
const isLoading = ref(true)

// Date navigation
const currentDate = ref(new Date())
const selectedDate = ref('Friday, September 27')
const activeView = ref('Today')

// Format date for display
const formatDisplayDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Navigation functions
const goToPreviousDay = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  fetchScheduleData()
}

const goToToday = () => {
  currentDate.value = new Date()
  selectedDate.value = formatDisplayDate(currentDate.value)
  fetchScheduleData()
}

const goToNextDay = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 1)
  currentDate.value = newDate
  selectedDate.value = formatDisplayDate(newDate)
  fetchScheduleData()
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
    const schedules = await ScheduleTimeAPI.getUserSchedule(CURRENT_USER)
    console.log('📋 Received schedules:', schedules.length, 'time blocks')
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
  } catch (error: any) {
    console.error('❌ Failed to fetch schedule:', error)
    tasks.value = []
    updateStats()
  } finally {
    isLoading.value = false
  }
}

// Update statistics based on tasks
const updateStats = () => {
  const total = tasks.value.length
  const completed = tasks.value.filter(t => t.completed).length
  const totalMinutes = tasks.value.reduce((sum, t) => sum + t.duration, 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  stats.value = {
    totalTasks: total,
    completed: completed,
    focusedTime: `${hours}h ${minutes}m`,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0
  }
}

// Get current time
const currentTime = ref(new Date())
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

// Drag and drop state
const isDragging = ref(false)
const draggedTask = ref<DisplayTask | null>(null)
const dragStartPosition = ref({ top: 0, height: 0 })
const dragPreviewPosition = ref({ top: 0, height: 0 })
const dragPreviewTime = ref({ start: '', end: '' })

// Debug: Log when hovering
const setHoveredTask = (taskId: string | null) => {
  console.log('🎯 HOVER EVENT - Task ID:', taskId)
  console.log('🎯 Current hoveredTaskId value:', hoveredTaskId.value)
  hoveredTaskId.value = taskId
  console.log('🎯 Updated hoveredTaskId value:', hoveredTaskId.value)
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

// Drag and drop handlers
const startDrag = (event: MouseEvent, task: DisplayTask) => {
  // Don't start drag if clicking on delete button
  if ((event.target as HTMLElement).classList.contains('task-delete-button')) {
    return
  }

  console.log('🎯 Start dragging task:', task.title)
  isDragging.value = true
  draggedTask.value = task

  // Store original position
  dragStartPosition.value = {
    top: getTaskPosition(task.timeStart),
    height: getTaskHeight(task.duration)
  }

  // Initialize preview at current position
  dragPreviewPosition.value = { ...dragStartPosition.value }
  dragPreviewTime.value = {
    start: task.timeStart,
    end: task.timeEnd
  }
}

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !draggedTask.value) return

  event.preventDefault()

  // Calculate position relative to timeline
  const timelineContent = timelineContentRef.value
  if (!timelineContent) return

  const timelineRect = timelineContent.getBoundingClientRect()
  const relativeY = event.clientY - timelineRect.top + (timelineContainerRef.value?.scrollTop || 0)

  // Snap to 15-minute blocks
  const totalMinutes = (relativeY / HOUR_HEIGHT) * 60
  const snappedMinutes = Math.round(totalMinutes / BLOCK_DURATION) * BLOCK_DURATION

  // Calculate new start time
  const newStartHour = Math.floor(snappedMinutes / 60)
  const newStartMinute = snappedMinutes % 60

  // Keep the same duration
  const durationMinutes = draggedTask.value.duration
  const endTotalMinutes = snappedMinutes + durationMinutes
  const newEndHour = Math.floor(endTotalMinutes / 60)
  const newEndMinute = endTotalMinutes % 60

  // Update preview position (snapped to 15-min blocks)
  const snappedPosition = (snappedMinutes / 60) * HOUR_HEIGHT
  dragPreviewPosition.value = {
    top: snappedPosition,
    height: dragStartPosition.value.height
  }

  // Update preview time display
  const today = new Date()
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), newStartHour, newStartMinute)
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), newEndHour, newEndMinute)

  dragPreviewTime.value = {
    start: formatTime(startDate.getTime()),
    end: formatTime(endDate.getTime())
  }
}

const endDrag = async (event: MouseEvent) => {
  if (!isDragging.value || !draggedTask.value) return

  console.log('🎯 End dragging task:', draggedTask.value.title)

  const task = draggedTask.value

  // Parse the preview time to get timestamps
  const parseTimeString = (timeStr: string) => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!match) return null

    let hours = parseInt(match[1])
    const minutes = parseInt(match[2])
    const period = match[3].toUpperCase()

    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0

    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes).getTime()
  }

  const newStartTimestamp = parseTimeString(dragPreviewTime.value.start)
  const newEndTimestamp = parseTimeString(dragPreviewTime.value.end)

  if (!newStartTimestamp || !newEndTimestamp) {
    console.error('Failed to parse preview time')
    isDragging.value = false
    draggedTask.value = null
    return
  }

  console.log('🎯 New time:', dragPreviewTime.value.start, '-', dragPreviewTime.value.end)

  try {
    // 1. Remove task from old time block
    console.log('🎯 Step 1: Removing task from old time block')
    await ScheduleTimeAPI.removeTask(CURRENT_USER, task.taskId, task.timeBlockId)

    // 2. Delete old schedule from task
    console.log('🎯 Step 2: Deleting old schedule from task')
    await TaskCatalogAPI.deleteSchedule(CURRENT_USER, task.taskId, task.timeBlockId)

    // 3. Assign task to new time block
    console.log('🎯 Step 3: Assigning task to new time block')
    const timeBlockResult = await ScheduleTimeAPI.assignTimeBlock({
      owner: CURRENT_USER,
      taskId: task.taskId,
      start: newStartTimestamp,
      end: newEndTimestamp
    })

    // 4. Assign new schedule to task
    console.log('🎯 Step 4: Assigning new schedule to task')
    await TaskCatalogAPI.assignSchedule(CURRENT_USER, task.taskId, timeBlockResult.timeBlockId)

    console.log('🎯 Task moved successfully!')

    // Refresh the schedule
    await fetchScheduleData()
  } catch (error: any) {
    console.error('🎯 Failed to move task:', error)
    alert(`Failed to move task: ${error.message || 'Unknown error'}`)
  } finally {
    // Reset drag state
    isDragging.value = false
    draggedTask.value = null
  }
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

    // Remove the task from the time block
    await ScheduleTimeAPI.removeTask(CURRENT_USER, task.taskId, task.timeBlockId)

    console.log('🗑️ Task removed from time block successfully')

    // Refresh the schedule
    await fetchScheduleData()
    console.log('🗑️ Schedule refreshed')
  } catch (error: any) {
    console.error('🗑️ Failed to delete task:', error)
    alert(`Failed to delete task: ${error.message || 'Unknown error'}`)
  }
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
      if (error.message?.includes('No future time blocks found')) {
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

// Scroll to current time on mount and fetch data
onMounted(async () => {
  // Initialize selected date
  selectedDate.value = formatDisplayDate(currentDate.value)

  // Fetch schedule data first
  await fetchScheduleData()

  // Then scroll to current time
  if (timelineContainerRef.value) {
    const currentPos = getCurrentTimePosition()
    // Center the current time in the viewport
    timelineContainerRef.value.scrollTop = currentPos - 200
  }

  // Add global mouse move and mouse up listeners for drag and drop
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
})

// Clean up event listeners on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
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
          </div>
        </div>
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
      </div>
    </div>

    <div class="container">
      <div v-if="isLoading" class="loading-message">
        Loading schedule...
      </div>

      <div class="today-stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalTasks }}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.completed }}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.focusedTime }}</div>
          <div class="stat-label">Focused Time</div>
        </div>
        <div class="stat-card progress">
          <div class="stat-value">{{ stats.progress }}%</div>
          <div class="stat-label">Progress</div>
        </div>
      </div>

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

            <!-- Drag preview shadow box -->
            <div
              v-if="isDragging && draggedTask"
              class="drag-preview-box"
              :style="{
                top: dragPreviewPosition.top + 'px',
                height: dragPreviewPosition.height + 'px'
              }"
            >
              <div class="preview-header">
                <div class="preview-time">{{ dragPreviewTime.start }} - {{ dragPreviewTime.end }}</div>
                <div class="preview-duration">{{ draggedTask.duration }} min</div>
              </div>
              <div class="preview-title">{{ draggedTask.title }}</div>
              <div class="preview-meta">
                <div class="preview-type">{{ draggedTask.category }}</div>
                <div class="preview-badge">{{ draggedTask.priority }}</div>
              </div>
            </div>

            <div
              v-for="task in tasks"
              :key="task.id"
              class="task-card"
              :class="[
                `${task.priority}-priority`,
                {
                  active: task.active,
                  completed: task.completed,
                  'glow-effect': task.active,
                  'is-dragging': isDragging && draggedTask?.id === task.id
                }
              ]"
              :style="{
                top: getTaskPosition(task.timeStart) + 'px',
                height: getTaskHeight(task.timeStart, task.timeEnd) + 'px'
              }"
              @mousedown="startDrag($event, task)"
              @mouseenter="setHoveredTask(task.id)"
              @mouseleave="setHoveredTask(null)"
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
                @click="deleteTask(task)"
                title="Remove from schedule"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button class="add-button">+</button>

    <!-- Add Task Modal -->
    <AddTaskModal
      :show="showAddTaskModal"
      :selected-hour="selectedHourForNewTask"
      @close="showAddTaskModal = false"
      @submit="handleTaskSubmit"
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

.date-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(245, 232, 216, 0.1);
  border: 1px solid rgba(245, 232, 216, 0.2);
  border-radius: 12px;
  padding: 4px;
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

.today-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 180px));
  gap: 20px;
  margin-bottom: 40px;
  justify-content: center;
}

.stat-card {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a3a;
  text-align: center;
  min-width: 140px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #F5E8D8;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 11px;
  color: #AAA;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 500;
}

.stat-card.progress {
  border-color: #FF6F61;
  background: #2a2a2a;
}

.stat-card.progress .stat-value {
  color: #FF6F61;
}

.timeline-wrapper {
  position: relative;
  width: 100vw;
  height: calc(100vh - 350px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  margin-left: calc(-50vw + 50%);
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
  width: 100%;
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

.task-card.high-priority {
  --priority-color: linear-gradient(180deg, #FF4500 0%, #FF6F61 100%);
}

.task-card.medium-priority {
  --priority-color: linear-gradient(180deg, #DAA520 0%, #FFD700 100%);
}

.task-card.low-priority {
  --priority-color: linear-gradient(180deg, #F5E8D8 0%, #E5D5C8 100%);
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

.high-priority .priority-badge {
  background: rgba(255, 69, 0, 0.2);
  color: #FF6F61;
  border: 1px solid rgba(255, 111, 97, 0.3);
}

.medium-priority .priority-badge {
  background: rgba(218, 165, 32, 0.2);
  color: #DAA520;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.low-priority .priority-badge {
  background: rgba(245, 232, 216, 0.1);
  color: #F5E8D8;
  border: 1px solid rgba(245, 232, 216, 0.2);
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
</style>
