import { Database } from '@cordisjs/plugin-database'
import { expect, it, vi } from 'vitest'

function PreparationTests(database: Database) {
  it('prepares an SSO dependency graph and enforces all foreign keys', async () => {
    const driver = database.drivers[0]
    const gate = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const original = driver.prepare.bind(driver)
    const prepare = vi.spyOn(driver, 'prepare').mockImplementation(async (name) => {
      if (name === 'prepare.user') {
        entered.resolve()
        await gate.promise
      }
      return original(name)
    })
    const extend = (name: string, fields = {}, foreign = {}) => database.extend(name as never, {
      id: 'unsigned', ...fields,
    } as any, { foreign })
    try {
      // Reverse registration makes the test independent of plugin registration order.
      extend('prepare.session', { userId: 'unsigned', identityId: 'unsigned' }, {
        userId: ['prepare.user', 'id'], identityId: ['prepare.identity', 'id'],
      })
      extend('prepare.password', { identityId: 'unsigned' }, { identityId: ['prepare.identity', 'id'] })
      extend('prepare.identity', { userId: 'unsigned' }, { userId: ['prepare.user', 'id'] })
      extend('prepare.user')
      const ready = database.prepared()
      try {
        await entered.promise
        expect(prepare.mock.calls.map(([name]) => name)).toEqual(['prepare.user'])
      } finally {
        gate.resolve()
        await ready
      }
      const create = (name: string, row: object) => database.create(name as never, row as never)
      await create('prepare.user', { id: 1 })
      await create('prepare.identity', { id: 1, userId: 1 })
      await create('prepare.session', { id: 1, userId: 1, identityId: 1 })
      await create('prepare.password', { id: 1, identityId: 1 })
      await expect(create('prepare.identity', { id: 2, userId: 999 })).to.be.rejected
      await expect(create('prepare.session', { id: 2, userId: 999, identityId: 1 })).to.be.rejected
      await expect(create('prepare.session', { id: 2, userId: 1, identityId: 999 })).to.be.rejected
      await expect(create('prepare.password', { id: 2, identityId: 999 })).to.be.rejected
    } finally {
      gate.resolve()
      prepare.mockRestore()
    }
  })
}

export default PreparationTests
