import { client } from './client'

describe('General test', () => {
  it('options should work.', async () => {
    const result = await client.cat.indices()
    console.log(result)
    expect(result).toBeTruthy()
  })
})
