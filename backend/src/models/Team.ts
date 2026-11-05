import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose'

export interface ITeam extends Document {
  name: string
  branch: Types.ObjectId
  lead?: Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Unique compound index on branch + name
teamSchema.index({ branch: 1, name: 1 }, { unique: true })

export const Team: Model<ITeam> =
  mongoose.models.Team || mongoose.model<ITeam>('Team', teamSchema)

