import { describe, expect, it } from 'vitest'
import { Builder } from '../src/builder'
import type MongoDriver from '../src'

describe('mongo Builder (unit)', () => {
  const builder = new Builder({} as any as MongoDriver, [])

  it('splits `$.query()` hybrid nodes reached through eval (#126)', () => {
    // `$.query(row, { platform, guildId, timestamp })` compiles to this shape
    const result = builder.eval({
      $expr: true,
      platform: 'onebot',
      guildId: 'g1',
      timestamp: {},
    })

    expect(result).to.deep.equal({
      $and: [
        true,
        {
          $and: [
            { $eq: ['$platform', 'onebot'] },
            { $eq: ['$guildId', 'g1'] },
            true,
          ],
        },
      ],
    })
  })

  it('supports $and / $or inside the query fragment', () => {
    const result = builder.eval({
      $expr: true,
      $or: [{ a: 1 }, { b: 2 }],
    })

    expect(result).to.deep.equal({
      $and: [
        true,
        {
          $or: [
            { $eq: ['$a', 1] },
            { $eq: ['$b', 2] },
          ],
        },
      ],
    })
  })

  it('throws on query operators with no expression-context equivalent yet', () => {
    expect(() => builder.eval({
      $expr: true,
      tag: { $regex: 'x' },
    })).to.throw(/not supported/)
  })

  it('leaves plain eval expressions without an $expr marker untouched', () => {
    expect(builder.eval({ $eq: [1, 1] })).to.deep.equal({ $eq: [1, 1] })
  })
})
