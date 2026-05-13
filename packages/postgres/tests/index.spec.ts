import { Context } from 'cordis'
import Database from '@cordisjs/plugin-database'
import PostgresDriver from '@cordisjs/plugin-database-postgres'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/plugin-database-postgres', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.plugin(LoggerConsole)
    await ctx.plugin(Database)
    await ctx.plugin(PostgresDriver, {
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
