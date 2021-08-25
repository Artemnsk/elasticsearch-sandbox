import { Client, ClientOptions } from '@elastic/elasticsearch'

const options = require('./client-options.json') as ClientOptions
export const client = new Client(options)
