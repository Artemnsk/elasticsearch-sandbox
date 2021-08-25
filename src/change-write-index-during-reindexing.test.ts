import { client } from './client'

const ALIAS = 'test_index'
const INDEX_1 = 'test_index_1'
const INDEX_2 = 'test_index_2'
const INDEX_WILDCARD = 'test_index*'

/**
 * CONCLUSION.
 * This test fails!
 * Inevitably, we have at least one document lost when reassigning a write index for the alias.
 */
describe('Indexes API usage case', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.deleteAlias({ name: ALIAS, index: INDEX_WILDCARD }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_1 }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_2 }).catch(emptyCb)
  })

  beforeEach(async () => {
    const emptyCb = () => {}
    await client.indices.deleteAlias({ name: ALIAS, index: INDEX_WILDCARD }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_1 }).catch(emptyCb)
    await client.indices.delete({ index: INDEX_2 }).catch(emptyCb)

    await client.indices.create({ index: INDEX_1 })
    await client.indices.putAlias({ name: ALIAS, index: INDEX_1, body: { is_write_index: true } })
  })

  test('You can create new writing index, run reindex and do not loose any data in between.', async () => {
    const document = { content: 'something' }

    // Just imagine that we already had something there to have more illustrative test scenario.
    const PRE_RUN_NODES_NUMBER = 5
    for (let i = 0; i < PRE_RUN_NODES_NUMBER; i++) {
      await client.index({ require_alias: true, index: ALIAS, body: document })
    }

    let WRITTEN_IN_INTERVAL = 0
    function writeInInterval(intervalMs: number) {
      const MAX_ATTEMPTS = 100
      let promise: Promise<any> = Promise.resolve()
      function singleWrite() {
        let newPromise = client.index({ require_alias: true, index: ALIAS, body: document })
          .catch(() => {
            WRITTEN_IN_INTERVAL--
            console.error('Document was not written to index, decrement WRITTEN_IN_INTERVAL.')
          })
        promise = promise.then(() => newPromise)
        WRITTEN_IN_INTERVAL++
      }

      // Immediately make the first write to test the most "edge" case.
      singleWrite()
      const interval = setInterval(() => {
        singleWrite()
        if (WRITTEN_IN_INTERVAL >= MAX_ATTEMPTS) {
          console.warn('MAX ATTEMPTS REACHED. THE TEST MAY BE NOT QUITE RIGHT.')
          clearInterval(interval)
        }
      }, intervalMs)

      return () => {
        clearInterval(interval)
        return promise
      }
    }

    await client.indices.create({ index: INDEX_2 })

    // Now start spamming old index with data meanwhile create a new one, set it as `write_index` and start reindexing.
    const stopParallelWritingToIndex1 = writeInInterval(25)
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
    await client.reindex({
      wait_for_completion: true,
      body: {
        source: { index: INDEX_1 },
        dest: { index: INDEX_2 },
      },
    })
    await stopParallelWritingToIndex1()
    // It needs some time for last indexed documents to appear in the search.
    await new Promise(r => setTimeout(r, 2_000))

    const totalDocumentsNumber = PRE_RUN_NODES_NUMBER + WRITTEN_IN_INTERVAL
    console.info('Total documents written during this test is ', totalDocumentsNumber)

    const searchResult = await client.search({
      index: INDEX_2,
      body: {
        size: totalDocumentsNumber + 1,
        query: {
          multi_match: {
            query: 'something',
            fields: ['content'],
            type: 'phrase_prefix',
          },
        },
      },
    })
    expect(searchResult.body.hits.hits.length).toBe(totalDocumentsNumber)
  })
})
