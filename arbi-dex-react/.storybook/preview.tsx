import type { Preview } from '@storybook/react';
import { withAppProviders } from './withAppProviders';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
  },
  decorators: [withAppProviders],
};

export default preview;
