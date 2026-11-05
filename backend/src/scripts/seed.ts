import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { Role, type IRolePermission } from '../models/Role.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { passwordService } from '../services/password.service.js'

// Default system role permission specifications
const SYSTEM_ROLES: Array<{
  name: string
  permissions: IRolePermission[]
  isSystem: boolean
}> = [
  {
    name: 'Super Admin',
    isSystem: true,
    permissions: [
      { key: 'task.view', scope: 'all' },
      { key: 'task.create', scope: 'all' },
      { key: 'task.edit', scope: 'all' },
      { key: 'task.status', scope: 'all' },
      { key: 'task.delete', scope: 'all' },
      { key: 'report.view', scope: 'all' },
      { key: 'user.manage', scope: 'all' },
      { key: 'team.manage', scope: 'all' },
      { key: 'branch.manage', scope: 'all' },
      { key: 'role.manage', scope: 'all' },
    ],
  },
  {
    name: 'Branch Admin',
    isSystem: true,
    permissions: [
      { key: 'task.view', scope: 'branch' },
      { key: 'task.create', scope: 'branch' },
      { key: 'task.edit', scope: 'branch' },
      { key: 'task.status', scope: 'branch' },
      { key: 'task.delete', scope: 'branch' },
      { key: 'report.view', scope: 'branch' },
      { key: 'user.manage', scope: 'branch' },
      { key: 'team.manage', scope: 'branch' },
    ],
  },
  {
    name: 'Team Lead',
    isSystem: true,
    permissions: [
      { key: 'task.view', scope: 'team' },
      { key: 'task.create', scope: 'team' },
      { key: 'task.edit', scope: 'team' },
      { key: 'task.status', scope: 'team' },
      { key: 'report.view', scope: 'team' },
    ],
  },
  {
    name: 'Member',
    isSystem: true,
    permissions: [
      { key: 'task.view', scope: 'team' },
      { key: 'task.create', scope: 'own' },
      { key: 'task.edit', scope: 'own' },
      { key: 'task.status', scope: 'own' },
    ],
  },
]

export async function runSeed(): Promise<void> {
  console.log('🌱 Starting database seeding...')

  // 1. Seed Roles (Idempotent: do not overwrite existing role permissions)
  for (const roleDef of SYSTEM_ROLES) {
    const existing = await Role.findOne({ name: roleDef.name })
    if (!existing) {
      await Role.create(roleDef)
      console.log(`  ✓ Created system role: ${roleDef.name}`)
    } else {
      console.log(`  • Role already exists: ${roleDef.name} (preserved)`)
    }
  }

  // 2. Seed Branches (Idempotent)
  const initialBranches = [
    { name: 'Bhopal', city: 'Bhopal' },
    { name: 'Indore', city: 'Indore' },
  ]

  const branchDocs: Record<string, InstanceType<typeof Branch>> = {}

  for (const b of initialBranches) {
    let branchDoc = await Branch.findOne({ name: b.name })
    if (!branchDoc) {
      branchDoc = await Branch.create({ ...b, isActive: true })
      console.log(`  ✓ Created branch: ${b.name}`)
    } else {
      console.log(`  • Branch already exists: ${b.name} (preserved)`)
    }
    branchDocs[b.name] = branchDoc
  }

  // 3. Seed Initial Teams (Idempotent)
  const initialTeams = [
    { name: 'Admissions Desk', branchName: 'Bhopal' },
    { name: 'Visa Processing', branchName: 'Bhopal' },
    { name: 'Counseling', branchName: 'Bhopal' },
    { name: 'Indore Operations', branchName: 'Indore' },
    { name: 'Indore Admissions', branchName: 'Indore' },
  ]

  for (const t of initialTeams) {
    const branchDoc = branchDocs[t.branchName]
    if (branchDoc) {
      const existingTeam = await Team.findOne({
        branch: branchDoc._id,
        name: t.name,
      })
      if (!existingTeam) {
        await Team.create({
          name: t.name,
          branch: branchDoc._id,
          isActive: true,
        })
        console.log(`  ✓ Created team: ${t.name} (${t.branchName})`)
      } else {
        console.log(`  • Team already exists: ${t.name} (${t.branchName})`)
      }
    }
  }

  // 4. Seed / Bootstrap Super Admin (Idempotent)
  const superAdminRole = await Role.findOne({ name: 'Super Admin' })
  if (!superAdminRole) {
    throw new Error('Super Admin role not found during user bootstrap')
  }

  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'zohaib.works022@gmail.com')
    .trim()
    .toLowerCase()
  const initialPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345'

  const existingAdmin = await User.findOne({ email: adminEmail })
  if (!existingAdmin) {
    const passwordHash = await passwordService.hashPassword(initialPassword)
    await User.create({
      name: 'Zohaib Khan',
      email: adminEmail,
      passwordHash,
      role: superAdminRole._id,
      branch: branchDocs['Bhopal']?._id || null,
      mustChangePassword: true, // Forces password update on initial login
      isActive: true,
    })
    console.log(`  ✓ Super Admin created (${adminEmail}) with mustChangePassword = true`)
    console.log('  ⚠️  Note: Super Admin must change password upon first login')
  } else {
    console.log(`  • Super Admin user already exists: ${adminEmail} (password preserved)`)
  }

  console.log('✅ Database seeding completed successfully.')
}

async function main() {
  try {
    await connectDatabase()
    await runSeed()
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

// Run if called directly via CLI
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  void main()
}

