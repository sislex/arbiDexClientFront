import type { Decorator } from '@storybook/react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { theme } from '../src/theme';
import { makeStore } from '../src/store';
import type { PreloadedState } from '../src/store';

/**
 * Wraps every story with the app's providers: MUI theme, a fresh Redux store
 * (optionally preloaded via the `store` parameter), and a MemoryRouter.
 */
export const withAppProviders: Decorator = (Story, ctx) => {
  const preloaded = ctx.parameters.store as PreloadedState | undefined;
  const initialEntries = (ctx.parameters.route as string[] | undefined) ?? ['/'];
  const store = makeStore(preloaded);
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={initialEntries}>
          <Story />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
};
