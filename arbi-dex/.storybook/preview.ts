import type { Preview } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [provideAnimationsAsync()],
    }),
  ],

  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    backgrounds: {
      options: {
        light: { name: 'light', value: '#f8f9fc' },
        dark: { name: 'dark',  value: '#0d1117' }
      }
    },
  },

  initialGlobals: {
    backgrounds: {
      value: 'light'
    }
  }
};

export default preview;

