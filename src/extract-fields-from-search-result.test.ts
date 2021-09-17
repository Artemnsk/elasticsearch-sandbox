import { client } from './client'

const INDEX = 'test_index'

const document = {
  field1: 'field 1 value',
  field2: 'field 2 value',
  field3: 'field 3 value',
}

describe('Extract fields from search result', () => {
  beforeAll(async () => {
    await client.indices.create({ index: INDEX })
    await client.index({
      index: INDEX,
      body: document,
      refresh: true,
    })
  })

  afterAll(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX }).catch(emptyCb)
  })

  it('Doesnt have any "fields" field inside, despite one hypothesis.', async () => {
    const searchResult1 = await client.search({
      index: INDEX,
      body: {
        highlight: {
          number_of_fragments: 0,
          fields: { field1: {}, field2: {} }
        },
        query: {
          multi_match: {
            query: '1',
            fields: ['field1', 'field2'],
            type: 'phrase_prefix',
          },
        },
      },
    })

    expect(searchResult1.body.hits.hits[0].fields).toBeUndefined()
  })

  it('Supports _source_includes option.', async () => {
    const searchResult1 = await client.search({
      index: INDEX,
      body: {
        highlight: {
          number_of_fragments: 0,
          fields: { field1: {}, field2: {} }
        },
        query: {
          multi_match: {
            query: '1',
            fields: ['field1', 'field2'],
            type: 'phrase_prefix',
          },
        },
      },
      _source_includes: ['field3'],
    })

    expect(searchResult1.body.hits.hits[0]._source.field1).toBeUndefined()
    expect(searchResult1.body.hits.hits[0]._source.field2).toBeUndefined()
    expect(searchResult1.body.hits.hits[0]._source.field3).toBe(document.field3)
  })
})
