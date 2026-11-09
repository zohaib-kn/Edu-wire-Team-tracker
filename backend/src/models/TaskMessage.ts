import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'
import type { ITask } from './Task.js'
import type { IUser } from './User.js'

export type TaskMessageType = 'question' | 'instruction' | 'reply'

export interface ITaskMessage extends Document {
  task: Types.ObjectId | ITask
  sender: Types.ObjectId | IUser
  type: TaskMessageType
  body: string
  createdAt: Date
  updatedAt: Date
}

const taskMessageSchema = new Schema<ITaskMessage>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task reference is required'],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['question', 'instruction', 'reply'],
        message: '{VALUE} is not a valid message type',
      },
      required: [true, 'Message type is required'],
    },
    body: {
      type: String,
      required: [true, 'Message body is required'],
      trim: true,
      minlength: [1, 'Message body cannot be empty'],
      maxlength: [5000, 'Message body cannot exceed 5000 characters'],
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

// Required compound index for deterministic, efficient chronological pagination
taskMessageSchema.index({ task: 1, createdAt: 1, _id: 1 })

export const TaskMessage: Model<ITaskMessage> =
  mongoose.models.TaskMessage ||
  mongoose.model<ITaskMessage>('TaskMessage', taskMessageSchema)

