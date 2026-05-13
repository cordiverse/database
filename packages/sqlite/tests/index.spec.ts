import { Context } from 'cordis'
import Database from '@cordisjs/plugin-database'
import SQLiteDriver from '@cordisjs/plugin-database-sqlite'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/plugin-database-sqlite', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.plugin(LoggerConsole)
    await ctx.plugin(Database)
    await ctx.plugin(SQLiteDriver, {
      path: new URL('test.db', import.meta.url).href,
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
