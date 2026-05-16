import { render } from 'preact';
import { DiffReviewApp } from './components/DiffReviewApp';
import type { DiffReviewState } from './messages';
import { createInitialSelection } from './selection';
import './styles.css';

const root = document.getElementById('root');

if (root !== null) {
  const initialState = window.initialDiffReviewState ?? fallbackState();
  render(<DiffReviewApp initialState={initialState} />, root);
}

declare global {
  interface Window {
    initialDiffReviewState?: DiffReviewState;
  }
}

function fallbackState(): DiffReviewState {
  return {
    title: 'Diff Review',
    files: [],
    selection: createInitialSelection([]),
    commitMessage: ''
  };
}
