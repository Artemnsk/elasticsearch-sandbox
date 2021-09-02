import { client } from './client'

const INDEX_1 = 'test_index_1'
const INDEX_2 = 'test_index_2'

describe('Indexes API usage case', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX_1 }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_2 }).catch(emptyCb)
  })

  test('Reindex API\'s op_type=create option makes re-indexed entities not overwrite existing values in destination index.', async () => {
    await client.indices.create({ index: INDEX_1 })
    await client.indices.create({ index: INDEX_2 })

    const SIZE = 5
    for (let i = 0; i < SIZE; i++) {
      await client.index({
        index: INDEX_1,
        id: `id_${i}`,
        body: { content: `something ${i}` },
      })
    }

    await client.create({
      id: `id_${SIZE - 1}`,
      index: INDEX_2,
      body: { content: `updated something ${SIZE - 1}` },
    })

    await client.reindex({
      wait_for_completion: true,
      body: {
        source: { index: INDEX_1 },
        dest: {
          index: INDEX_2,
          op_type: 'create',
        },
      },
    })

    await new Promise(r => setTimeout(r, 2000))

    // Data was written to the second index instead.
    const searchResult2 = await client.search({
      index: INDEX_2,
      body: {
        query: {
          multi_match: {
            query: `something ${SIZE - 1}`,
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })
    expect(searchResult2.body.hits.hits.length).toBe(1)
    expect(searchResult2.body.hits.hits[0]._source.content).toBe(`updated something ${SIZE - 1}`)
  })
})
