import { useAuthStore } from '@/stores/auth'

// Use environment variable for deployed backend, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Routes that require authentication (excluded routes that go through syncs)
const AUTHENTICATED_ROUTES = [
  '/api/TaskCatalog/createTask',
  '/api/TaskCatalog/assignSchedule',
  '/api/TaskCatalog/deleteSchedule',
  '/api/TaskCatalog/updateTaskName',
  '/api/TaskCatalog/updateTaskCategory',
  '/api/TaskCatalog/updateTaskDuration',
  '/api/TaskCatalog/updateTaskPriority',
  '/api/TaskCatalog/updateTaskSplittable',
  '/api/TaskCatalog/updateTaskDeadline',
  '/api/TaskCatalog/updateTaskSlack',
  '/api/TaskCatalog/updateTaskNote',
  '/api/TaskCatalog/addPreDependence',
  '/api/TaskCatalog/deleteTask',
  '/api/ScheduleTime/assignTimeBlock',
  '/api/ScheduleTime/removeTask',
  '/api/RoutineLog/createSession',
  '/api/RoutineLog/startSession',
  '/api/RoutineLog/endSession',
  '/api/RoutineLog/interruptSession',
  '/api/RoutineLog/deleteSession',
  '/api/AdaptiveSchedule/assignAdaptiveSchedule',
  '/api/AdaptiveSchedule/deleteAdaptiveBlock',
  '/api/AdaptiveSchedule/requestAdaptiveScheduleAI',
]

// Task interfaces (as returned by API)
interface TaskResponse {
  _id: string
  owner: string
  taskName: string
  category: string
  duration: number
  priority: number
  splittable: boolean
  timeBlockSet: string[]
  deadline?: string
  slack?: number
  preDependence?: string[]
  postDependence?: string[]
  note?: string
}

// Task interface for frontend use
export interface Task {
  taskId: string
  owner: string
  taskName: string
  category: string
  duration: number
  priority: number
  splittable: boolean
  timeBlockSet: string[]
  deadline?: string
  slack?: number
  preDependence?: string[]
  postDependence?: string[]
  note?: string
}

// Helper to convert API response to Task
function mapTaskResponse(response: TaskResponse): Task {
  return {
    taskId: response._id,
    owner: response.owner,
    taskName: response.taskName,
    category: response.category,
    duration: response.duration,
    priority: response.priority,
    splittable: response.splittable,
    timeBlockSet: response.timeBlockSet,
    deadline: response.deadline,
    slack: response.slack,
    preDependence: response.preDependence,
    postDependence: response.postDependence,
    note: response.note
  }
}

// Schedule/TimeBlock interfaces (as returned by API)
interface TimeBlockResponse {
  _id: string
  owner: string
  start: number  // Unix timestamp in milliseconds
  end: number    // Unix timestamp in milliseconds
  taskIdSet: string[]
}

// TimeBlock interface for frontend use
export interface TimeBlock {
  timeBlockId: string
  owner: string
  start: number  // Unix timestamp in milliseconds
  end: number    // Unix timestamp in milliseconds
  taskIdSet: string[]
}

// Helper to convert API response to TimeBlock
function mapTimeBlockResponse(response: TimeBlockResponse): TimeBlock {
  return {
    timeBlockId: response._id,
    owner: response.owner,
    start: response.start,
    end: response.end,
    taskIdSet: response.taskIdSet
  }
}

// API call helper
async function apiCall<T>(endpoint: string, body: any): Promise<T> {
  try {
    // Auto-inject sessionToken for authenticated routes
    let requestBody = body
    if (AUTHENTICATED_ROUTES.includes(endpoint)) {
      const authStore = useAuthStore()
      const sessionToken = authStore.getSessionToken()

      console.log('API Call requires auth. Current user:', authStore.getCurrentUser())
      console.log('Session token from store:', sessionToken)

      if (!sessionToken) {
        throw new Error('Authentication required - no session token')
      }

      // Remove owner parameter and add sessionToken instead
      const { owner, ...restBody } = body
      requestBody = { sessionToken, ...restBody }
      console.log(`API Call (Authenticated): ${endpoint}`, requestBody)
    } else {
      console.log(`API Call: ${endpoint}`, body)
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    console.log(`API Response: ${endpoint}`, data)

    if (!response.ok || data.error) {
      console.error(`API Error: ${endpoint}`, data)
      throw new Error(data.error || `API call failed: ${endpoint} - Status: ${response.status}`)
    }

    return data
  } catch (error) {
    console.error(`API Exception: ${endpoint}`, error)
    throw error
  }
}

// TaskCatalog APIs
export const TaskCatalogAPI = {
  async getUserTasks(owner: string): Promise<Task[]> {
    const response = await apiCall<{ taskTable: TaskResponse[] }>('/api/TaskCatalog/_getUserTasks', { owner })
    return response.taskTable.map(mapTaskResponse)
  },

  async getTask(owner: string, taskId: string): Promise<Task> {
    const response = await apiCall<{ task: TaskResponse }>('/api/TaskCatalog/_getTask', { owner, taskId })
    return mapTaskResponse(response.task)
  },

  async createTask(params: {
    owner: string
    taskName: string
    category: string
    duration: number
    priority: number
    splittable: boolean
    deadline?: string
    slack?: number
    preDependence?: string[]
    note?: string
  }): Promise<Task> {
    const response = await apiCall<{ task: TaskResponse }>('/api/TaskCatalog/createTask', params)
    return mapTaskResponse(response.task)
  },

  async assignSchedule(owner: string, taskId: string, timeBlockId: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/assignSchedule', {
      owner,
      taskId,
      timeBlockId,
    })
  },

  async deleteTask(owner: string, taskId: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/deleteTask', { owner, taskId })
  },

  async deleteSchedule(owner: string, taskId: string, timeBlockId: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/deleteSchedule', {
      owner,
      taskId,
      timeBlockId,
    })
  },

  async updateTaskName(owner: string, taskId: string, taskName: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskName', { owner, taskId, taskName })
  },

  async updateTaskCategory(owner: string, taskId: string, category: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskCategory', { owner, taskId, category })
  },

  async updateTaskDuration(owner: string, taskId: string, duration: number): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskDuration', { owner, taskId, duration })
  },

  async updateTaskPriority(owner: string, taskId: string, priority: number): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskPriority', { owner, taskId, priority })
  },

  async updateTaskSplittable(owner: string, taskId: string, splittable: boolean): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskSplittable', { owner, taskId, splittable })
  },

  async updateTaskDeadline(owner: string, taskId: string, deadline: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskDeadline', { owner, taskId, deadline })
  },

  async updateTaskSlack(owner: string, taskId: string, slack: number): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskSlack', { owner, taskId, slack })
  },

  async updateTaskNote(owner: string, taskId: string, note: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/updateTaskNote', { owner, taskId, note })
  },

  async addPreDependence(owner: string, taskId: string, newPreDependence: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/addPreDependence', { owner, taskId, newPreDependence })
  },

  async removePreDependence(owner: string, taskId: string, oldPreDependence: string): Promise<void> {
    return apiCall<void>('/api/TaskCatalog/removePreDependence', { owner, taskId, oldPreDependence })
  },
}

// RoutineLog interfaces
interface SessionResponse {
  owner: string
  sessionName: string
  sessionId: string
  isPaused: boolean
  isActive: boolean
  start?: string
  end?: string
  linkedTaskId?: string
  interruptReason?: string
}

export interface Session {
  owner: string
  sessionName: string
  sessionId: string
  isPaused: boolean
  isActive: boolean
  isDone: boolean
  start?: string
  end?: string
  linkedTaskId?: string
  interruptReason?: string
}

// RoutineLog APIs
export const RoutineLogAPI = {
  async getUserSessions(owner: string): Promise<Session[]> {
    const response = await apiCall<{ sessionTable: any[] }>('/api/RoutineLog/_getUserSessions', { owner })
    // Map _id to sessionId for consistency with frontend
    return response.sessionTable.map(session => ({
      ...session,
      sessionId: session._id || session.sessionId
    }))
  },

  async createSession(params: {
    owner: string
    sessionName: string
    linkedTaskId?: string
  }): Promise<{ session: Session | string }> {
    return apiCall<{ session: Session | string }>('/api/RoutineLog/createSession', params)
  },

  async startSession(owner: string, session: any): Promise<void> {
    return apiCall<void>('/api/RoutineLog/startSession', { owner, session })
  },

  async endSession(owner: string, session: any, isDone: boolean): Promise<void> {
    return apiCall<void>('/api/RoutineLog/endSession', { owner, session, isDone })
  },

  async interruptSession(owner: string, session: any, interruptReason: string): Promise<void> {
    return apiCall<void>('/api/RoutineLog/interruptSession', {
      owner,
      session,
      interruptReason,
    })
  },

  async deleteSession(owner: string, session: any): Promise<void> {
    return apiCall<void>('/api/RoutineLog/deleteSession', { owner, session })
  },
}

// ScheduleTime APIs
export const ScheduleTimeAPI = {
  async getUserSchedule(owner: string): Promise<TimeBlock[]> {
    const response = await apiCall<Array<{ timeBlock: TimeBlockResponse }>>('/api/ScheduleTime/_getUserSchedule', { owner })
    // Extract timeBlock from each wrapped object and map _id to timeBlockId
    return response.map(item => mapTimeBlockResponse(item.timeBlock))
  },

  async getTaskSchedule(owner: string, timeBlockId: string): Promise<TimeBlock> {
    const response = await apiCall<{ timeBlock: TimeBlockResponse }>('/api/ScheduleTime/_getTaskSchedule', { owner, timeBlockId })
    return mapTimeBlockResponse(response.timeBlock)
  },

  async assignTimeBlock(params: {
    owner: string
    taskId: string
    start: string | number
    end: string | number
  }): Promise<{ timeBlockId: string }> {
    // Convert ISO strings to Unix timestamps if needed
    const startTimestamp = typeof params.start === 'string' ? new Date(params.start).getTime() : params.start
    const endTimestamp = typeof params.end === 'string' ? new Date(params.end).getTime() : params.end

    const requestBody = {
      owner: params.owner,
      taskId: params.taskId,
      start: startTimestamp,
      end: endTimestamp
    }

    console.log('assignTimeBlock request body:', requestBody)

    return apiCall<{ timeBlockId: string }>('/api/ScheduleTime/assignTimeBlock', requestBody)
  },

  async removeTask(owner: string, taskId: string, timeBlockId: string): Promise<void> {
    return apiCall<void>('/api/ScheduleTime/removeTask', {
      owner,
      taskId,
      timeBlockId,
    })
  },
}

// AdaptiveSchedule interfaces
interface AdaptiveBlockResponse {
  _id: string
  owner: string
  start: number  // Unix timestamp in milliseconds
  end: number    // Unix timestamp in milliseconds
  taskIdSet: string[]
}

export interface AdaptiveBlock {
  timeBlockId: string
  owner: string
  start: number  // Unix timestamp in milliseconds
  end: number    // Unix timestamp in milliseconds
  taskIdSet: string[]
}

export interface DroppedTask {
  taskId: string
  owner: string
  reason: string
}

// Helper to convert API response to AdaptiveBlock
function mapAdaptiveBlockResponse(response: AdaptiveBlockResponse): AdaptiveBlock {
  return {
    timeBlockId: response._id,
    owner: response.owner,
    start: response.start,
    end: response.end,
    taskIdSet: response.taskIdSet
  }
}

// AdaptiveSchedule APIs
export const AdaptiveScheduleAPI = {
  async getAdaptiveSchedule(owner: string): Promise<AdaptiveBlock[]> {
    const response = await apiCall<{ adaptiveBlockTable: AdaptiveBlockResponse[] }>('/api/AdaptiveSchedule/_getAdaptiveSchedule', { owner })
    return response.adaptiveBlockTable.map(mapAdaptiveBlockResponse)
  },

  async getDroppedTasks(owner: string): Promise<DroppedTask[]> {
    const response = await apiCall<{ droppedTaskSet: DroppedTask[] }>('/api/AdaptiveSchedule/_getDroppedTask', { owner })
    return response.droppedTaskSet
  },

  async requestAdaptiveScheduleAI(owner: string, contextedPrompt: string): Promise<{
    adaptiveBlockTable: AdaptiveBlock[]
    droppedTaskSet: DroppedTask[]
    analysis: string
  }> {
    const response = await apiCall<{
      adaptiveBlockTable: AdaptiveBlockResponse[]
      droppedTaskSet: DroppedTask[]
      analysis: string
    }>('/api/AdaptiveSchedule/requestAdaptiveScheduleAI', {
      owner,
      contexted_prompt: contextedPrompt
    })
    return {
      adaptiveBlockTable: response.adaptiveBlockTable.map(mapAdaptiveBlockResponse),
      droppedTaskSet: response.droppedTaskSet,
      analysis: response.analysis
    }
  },

  async deleteAdaptiveBlock(owner: string, timeBlockId: string): Promise<void> {
    await apiCall<{}>('/api/AdaptiveSchedule/deleteAdaptiveBlock', {
      owner,
      timeBlockId
    })
  },

  async assignAdaptiveSchedule(params: {
    owner: string
    taskId: string
    start: string | number
    end: string | number
  }): Promise<{ timeBlockId: string }> {
    // Convert ISO strings to Unix timestamps if needed
    const startTimestamp = typeof params.start === 'string' ? new Date(params.start).getTime() : params.start
    const endTimestamp = typeof params.end === 'string' ? new Date(params.end).getTime() : params.end

    return apiCall<{ timeBlockId: string }>('/api/AdaptiveSchedule/assignAdaptiveSchedule', {
      owner: params.owner,
      taskId: params.taskId,
      start: startTimestamp,
      end: endTimestamp
    })
  },
}

// Auth interfaces
export interface AuthUser {
  userId: string
  username: string
  email?: string
  sessionToken?: string
}

// Auth APIs
export const AuthAPI = {
  async registerUser(params: {
    username: string
    email: string
    password: string
  }): Promise<AuthUser> {
    const response = await apiCall<{ userId: string; username: string; sessionToken: string }>('/api/Auth/registerUser', params)
    return {
      userId: response.userId,
      username: response.username,
      sessionToken: response.sessionToken,
    }
  },

  async authenticateUser(params: {
    email: string
    password: string
  }): Promise<AuthUser> {
    const response = await apiCall<{ userId: string; username: string; sessionToken: string }>('/api/Auth/authenticateUser', params)
    return {
      userId: response.userId,
      username: response.username,
      sessionToken: response.sessionToken,
    }
  },

  async getUserById(userId: string): Promise<AuthUser> {
    const response = await apiCall<{ userId: string; username: string; email: string }>('/api/Auth/getUserById', { userId })
    return {
      userId: response.userId,
      username: response.username,
      email: response.email,
    }
  },

  async getUserByUsername(username: string): Promise<AuthUser> {
    const response = await apiCall<{ userId: string; username: string; email: string }>('/api/Auth/getUserByUsername', { username })
    return {
      userId: response.userId,
      username: response.username,
      email: response.email,
    }
  },

  async updatePassword(params: {
    userId: string
    oldPassword: string
    newPassword: string
  }): Promise<void> {
    return apiCall<void>('/api/Auth/updatePassword', params)
  },

  async deleteUser(userId: string): Promise<void> {
    return apiCall<void>('/api/Auth/deleteUser', { userId })
  },
}
