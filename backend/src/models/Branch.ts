import mongoose, { Schema, type Document, type Model } from 'mongoose'

export interface IBranch extends Document {
  name: string
  city: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const branchSchema = new Schema<IBranch>(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      unique: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
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
        ret.id = ret._id ? (ret._id as mongoose.Types.ObjectId).toString() : ret.id
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

export const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>('Branch', branchSchema)
