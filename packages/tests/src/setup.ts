import { chai } from 'vitest'
import chaiAsPromised from 'chai-as-promised'
import { isNullable } from 'cosmokit'
import shape from './shape'

chai.use(shape)
chai.use(chaiAsPromised)

function type(obj: any) {
  if (typeof obj === 'undefined') return 'undefined'
  if (obj === null) return 'null'
  const stringTag = obj[Symbol.toStringTag]
  if (typeof stringTag === 'string') return stringTag
  return Object.prototype.toString.call(obj).slice(8, -1)
}

function getEnumerableKeys(target: any) {
  const keys: string[] = []
  for (const key in target) keys.push(key)
  return keys
}

function getEnumerableSymbols(target: any) {
  const keys: symbol[] = []
  for (const key of Object.getOwnPropertySymbols(target)) {
    if (Object.getOwnPropertyDescriptor(target, key)?.enumerable) keys.push(key)
  }
  return keys
}

chai.config.deepEqual = (expected, actual) => {
  return chai.util.eql(expected, actual, {
    comparator: (expected: any, actual: any) => {
      if (isNullable(expected) && isNullable(actual)) return true
      if (type(expected) === 'Object' && type(actual) === 'Object') {
        const keys = new Set<string | symbol>([
          ...getEnumerableKeys(expected),
          ...getEnumerableKeys(actual),
          ...getEnumerableSymbols(expected),
          ...getEnumerableSymbols(actual),
        ])
        return [...keys].every(key => chai.config.deepEqual!(expected[key], actual[key]))
      }
      return null
    },
  })
}
