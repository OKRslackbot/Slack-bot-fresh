const { parseCommandArgs, formatObjectiveResponse, validateUser } = require('../utils/formatters');
const { validateObjectiveInput } = require('../utils/validators');

/**
 * Objective Command Handlers
 * Handles all Slack commands related to objectives
 */
class ObjectiveCommands {
  constructor(objectiveService, keyResultService) {
    this.objectiveService = objectiveService;
    this.keyResultService = keyResultService;
  }

  registerCommands(app) {
    app.command('/obj-create', this.handleCreateObjective.bind(this));
    app.command('/obj-list', this.handleListObjectives.bind(this));
    app.command('/obj-update', this.handleUpdateObjective.bind(this));
    app.command('/obj-delete', this.handleDeleteObjective.bind(this));
    app.command('/obj-assign', this.handleAssignObjective.bind(this));
    app.command('/obj-status', this.handleSetStatus.bind(this));
    app.command('/obj-show', this.handleShowObjective.bind(this));
  }

  async handleCreateObjective({ command, ack, say }) {
    await ack();

    try {
      const args = parseCommandArgs(command.text, ['title', 'description', 'owner', 'dueDate']);
      
      if (!args.title) {
        await say(`❌ **Usage:** \`/obj-create "Title" "Description" [@owner] [due-date]\`
**Example:** \`/obj-create "Increase Revenue" "Grow revenue by 25%" @john 2024-12-31\``);
        return;
      }

      const validation = validateObjectiveInput(args);
      if (!validation.valid) {
        await say(`❌ **Error:** ${validation.error}`);
        return;
      }

      const owner = args.owner || command.user_name || command.user_id;
      const objective = await this.objectiveService.createObjective(
        args.title,
        args.description || '',
        owner,
        args.dueDate
      );

      const response = formatObjectiveResponse(objective, 'created');
      await say(response);

    } catch (error) {
      console.error('Error creating objective:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleListObjectives({ command, ack, say }) {
    await ack();

    try {
      const args = command.text.split(' ').filter(arg => arg.trim());
      const filters = {};

      // Parse filters
      args.forEach(arg => {
        if (arg.startsWith('@')) {
          filters.owner = arg.replace('@', '');
        } else if (['active', 'completed', 'cancelled', 'draft'].includes(arg)) {
          filters.status = arg;
        }
      });

      // Default to active objectives
      if (!filters.status) {
        filters.status = 'active';
      }

      const objectives = await this.objectiveService.getAllObjectives(filters);

      if (objectives.length === 0) {
        await say(`📭 No ${filters.status} objectives found${filters.owner ? ` for @${filters.owner}` : ''}.`);
        return;
      }

      let response = `📋 **${filters.status.toUpperCase()} OBJECTIVES**${filters.owner ? ` - @${filters.owner}` : ''}\n\n`;

      for (const obj of objectives) {
        const keyResults = await this.keyResultService.getKeyResultsByObjective(obj.id);
        const progressEmoji = obj.progress >= 75 ? '🟢' : obj.progress >= 50 ? '🟡' : '🔴';
        
        response += `${progressEmoji} **${obj.id.slice(-6)}. ${obj.title}** (${obj.progress}%)\n`;
        response += `   📝 ${obj.description}\n`;
        response += `   👤 Owner: ${obj.owner} | 📅 Due: ${obj.dueDate || 'Not set'}\n`;
        response += `   🔑 Key Results: ${keyResults.length}\n`;
        
        if (obj.dueDate && obj.dueDate !== 'Not set') {
          const daysUntilDue = Math.ceil((new Date(obj.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntilDue < 0) {
            response += `   ⚠️ **OVERDUE** by ${Math.abs(daysUntilDue)} days\n`;
          } else if (daysUntilDue <= 7) {
            response += `   ⏰ Due in ${daysUntilDue} days\n`;
          }
        }
        
        response += `\n`;
      }

      response += `\n💡 Use \`/obj-show [id]\` for details or \`/kr-list [obj-id]\` to see key results.`;

      await say(response);

    } catch (error) {
      console.error('Error listing objectives:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleUpdateObjective({ command, ack, say }) {
    await ack();

    try {
      const args = command.text.split(' ');
      const objId = args[0];

      if (!objId) {
        await say(`❌ **Usage:** \`/obj-update [id] [field]="[value]"\`
**Examples:**
• \`/obj-update abc123 title="New Title"\`
• \`/obj-update abc123 description="Updated description"\`
• \`/obj-update abc123 dueDate="2024-12-31"\``);
        return;
      }

      const updateText = args.slice(1).join(' ');
      const updates = {};

      // Parse field="value" patterns
      const fieldRegex = /(\w+)="([^"]+)"/g;
      let match;
      while ((match = fieldRegex.exec(updateText)) !== null) {
        updates[match[1]] = match[2];
      }

      if (Object.keys(updates).length === 0) {
        await say('❌ **Error:** No valid updates found. Use format: field="value"');
        return;
      }

      const updated = await this.objectiveService.updateObjective(objId, updates);
      const response = formatObjectiveResponse(updated, 'updated');
      await say(response);

    } catch (error) {
      console.error('Error updating objective:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleDeleteObjective({ command, ack, say }) {
    await ack();

    try {
      const objId = command.text.trim();

      if (!objId) {
        await say('❌ **Usage:** `/obj-delete [objective-id]`\n**Example:** `/obj-delete abc123`');
        return;
      }

      const objective = await this.objectiveService.getObjective(objId);
      if (!objective) {
        await say(`❌ **Error:** Objective with ID ${objId} not found.`);
        return;
      }

      const keyResults = await this.keyResultService.getKeyResultsByObjective(objId);
      await this.objectiveService.deleteObjective(objId);

      await say(`✅ **Objective Deleted!**
🎯 Deleted: "${objective.title}"
🔑 Also deleted ${keyResults.length} related Key Results`);

    } catch (error) {
      console.error('Error deleting objective:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleAssignObjective({ command, ack, say }) {
    await ack();

    try {
      const args = command.text.split(' ');
      const objId = args[0];
      const user = args[1]?.replace('@', '');

      if (!objId || !user) {
        await say('❌ **Usage:** `/obj-assign [objective-id] [@user]`\n**Example:** `/obj-assign abc123 @john`');
        return;
      }

      await this.objectiveService.addAssignee(objId, user);
      await say(`✅ **Objective Assigned!**\n👤 Added @${user} to objective ${objId}`);

    } catch (error) {
      console.error('Error assigning objective:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleSetStatus({ command, ack, say }) {
    await ack();

    try {
      const args = command.text.split(' ');
      const objId = args[0];
      const status = args[1];

      if (!objId || !status) {
        await say(`❌ **Usage:** \`/obj-status [objective-id] [status]\`
**Valid statuses:** active, completed, cancelled, draft
**Example:** \`/obj-status abc123 completed\``);
        return;
      }

      await this.objectiveService.setStatus(objId, status);
      await say(`✅ **Status Updated!**\n🎯 Objective ${objId} set to: **${status}**`);

    } catch (error) {
      console.error('Error setting status:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }

  async handleShowObjective({ command, ack, say }) {
    await ack();

    try {
      const objId = command.text.trim();

      if (!objId) {
        await say('❌ **Usage:** `/obj-show [objective-id]`\n**Example:** `/obj-show abc123`');
        return;
      }

      const stats = await this.objectiveService.getObjectiveStats(objId);
      const keyResults = await this.keyResultService.getKeyResultsByObjective(objId);

      let response = `🎯 **OBJECTIVE DETAILS**\n\n`;
      response += `**${stats.objective.title}** (${stats.progress}%)\n`;
      response += `📝 ${stats.objective.description}\n`;
      response += `👤 Owner: ${stats.objective.owner}\n`;
      response += `📅 Due Date: ${stats.objective.dueDate || 'Not set'}\n`;
      response += `📊 Status: ${stats.objective.status}\n`;
      response += `🔑 Key Results: ${stats.keyResultsCount} (${stats.completedKeyResults} completed)\n`;

      if (stats.isOverdue) {
        response += `⚠️ **OVERDUE**\n`;
      } else if (stats.daysUntilDue !== null && stats.daysUntilDue <= 7) {
        response += `⏰ Due in ${stats.daysUntilDue} days\n`;
      }

      response += `\n🔑 **KEY RESULTS:**\n`;
      keyResults.forEach(kr => {
        const progress = Math.round((kr.current / kr.target) * 100);
        const statusEmoji = progress >= 75 ? '🟢' : progress >= 50 ? '🟡' : '🔴';
        response += `${statusEmoji} ${kr.title}: ${kr.current}/${kr.target} ${kr.unit} (${progress}%)\n`;
      });

      await say(response);

    } catch (error) {
      console.error('Error showing objective:', error);
      await say(`❌ **Error:** ${error.message}`);
    }
  }
}

module.exports = ObjectiveCommands;