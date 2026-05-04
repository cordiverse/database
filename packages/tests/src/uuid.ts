import { Database } from '@cordisjs/plugin-database'
import { expect } from 'chai'

interface UuidRow {
  id: number
  value?: string
}

declare module '@cordisjs/plugin-database' {
  interface Tables {
    uuids: UuidRow
  }
}

function UuidOperations(database: Database) {
  before(() => {
    database.extend('uuids', {
      id: 'unsigned',
      value: {
        type: 'uuid',
        initial: '00000000-0000-0000-0000-000000000000',
      },
    }, { autoInc: true })
  })

  it('round-trip', async () => {
    await database.remove('uuids', {})
    const a = await database.create('uuids', { id: 1, value: '550e8400-e29b-41d4-a716-446655440000' })
    expect(a.value).to.equal('550e8400-e29b-41d4-a716-446655440000')

    const b = await database.create('uuids', { id: 2 })
    expect(b.value).to.equal('00000000-0000-0000-0000-000000000000')

    const updated = '00112233-4455-6677-8899-aabbccddeeff'
    await database.set('uuids', a.id, { value: updated })
    const fetched = await database.get('uuids', a.id)
    expect(fetched[0].value).to.equal(updated)

    await database.upsert('uuids', [{ id: a.id, value: '550e8400-e29b-41d4-a716-446655440000' }])
    const after = await database.get('uuids', a.id)
    expect(after[0].value).to.equal('550e8400-e29b-41d4-a716-446655440000')
  })
}

export default UuidOperations
