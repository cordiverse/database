import { Context } from 'cordis'
import Fs from '@cordisjs/fs'
import Database from '@cordisjs/database'
import SQLiteDriver from '@cordisjs/database-sqlite'
import LoggerConsole from '@cordisjs/logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/database-sqlite', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.use(LoggerConsole)
    await ctx.use(Fs)
    await ctx.use(Database)
    await ctx.use(SQLiteDriver, {
      path: new URL('test.db', import.meta.url).href,
    })
  })

  afterAll(async () => {
    await ctx.database.dropAll()
    await ctx.database.stopAll()
  })

  test(ctx, {
    preparation: false,
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})
