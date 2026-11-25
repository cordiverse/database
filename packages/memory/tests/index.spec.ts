import { Context } from 'cordis'
import Database from '@cordisjs/database'
import MemoryDriver from '@cordisjs/database-memory'
import LoggerConsole from '@cordisjs/logger-console'
import test from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe } from 'vitest'

describe('@cordisjs/database-memory', () => {
  const ctx = new Context()

  beforeAll(async () => {
    await ctx.use(LoggerConsole)
    await ctx.use(Database)
    await ctx.use(MemoryDriver)
  })

  afterAll(async () => {
    await ctx.database.dropAll()
    await ctx.database.stopAll()
  })

  test(ctx, {
    preparation: false,
    migration: false,
    update: {
      index: false,
    },
    json: {
      query: {
        nullableComparator: false,
      },
    },
    model: {
      fields: {
        cast: false,
        typeModel: false,
      },
      object: {
        nullableComparator: false,
        typeModel: false,
      },
    },
    query: {
      comparison: {
        nullableComparator: false,
      },
    },
    relation: {
      select: {
        nullableComparator: false,
      },
      create: {
        nullableComparator: false,
      },
      modify: {
        nullableComparator: false,
      },
    },
  })
})
