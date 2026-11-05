import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'

export interface ISession extends Document {
  user: Types.ObjectId
  refreshTokenHash: string
  device?: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const sessionSchema = new Schema<ISession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    device: {
      type: String,
      default: 'Unknown device / browser',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id ? (ret._id as Types.ObjectId).toString() : ret.id
        delete ret._id
        delete ret.__v
        delete ret.refreshTokenHash // Never leak refresh token hash
        return ret
      },
    },
  },
)

// TTL Index: documents automatically removed once expiresAt is reached
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', sessionSchema)

