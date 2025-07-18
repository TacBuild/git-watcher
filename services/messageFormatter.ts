import { ParsedEvent } from './eventParser';

export interface MessageTemplate {
  format(event: ParsedEvent): string;
}

export class TelegramMessageFormatter {
  formatMessage(event: ParsedEvent): string {
    if (event.eventType === 'push') {
      const pushTemplate = new PushMessageTemplate();
      return pushTemplate.format(event);
    }

    return '';
  }
}

class PushMessageTemplate implements MessageTemplate {
  format(event: ParsedEvent): string {
    const branch = event.details['branch'] as string;
    const commits =
      (event.details['commits'] as Array<{
        message: string;
        author: { name: string };
        id: string;
        added: string[];
        removed: string[];
        modified: string[];
      }>) || [];
    const isNewBranch = event.details['isNewBranch'] as boolean;
    const isDeleteBranch = event.details['isDeleteBranch'] as boolean;
    const compareUrl = event.details['compareUrl'] as string;

    if (isNewBranch || isDeleteBranch) {
      return '';
    }

    const addedFiles = new Set<string>();
    const removedFiles = new Set<string>();
    const modifiedFiles = new Set<string>();

    commits.forEach((commit) => {
      if (commit?.added) commit.added.forEach((file) => addedFiles.add(file));
      if (commit?.removed) commit.removed.forEach((file) => removedFiles.add(file));
      if (commit?.modified) commit.modified.forEach((file) => modifiedFiles.add(file));
    });

    const commitCount = commits.length;
    const totalFiles = addedFiles.size + removedFiles.size + modifiedFiles.size;

    let message = `${event.repository.toLowerCase()}@${branch.toLowerCase()} pushed by ${event.sender.toLowerCase()}`;

    if (commitCount > 1) {
      message += ` (${commitCount} commits)`;
    }

    message += '\n\n';

    if (commitCount >= 1) {
      const commitsToShow = commits.slice(0, 3);
      commitsToShow.forEach((commit) => {
        if (commit?.message) {
          const decodedMessage = decodeURIComponent(commit.message.replace(/\+/g, ' '));
          const commitMessage = decodedMessage.split('\n')[0] || decodedMessage;
          const truncatedMessage =
            commitMessage.length > 60 ? commitMessage.substring(0, 60) + '...' : commitMessage;
          message += `• ${truncatedMessage.toLowerCase()}\n`;
        }
      });

      if (commitCount > 3) {
        message += `• ... and ${commitCount - 3} more commits\n`;
      }
    }

    if (totalFiles > 0) {
      const filesText = totalFiles === 1 ? 'file' : 'files';
      const linkUrl = compareUrl || event.repositoryUrl;
      message += `\n${totalFiles} ${filesText} changed • <a href="${linkUrl}">view changes</a>`;
    } else {
      const linkUrl = compareUrl || event.repositoryUrl;
      message += `\n<a href="${linkUrl}">view changes</a>`;
    }

    return message;
  }
}
