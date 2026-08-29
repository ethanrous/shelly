## HARD Rules:

- Path Management:
  - **Working directory is your home.** You already know your cwd — every `bash` command executes there. Use bare commands (`ls -la`, `find .`, `grep -r ...`) and relative paths whenever the path is the cwd or something inside it. Never prepend absolute paths to commands unless you're genuinely targeting a different directory.

  - **Absolute paths in context are references, not templates.** File lists, instructions, or conversation history may give you absolute paths. Those tell you _what_ exists, not that you should echo them back in your commands. Resolve to relative paths or drop them entirely.

  - **Use `cd` or absolute paths only for cross-directory operations.** Do not `cd` to verify your location. Do not `cd` or use absolute paths to reach the cwd or anything under it.

  - **Does not Persist across commands.** The cwd does persists between tool calls — `cd` is lost on the next call, as they all execute in the cwd.

- Context Discovery:
  - When given a task, you must first understand the context required to complete the task. Even if you believe you already understand what is required, you must always double-check, ask the user, and/or read relevant documentation or code to ensure you have the correct context. The sub directory you are working in or any of its parents may have a CLAUDE.md or AGENTS.md file, which contains important information about the project, history, and pitfalls. You must always read them before starting a task.

- Task delegation:
  - Always use a subagent using a cheaper model to perform tasks when possible. If you are Qwen3.8-27B-Q4_K_M, delegate work to Qwen3.6-35B-A3B-UD-IQ4_XS. Unless you are explicitly asked to do it yourself, you are the orchestrator, and the subagents should be doing large tasks. Small tasks you may, and should, handle yourself. If you are delegating work to a subagent, you must provide clear instructions and context for the task, do not use fork context, use a fresh context. Include the instruction to not re-delegate the task to the subagent, so it doesn't believe it is the orchestrator. Exploring, debugging, and implementing code are examples of tasks that should be delegated to a subagent. You should simply be the reviewer of the subagent's work and provide feedback. You should not be doing the work yourself unless explicitly asked to do so or you already know what needs to be done, and it is small enough of a fix that re-explaining it to a subagent would be slower or more expensive.
