import mongoose, { Schema, type Document, type Model } from 'mongoose'

export type PermissionScope = 'own' | 'team' | 'branch' | 'all'

export interface IRolePermission {
  key: string
  scope: PermissionScope
}

export interface IRole extends Document {
  name: string
  description?: string
  permissions: IRolePermission[]
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['own', 'team', 'branch', 'all'],
      required: true,
      default: 'own',
    },
  },
  { _id: false },
)

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    permissions: {
      type: [rolePermissionSchema],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
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

export const Role: Model<IRole> =
  mongoose.models.Role || mongoose.model<IRole>('Role', roleSchema)
