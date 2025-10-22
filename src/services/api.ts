const API_BASE_URL = 'http://localhost:8000'

// Current user for prototype
export const CURRENT_USER = 'Friday'

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
    console.log(`API Call: ${endpoint}`, body)

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
  }): Promise<{ session: string }> {
    return apiCall<{ session: string }>('/api/RoutineLog/createSession', params)
  },

  async startSession(owner: string, session: string): Promise<void> {
    return apiCall<void>('/api/RoutineLog/startSession', { owner, session })
  },

  async endSession(owner: string, session: string): Promise<void> {
    return apiCall<void>('/api/RoutineLog/endSession', { owner, session })
  },

  async interruptSession(owner: string, session: string, interruptReason: string): Promise<void> {
    return apiCall<void>('/api/RoutineLog/interruptSession', {
      owner,
      session,
      interruptReason,
    })
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
  }> {
    const response = await apiCall<{
      adaptiveBlockTable: AdaptiveBlockResponse[]
      droppedTaskSet: DroppedTask[]
    }>('/api/AdaptiveSchedule/requestAdaptiveScheduleAI', {
      owner,
      contexted_prompt: contextedPrompt
    })
    return {
      adaptiveBlockTable: response.adaptiveBlockTable.map(mapAdaptiveBlockResponse),
      droppedTaskSet: response.droppedTaskSet
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
