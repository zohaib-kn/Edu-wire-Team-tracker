import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'
import type { IBranch } from './Branch.js'
import type { ITeam } from './Team.js'
import type { IUser } from './User.js'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'normal' | 'high'
export type TaskLevel = 'standalone' | 'parent' | 'subtask'

export interface ITask extends Document {
  title: string
  note?: string
  team: Types.ObjectId | ITeam
  branch: Types.ObjectId | IBranch
  owner: Types.ObjectId | IUser
  reportingManager?: Types.ObjectId | IUser | null
  createdBy: Types.ObjectId | IUser
  due: string // YYYY-MM-DD
  deadlineAt?: Date | null
  deadlineTimezone?: string
  reminderMinutesBefore?: number | null
  priority: TaskPriority
  status: TaskStatus
  parentTask?: Types.ObjectId | ITask | null
  taskLevel: TaskLevel
  responsibilityLabel?: string | null
  isRequired: boolean
  doneAt?: Date | null
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team reference is required'],
      index: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true,
    },
    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
    },
    due: {
      type: String,
      required: [true, 'Due date (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'],
    },
    deadlineAt: {
      type: Date,
      default: null,
      index: true,
    },
    deadlineTimezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
    reminderMinutesBefore: {
      type: Number,
      default: null,
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['todo', 'doing', 'done'],
      default: 'todo',
    },
    parentTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    taskLevel: {
      type: String,
      enum: ['standalone', 'parent', 'subtask'],
      default: 'standalone',
      index: true,
    },
    responsibilityLabel: {
      type: String,
      trim: true,
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    doneAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id ? (ret._id as Types.ObjectId).toString() : ret.id
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

// Required compound indexes
taskSchema.index({ branch: 1, status: 1, due: 1 })
taskSchema.index({ team: 1, status: 1, due: 1 })
taskSchema.index({ owner: 1, status: 1 })
taskSchema.index({ reportingManager: 1, status: 1 })
taskSchema.index({ parentTask: 1, deletedAt: 1, status: 1 })
taskSchema.index({ taskLevel: 1, deletedAt: 1 })
taskSchema.index({ status: 1, deadlineAt: 1, deletedAt: 1 })

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>('Task', taskSchema)

