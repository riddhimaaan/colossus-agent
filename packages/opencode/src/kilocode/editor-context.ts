import { Schema, Types } from "effect"

export const EditorContext = Schema.Struct({
  directory: Schema.optional(Schema.String),
  worktree: Schema.optional(Schema.String),
  visibleFiles: Schema.optional(Schema.Array(Schema.String)),
  openTabs: Schema.optional(Schema.Array(Schema.String)),
  activeFile: Schema.optional(Schema.String),
  shell: Schema.optional(Schema.String),
})
export type EditorContext = Types.DeepMutable<Schema.Schema.Type<typeof EditorContext>>

// The EditorContext schema is still carried on user messages by the clients and
// the wire protocol. Colossus does not render it into a prompt: staticEnvLines
// and environmentDetails were removed along with their only callers, because
// injectEditorContext no longer appends machine context to the user's words.
