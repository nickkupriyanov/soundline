import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  /**
   * The stories run against the sources so the docs reflect what is in the
   * working tree — no `pnpm build` needed first, and a change to core reloads the
   * story. A consumer imports the built package instead.
   */
  async viteFinal(viteConfig) {
    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: [
          // The `/dom` subpath has to be matched first: the entry below is a
          // prefix alias and would otherwise rewrite it into `…/src/index.ts/dom`.
          {
            find: /^@nickkupriyanov\/soundline-core\/dom$/,
            replacement: source('../../core/src/dom/index.ts'),
          },
          {
            find: '@nickkupriyanov/soundline-core',
            replacement: source('../../core/src/index.ts'),
          },
          ...(Array.isArray(viteConfig.resolve?.alias) ? viteConfig.resolve.alias : []),
        ],
      },
    };
  },
};

export default config;
