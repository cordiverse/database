import { $, Database } from '@cordisjs/plugin-database'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

interface UuidRow {
  id: number
  value?: string
}

interface UuidParent {
  id: string
  name?: string
  children?: UuidChild[]
}

interface UuidChild {
  id: string
  label?: string
  parent?: UuidParent
}

declare module '@cordisjs/plugin-database' {
  interface Tables {
    uuids: UuidRow
    uuidParents: UuidParent
    uuidChildren: UuidChild
  }
}

const u1 = '550e8400-e29b-41d4-a716-446655440000'
const u2 = '00112233-4455-6677-8899-aabbccddeeff'
const u3 = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb'

function UuidOperations(database: Database) {
  beforeAll(() => {
    database.extend('uuids', {
      id: 'unsigned',
      value: {
        type: 'uuid',
        initial: '00000000-0000-0000-0000-000000000000',
      },
    }, { autoInc: true })

    database.extend('uuidParents', {
      id: 'uuid',
      name: 'string',
    }, { primary: 'id' })

    database.extend('uuidChildren', {
      id: 'uuid',
      label: 'string',
      parent: {
        type: 'manyToOne',
        table: 'uuidParents',
        target: 'children',
      },
    }, { primary: 'id' })
  })

  it('round-trip', async () => {
    await database.remove('uuids', {})
    const a = await database.create('uuids', { id: 1, value: u1 })
    expect(a.value).to.equal(u1)

    const b = await database.create('uuids', { id: 2 })
    expect(b.value).to.equal('00000000-0000-0000-0000-000000000000')

    await database.set('uuids', a.id, { value: u2 })
    const fetched = await database.get('uuids', a.id)
    expect(fetched[0].value).to.equal(u2)

    await database.upsert('uuids', [{ id: a.id, value: u1 }])
    const after = await database.get('uuids', a.id)
    expect(after[0].value).to.equal(u1)
  })

  it('uuid primary key', async () => {
    await database.remove('uuidParents', {})
    await database.create('uuidParents', { id: u1, name: 'parent-1' })
    await database.create('uuidParents', { id: u2, name: 'parent-2' })

    const all = await database.get('uuidParents', {})
    expect(all.map(x => x.id)).to.have.members([u1, u2])

    const byId = await database.get('uuidParents', { id: u1 })
    expect(byId).to.have.length(1)
    expect(byId[0]).to.deep.include({ id: u1, name: 'parent-1' })

    const byEval = await database.get('uuidParents', r => $.eq(r.id, $.literal(u1, 'uuid')))
    expect(byEval).to.have.length(1)
    expect(byEval[0]).to.deep.include({ id: u1, name: 'parent-1' })

    const byIn = await database.get('uuidParents', { id: { $in: [u1, u3] } })
    expect(byIn.map(x => x.id)).to.have.members([u1])
  })

  it('uuid foreign key join (manyToOne)', async () => {
    await database.remove('uuidChildren', {})
    await database.remove('uuidParents', {})
    await database.create('uuidParents', { id: u1, name: 'parent-1' })
    await database.create('uuidParents', { id: u2, name: 'parent-2' })
    await database.create('uuidChildren', { id: u3, label: 'c1', parent: { $literal: { id: u1 } } })
    await database.create('uuidChildren', { id: '11111111-2222-3333-4444-555555555555', label: 'c2', parent: { $literal: { id: u1 } } })
    await database.create('uuidChildren', { id: '22222222-3333-4444-5555-666666666666', label: 'c3', parent: { $literal: { id: u2 } } })

    const joined = await database.get('uuidChildren', {}, { include: { parent: true } })
    expect(joined).to.have.length(3)
    const c1 = joined.find(x => x.label === 'c1')!
    expect(c1.parent?.id).to.equal(u1)
    expect(c1.parent?.name).to.equal('parent-1')

    const parentsWithChildren = await database.get('uuidParents', {}, { include: { children: true } })
    const p1 = parentsWithChildren.find(x => x.id === u1)!
    expect(p1.children).to.have.length(2)
    expect(p1.children!.map(x => x.label)).to.have.members(['c1', 'c2'])
  })

  it('query by uuid foreign key', async () => {
    const rows = await database.get('uuidChildren', { parent: { id: u1 } })
    expect(rows).to.have.length(2)
    expect(rows.every(x => x.label === 'c1' || x.label === 'c2')).to.be.true
  })
}

export default UuidOperations
