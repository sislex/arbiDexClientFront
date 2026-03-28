import { themeAlpine } from 'ag-grid-community';

/**
 * ag-grid light theme — default
 */
export const AG_THEME_LIGHT = themeAlpine;

/**
 * ag-grid dark theme — matches ArbiDex dark palette
 */
export const AG_THEME_DARK = themeAlpine.withParams({
  backgroundColor:       '#161b22',
  foregroundColor:       '#e6edf3',
  headerBackgroundColor: '#1e2530',
  headerTextColor:       '#8b949e',
  borderColor:           '#2d3748',
  rowHoverColor:         '#1e2530',
  selectedRowBackgroundColor: '#1c2333',
  oddRowBackgroundColor: '#161b22',
  fontFamily:            'Inter, Roboto, sans-serif',
  fontSize:              14,
  rowHeight:             48,
  headerHeight:          44,
});

