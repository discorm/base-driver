# @disco/base-driver

[![CI status](https://github.com/discorm/base-driver/workflows/ci/badge.svg)](https://github.com/discorm/base-driver/actions?query=workflow%3Aci+branch%3Amaster)
[![Coverage Status](https://coveralls.io/repos/discorm/base-driver/badge.png)](https://coveralls.io/r/discorm/base-driver)
[![npm package](https://img.shields.io/npm/v/@disco/base-driver)](https://npmjs.com/package/@disco/base-driver)
[![Dependencies](https://img.shields.io/david/discorm/base-driver)](https://david-dm.org/discorm/base-driver)
[![MIT License](https://img.shields.io/npm/l/@disco/base-driver)](./LICENSE)

This is the base driver for disco which database-specific drivers
should derive from. It provides a large and friendly API surface
over a more limited selection of basics that can be worked with
generically. For better performance, drivers may opt to override
a larger selection of the API to make more efficient queries.

## Usage

```js
const BaseDriver = require('@disco/base-driver')

const data = {}

class MemoryDriver extends BaseDriver {
  static ensureData() {
    data[this.name] = data[this.name] || []
    return data[this.name]
  }

  // Called by model.fetch()
  async _fetch () {
    const data = this.ensureData()
    for (let item of data) {
      if (item.id === this.id) {
        return results[0]
      }
    }

    throw new Error(`Failed to fetch item #${this.id}`)
  }

  // Called by model.save()
  async _save () {
    const data = this.ensureData()
    const { length } = data
    data.push({ id: length + 1, ...this })
    return data[length].id
  }

  // Called by model.update()
  async _update () {
    return Object.assign(this._fetch(), this)
  }

  // Called by model.remove()
  async _remove () {
    const data = this.ensureData()
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === this.id) {
        data.splice(i, 1)
        return
      }
    }

    throw new Error(`Failed to remove item #${this.id}`)
  }

  // Called by all find* operations, both singular and plural
  static async * findIterator (query) {
    for (const item of this.ensureData()) {
      if (objectContains(item, query)) {
        yield this.build(item)
      }
    }
  }
}

```

A driver _must_ implement the `_fetch`, `_save`, `_update` and
`_remove` instance methods along with the `findIterator` static
method. All other model APIs include default implementations but
can be overriden to allow for making more performant queries.

A driver may choose to implement additional helpful methods which
are not specifically required by the disco base driver. A common
example of this would be a `count` method to count records. This
functionality is not strictly necessary for disco so it is not
included in the base or required methods to implement, but it is
often helpful to the user.

The driver functions as a base class for the models generated by
disco and will have `Model.name` and `Model.schema` properties
added to it. These can be used to 

## Model API

### Statics

#### Model.build(data: Object) : Model
Build a model instance.

#### Model.create(data: Object): Promise<Model>
Build a model instance and save it.

#### Model.find(query: Object): Promise<Model>
Find an array of model instances matching a given query object.

#### Model.findOne(query: Object): Promise<Model>
Find one model instance matching a given query object.

#### Model.findById(id: ID): Promise<Model>
Find one model instance by id. The id should be whatever type the driver expects. Some drivers have string ids others have numeric ids.

#### Model.findOrCreate(data: Object): Promise<Model>
Find or create a model instance given a set of data.

#### Model.createOrUpdate(query: Object, changes: Object): Promise<Model>
Create or update a model instance given a query and change set.

#### Model.update(query: Object, changes: Object): Promise<Array<Model>>
Update any records that match the query with the given change set.

#### Model.updateById(id: ID, changes: Object): Promise<Model>
Update a record by id with the given change set.

#### Model.remove(query: Object): Promise<Array<Model>>
Remove any records that match the query. This will return the records with their IDs cleared, allowing them to be saved again to create new records, if necessary.

#### Model.removeById(id: ID): Promise<Model>
Remove a record by id. This will return the record with the id cleared, allowing it to be saved again to create a new record.

### Properties

#### model.isNew
This property is mostly used internally to detect if a model exists in the database already. Currently, it simply checks for existence of a `_id` property.

### Methods

#### model.save(): Promise<Model>
Insert new models or update already persisted models.

#### model.update(changes: Object): Promise<Model>
Apply the input data to the model and save it.

#### model.remove(): Promise<Model>
Remove the model from the database.

#### model.fetch(): Promise<Model>
Fetch the latest model state from the database.

### Hooks

There are several async hook methods that can be overridden to trigger things before or after various interactions. These methods include:

- `beforeSave`
- `beforeCreate`
- `beforeUpdate`
- `beforeRemove`
- `beforeValidate`
- `afterSave`
- `afterCreate`
- `afterUpdate`
- `afterRemove`
- `afterValidate`
