import type { SelectedSummary } from './selection';

export function canCommitSelectedChanges(summary: SelectedSummary, commitMessage: string): boolean {
  return summary.lines > 0 && commitMessage.trim().length > 0;
}
