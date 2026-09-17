/** The tutor's tool names and the status line each one shows the learner while it runs. Shared by both backends. */

export const DERIVE_TOOL_NAMES = [
  'quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember', 'set_preferences', 'read_material', 'search_material',
  'search_library', 'read_resource', 'suggest_resource', 'add_resource',
] as const;

export const TOOL_LABELS: Record<string, string> = {
  quiz: 'Writing a question',
  ask: 'Asking',
  set_plan: 'Drawing the plan',
  node_status: 'Updating the graph',
  set_phase: 'Changing phase',
  explain_back: 'Preparing a teach-back',
  remember: 'Taking a note',
  set_preferences: 'Updating how you learn',
  read_material: 'Reading your material',
  search_material: 'Searching your material',
  search_library: 'Searching your library',
  read_resource: 'Reading from your library',
  suggest_resource: 'Picking a resource for you',
  add_resource: 'Saving a source to your library',
};
