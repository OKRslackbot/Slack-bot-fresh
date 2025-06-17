function parseCommandArgs(text, expectedFields = []) {
  const args = {};
  
  // Split by quotes to handle quoted arguments
  const parts = text.split('"').filter(part => part.trim());
  
  // If we have quoted parts, assume they are title and description
  if (parts.length >= 2) {
    if (expectedFields.includes('title')) args.title = parts[0].trim();
    if (expectedFields.includes('description')) args.description = parts[1].trim();
    
    // Process remaining parts
    if (parts[2]) {
      const remaining = parts[2].trim().split(' ').filter(p => p.trim());
      remaining.forEach((part, index) => {
        if (part.startsWith('@')) {
          args.owner = part.replace('@', '');
        } else if (part.match(/^\d{4}-\d{2}-\d{2}$/)) {
          args.dueDate = part;
        } else if (expectedFields[index + 2]) {
          args[expectedFields[index + 2]] = part;
        }
      });
    }
  } else {
    // Fallback for simple space-separated arguments
    const simpleParts = text.split(' ').filter(p => p.trim());
    expectedFields.forEach((field, index) => {
      if (simpleParts[index]) {
        if (field === 'owner' && simpleParts[index].startsWith('@')) {
          args[field] = simpleParts[index].replace('@', '');
        } else {
          args[field] = simpleParts[index];
        }
      }
    });
  }
  
  return args;
}

function formatObjectiveResponse(objective, action = 'created') {
  const actionEmoji = {
    created: '✅',
    updated: '🔄',
    deleted: '🗑️'
  };

  const actionText = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted'
  };

  let response = `${actionEmoji[action]} **Objective ${actionText[action]}!**\n`;
  response += `🎯 **ID:** ${objective.id.slice(-6)}\n`;
  response += `📋 **Title:** ${objective.title}\n`;
  response += `📝 **Description:** ${objective.description}\n`;
  response += `👤 **Owner:** ${objective.owner}\n`;
  response += `📅 **Due Date:** ${objective.dueDate || 'Not set'}\n`;
  response += `📊 **Status:** ${objective.status}\n`;
  
  if (action === 'created') {
    response += `\n💡 Use \`/kr-create ${objective.id.slice(-6)}\` to add Key Results`;
  }
  
  return response;
}

function formatKeyResultResponse(keyResult, action = 'created', objective = null) {
  const actionEmoji = {
    created: '✅',
    updated: '🔄',
    deleted: '🗑️'
  };

  const actionText = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted'
  };

  const progress = Math.round((keyResult.current / keyResult.target) * 100);
  const statusEmoji = progress >= 75 ? '🟢' : progress >= 50 ? '🟡' : '🔴';

  let response = `${actionEmoji[action]} **Key Result ${actionText[action]}!**\n`;
  response += `🔑 **ID:** ${keyResult.id.slice(-6)}\n`;
  
  if (objective) {
    response += `🎯 **Objective:** ${objective.title}\n`;
  }
  
  response += `📋 **Title:** ${keyResult.title}\n`;
  response += `📝 **Description:** ${keyResult.description}\n`;
  response += `👤 **Owner:** ${keyResult.owner}\n`;
  response += `📈 **Progress:** ${keyResult.current}/${keyResult.target} ${keyResult.unit} (${progress}%) ${statusEmoji}\n`;
  
  return response;
}

function formatProgressUpdate(keyResult, oldValue, newValue) {
  const oldProgress = Math.round((oldValue / keyResult.target) * 100);
  const newProgress = Math.round((newValue / keyResult.target) * 100);
  const progressChange = newProgress - oldProgress;
  const changeEmoji = progressChange > 0 ? '📈' : progressChange < 0 ? '📉' : '➡️';
  
  let response = `${changeEmoji} **Progress Updated!**\n`;
  response += `🔑 **Key Result:** ${keyResult.title}\n`;
  response += `📊 **Progress:** ${oldProgress}% → ${newProgress}% (${progressChange > 0 ? '+' : ''}${progressChange}%)\n`;
  response += `📈 **Current:** ${newValue}/${keyResult.target} ${keyResult.unit}\n`;
  
  if (newProgress >= 100) {
    response += `🎉 **COMPLETED!** Target reached!\n`;
  } else if (newProgress >= 75) {
    response += `🟢 **On Track** - Great progress!\n`;
  } else if (newProgress >= 50) {
    response += `🟡 **At Risk** - May need attention\n`;
  } else {
    response += `🔴 **Behind** - Needs immediate attention\n`;
  }
  
  return response;
}

function formatUserList(users) {
  if (!users || users.length === 0) return 'None';
  return users.map(user => `@${user}`).join(', ');
}

function formatDate(date) {
  if (!date || date === 'Not set') return 'Not set';
  return new Date(date).toLocaleDateString();
}

function formatDuration(startDate, endDate = new Date()) {
  const diff = new Date(endDate) - new Date(startDate);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function validateUser(user) {
  if (!user || typeof user !== 'string') return false;
  return user.trim().length > 0;
}

function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function generateShortId(fullId) {
  if (!fullId) return 'N/A';
  return fullId.toString().slice(-6);
}

function parseUpdates(updateText) {
  const updates = {};
  
  // Parse field="value" patterns
  const fieldRegex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = fieldRegex.exec(updateText)) !== null) {
    updates[match[1]] = match[2];
  }
  
  // Parse field=value patterns (without quotes)
  const simpleFieldRegex = /(\w+)=([^\s]+)/g;
  while ((match = simpleFieldRegex.exec(updateText)) !== null) {
    if (!updates[match[1]]) { // Don't override quoted values
      updates[match[1]] = match[2];
    }
  }
  
  return updates;
}

function formatObjectivesList(objectives, includeProgress = true) {
  if (!objectives || objectives.length === 0) {
    return '📭 No objectives found.';
  }
  
  let response = '';
  objectives.forEach((obj, index) => {
    const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
    const progressText = includeProgress ? ` (${obj.progress}%)` : '';
    
    response += `${progressEmoji} **${generateShortId(obj.id)}. ${obj.title}**${progressText}\n`;
    response += `   👤 ${obj.owner} | 📅 ${formatDate(obj.dueDate)}\n`;
    
    if (index < objectives.length - 1) response += '\n';
  });
  
  return response;
}

function formatKeyResultsList(keyResults, includeObjective = false) {
  if (!keyResults || keyResults.length === 0) {
    return '📭 No key results found.';
  }
  
  let response = '';
  keyResults.forEach((kr, index) => {
    const progress = Math.round((kr.current / kr.target) * 100);
    const statusEmoji = progress >= 75 ? '🟢' : progress >= 50 ? '🟡' : '🔴';
    
    response += `${statusEmoji} **${generateShortId(kr.id)}. ${kr.title}** (${progress}%)\n`;
    response += `   📈 ${kr.current}/${kr.target} ${kr.unit} | 👤 ${kr.owner}\n`;
    
    if (includeObjective && kr.objectiveTitle) {
      response += `   🎯 ${kr.objectiveTitle}\n`;
    }
    
    if (index < keyResults.length - 1) response += '\n';
  });
  
  return response;
}

module.exports = {
  parseCommandArgs,
  formatObjectiveResponse,
  formatKeyResultResponse,
  formatProgressUpdate,
  formatUserList,
  formatDate,
  formatDuration,
  validateUser,
  truncateText,
  generateShortId,
  parseUpdates,
  formatObjectivesList,
  formatKeyResultsList
};