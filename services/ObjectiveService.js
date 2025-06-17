const Objective = require('../models/Objective');

/**
 * ObjectiveService
 * Business logic for managing objectives
 */
class ObjectiveService {
  constructor(storage) {
    this.storage = storage;
  }

  async createObjective(title, description, owner, dueDate = null, options = {}) {
    // Validate inputs
    if (!title || title.trim().length === 0) {
      throw new Error('Objective title is required');
    }
    
    if (!owner || owner.trim().length === 0) {
      throw new Error('Objective owner is required');
    }

    // Create objective
    const objective = new Objective(
      title.trim(),
      description ? description.trim() : '',
      owner.trim(),
      dueDate
    );

    // Apply optional settings
    if (options.priority) objective.priority = options.priority;
    if (options.category) objective.category = options.category;
    if (options.status) objective.setStatus(options.status);

    // Save to storage
    return await this.storage.saveObjective(objective);
  }

  async getObjective(id) {
    return await this.storage.getObjective(id);
  }

  async getAllObjectives(filters = {}) {
    return await this.storage.getAllObjectives(filters);
  }

  async updateObjective(id, updates) {
    const objective = await this.storage.getObjective(id);
    if (!objective) {
      throw new Error(`Objective with ID ${id} not found`);
    }

    // Validate updates
    const allowedFields = [
      'title', 'description', 'owner', 'dueDate', 
      'status', 'priority', 'category', 'assignees'
    ];

    const validUpdates = {};
    Object.keys(updates).forEach(field => {
      if (allowedFields.includes(field)) {
        validUpdates[field] = updates[field];
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    return await this.storage.updateObjective(id, validUpdates);
  }

  async deleteObjective(id) {
    const objective = await this.storage.getObjective(id);
    if (!objective) {
      throw new Error(`Objective with ID ${id} not found`);
    }

    return await this.storage.deleteObjective(id);
  }

  async addAssignee(id, user) {
    const objective = await this.storage.getObjective(id);
    if (!objective) {
      throw new Error(`Objective with ID ${id} not found`);
    }

    if (!objective.assignees.includes(user)) {
      const updatedAssignees = [...objective.assignees, user];
      return await this.storage.updateObjective(id, { assignees: updatedAssignees });
    }

    return objective;
  }

  async removeAssignee(id, user) {
    const objective = await this.storage.getObjective(id);
    if (!objective) {
      throw new Error(`Objective with ID ${id} not found`);
    }

    const updatedAssignees = objective.assignees.filter(assignee => assignee !== user);
    return await this.storage.updateObjective(id, { assignees: updatedAssignees });
  }

  async setStatus(id, status) {
    const validStatuses = ['active', 'completed', 'cancelled', 'draft'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
    }

    return await this.storage.updateObjective(id, { status });
  }

  async getObjectivesByOwner(owner) {
    return await this.storage.getAllObjectives({ owner });
  }

  async getObjectivesByStatus(status) {
    return await this.storage.getAllObjectives({ status });
  }

  async updateProgress(id) {
    // Recalculate progress based on key results
    const progress = await this.storage.getObjectiveProgress(id);
    return await this.storage.updateObjective(id, { progress });
  }

  async getOverdueObjectives() {
    const allObjectives = await this.storage.getAllObjectives({ status: 'active' });
    return allObjectives.filter(obj => {
      if (!obj.dueDate || obj.dueDate === 'Not set') return false;
      return new Date() > new Date(obj.dueDate);
    });
  }

  async getUpcomingDeadlines(days = 7) {
    const allObjectives = await this.storage.getAllObjectives({ status: 'active' });
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + days);

    return allObjectives.filter(obj => {
      if (!obj.dueDate || obj.dueDate === 'Not set') return false;
      const dueDate = new Date(obj.dueDate);
      return dueDate >= new Date() && dueDate <= upcomingDate;
    });
  }

  async searchObjectives(query) {
    const results = await this.storage.search(query, 'objectives');
    return results.objectives;
  }

  async getObjectiveStats(id) {
    const objective = await this.storage.getObjective(id);
    if (!objective) {
      throw new Error(`Objective with ID ${id} not found`);
    }

    const keyResults = await this.storage.getAllKeyResults({ objectiveId: id });
    const progress = await this.storage.getObjectiveProgress(id);

    return {
      objective: objective,
      keyResultsCount: keyResults.length,
      completedKeyResults: keyResults.filter(kr => kr.status === 'completed').length,
      progress: progress,
      isOverdue: new Date() > new Date(objective.dueDate),
      daysUntilDue: objective.getDaysUntilDue?.() || null
    };
  }
}

module.exports = ObjectiveService;