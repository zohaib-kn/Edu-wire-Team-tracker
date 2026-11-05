import type { Request, Response, NextFunction } from 'express'
import { taskService } from './task.service.js'
import {
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from './task.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const taskController = {
  /**
   * POST /api/v1/tasks
   * Create a new task
   */
  async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = createTaskSchema.parse(req.body)
      const task = await taskService.createTask(validated, req.user)

      res.status(201).json({
        success: true,
        data: task,
        task,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/tasks
   * List tasks with scoped permissions and filters
   */
  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = taskQuerySchema.parse(req.query)
      const result = await taskService.getTasks(validated, req.user)

      res.status(200).json({
        success: true,
        data: result.tasks,
        tasks: result.tasks,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/tasks/:id
   * Get single task details and activity log
   */
  async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const task = await taskService.getTaskById(id, req.user)

      res.status(200).json({
        success: true,
        data: task,
        task,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/tasks/:id
   * Update task fields (title, note, owner, due, priority)
   */
  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateTaskSchema.parse(req.body)
      const task = await taskService.updateTask(id, validated, req.user)

      res.status(200).json({
        success: true,
        data: task,
        task,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/tasks/:id/status
   * Direct task status update (todo, doing, done)
   */
  async updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateTaskStatusSchema.parse(req.body)
      const task = await taskService.updateTaskStatus(id, validated.status, req.user)

      res.status(200).json({
        success: true,
        data: task,
        task,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/v1/tasks/:id
   * Soft-delete task
   */
  async deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const result = await taskService.deleteTask(id, req.user)

      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },
}
