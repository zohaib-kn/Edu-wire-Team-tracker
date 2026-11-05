import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'
import type { IUser } from './User.js'

export type ActivityAction =
  | 'created'
  | 'edited'
  | 'status_changed'
  | 'deleted'
  | 'role_updated'
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'password_reset'
  | string

export interface IActivity extends Document {
  task?: Types.ObjectId | null
  user: Types.ObjectId | IUser
  action: ActivityAction
  from?: unknown
  to?: unknown
  at: Date
  createdAt: Date
  updatedAt: Date
}

const activitySchema = new Schema<IActivity>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action type is required'],
    },
    from: {
      type: Schema.Types.Mixed,
      default: null,
    },
    to: {
      type: Schema.Types.Mixed,
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
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
activitySchema.index({ task: 1, at: -1 })
activitySchema.index({ user: 1, at: -1 })

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema)
