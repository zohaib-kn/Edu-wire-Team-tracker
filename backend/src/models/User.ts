import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'
import type { IRole } from './Role.js'
import type { IBranch } from './Branch.js'
import type { ITeam } from './Team.js'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  phone?: string
  role: Types.ObjectId | IRole
  branch?: Types.ObjectId | IBranch | null
  teams: Types.ObjectId[] | ITeam[]
  mustChangePassword: boolean
  isActive: boolean
  failedLogins: number
  lockedUntil?: Date | null
  pushTokens: string[]
  lastLoginAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never returned in default queries
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role is required'],
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    teams: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    failedLogins: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    pushTokens: {
      type: [String],
      default: [],
    },
    lastLoginAt: {
      type: Date,
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
        delete ret.passwordHash
        return ret
      },
    },
  },
)

// Indexes
userSchema.index({ branch: 1 })
userSchema.index({ teams: 1 })

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema)
