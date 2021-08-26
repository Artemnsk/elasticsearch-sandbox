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

  const indexingCases: Array<[string, number, boolean]> = [
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

  test.each(indexingCases)('%s', async (_, waitTimeMs, hasResult) => {
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

  test('Write and update after getting the response back then - changes should be applied properly.', async () => {
    const document = { fruits: ['apple'] }

    const indexResult = await client.index({ index: INDEX, body: document })
    const { _id, result } = indexResult.body
    expect(result).toBe('created')

    const updateResult = await client.update({
      index: INDEX,
      id: _id,
      body: {
        script: {
          source: `
            if (!ctx._source.fruits.contains(params.fruitToAdd)){
              ctx._source.fruits.add(params.fruitToAdd)
            }
          `,
          lang: 'painless',
          params: {
            fruitToAdd: 'orange',
          }
        },
      },
    })

    expect(updateResult.body.result).toBe('updated')

    await new Promise(r => setTimeout(r, 1000))

    const searchResult = await client.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: 'orange',
            fields: ['fruits'],
            type: 'phrase_prefix',
          },
        },
      },
    })

    const { hits } = searchResult.body.hits
    expect(hits.length).toBe(1)
    expect(hits[0]._source.fruits).toEqual(['apple', 'orange'])
  })

  const updateCases: Array<[string, number, (createdResultsCounter: number) => void]> = [
    [
      'Spam updates - works fine if delay between update ops is huge enough.',
      100,
      counter => expect(counter).toBe(1)
    ], [
      'Spam updates - multiple `create` ops throw error if delay between update ops is too small.',
      10,
      counter => expect(counter).toBeGreaterThan(1)
    ],
  ]

  test.each(updateCases)('%s', async (_, delayMs, expectation) => {
    const DOCUMENT_ID = 'document_id'
    const defaultFruits = [
      'apple',
    ]
    const fruitsToAdd = [
      'orange',
      'banana',
      'mango',
      'peanut',
      // Is it actually a fruit? Maybe a berry?
      'watermelon',
    ]
    const promises: Promise<any>[] = []
    let createdResultsCounter = 0
    for (const fruitToAdd of fruitsToAdd) {
      const promise = client.update({
        index: INDEX,
        id: DOCUMENT_ID,
        body: {
          script: {
            source: `
            if (!ctx._source.fruits.contains(params.fruitToAdd)){ 
              ctx._source.fruits.add(params.fruitToAdd)
            }
          `,
            lang: 'painless',
            params: { fruitToAdd }
          },
          upsert: {
            fruits: [...defaultFruits, fruitToAdd],
          }
        },
      }).then(r => {
        if (r === null) return
        if (r.body.result === 'created') {
          createdResultsCounter++
        }
      }, e => {
        console.error(e.toString())
        createdResultsCounter++
      })
      promises.push(promise)
      await new Promise(r => setTimeout(r, delayMs))
    }
    await Promise.all(promises)
    expectation(createdResultsCounter)

    await new Promise(r => setTimeout(r, 1000))

    const searchResult = await client.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: 'apple',
            fields: ['fruits'],
            type: 'phrase_prefix',
          },
        },
      },
    })

    const { hits } = searchResult.body.hits
    expect(hits.length).toBe(1)
    expect(hits[0]._source.fruits.sort()).toEqual([...defaultFruits, ...fruitsToAdd].sort())
  })
})
