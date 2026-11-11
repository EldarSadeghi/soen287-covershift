import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './json-store.js';
import { createRepositories } from './repositories.js';

const defaultDirectory = fileURLToPath(new URL('../../data/', import.meta.url));
export const store = new JsonStore(resolve(process.env.DATA_DIRECTORY || defaultDirectory, 'covershift.json'));
export const repositories = createRepositories(store);
