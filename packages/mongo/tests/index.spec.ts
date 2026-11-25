import { Context } from 'cordis'
import Database from '@cordisjs/database'
import MongoDriver from '@cordisjs/database-mongo'
import LoggerConsole from '@cordisjs/logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/database-mongo', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.use(LoggerConsole)
    await ctx.use(Database)
    await ctx.use(MongoDriver, {
      host: 'localhost',
      port: 27017,
      database: 'test',
      optimizeIndex: true,
    })
  })

  afterAll(async () => {
    await ctx.database.dropAll()
    await ctx.database.stopAll()
  })

  test(ctx, {
    preparation: false,
    model: {
      object: {
        aggregateNull: false,
      }
    },
    transaction: {
      abort: !!process.env.TEST_TRANSACTION_ABORT
    }
  })
})
