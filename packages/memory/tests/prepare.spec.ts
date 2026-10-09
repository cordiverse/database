import { Context } from 'cordis'
import Database, { Driver } from '@cordisjs/plugin-database'
import MemoryDriver from '@cordisjs/plugin-database-memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('database preparation', () => {
  let ctx: Context
  let driver: Driver
  const extend = (name: string, foreign = {}) => ctx.database.extend(name as never, {
    id: 'unsigned',
    parent: 'unsigned',
  } as any, { foreign })

  beforeEach(async () => {
    ctx = new Context()
    await ctx.plugin(Database)
    await ctx.plugin(MemoryDriver)
    driver = ctx.model.drivers[0]
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await ctx.database.stopAll()
  })

  it('waits for parent indexes with reverse registration and leaves unrelated tables concurrent', async () => {
    const gate = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const independent = Promise.withResolvers<void>()
    const prepare = vi.spyOn(driver, 'prepare').mockImplementation(async (name) => {
      if (name === 'independent') independent.resolve()
    })
    vi.spyOn(driver, 'prepareIndexes').mockImplementation(async (name) => {
      if (name !== 'parent') return
      entered.resolve()
      await gate.promise
    })
    extend('child', { parent: ['parent', 'id'] })
    extend('parent')
    extend('independent')
    const ready = ctx.database.prepared()
    try {
      await Promise.all([entered.promise, independent.promise])
      expect(prepare.mock.calls.map(([name]) => name)).not.toContain('child')
    } finally {
      gate.resolve()
      await ready
    }
    expect(prepare).toHaveBeenCalledWith('child')
  })

  it('allows self references', async () => {
    extend('self', { parent: ['self', 'id'] })
    await ctx.database.prepared()
  })

  it('rejects cycles instead of waiting forever', async () => {
    extend('a', { parent: ['b', 'id'] })
    extend('b', { parent: ['a', 'id'] })
    await expect(ctx.database.prepared()).rejects.toThrow('circular foreign key dependency: a -> b -> a')
  })

  it('leaves externally managed references to the driver', async () => {
    const prepare = vi.spyOn(driver, 'prepare')
    extend('child', { parent: ['external', 'id'] })
    await ctx.database.prepared()
    expect(prepare).toHaveBeenCalledWith('child')
  })

  it('retains failures until explicit refresh and retries dependents', async () => {
    const failure = new Error('parent preparation failed')
    const prepare = vi.spyOn(driver, 'prepare').mockRejectedValueOnce(failure)
    extend('parent')
    extend('child', { parent: ['parent', 'id'] })
    await expect(ctx.database.prepared()).rejects.toBe(failure)
    await expect(ctx.database.prepared()).rejects.toBe(failure)
    expect(prepare).toHaveBeenCalledTimes(1)
    ctx.model.refresh()
    await ctx.database.prepared()
    expect(prepare.mock.calls.map(([name]) => name)).toEqual(['parent', 'parent', 'child'])
  })

  it('coalesces synchronous extensions and serializes subsequent preparation', async () => {
    const gate = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const prepare = vi.spyOn(driver, 'prepare').mockImplementationOnce(async () => {
      entered.resolve()
      await gate.promise
    })
    extend('parent')
    extend('parent')
    const first = ctx.database.prepared()
    await entered.promise
    extend('parent')
    extend('parent')
    expect(prepare).toHaveBeenCalledTimes(1)
    gate.resolve()
    await first
    await ctx.database.prepared()
    expect(prepare).toHaveBeenCalledTimes(2)
  })

  it('does not hide a failure behind a coalesced request', async () => {
    const failure = new Error('preparation failed')
    const prepare = vi.spyOn(driver, 'prepare').mockRejectedValueOnce(failure)
    extend('parent')
    extend('parent')
    await expect(ctx.database.prepared()).rejects.toBe(failure)
    expect(prepare).toHaveBeenCalledTimes(1)
    ctx.model.refresh()
    ctx.model.refresh()
    await ctx.database.prepared()
    expect(prepare).toHaveBeenCalledTimes(2)
  })
})
