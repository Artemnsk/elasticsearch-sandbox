import { client } from './client'

const ALIAS = 'test_index'
const INDEX_1 = 'test_index_1'
const INDEX_2 = 'test_index_2'
const INDEX_WILDCARD = 'test_index*'

describe('Indexes API usage case', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.deleteAlias({ name: ALIAS, index: INDEX_WILDCARD }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_1 }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_2 }).catch(emptyCb)
  })

  test('Responds with documents from all the indexes under the alias specified in search.', async () => {
    // Create the 1st index & alias for it.
    await client.indices.create({ index: INDEX_1 })
    await client.indices.create({ index: INDEX_2 })
    await client.indices.updateAliases({
      body: {
        actions: [
          {
            add: {
              index: INDEX_1,
              alias: ALIAS,
            },
          },
          {
            add: {
              index: INDEX_2,
              alias: ALIAS,
            },
          },
        ],
      },
    })

    const ID = 'id_1'
    await client.index({
      index: INDEX_1,
      id: ID,
      body: { content: 'content index 1' },
      refresh: true,
    })
    await client.index({
      index: INDEX_2,
      id: ID,
      body: { content: 'content index 2' },
      refresh: true,
    })

    const searchResult = await client.search({
      index: ALIAS,
      body: {
        query: {
          multi_match: {
            query: 'content',
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })

    expect(searchResult.body.hits.hits.length).toBe(2)
  })
})
