'use strict'

const isSubset = require('is-subset')
const tap = require('tap')

const { BaseModel } = require('./')

class Model extends BaseModel {
  static reset (data = []) {
    Model.data = data
    Model.hooks = []
  }

  emit (event) {
    Model.hooks.push(event)
  }

  _fetch () {
    return Model.data.filter(v => v.id === this.id)[0]
  }

  _save () {
    const { length } = Model.data
    const data = { id: length + 1, ...this }
    Model.data.push(data)
    return data
  }

  _update () {
    const record = Model.data.filter(model => model.id === this.id)
    Object.assign(record[0], this)
    return this._fetch()
  }

  _remove () {
    Model.data = Model.data.filter(model => model.id !== this.id)
  }

  static async * findIterator (query) {
    const items = query
      ? Model.data.filter(v => isSubset(v, query))
      : Model.data

    for (const item of items) {
      yield this.build(item)
    }
  }
}

tap.test('makeModel', async t => {
  const SubModel = Model.makeModel('test')
  t.ok((new SubModel()) instanceof Model)
  t.ok(SubModel.name, 'test')
})

tap.test('build', async t => {
  Model.reset()
  const model = await Model.build({ test: 'build' })
  t.ok(model.isNew)
  t.notOk(model.id)
  t.deepEqual(Model.data, [])
  t.deepEqual(Model.hooks, [])
})

tap.test('create', async t => {
  Model.reset()
  const model = await Model.create({ test: 'create' })
  t.notOk(model.isNew)
  t.equal(model.id, 1)
  t.deepEqual(Model.data, [
    { id: 1, test: 'create' }
  ])
  t.deepEqual(Model.hooks, [
    'validate',
    'beforeCreate',
    'beforeSave',
    'afterSave',
    'afterCreate'
  ])
})

tap.test('findOrCreate', async t => {
  t.comment('when absent')
  {
    Model.reset()
    const model = await Model.findOrCreate({
      test: 'findOrCreate when absent'
    })
    t.notOk(model.isNew)
    t.equal(model.id, 1)
    t.deepEqual(Model.data, [
      { id: 1, test: 'findOrCreate when absent' }
    ])
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeCreate',
      'beforeSave',
      'afterSave',
      'afterCreate'
    ])
  }

  t.comment('when absent with data')
  {
    Model.reset()
    const model = await Model.findOrCreate({
      test: 'findOrCreate when absent with data'
    }, {
      foo: 'bar'
    })
    t.notOk(model.isNew)
    t.equal(model.id, 1)
    t.deepEqual(Model.data, [
      { id: 1, test: 'findOrCreate when absent with data', foo: 'bar' }
    ])
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeCreate',
      'beforeSave',
      'afterSave',
      'afterCreate'
    ])
  }

  t.comment('when present')
  {
    Model.reset([
      { id: 1, test: 'findOrCreate when present', foo: 'bar' }
    ])
    const model = await Model.findOrCreate({
      test: 'findOrCreate when present'
    }, {
      baz: 'buz'
    })
    t.notOk(model.isNew)
    t.equal(model.id, 1)
    t.deepEqual(Model.data, [
      { id: 1, test: 'findOrCreate when present', foo: 'bar' }
    ])
    t.deepEqual(Model.hooks, [])
  }
})

tap.test('findById', async t => {
  Model.reset([
    { id: 1, test: 'findById' }
  ])

  await t.rejects(Model.findById(2), /Record not found/)

  const model = await Model.findById(1)
  t.notOk(model.isNew)
  t.equal(model.id, 1)

  t.deepEqual(Model.data, [
    { id: 1, test: 'findById' }
  ])
  t.deepEqual(Model.hooks, [])
})

tap.test('findOne', async t => {
  Model.reset([
    { id: 1, test: 'findOne' }
  ])
  const model = await Model.findOne({ test: 'findOne' })
  t.notOk(model.isNew)
  t.equal(model.id, 1)
  t.deepEqual(Model.data, [
    { id: 1, test: 'findOne' }
  ])
  t.deepEqual(Model.hooks, [])
})

tap.test('findIterator', async t => {
  Model.reset([
    { id: 1, test: 'findIterator' },
    { id: 2, test: 'findIterator' }
  ])

  let id = 0
  for await (const model of Model.findIterator({ test: 'findIterator' })) {
    t.deepEqual(model, {
      test: 'findIterator',
      id: ++id
    })
  }

  const it = Model.findIterator({ test: 'doesNotExist' })
  t.ok((await it.next()).done, 'should not find non-matching models')

  t.deepEqual(Model.data, [
    { id: 1, test: 'findIterator' },
    { id: 2, test: 'findIterator' }
  ])
  t.deepEqual(Model.hooks, [])
})

tap.test('find', async t => {
  Model.reset([
    { id: 1, test: 'find' },
    { id: 2, test: 'find' }
  ])

  const models = await Model.find({ test: 'find' })

  let id = 0
  for (const model of models) {
    t.deepEqual(model, {
      test: 'find',
      id: ++id
    })
  }

  const empty = await Model.find({ test: 'doesNotExist' })
  t.notOk(empty.length, 'should not find non-matching models')

  t.deepEqual(Model.data, [
    { id: 1, test: 'find' },
    { id: 2, test: 'find' }
  ])
  t.deepEqual(Model.hooks, [])
})

tap.test('Symbol.asyncIterator', async t => {
  Model.reset([
    { id: 1, test: 'Symbol.asyncIterator' },
    { id: 2, test: 'Symbol.asyncIterator' }
  ])

  let id = 0
  for await (const model of Model) {
    t.deepEqual(model, {
      test: 'Symbol.asyncIterator',
      id: ++id
    })
  }

  t.deepEqual(Model.data, [
    { id: 1, test: 'Symbol.asyncIterator' },
    { id: 2, test: 'Symbol.asyncIterator' }
  ])
  t.deepEqual(Model.hooks, [])
})

tap.test('createOrUpdate', async t => {
  t.comment('when absent')
  {
    Model.reset()
    const model = await Model.createOrUpdate({ test: 'createOrUpdate when absent' }, { foo: 'bar' })
    t.equal(model.id, 1)
    t.deepEqual(Model.data, [
      { id: 1, test: 'createOrUpdate when absent', foo: 'bar' }
    ])
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeCreate',
      'beforeSave',
      'afterSave',
      'afterCreate'
    ])
  }

  t.comment('when present')
  {
    Model.reset([
      { id: 1, test: 'createOrUpdate when present' }
    ])
    const model = await Model.createOrUpdate({ test: 'createOrUpdate when present' }, { foo: 'bar' })
    t.equal(model.id, 1)
    t.deepEqual(Model.data, [
      { id: 1, test: 'createOrUpdate when present', foo: 'bar' }
    ])
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeUpdate',
      'beforeSave',
      'afterSave',
      'afterUpdate'
    ])
  }
})

tap.test('updateIterator', async t => {
  Model.reset([
    { id: 1, test: 'updateIterator' },
    { id: 2, test: 'updateIterator' }
  ])

  let id = 0
  for await (const model of Model.updateIterator({ test: 'updateIterator' }, { foo: 'bar' })) {
    t.deepEqual(model, {
      test: 'updateIterator',
      foo: 'bar',
      id: ++id
    })
  }

  const it = Model.updateIterator({ test: 'doesNotExist' }, { baz: 'buz' })
  t.ok((await it.next()).done, 'should not update non-matching models')

  t.deepEqual(Model.data, [
    { id: 1, test: 'updateIterator', foo: 'bar' },
    { id: 2, test: 'updateIterator', foo: 'bar' }
  ])
  t.deepEqual(Model.hooks, [
    'validate',
    'beforeUpdate',
    'beforeSave',
    'afterSave',
    'afterUpdate',
    'validate',
    'beforeUpdate',
    'beforeSave',
    'afterSave',
    'afterUpdate'
  ])
})

tap.test('update', async t => {
  Model.reset([
    { id: 1, test: 'update' },
    { id: 2, test: 'update' }
  ])

  const models = await Model.update({ test: 'update' }, { foo: 'bar' })

  let id = 0
  for (const model of models) {
    t.deepEqual(model, {
      test: 'update',
      foo: 'bar',
      id: ++id
    })
  }

  const empty = await Model.update({ test: 'doesNotExist' }, { baz: 'buz' })
  t.notOk(empty.length, 'should not update non-matching models')

  t.deepEqual(Model.data, [
    { id: 1, test: 'update', foo: 'bar' },
    { id: 2, test: 'update', foo: 'bar' }
  ])
  t.deepEqual(Model.hooks, [
    'validate',
    'beforeUpdate',
    'beforeSave',
    'afterSave',
    'afterUpdate',
    'validate',
    'beforeUpdate',
    'beforeSave',
    'afterSave',
    'afterUpdate'
  ])
})

tap.test('updateById', async t => {
  Model.reset([
    { id: 1, test: 'updateById' },
    { id: 2, test: 'updateById' },
    { id: 3, test: 'updateById' }
  ])

  await t.rejects(Model.updateById(4, { baz: 'buz' }), /Record not found/)
  t.deepEqual(Model.hooks, [])
  Model.reset(Model.data)

  const model = await Model.updateById(2, { foo: 'bar' })
  t.deepEqual(model, {
    test: 'updateById',
    foo: 'bar',
    id: 2
  })

  t.deepEqual(Model.data, [
    { id: 1, test: 'updateById' },
    { id: 2, test: 'updateById', foo: 'bar' },
    { id: 3, test: 'updateById' }
  ])
  t.deepEqual(Model.hooks, [
    'validate',
    'beforeUpdate',
    'beforeSave',
    'afterSave',
    'afterUpdate'
  ])
})

tap.test('removeIterator', async t => {
  Model.reset([
    { id: 1, test: 'removeIterator' },
    { id: 2, test: 'removeIterator' }
  ])

  const it = Model.removeIterator({ test: 'doesNotExist' })
  t.ok((await it.next()).done, 'should not remove non-matching models')

  for await (const model of Model.removeIterator({ test: 'removeIterator' })) {
    t.ok(model.isNew)
    t.deepEqual(model, {
      test: 'removeIterator',
      id: undefined
    })
  }

  t.deepEqual(Model.data, [])
  t.deepEqual(Model.hooks, [
    'beforeRemove',
    'afterRemove',
    'beforeRemove',
    'afterRemove'
  ])
})

tap.test('remove', async t => {
  Model.reset([
    { id: 1, test: 'remove' },
    { id: 2, test: 'remove' }
  ])

  const empty = await Model.remove({ test: 'doesNotExist' })
  t.notOk(empty.length, 'should not remove non-matching models')

  const models = await Model.remove({ test: 'remove' })
  for (const model of models) {
    t.ok(model.isNew)
    t.deepEqual(model, {
      test: 'remove',
      id: undefined
    })
  }

  t.deepEqual(Model.data, [])
  t.deepEqual(Model.hooks, [
    'beforeRemove',
    'afterRemove',
    'beforeRemove',
    'afterRemove'
  ])
})

tap.test('removeById', async t => {
  Model.reset([
    { id: 1, test: 'removeById' },
    { id: 2, test: 'removeById' },
    { id: 3, test: 'removeById' }
  ])

  await t.rejects(Model.removeById(4), /Record not found/)
  t.deepEqual(Model.hooks, [])
  Model.reset(Model.data)

  const model = await Model.removeById(2)
  t.ok(model.isNew)

  t.deepEqual(Model.data, [
    { id: 1, test: 'removeById' },
    { id: 3, test: 'removeById' }
  ])
  t.deepEqual(Model.hooks, [
    'beforeRemove',
    'afterRemove'
  ])
})

tap.test('count', async t => {
  Model.reset([
    { id: 1, test: 'count' }
  ])

  t.equal(await Model.count(), 1)
})

tap.test('methods', t => {
  Model.reset()
  const model = new Model({ name: 'a' })

  t.test('isNew', t => {
    t.ok(model.isNew)
    t.end()
  })

  t.test('toJSON', t => {
    t.deepEqual(model.toJSON(), {
      name: 'a'
    })
    t.end()
  })

  t.test('save unsaved model', async t => {
    Model.reset()

    await model.save()
    t.notOk(model.isNew)
    t.deepEqual(model, { name: 'a', id: 1 }, 'does not modify model')
    t.deepEqual(Model.data, [
      { id: 1, name: 'a' }
    ], 'persists')
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeCreate',
      'beforeSave',
      'afterSave',
      'afterCreate'
    ])
    t.end()
  })

  t.test('save already saved model', async t => {
    Model.hooks = []

    model.name = 'b'
    await model.save()
    t.deepEqual(model, { name: 'b', id: 1 }, 'does not modify model')
    t.deepEqual(Model.data, [
      { id: 1, name: 'b' }
    ], 'persists')
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeUpdate',
      'beforeSave',
      'afterSave',
      'afterUpdate'
    ])
  })

  t.test('set', t => {
    Model.hooks = []

    model.set({ name: 'c' })
    t.deepEqual(model, { name: 'c', id: 1 }, 'modifies model')
    t.deepEqual(Model.data, [
      { id: 1, name: 'b' }
    ], 'does not persist')
    t.deepEqual(Model.hooks, [])
    t.end()
  })

  t.test('fetch without id', async t => {
    Model.hooks = []

    const empty = new Model({})
    await t.rejects(empty.fetch(), /Can not fetch unsaved model/)
    t.deepEqual(empty, {}, 'does not modify model')
    t.deepEqual(Model.hooks, [])
    t.end()
  })

  t.test('fetch with id', async t => {
    Model.hooks = []

    await model.fetch()
    t.deepEqual(model, { name: 'b', id: 1 }, 'modifies model')
    t.deepEqual(Model.data, [
      { id: 1, name: 'b' }
    ], 'persists')
    t.deepEqual(Model.hooks, [
      'beforeFetch',
      'afterFetch'
    ], 'has before and after fetch hooks on success')
  })

  t.test('update unsaved model', async t => {
    Model.hooks = []

    const empty = new Model({})
    await t.rejects(empty.update(), /Can not update unsaved model/)
    t.ok(empty.isNew)
    t.notOk(empty.id)
    t.deepEqual(empty, {}, 'does not modify model')
    t.deepEqual(Model.hooks, [])
  })

  t.test('update already saved model', async t => {
    Model.hooks = []

    await model.update({ name: 'd' })
    t.deepEqual(model, { name: 'd', id: 1 }, 'modifies model')
    t.deepEqual(Model.data, [
      { id: 1, name: 'd' }
    ], 'persists')
    t.deepEqual(Model.hooks, [
      'validate',
      'beforeUpdate',
      'beforeSave',
      'afterSave',
      'afterUpdate'
    ])
  })

  t.test('remove unsaved model', async t => {
    Model.hooks = []

    const empty = new Model({})
    await t.rejects(empty.remove(), /Can not remove unsaved model/)
    t.deepEqual(Model.hooks, [])
  })

  t.test('remove already saved model', async t => {
    Model.hooks = []

    await model.remove()
    t.deepEqual(model, { name: 'd', id: undefined }, 'removes id')
    t.deepEqual(Model.data, [], 'persists')
    t.deepEqual(Model.hooks, [
      'beforeRemove',
      'afterRemove'
    ])
  })

  t.end()
})

tap.test('placeholders', t => {
  class Model extends BaseModel {
    emit () {}
  }
  const model = Model.build({})
  const it = Model.findIterator({})
  t.rejects(it.next(), /Model.findIterator not implemented/)
  t.rejects(model.save(), /model._save not implemented/)
  model.id = 1
  t.rejects(model.fetch(), /model._fetch not implemented/)
  t.rejects(model.update(), /model._update not implemented/)
  t.rejects(model.remove(), /model._remove not implemented/)
  t.end()
})
