import { Database, Driver } from '@cordisjs/plugin-database'
import { Context, Fiber } from 'cordis'
import MongoDriver from '@cordisjs/plugin-database-mongo'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import { expect } from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe, it } from 'vitest'

interface Legacy {
  id?: number
  text?: string
}

declare module '@cordisjs/plugin-database' {
  interface Tables {
    mongo_legacy: Legacy
  }
}

describe('@cordisjs/plugin-database-mongo/meta-migration', () => {
  const ctx = new Context()

  let database: Database
  let fiber: Fiber | undefined

  const reset = async () => {
    await fiber?.dispose()
    fiber = await ctx.plugin(MongoDriver, {
      host: 'localhost',
      port: 27017,
      database: 'test_meta_migration',
    })
    database.refresh()
    await database.prepared()
  }

  const getMeta = async () => {
    const driver = database['getDriver']('mongo_legacy') as MongoDriver
    return driver.db.collection('_fields').findOne({ _id: 'mongo_legacy' })
  }

  const getRawCollection = () => {
    const driver = database['getDriver']('mongo_legacy') as MongoDriver
    return driver.db.collection('mongo_legacy')
  }

  beforeAll(async () => {
    await ctx.plugin(Database)
    await ctx.plugin(LoggerConsole)
    fiber = await ctx.plugin(MongoDriver, {
      host: 'localhost',
      port: 27017,
      database: 'test_meta_migration',
    })
    database = ctx.model as Database
  })

  afterAll(async () => {
    await database.dropAll()
    await fiber?.dispose()
  })

  it('should inherit virtual/autoInc from legacy-format _fields entries', async () => {
    database.extend('mongo_legacy', {
      id: 'unsigned',
      text: 'string',
    }, {
      autoInc: true,
    })

    await database.remove('mongo_legacy', {})
    const created = []
    for (let i = 0; i < 3; i++) {
      created.push(await database.create('mongo_legacy', { text: `row ${i}` }))
    }
    // remove the row with the highest id: if the stored `autoInc` is lost,
    // `_migratePrimary` will recalculate it as `max(remaining ids)` and the
    // next insert will silently reuse the id of the deleted row
    await database.remove('mongo_legacy', { id: created[2].id })

    // simulate the legacy (< 3.7.0) `_fields` state: per-table entries keyed by
    // `{ table, field }` with an ObjectId `_id`, carrying `virtual` and `autoInc`
    const driver = database['getDriver']('mongo_legacy') as MongoDriver
    const metaTable = driver.db.collection('_fields')
    const { ObjectId } = await import('mongodb')
    const current = await metaTable.findOne({ _id: 'mongo_legacy' })
    await metaTable.deleteOne({ _id: 'mongo_legacy' })
    await metaTable.insertOne({
      _id: new ObjectId(),
      table: 'mongo_legacy',
      field: 'id',
      virtual: false,
      autoInc: current.autoInc,
    })

    // restart the driver: `_createFields` should initialize the new-format entry
    // and inherit `virtual` / `autoInc` from the legacy entry instead of losing them
    await reset()

    const meta = await getMeta()
    expect(meta.virtual).to.equal(false)
    expect(meta.autoInc).to.equal(current.autoInc)

    // data must survive untouched (no destructive re-migration, ids still resolvable)
    await expect(database.get('mongo_legacy', {})).to.eventually.have.deep.members(created.slice(0, 2))
    // the next insert must NOT reuse the id of the deleted row
    const next = await database.create('mongo_legacy', { text: 'row 3' })
    expect(next.id).to.equal(current.autoInc + 1)
  })

  it('should not lose autoInc when _fields is dropped entirely', async () => {
    // dropping `_fields` simulates a cold re-detect: virtual/autoInc are inferred
    // from the data itself, which is the pre-existing behavior — this test guards
    // that the inheritance path above does not interfere with it
    const driver = database['getDriver']('mongo_legacy') as unknown as Driver
    await driver.drop('_fields')
    await reset()

    const rows = await database.get('mongo_legacy', {})
    expect(rows.length).to.equal(3)
    const next = await database.create('mongo_legacy', { text: 'row 4' })
    expect(rows.every(row => row.id !== next.id)).to.equal(true)
  })
})
