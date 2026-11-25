import { Context } from 'cordis'
import Database from '@cordisjs/database'
import PostgresDriver from '@cordisjs/database-postgres'
import LoggerConsole from '@cordisjs/logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/database-postgres', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.use(LoggerConsole)
    await ctx.use(Database)
    await ctx.use(PostgresDriver, {
      host: 'localhost',
      port: 5432,
      user: 'koishi',
      password: 'koishi@114514',
      database: 'test',
    })
  })

  afterAll(async () => {
    await ctx.database.dropAll()
    await ctx.database.stopAll()
  })

  test(ctx, {
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
