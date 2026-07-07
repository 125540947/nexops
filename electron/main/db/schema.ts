import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  color: text('color'),
  icon: text('icon'),
  createdAt: integer('created_at').notNull()
})

export const hosts = sqliteTable('hosts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(22),
  username: text('username').notNull(),
  authType: text('auth_type').notNull().default('password'),
  password: text('password'),
  keyPath: text('key_path'),
  passphrase: text('passphrase'),
  groupId: integer('group_id'),
  notes: text('notes'),
  tags: text('tags'),
  jumpHostId: integer('jump_host_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const sessionLogs = sqliteTable('session_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  hostId: integer('host_id').notNull(),
  sessionType: text('session_type').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  recording: text('recording')
})

export const snippets = sqliteTable('snippets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  command: text('command').notNull(),
  description: text('description'),
  tags: text('tags'),
  createdAt: integer('created_at').notNull()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const dbConnections = sqliteTable('db_connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  username: text('username'),
  password: text('password'),
  database: text('database'),
  sshHostId: integer('ssh_host_id'),
  createdAt: integer('created_at').notNull()
})
