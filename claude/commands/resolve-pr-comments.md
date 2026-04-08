# Resolve PR Review Comments

Find all unresolved review comments on the current branch's PR, evaluate each one, fix valid issues, and resolve the conversations on GitHub.

## Step 1: Get PR info and review comments

Use the `gh` CLI — it auto-detects the current branch's PR:

```bash
# PR title and URL
gh pr view --json number,title,url

# All review comments with file, line, and body
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PR_NUM=$(gh pr view --json number -q .number)
gh api "repos/$REPO/pulls/$PR_NUM/comments" --jq '.[] | "ID: \(.id) | File: \(.path):\(.line // .original_line) | Body: \(.body)"'
```

If no open PR exists for the branch, inform the user and stop.

## Step 2: Get thread IDs for unresolved threads

REST comments don't include thread IDs (needed for resolving). Use GraphQL to get them, filtering to unresolved only:

```bash
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
gh api graphql -f query='
{
  repository(owner: "'"$OWNER"'", name: "'"$NAME"'") {
    pullRequest(number: '"$PR_NUM"') {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { databaseId body }
          }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | "\(.id) | \(.comments.nodes[0].databaseId) | \(.comments.nodes[0].body[:80])"'
```

Match thread IDs to REST comment IDs via `databaseId`. Skip threads where `isOutdated` is `true` (the code they reference has already changed).

## Step 3: Read the referenced code

For each unresolved thread, read the file at the referenced line(s) to understand the current state of the code. The comment may already be addressed if the code has changed since the review.

## Step 4: Evaluate each comment

For each unresolved review thread, determine which category it falls into:

### Category A: Already fixed
The code has already been changed to address the feedback. The thread just needs to be resolved.
**Action:** Reply acknowledging the fix, then resolve the thread.

### Category B: Valid suggestion — fix it
The feedback identifies a real issue (bug, security concern, code quality, performance) that should be addressed.
**Action:** Fix the code, reply explaining the fix, then resolve the thread.

### Category C: Not actionable / Disagree
The suggestion is a matter of preference, is incorrect, or doesn't apply. Examples: style nits that conflict with project conventions, suggestions based on incorrect assumptions.
**Action:** Do NOT resolve. Report to the user with your reasoning and let them decide.

### Category D: Question / Discussion
The comment asks a question or starts a discussion rather than suggesting a code change.
**Action:** Do NOT resolve. Report to the user so they can respond.

Present your categorization to the user BEFORE making any changes or resolving any threads. Wait for confirmation.

## Step 5: Fix valid issues (Category B)

For each Category B item:
1. Read the full file to understand context
2. Make the minimal fix that addresses the feedback
3. Follow existing code conventions and patterns
4. Run linting/tests if the project has them configured

Group related fixes together logically.

## Step 6: Reply and resolve threads

For each thread being resolved (Categories A and B, after fixes are applied):

Reply to the thread, then resolve it. These can be batched in parallel across threads:

```bash
# Reply
gh api graphql -f query='
mutation {
  addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: "THREAD_ID", body: "Fixed — description of what was changed."}) {
    comment { id }
  }
}'

# Resolve (can batch multiple in a loop)
for thread_id in THREAD_ID_1 THREAD_ID_2 THREAD_ID_3; do
  gh api graphql -f query='
  mutation {
    resolveReviewThread(input: {threadId: "'"$thread_id"'"}) {
      thread { isResolved }
    }
  }' --jq '.data.resolveReviewThread.thread.isResolved'
done
```

## Step 7: Report summary

After all actions are complete, present a summary table:

```
| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | path:line | Brief description | What was changed |
| 2 | path:line | Brief description | Skipped — reason |
```

## Important rules

- **NEVER resolve a thread without understanding the feedback and verifying the fix**
- **NEVER resolve discussion threads or questions** — only resolve threads where a concrete code suggestion has been addressed
- **ALWAYS present your plan before making changes** — let the user approve which items to fix and which to skip
- **Respect the project's CLAUDE.md** — follow existing conventions for code style, testing, etc.
- **Do not create git commits** — only make code changes. The user handles version control.
- **Run project linting/tests after fixes** if the project has `make lint` or equivalent configured
