import { defineConfig, defaultPlugins } from '@hey-api/openapi-ts';

export default defineConfig({
    input: process.env.W86_DOMAIN ? `${process.env.W86_DOMAIN}/v3/api-docs` : 'https://rest.workflow86.com/v3/api-docs',
    output: 'src/client',
    plugins: [
        ...defaultPlugins,
        {
            name: '@hey-api/schemas',
            type: 'json',
        },
    ],
});