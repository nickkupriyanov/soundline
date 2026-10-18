import type { Decorator, Preview } from '@storybook/react-vite';
import '../../core/src/styles/index.css';
import './preview.css';

/** The page background follows the toolbar so a light player stays readable. */
const withSurface: Decorator = (Story, context) => (
  <div className="sb-surface" data-sb-theme={String(context.globals.theme ?? 'dark')}>
    <Story />
  </div>
);

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true, sort: 'requiredFirst' },
    options: { storySort: { order: ['Widget', 'States', 'Extensions', 'Headless'] } },
    a11y: { test: 'todo' },
  },
  globalTypes: {
    theme: {
      description: 'Theme applied to the player and the story background',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [withSurface],
};

export default preview;
