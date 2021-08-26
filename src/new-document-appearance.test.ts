import { client } from './client'

const INDEX = 'test_index'

/**
 * CONCLUSION.
 * Documents do not appear in search results immediately as you index them.
 * You need to wait for a while first.
 */
describe('Search API usage case', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX }).catch(emptyCb)
  })

  beforeEach(async () => {
    await client.indices.create({ index: INDEX })
  })

  const cases: Array<[string, number, boolean]> = [
    [
      'Searching for a just indexed item immediately will not respond it.',
      0,
      false,
    ], [
      'Searching for a just indexed item after 1000ms delay will respond it.',
      1000,
      true,
    ], [
      'Searching for a just indexed item after 50ms delay will not respond it.',
      50,
      false,
    ],
  ]

  test.each(cases)('%s', async (_, waitTimeMs, hasResult) => {
    const document = { content: 'something2' }

    const indexResult = await client.index({ index: INDEX, body: document })
    expect(indexResult.body.result).toBe('created')

    await new Promise(r => setTimeout(r, waitTimeMs))

    const searchResult = await client.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: 'something2',
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })

    expect(searchResult.body.hits.hits.length > 0).toBe(hasResult)
  })
})
