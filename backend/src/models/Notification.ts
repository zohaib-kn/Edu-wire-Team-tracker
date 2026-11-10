import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'
import type { IUser } from './User.js'
import type { ITask } from './Task.js'

export type NotificationChannel = 'push' | 'whatsapp' | 'web'

export type NotificationStatus =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'skipped'

export type NotificationType =
  | 'task_assigned'
  | 'task_reminder'
  | 'task_completed'
  | 'task_discussion_message'
  | 'daily_report'
  | 'weekly_summary'
  | 'deadline_warning'
  | 'deadline_escalation'
  | string

export interface INotification extends Document {
  user: Types.ObjectId | IUser
  type: NotificationType
  task?: Types.ObjectId | ITask | null
  channel: NotificationChannel
  status: NotificationStatus
  sentAt?: Date | null
  error?: string | null
  // Delivery & Queue Metadata
  jobId?: string | null
  recipient: string
  attempts: number
  idempotencyKey?: string | null
  providerPayload?: Record<string, unknown> | null
  providerResponse?: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      trim: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: ['push', 'whatsapp', 'web'],
      required: [true, 'Notification channel is required'],
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'sent', 'failed', 'skipped'],
      default: 'queued',
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    jobId: {
      type: String,
      default: null,
    },
    recipient: {
      type: String,
      required: [true, 'Recipient identifier (phone/email/push token) is required'],
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    providerPayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    providerResponse: {
      type: Schema.Types.Mixed,
      default: null,
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

// Compound indexes per Specification (Page 5) and Queue Querying
notificationSchema.index({ user: 1, sentAt: -1 })
notificationSchema.index({ status: 1, createdAt: -1 })
notificationSchema.index({ task: 1, createdAt: -1 })
notificationSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', notificationSchema)
