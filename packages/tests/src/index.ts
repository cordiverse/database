export * from './shape.ts'

import { Database } from '@cordisjs/plugin-database'
import { beforeAll, describe } from 'vitest'
import Preparation from './preparation.ts'
import ModelOperations from './model.ts'
import QueryOperators from './query.ts'
import UpdateOperators from './update.ts'
import ObjectOperations from './object.ts'
import Migration from './migration.ts'
import Selection from './selection.ts'
import Json from './json.ts'
import Transaction from './transaction.ts'
import Relation from './relation.ts'
import Performance from './performance.ts'
import Uuid from './uuid.ts'
import './setup'

export { expect } from 'vitest'

const Keywords = ['name']
type Keywords = 'name'

type UnitOptions<T> = (T extends (database: Database, options?: infer R) => any ? R : {}) & {
  [K in keyof T as Exclude<K, Keywords>]?: boolean | UnitOptions<T[K]>
}

type DatabaseLike = Database | (() => Database) | { model: Database }

type Unit<T> = ((source: DatabaseLike, options?: UnitOptions<T>, overrideOptions?: UnitOptions<T>) => void) & {
  [K in keyof T as Exclude<K, Keywords>]: Unit<T[K]>
}

function resolveGetDb(source: DatabaseLike): () => Database {
  if (typeof source === 'function') return source
  if (source instanceof Database) return () => source
  return () => source.model
}

function createLazyDatabase(getDb: () => Database): Database {
  return new Proxy(Object.create(null), {
    get(_, prop) {
      const db = getDb()
      const value = (db as any)[prop]
      return typeof value === 'function' ? value.bind(db) : value
    },
  })
}

function createUnit<T>(target: T, root = false): Unit<T> {
  const test: any = (source: DatabaseLike, options: any = {}, overrideOptions?: any) => {
    const getDb = resolveGetDb(source)

    function callback() {
      if (typeof target === 'function') {
        target(createLazyDatabase(getDb), options)
      }

      for (const key in target) {
        if (overrideOptions && !overrideOptions[key]) continue
        if (options[key] === false || Keywords.includes(key)) continue
        test[key](getDb, options[key], overrideOptions?.[key] === true ? undefined : overrideOptions?.[key])
      }
    }

    const title = target['name']
    if (!root && title) {
      describe(title.replace(/(?=[A-Z])/g, ' ').trimStart(), callback)
    } else {
      callback()
    }
  }

  for (const key in target) {
    if (Keywords.includes(key)) continue
    test[key] = createUnit(target[key])
  }

  return test
}

namespace Tests {
  export const preparation = Preparation
  export const model = ModelOperations
  export const query = QueryOperators
  export const update = UpdateOperators
  export const object = ObjectOperations
  export const selection = Selection
  export const migration = Migration
  export const json = Json
  export const transaction = Transaction
  export const relation = Relation
  export const performance = Performance
  export const uuid = Uuid
}

export default createUnit(Tests, true)
