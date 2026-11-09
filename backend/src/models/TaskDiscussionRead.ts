/**
 * TaskDiscussionRead — per-user, per-task read cursor for the Discussion tab.
 *
 * Design rationale:
 *   One document per (user × task) pair stores the timestamp of the last
 *   message the user has seen.  Unread count = messages created after
 *   lastReadAt by other senders.
 *
 *   Chosen over per-message read-receipts because:
 *   - O(1) upsert on every Discussion tab open
 *   - O(1) unread-count query (index scan on task + createdAt)
 *   - Zero growth for tasks with no unread tracking
 */
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'

export interface ITaskDiscussionRead extends Document {
  task: Types.ObjectId
  user: Types.ObjectId
  lastReadAt: Date
  createdAt: Date
  updatedAt: Date
}

const taskDiscussionReadSchema = new Schema<ITaskDiscussionRead>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task reference is required'],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    lastReadAt: {
      type: Date,
      required: [true, 'Last read timestamp is required'],
    },
  },
  {
    timestamps: true,
  },
)

// Unique cursor per user × task; makes upsert idempotent
taskDiscussionReadSchema.index({ task: 1, user: 1 }, { unique: true })
// Fast unread-count lookups: given task _id, count messages after lastReadAt
taskDiscussionReadSchema.index({ user: 1, task: 1, lastReadAt: -1 })

export const TaskDiscussionRead: Model<ITaskDiscussionRead> =
  mongoose.models.TaskDiscussionRead ||
  mongoose.model<ITaskDiscussionRead>('TaskDiscussionRead', taskDiscussionReadSchema)

