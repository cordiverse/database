import { Context } from 'cordis'
import Database from '@cordisjs/plugin-database'
import SQLiteDriver from '@cordisjs/plugin-database-sqlite'
import LoggerConsole from '@cordisjs/plugin-logger-console'
import test from '@cordisjs/database-tests'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
    preparation: false,
    query: {
      list: {
        elementQuery: false,
      },
    },
  })
})

describe('SQLite path', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))

  afterAll(() => {
    for (const name of ['drive-letter.db', 'relative.db']) {
      rmSync(join(testDir, name), { force: true })
    }
  })

  async function createDatabase(path: string) {
    const ctx = new Context()
    ctx.baseUrl = new URL('.', import.meta.url).href
    await ctx.plugin(Database)
    await ctx.plugin(SQLiteDriver, { path })
    return ctx
  }

  // `path` is a filesystem path, but `new URL()` reads a Windows drive letter
  // as a URL scheme (`c:`), which `fileURLToPath` rejects.
  it.runIf(process.platform === 'win32')('accepts a drive-letter path', async () => {
    const path = join(testDir, 'drive-letter.db')
    const ctx = await createDatabase(path)

    expect((ctx.database as any)._driver.path).to.equal(path)
    await ctx.database.stopAll()
  })

  it('resolves a relative path against the context', async () => {
    const ctx = await createDatabase('relative.db')

    expect((ctx.database as any)._driver.path).to.equal(join(testDir, 'relative.db'))
    await ctx.database.stopAll()
  })
})
