// Event parser service for GitHub webhooks

export interface GitHubWebhookPayload {
  action?: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  sender: {
    login: string;
    html_url: string;
  };
  [key: string]: unknown;
}

export interface ParsedEvent {
  eventType: string;
  eventId: string;
  repository: string;
  repositoryUrl: string;
  sender: string;
  senderUrl: string;
  action?: string | undefined;
  details: Record<string, unknown>;
  timestamp: Date;
}

export class GitHubEventParser {
  parseEvent(eventType: string, deliveryId: string, payload: GitHubWebhookPayload): ParsedEvent {
    const baseEvent: ParsedEvent = {
      eventType,
      eventId: deliveryId,
      repository: payload.repository.full_name,
      repositoryUrl: payload.repository.html_url,
      sender: payload.sender.login,
      senderUrl: payload.sender.html_url,
      action: payload.action || undefined,
      details: {},
      timestamp: new Date(),
    };

    switch (eventType) {
      case 'push':
        return this.parsePushEvent(baseEvent, payload);
      case 'pull_request':
        return this.parsePullRequestEvent(baseEvent, payload);
      case 'issues':
        return this.parseIssuesEvent(baseEvent, payload);
      case 'check_run':
      case 'check_suite':
        return this.parseCheckEvent(baseEvent, payload);
      case 'workflow_run':
        return this.parseWorkflowRunEvent(baseEvent, payload);
      default:
        return baseEvent;
    }
  }

  private parsePushEvent(baseEvent: ParsedEvent, payload: GitHubWebhookPayload): ParsedEvent {
    const pushPayload = payload as unknown as {
      ref: string;
      before: string;
      after: string;
      commits: Array<{
        id: string;
        message: string;
        author: { name: string; email: string };
        url: string;
        added: string[];
        removed: string[];
        modified: string[];
      }>;
      head_commit: {
        id: string;
        message: string;
        author: { name: string; email: string };
        url: string;
        added: string[];
        removed: string[];
        modified: string[];
      };
      compare: string;
    };

    const branch = pushPayload.ref.replace('refs/heads/', '');
    const commitCount = pushPayload.commits?.length || 0;
    const isNewBranch = pushPayload.before === '0000000000000000000000000000000000000000';
    const isDeleteBranch = pushPayload.after === '0000000000000000000000000000000000000000';

    return {
      ...baseEvent,
      details: {
        branch,
        commitCount,
        isNewBranch,
        isDeleteBranch,
        commits: pushPayload.commits?.slice(0, 5), // Limit to first 5 commits
        headCommit: pushPayload.head_commit,
        compareUrl: pushPayload.compare,
      },
    };
  }

  private parsePullRequestEvent(
    baseEvent: ParsedEvent,
    payload: GitHubWebhookPayload,
  ): ParsedEvent {
    const prPayload = payload as unknown as {
      pull_request: {
        number: number;
        title: string;
        html_url: string;
        state: string;
        draft: boolean;
        base: { ref: string };
        head: { ref: string };
        user: { login: string };
        merged: boolean;
        merge_commit_sha: string | null;
        additions?: number;
        deletions?: number;
        changed_files?: number;
      };
    };

    const pr = prPayload.pull_request;

    return {
      ...baseEvent,
      details: {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        draft: pr.draft,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        author: pr.user.login,
        merged: pr.merged,
        mergeCommitSha: pr.merge_commit_sha,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changed_files || 0,
      },
    };
  }

  private parseIssuesEvent(baseEvent: ParsedEvent, payload: GitHubWebhookPayload): ParsedEvent {
    const issuePayload = payload as unknown as {
      issue: {
        number: number;
        title: string;
        html_url: string;
        state: string;
        user: { login: string };
        labels: Array<{ name: string; color: string }>;
        assignees: Array<{ login: string }>;
      };
    };

    const issue = issuePayload.issue;

    return {
      ...baseEvent,
      details: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        author: issue.user.login,
        labels: issue.labels?.map((label) => label.name) || [],
        assignees: issue.assignees?.map((assignee) => assignee.login) || [],
      },
    };
  }

  private parseCheckEvent(baseEvent: ParsedEvent, payload: GitHubWebhookPayload): ParsedEvent {
    const checkPayload = payload as unknown as {
      check_run?: {
        name: string;
        conclusion: string | null;
        status: string;
        html_url: string;
        head_sha: string;
      };
      check_suite?: {
        conclusion: string | null;
        status: string;
        head_sha: string;
        pull_requests: Array<{ number: number }>;
      };
    };

    if (checkPayload.check_run) {
      const checkRun = checkPayload.check_run;
      return {
        ...baseEvent,
        details: {
          name: checkRun.name,
          conclusion: checkRun.conclusion,
          status: checkRun.status,
          url: checkRun.html_url,
          headSha: checkRun.head_sha,
        },
      };
    } else if (checkPayload.check_suite) {
      const checkSuite = checkPayload.check_suite;
      return {
        ...baseEvent,
        details: {
          conclusion: checkSuite.conclusion,
          status: checkSuite.status,
          headSha: checkSuite.head_sha,
          pullRequests: checkSuite.pull_requests?.map((pr) => pr.number) || [],
        },
      };
    }

    return baseEvent;
  }

  private parseWorkflowRunEvent(
    baseEvent: ParsedEvent,
    payload: GitHubWebhookPayload,
  ): ParsedEvent {
    const workflowPayload = payload as unknown as {
      workflow_run: {
        name: string;
        conclusion: string | null;
        status: string;
        html_url: string;
        head_sha: string;
        head_branch: string;
        event: string;
        run_number: number;
        run_attempt: number;
      };
    };

    const workflowRun = workflowPayload.workflow_run;

    return {
      ...baseEvent,
      details: {
        name: workflowRun.name,
        conclusion: workflowRun.conclusion,
        status: workflowRun.status,
        url: workflowRun.html_url,
        headSha: workflowRun.head_sha,
        headBranch: workflowRun.head_branch,
        triggerEvent: workflowRun.event,
        runNumber: workflowRun.run_number,
        runAttempt: workflowRun.run_attempt,
      },
    };
  }
}
