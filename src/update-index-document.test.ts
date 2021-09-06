import { client } from './client'

const INDEX = 'test_index'

async function searchDocs(query: string) {
  const searchResult = await client.search({
    index: INDEX,
    body: {
      query: {
        multi_match: {
          query,
          fields: ['field1', 'field2', 'field3'],
          type: 'phrase_prefix',
        },
      },
    },
  })
  return searchResult.body.hits.hits
}

const DOCUMENT_ID = 'doc_id'
const originalDocument = { field1: 'field1 something', field2: 'field2 something' }

describe('Update/Index API usage cases', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX }).catch(emptyCb)
  })

  beforeEach(async () => {
    await client.indices.create({ index: INDEX })
  })

  it('Should update existing document', async () => {
    await client.index({ index: INDEX, id: DOCUMENT_ID, body: originalDocument })

    await client.update({
      index: INDEX,
      id: DOCUMENT_ID,
      refresh: true,
      body: { doc: { field2: 'field2 something 2', field3: 'field3 something' } },
    })

    const hits = await searchDocs('something')

    expect(hits.length).toBe(1)
    expect(hits[0]._source).toMatchObject({
      field1: 'field1 something',
      field2: 'field2 something 2',
      field3: 'field3 something',
    })
  })

  it('Should upsert document if doesnt exist', async () => {
    const update = { field2: 'field2 something 2', field3: 'field3 something' }
    await client.update({
      index: INDEX,
      id: DOCUMENT_ID,
      refresh: true,
      body: {
        doc: update,
        upsert: { ...originalDocument, ...update },
      },
    })

    const hits = await searchDocs('something')

    expect(hits.length).toBe(1)
    expect(hits[0]._source).toMatchObject({
      field1: 'field1 something',
      field2: 'field2 something 2',
      field3: 'field3 something',
    })
  })

  it('`index()` should fully replace an existing document without any fields merging', async () => {
    await client.index({ index: INDEX, id: DOCUMENT_ID, body: originalDocument })

    await client.index({
      index: INDEX,
      id: DOCUMENT_ID,
      refresh: true,
      body: { field2: 'field2 something 2', field3: 'field3 something' },
    })

    const hits = await searchDocs('something')

    expect(hits.length).toBe(1)
    expect(hits[0]._source).toMatchObject({ field2: 'field2 something 2', field3: 'field3 something' })
  })
})
