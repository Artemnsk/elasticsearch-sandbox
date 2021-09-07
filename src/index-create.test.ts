import { client } from './client'

const INDEX = 'test_index'

describe('Index Create API usage cases', () => {
  afterEach(async () => {
    const emptyCb = () => {}
    await client.indices.delete({ index: INDEX }).catch(emptyCb)
  })

  it('Should not allow to create index twice and throw an error of specific shape', async () => {
    await client.indices.create({ index: INDEX })
    let err
    try {
      await client.indices.create({ index: INDEX })
    } catch (e) {
      err = e
    }

    expect(err).toMatchObject({
      meta: {
        body: {
          error: {
            type: 'resource_already_exists_exception',
          },
        },
      },
    })
  })
})
