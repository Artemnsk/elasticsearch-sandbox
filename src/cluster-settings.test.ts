import { client } from './client'

const INDEX = 'test_index'

describe('Cluster API usage cases', () => {
  let auto_create_index: boolean

  beforeEach(async () => {
    const settings = await client.cluster.getSettings({})
    auto_create_index = settings.body.persistent.action.auto_create_index
  })

  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX }).catch(emptyCb)
    // Reset to default values.
    await client.cluster.putSettings({
      body: {
        transient: {
          'action.auto_create_index': auto_create_index,
        },
        persistent: {
          'action.auto_create_index': auto_create_index,
        },
      },
    })
  })

  it('Should not allow to create document in non-existing index.', async () => {
    await client.cluster.putSettings({
      body: {
        transient: {
          'action.auto_create_index': false,
        },
        persistent: {
          'action.auto_create_index': false,
        },
      },
    })

    let error
    try {
      await client.create({
        id: 'docId',
        index: INDEX,
        body: { content: 'something' },
      })
    } catch (e) {
      error = e
    }

    expect(error).toMatchObject({
      body: {
        error: {
          type: 'index_not_found_exception',
        },
      },
    })
  })
})
