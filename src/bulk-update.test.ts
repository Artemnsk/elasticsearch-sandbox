import { client } from './client'

const INDEX_NAME = 'test_index_bulk_update'

const document1 = {
  id: 'doc1',
  field: 'field value 1',
  items: ['i1', 'i2'],
}

const document2 = {
  id: 'doc2',
  field: 'field value 2',
  items: ['i1', 'i2'],
}

describe('Indexes API usage case', () => {
  beforeAll(async () => {
    await client.indices.create({ index: INDEX_NAME })
  })

  afterAll(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX_NAME }).catch(emptyCb)
  })

  test('Bulk updates: update / upsert / conflict response.', async () => {
    await client.create({
      index: INDEX_NAME,
      id: document1.id,
      body: document1,
    })

    const bulkResponse = await client.bulk({
      index: INDEX_NAME,
      refresh: true,
      body: [
        { update: { _id: document1.id } },
        {
          script: {
            source: `
              for (int i = 0; i < params.items.length; i++) {
                if (!ctx._source.items.contains(params.items[i])){
                ctx._source.items.add(params.items[i])
              }
            }`,
            lang: 'painless',
            params: { items: ['i3'] },
          },
        },
        { update: { _id: document2.id } },
        {
          script: {
            // Script source doesn't matter because we are upserting anyway.
            source: '',
            lang: 'painless',
          },
          upsert: document2,
        },
        { create: { _id: document1.id } },
        document1,
      ],
    })

    expect(bulkResponse.body.errors).toBe(true)
    expect(bulkResponse.body.items[2]).toStrictEqual({
      create: expect.objectContaining({
        error: expect.objectContaining({
          type: 'version_conflict_engine_exception',
        }),
      }),
    })

    const response = await client.search({
      index: INDEX_NAME,
      body: {
        query: {
          multi_match: {
            query: 'doc',
            fields: ['id'],
            type: 'phrase_prefix',
          },
        },
      },
    })
    expect(response.body.hits.hits).toStrictEqual([
      expect.objectContaining({
        _source: document2,
      }),
      expect.objectContaining({
        _source: {
          ...document1,
          items: [...document1.items, 'i3']
        },
      }),
    ])
  })
})
