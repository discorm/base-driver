'use strict'

class RecordNotFound extends Error {
  constructor () {
    super('Record not found')
  }
}

class NotImplemented extends Error {
  constructor (method) {
    super(`${method} not implemented`)
  }
}

class UnsavedModel extends Error {
  constructor (action) {
    super(`Can not ${action} unsaved model`)
  }
}

class BaseModel {
  constructor (data) {
    this.set(data)
  }

  emit () {}

  set (key, value) {
    if (!key) return
    if (typeof key === 'object') {
      for (const pair of Object.entries(key)) {
        this.set(...pair)
      }
      return
    }

    this[key] = value
  }

  toJSON () {
    return { ...this }
  }

  get isNew () {
    return !this.id
  }

  async _fetch () {
    throw new NotImplemented('model._fetch')
  }

  async fetch () {
    // Reject removals of unsaved models
    if (this.isNew) {
      throw new UnsavedModel('fetch')
    }

    await this.emit('beforeFetch')
    this.set(await this._fetch())
    await this.emit('afterFetch')

    return this
  }

  async _save () {
    throw new NotImplemented('model._save')
  }

  async save () {
    // Use update to sync model state of already persisted records
    if (!this.isNew) {
      return this.update()
    }

    // Run validator, if there is one
    await this.emit('validate')

    // Run before create + save hooks
    await this.emit('beforeCreate')
    await this.emit('beforeSave')

    this.set(await this._save())

    // Run after create + save hooks
    await this.emit('afterSave')
    await this.emit('afterCreate')

    return this
  }

  async _update () {
    throw new NotImplemented('model._update')
  }

  async update (data) {
    // Reject updates on unsaved models
    if (this.isNew) {
      throw new UnsavedModel('update')
    }

    // Merge update data into the model, when supplied
    if (data) {
      this.set(data)
    }

    // Run validator, if there is one
    await this.emit('validate')

    // Run before update + save hooks
    await this.emit('beforeUpdate')
    await this.emit('beforeSave')

    // Update and re-fetch
    this.set(await this._update())

    // Run after update + save hooks
    await this.emit('afterSave')
    await this.emit('afterUpdate')

    return this
  }

  async _remove () {
    throw new NotImplemented('model._remove')
  }

  async remove () {
    // Reject removals of unsaved models
    if (this.isNew) {
      throw new UnsavedModel('remove')
    }

    // Run before remove hook
    await this.emit('beforeRemove')

    // Remove the record from mongo
    await this._remove()
    this.set('id', undefined)

    // Run after remove hook
    await this.emit('afterRemove')

    return this
  }

  static build (data) {
    return new this(data)
  }

  static create (data) {
    return this.build(data).save()
  }

  static async findOrCreate (query, data = {}) {
    // If record exists, return it as-is
    const doc = await this.findOne(query)
    if (doc) return doc

    // Otherwise, create a new one
    return this.create(Object.assign({}, data, query))
  }

  static async findOne (query) {
    for await (const model of this.findIterator(query)) {
      return model
    }
  }

  static async findById (id) {
    const doc = await this.findOne({ id })
    if (!doc) throw new RecordNotFound()
    return doc
  }

  static async * findIterator (query) {
    throw new NotImplemented('Model.findIterator')
  }

  static async find (query) {
    const items = []
    for await (const item of this.findIterator(query)) {
      items.push(item)
    }
    return items
  }

  static [Symbol.asyncIterator] () {
    return this.findIterator({})
  }

  static async createOrUpdate (query, data) {
    // If record exists, update it
    const doc = await this.findOne(query)
    if (doc) return doc.update(data)

    // Otherwise, create a new one
    return this.create(Object.assign({}, query, data))
  }

  static async * updateIterator (query, data) {
    for await (const item of this.findIterator(query)) {
      yield await item.update(data)
    }
  }

  static async update (query, data) {
    const items = []
    for await (const item of this.updateIterator(query, data)) {
      items.push(item)
    }
    return items
  }

  static async updateOne (query, data) {
    const doc = await this.findOne(query)
    if (!doc) return
    return doc.update(data)
  }

  static async updateById (id, data) {
    const doc = await this.updateOne({ id }, data)
    if (!doc) throw new RecordNotFound()
    return doc
  }

  static async * removeIterator (query) {
    for await (const item of this.findIterator(query)) {
      yield await item.remove()
    }
  }

  static async remove (query) {
    const items = []
    for await (const item of this.removeIterator(query)) {
      items.push(item)
    }
    return items
  }

  static async removeOne (query) {
    const doc = await this.findOne(query)
    if (!doc) return
    return doc.remove()
  }

  static async removeById (id) {
    const doc = await this.removeOne({ id })
    if (!doc) throw new RecordNotFound()
    return doc
  }

  static async count (query) {
    const it = this.findIterator(query)
    let count = 0
    let next
    while ((next = await it.next()) && !next.done) {
      count++
    }
    return count
  }

  static makeModel (name) {
    class Model extends this {}
    Object.defineProperty(Model, 'tableName', {
      value: name
    })
    return Model
  }
}

module.exports = {
  BaseModel,

  // Errors
  RecordNotFound,
  NotImplemented,
  UnsavedModel
}
