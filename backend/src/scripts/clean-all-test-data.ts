import '../models/index.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { Branch } from '../models/Branch.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Task } from '../models/Task.js'
import { Activity } from '../models/Activity.js'
import { Notification } from '../models/Notification.js'
import { TaskMessage } from '../models/TaskMessage.js'
import { TaskDiscussionRead } from '../models/TaskDiscussionRead.js'
import { Session } from '../models/Session.js'

async function runClean() {
  console.log('\n🧹 Cleaning up test data from MongoDB Atlas...\n')

  await connectDatabase()
  console.log('  ✓ Connected to MongoDB\n')

  // 1. Identify Test Branches
  const testBranches = await Branch.find({
    name: { $regex: /^DL Branch|^Test Branch/i },
  }).exec()
  const testBranchIds = testBranches.map((b) => b._id)
  console.log(`Found ${testBranches.length} test branch(es):`)
  testBranches.forEach((b) => console.log(`  - ${b.name} (${b._id})`))

  // 2. Identify Test Teams
  const testTeams = await Team.find({
    $or: [
      { name: { $regex: /^DL Team|^Test Team/i } },
      ...(testBranchIds.length ? [{ branch: { $in: testBranchIds } }] : []),
    ],
  }).exec()
  const testTeamIds = testTeams.map((t) => t._id)
  console.log(`\nFound ${testTeams.length} test team(s):`)
  testTeams.forEach((t) => console.log(`  - ${t.name} (${t._id})`))

  // 3. Identify Test Users
  const testUsers = await User.find({
    $or: [
      { email: { $regex: /^dl_|^test_.*@example\.com|@example\.com$/i } },
      { name: { $regex: /^DL /i } },
    ],
  }).exec()
  const testUserIds = testUsers.map((u) => u._id)
  console.log(`\nFound ${testUsers.length} test user(s):`)
  testUsers.forEach((u) => console.log(`  - ${u.name} <${u.email}> (${u._id})`))

  // 4. Identify Test Tasks
  const testTaskTitlePatterns = [
    /^Legacy Date-Only Task/i,
    /^Complete CRM Dashboard \(Timed\)/i,
    /^Build CRM \(Multi-Assignee\)/i,
    /^testing testing testing/i,
    /^test 23/i,
    /^csadvsfv/i,
    /^testing the double members/i,
    /^555522/i,
    /^my task\s*\d*/i,
    /^task$/i,
  ]

  const initialTestTasks = await Task.find({
    $or: [
      { title: { $in: ['Frontend UI', 'Backend APIs', 'datavdfddddd', 'testing'] } },
      ...testTaskTitlePatterns.map((p) => ({ title: { $regex: p } })),
      ...(testBranchIds.length ? [{ branch: { $in: testBranchIds } }] : []),
      ...(testTeamIds.length ? [{ team: { $in: testTeamIds } }] : []),
      ...(testUserIds.length ? [{ owner: { $in: testUserIds } }] : []),
    ],
  }).exec()

  // Find subtasks of test parents
  const initialTestTaskIds = initialTestTasks.map((t) => t._id)
  const childSubtasks = await Task.find({
    parentTask: { $in: initialTestTaskIds },
  }).exec()

  const allTestTasksMap = new Map<string, any>()
  initialTestTasks.forEach((t) => allTestTasksMap.set(t._id.toString(), t))
  childSubtasks.forEach((t) => allTestTasksMap.set(t._id.toString(), t))
  const allTestTasks = Array.from(allTestTasksMap.values())
  const allTestTaskIds = allTestTasks.map((t) => t._id)

  console.log(`\nFound ${allTestTasks.length} test task(s) to remove:`)
  allTestTasks.forEach((t) => console.log(`  - "${t.title}" (due: ${t.due}, status: ${t.status})`))

  // 5. Delete Activities
  const activityFilter: any = { $or: [] }
  if (allTestTaskIds.length) activityFilter.$or.push({ task: { $in: allTestTaskIds } })
  if (testUserIds.length) activityFilter.$or.push({ user: { $in: testUserIds } })
  let deletedActivities = 0
  if (activityFilter.$or.length) {
    const actRes = await Activity.deleteMany(activityFilter)
    deletedActivities = actRes.deletedCount ?? 0
  }
  console.log(`\nDeleted ${deletedActivities} activity log(s)`)

  // 6. Delete Task Messages & Read states
  const msgFilter: any = { $or: [] }
  if (allTestTaskIds.length) msgFilter.$or.push({ task: { $in: allTestTaskIds } })
  if (testUserIds.length) msgFilter.$or.push({ sender: { $in: testUserIds } })
  let deletedMessages = 0
  if (msgFilter.$or.length) {
    const msgRes = await TaskMessage.deleteMany(msgFilter)
    deletedMessages = msgRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedMessages} task message(s)`)

  const readFilter: any = { $or: [] }
  if (allTestTaskIds.length) readFilter.$or.push({ task: { $in: allTestTaskIds } })
  if (testUserIds.length) readFilter.$or.push({ user: { $in: testUserIds } })
  let deletedReads = 0
  if (readFilter.$or.length) {
    const readRes = await TaskDiscussionRead.deleteMany(readFilter)
    deletedReads = readRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedReads} task discussion read record(s)`)

  // 7. Delete Notifications
  const notifFilter: any = { $or: [] }
  if (testUserIds.length) notifFilter.$or.push({ user: { $in: testUserIds } })
  if (allTestTaskIds.length) notifFilter.$or.push({ task: { $in: allTestTaskIds } })
  notifFilter.$or.push({ recipient: { $regex: /@example\.com$|^dl_/i } })
  let deletedNotifications = 0
  if (notifFilter.$or.length) {
    const notifRes = await Notification.deleteMany(notifFilter)
    deletedNotifications = notifRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedNotifications} notification(s)`)

  // 8. Delete Tasks
  let deletedTasks = 0
  if (allTestTaskIds.length) {
    const taskRes = await Task.deleteMany({ _id: { $in: allTestTaskIds } })
    deletedTasks = taskRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedTasks} task(s)`)

  // 9. Delete Users & Sessions
  let deletedUsers = 0
  if (testUserIds.length) {
    await Session.deleteMany({ user: { $in: testUserIds } })
    const userRes = await User.deleteMany({ _id: { $in: testUserIds } })
    deletedUsers = userRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedUsers} test user(s) and their sessions`)

  // 10. Delete Teams
  let deletedTeams = 0
  if (testTeamIds.length) {
    const teamRes = await Team.deleteMany({ _id: { $in: testTeamIds } })
    deletedTeams = teamRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedTeams} test team(s)`)

  // 11. Delete Branches
  let deletedBranches = 0
  if (testBranchIds.length) {
    const branchRes = await Branch.deleteMany({ _id: { $in: testBranchIds } })
    deletedBranches = branchRes.deletedCount ?? 0
  }
  console.log(`Deleted ${deletedBranches} test branch(es)`)

  // 12. Show remaining legitimate data
  const remainingBranches = await Branch.find().exec()
  const remainingTeams = await Team.find().exec()
  const remainingUsers = await User.find().exec()
  const remainingTasks = await Task.find().exec()

  console.log('\n==============================================')
  console.log('✨ CLEANUP FINISHED - CURRENT DATABASE STATE ✨')
  console.log('==============================================')
  console.log(`Remaining Branches (${remainingBranches.length}):`, remainingBranches.map((b) => b.name).join(', '))
  console.log(`Remaining Teams (${remainingTeams.length}):`, remainingTeams.map((t) => t.name).join(', '))
  console.log(`Remaining Users (${remainingUsers.length}):`, remainingUsers.map((u) => `${u.name} <${u.email}>`).join(', '))
  console.log(`\nRemaining Real Tasks (${remainingTasks.length}):`)
  remainingTasks.forEach((t) => console.log(`  ✓ "${t.title}" [status: ${t.status}, due: ${t.due}]`))
  console.log('==============================================\n')

  await disconnectDatabase()
  process.exit(0)
}

runClean().catch((err) => {
  console.error('Cleanup error:', err)
  process.exit(1)
})

