import { $, Database, Driver, Primary } from '@cordisjs/plugin-database'
import { Context, Fiber } from 'cordis'
import MongoDriver from '@cordisjs/plugin-database-mongo'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import { ObjectId } from 'mongodb'
import { expect } from '@cordisjs/database-tests'
import { afterAll, beforeAll, describe, it, vi } from 'vitest'

interface Foo {
  id?: number
  text?: string
  value?: number
  bool?: boolean
  list?: number[]
  timestamp?: Date
  date?: Date
  time?: Date
  regex?: string
}

interface Bar {
  id?: Primary
  text?: string
  value?: number
  bool?: boolean
  list?: number[]
  timestamp?: Date
  date?: Date
  time?: Date
  regex?: string
  foreign?: Primary
}

interface Baz {
  id?: number
  text?: string
  value?: number
}

interface Qux {
  id?: Primary
  text?: string
  value?: number
}

interface UuidRow {
  id?: string
  text?: string
}

interface BinaryRow {
  id?: ArrayBuffer
  text?: string
}

interface RawDoc {
  _id: number | ObjectId
  id?: number | ObjectId
  text?: string
  value?: number
}

declare module '@cordisjs/plugin-database' {
  interface Tables {
    mongo1: Foo
    mongo2: Bar
    mongo3: Baz
    mongo4: Qux
    mongo5: UuidRow
    mongo6: BinaryRow
    mongo7: Baz
  }
}

describe('@cordisjs/plugin-database-mongo/migrate-virtualKey', () => {
  const ctx = new Context()

  let database: Database
  let fiber: Fiber | undefined

  const resetConfig = async (optimizeIndex: boolean) => {
    await fiber?.dispose()
    fiber = await ctx.plugin(MongoDriver, {
      host: 'localhost',
      port: 27017,
      database: 'test_migrate',
      optimizeIndex,
    })
    database.refresh()
  }

  beforeAll(async () => {
    await ctx.plugin(Database)
    await ctx.plugin(LoggerConsole)
    fiber = await ctx.plugin(MongoDriver, {
      host: 'localhost',
      port: 27017,
      database: 'test_migrate',
      optimizeIndex: false,
    })
    database = ctx.model as Database
  })

  afterAll(async () => {
    await database.dropAll()
    await fiber?.dispose()
  })

  const getDriver = (table: string) => database['getDriver'](table) as MongoDriver

  const getCollection = (table: string) => getDriver(table).db.collection<RawDoc>(table)

  it('reset optimizeIndex', async () => {
    database.extend('mongo1', {
      id: 'unsigned',
      text: 'string',
      value: 'integer',
      bool: 'boolean',
      list: 'list',
      timestamp: 'timestamp',
      date: 'date',
      time: 'time',
      regex: 'string',
    }, {
      autoInc: true,
      unique: ['id'],
    })

    const table: Foo[] = []
    table.push(await database.create('mongo1', {
      text: 'awesome foo',
      timestamp: new Date('2000-01-01'),
      date: new Date('2020-01-01'),
      time: new Date('2020-01-01 12:00:00'),
    }))
    table.push(await database.create('mongo1', { text: 'awesome bar' }))
    table.push(await database.create('mongo1', { text: 'awesome baz' }))
    await expect(database.get('mongo1', {})).to.eventually.deep.eq(table)

    await resetConfig(true)
    await expect(database.get('mongo1', {})).to.eventually.deep.eq(table)

    await resetConfig(false)
    await expect(database.get('mongo1', {})).to.eventually.deep.eq(table)

    await (Object.values(database.drivers)[0] as Driver).drop('_fields')
    await resetConfig(true)
    await expect(database.get('mongo1', {})).to.eventually.deep.eq(table)

    await (Object.values(database.drivers)[0] as Driver).drop('_fields')
    await resetConfig(false)
    await expect(database.get('mongo1', {})).to.eventually.deep.eq(table)
  })

  it('using primary', async () => {
    database.extend('mongo2', {
      id: 'primary',
      text: 'string',
      value: 'integer',
      bool: 'boolean',
      list: 'list',
      timestamp: 'timestamp',
      date: 'date',
      time: 'time',
      regex: 'string',
      foreign: 'primary',
    })

    await database.remove('mongo2', {})

    const table: Bar[] = []
    table.push(await database.create('mongo2', {
      text: 'awesome foo',
      timestamp: new Date('2000-01-01'),
      date: new Date('2020-01-01'),
      time: new Date('2020-01-01 12:00:00'),
    }))
    table.push(await database.create('mongo2', { text: 'awesome bar' }))
    table.push(await database.create('mongo2', { text: 'awesome baz' }))
    await expect(database.get('mongo2', {})).to.eventually.deep.eq(table)

    await expect(database.get('mongo2', table[0].id?.toString() as any)).to.eventually.deep.eq([table[0]])
    await expect(database.get('mongo2', { id: table[0].id?.toString() as any })).to.eventually.deep.eq([table[0]])
    await expect(database.get('mongo2', row => $.eq(row.id, $.literal(table[0].id?.toString(), 'primary') as any))).to.eventually.deep.eq([table[0]])

    await (Object.values(database.drivers)[0] as Driver).drop('_fields')
    await resetConfig(true)
    await expect(database.get('mongo2', {})).to.eventually.deep.eq(table)

    await (Object.values(database.drivers)[0] as Driver).drop('_fields')
    await resetConfig(false)
    await expect(database.get('mongo2', {})).to.eventually.deep.eq(table)

    // query & eval
    table.push(await database.create('mongo2', { foreign: table[0].id }))
    await expect(database.get('mongo2', {})).to.eventually.deep.eq(table)
    await expect(database.get('mongo2', { foreign: table[0].id })).to.eventually.deep.eq([table[3]])
    await expect(database.get('mongo2', row => $.eq(row.foreign, table[0].id!))).to.eventually.deep.eq([table[3]])
  })

  it('upsert for ensurePrimary path', async () => {
    await resetConfig(true)
    database.extend('mongo3', {
      id: 'unsigned',
      text: 'string',
      value: 'integer',
    }, {
      autoInc: true,
    })

    await database.remove('mongo3', {})

    const existing = await database.create('mongo3', { text: 'before', value: 1 })
    const insertedId = existing.id! + 1
    await expect(database.upsert('mongo3', [
      { id: existing.id, text: 'after', value: 2 },
      { id: insertedId, text: 'inserted', value: 3 },
    ])).to.eventually.have.shape({ inserted: 1, matched: 1 })

    await expect(database.get('mongo3', {})).to.eventually.have.deep.members([
      { id: existing.id, text: 'after', value: 2 },
      { id: insertedId, text: 'inserted', value: 3 },
    ])

    const docs = await getCollection('mongo3')
      .find({}, { projection: { _id: 1, id: 1, text: 1, value: 1 } })
      .sort({ _id: 1 })
      .toArray()

    expect(docs).to.have.length(2)
    expect(docs.every(doc => !('id' in doc))).to.equal(true)
    expect(docs.find(doc => doc._id === existing.id)).to.have.shape({ _id: existing.id, text: 'after', value: 2 })
    expect(docs.find(doc => doc._id === insertedId)).to.have.shape({ _id: insertedId, text: 'inserted', value: 3 })

    await resetConfig(false)
  })

  it('upsert for pipeline path', async () => {
    database.extend('mongo4', {
      id: 'primary',
      text: 'string',
      value: 'integer',
    })

    await database.remove('mongo4', {})

    const existing = await database.create('mongo4', { text: 'before', value: 1 })
    const insertedId = new ObjectId() as unknown as Primary
    await expect(database.upsert('mongo4', [
      { id: existing.id, text: 'after', value: 2 },
      { id: insertedId, text: 'inserted', value: 3 },
    ])).to.eventually.have.shape({ inserted: 1, matched: 1 })

    const [updated] = await database.get('mongo4', { id: existing.id?.toString() as any })
    expect(updated).to.have.shape({ text: 'after', value: 2 })
    expect(updated.id?.toString()).to.equal(existing.id?.toString())

    const [inserted] = await database.get('mongo4', { id: insertedId.toString() as any })
    expect(inserted).to.have.shape({ text: 'inserted', value: 3 })
    expect(inserted.id?.toString()).to.equal(insertedId.toString())

    const docs = await getCollection('mongo4')
      .find({}, { projection: { _id: 1, id: 1, text: 1, value: 1 } })
      .toArray()

    expect(docs).to.have.length(2)
    expect(docs.every(doc => !('id' in doc))).to.equal(true)
    expect(docs.find(doc => doc._id?.toString() === existing.id?.toString())).to.have.shape({ text: 'after', value: 2 })
    expect(docs.find(doc => doc._id?.toString() === insertedId.toString())).to.have.shape({ text: 'inserted', value: 3 })
  })

  for (const type of ['uuid', 'binary'] as const) {
    for (const sourceVirtual of [false, true]) {
      for (const targetVirtual of [false, true]) {
        it(`rebuilds ${type} primary metadata (${sourceVirtual} -> ${targetVirtual})`, async () => {
          const table = type === 'uuid' ? 'mongo5' : 'mongo6'
          await resetConfig(sourceVirtual)
          database.extend(table, { id: type, text: 'string' })
          await database.remove(table, {})
          const ids = type === 'uuid'
            ? ['550e8400-e29b-41d4-a716-446655440000', '00112233-4455-6677-8899-aabbccddeeff']
            : [new Uint8Array([1, 2, 3]).buffer, new Uint8Array([4, 5, 6]).buffer]
          const rows = await Promise.all(ids.map((id, i) => database.create(table, { id, text: `row-${i}` })))

          await getDriver(table).drop('_fields')
          await resetConfig(targetVirtual)

          await expect(database.get(table, {})).to.eventually.have.deep.members(rows)
          const docs = await getCollection(table).find().toArray()
          expect(docs.every(doc => Object.hasOwn(doc, 'id') === !targetVirtual)).to.equal(true)
          expect(await getDriver(table).db.collection<{ _id: string }>('_fields').findOne({ _id: table }))
            .to.include({ virtual: targetVirtual })
        })
      }
    }
  }

  for (const sourceVirtual of [false, true]) {
    for (const [clearMeta, revertConfig] of [[false, false], [true, false], [false, true]]) {
      for (const point of ['before', 'after'] as const) {
        it(`recovers ${point} rename (${sourceVirtual} -> ${!sourceVirtual}, clearMeta=${clearMeta}, revertConfig=${revertConfig})`, async () => {
          const table = 'mongo7'
          await resetConfig(sourceVirtual)
          database.extend(table, { id: 'unsigned', text: 'string' }, { autoInc: true })
          await database.remove(table, {})
          const rows = [
            await database.create(table, { text: 'first' }),
            await database.create(table, { text: 'second' }),
          ]
          const lastId = rows[1].id!
          const driver = getDriver(table)
          if (clearMeta) await driver.drop('_fields')

          const rename = driver.db.renameCollection.bind(driver.db)
          const interruption = new Error(`interrupted ${point} rename`)
          const spy = vi.spyOn(driver.db, 'renameCollection').mockImplementationOnce(async (...args) => {
            if (point === 'after') await rename(...args)
            throw interruption
          })
          driver.config.optimizeIndex = !sourceVirtual
          try {
            await expect(driver.prepare(table)).to.be.rejectedWith(interruption)
          } finally {
            spy.mockRestore()
          }

          const targetVirtual = revertConfig ? sourceVirtual : !sourceVirtual
          await resetConfig(targetVirtual)

          await expect(database.get(table, {})).to.eventually.have.deep.members(rows)
          expect(await getDriver(table).db.listCollections({ name: '_migrate_' + table }).hasNext()).to.equal(false)
          expect(await getDriver(table).db.collection<{ _id: string }>('_fields').findOne({ _id: table }))
            .to.include({ virtual: targetVirtual, migrate: false, autoInc: lastId })
          await resetConfig(targetVirtual)
          await expect(database.get(table, {})).to.eventually.have.deep.members(rows)
          await expect(database.create(table, { text: 'third' })).to.eventually.have.shape({ id: lastId + 1 })
        })
      }
    }
  }
})
