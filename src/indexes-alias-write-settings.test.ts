import { client } from './client'

const ALIAS = 'test_index'
const INDEX_1 = 'test_index_1'
const INDEX_2 = 'test_index_2'
const INDEX_WILDCARD = 'test_index*'

describe('Indexes API usage cases', () => {
  afterEach(async () => {
    await client.indices.deleteAlias({ name: ALIAS, index: INDEX_WILDCARD }).catch()
    await client.indices.delete({ index: INDEX_1 }).catch()
    await client.indices.delete({ index: INDEX_2 }).catch()
  })

  test('You can create indexes, assign them to alias and update writing settings.', async () => {
    // Create the 1st index & alias for it.
    await client.indices.create({ index: INDEX_1 })
    await client.indices.updateAliases({
      body: {
        actions: [
          {
            add: {
              index: INDEX_1,
              alias: ALIAS,
              is_write_index: true,
            },
          },
        ],
      },
    })

    // Create the 2nd index and alias for it.
    // Make it writable reverting the previous write.
    await client.indices.create({ index: INDEX_2 })
    await client.indices.updateAliases({
      body: {
        actions: [
          {
            add: {
              index: INDEX_1,
              alias: ALIAS,
              is_write_index: false,
            },
          },
          {
            add: {
              index: INDEX_2,
              alias: ALIAS,
              is_write_index: true,
            },
          },
        ],
      },
    })

    // Aliases call contain all the information about indexes including `is_write_index` key.
    const aliasesResponse = await client.indices.getAlias({ name: ALIAS })
    expect(aliasesResponse.body).toMatchObject({
      [INDEX_1]: {
        aliases: {
          [ALIAS]: {
            is_write_index: false,
          }
        }
      },
      [INDEX_2]: {
        aliases: {
          [ALIAS]: {
            is_write_index: true,
          }
        }
      }
    })

    // If there is a writing conflict, this call throws an error.
    await client.index({
      // Write to the alias only to make code more errors-proof.
      require_alias: true,
      index: ALIAS,
      body: { content: 'something' }
    })

    // Data was not written to the first index.
    const searchResult1 = await client.search({
      index: INDEX_1,
      body: {
        query: {
          multi_match: {
            query: 'something',
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })
    expect(searchResult1.body.hits.hits.length).toBe(0)

    // Data was written to the second index instead.
    const searchResult2 = await client.search({
      index: INDEX_2,
      body: {
        query: {
          multi_match: {
            query: 'something',
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })
    expect(searchResult2.body.hits.hits.length).toBe(1)
  })
})
