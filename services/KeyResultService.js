const KeyResult = require('../models/KeyResult');

/**
 * KeyResultService
 * Business logic for managing key results
 */
class KeyResultService {
  constructor(storage, objectiveService) {
    this.storage = storage;
    this.objectiveService = objectiveService;
  }

  async createKeyResult(objectiveId, title, description, owner, target, unit = 'percent', options = {}) {
    // Validate inputs
    if (!title || title.trim().length === 0) {
      throw new Error('Key Result title is required');
    }

    if (!owner || owner.trim().length === 0) {
      throw new Error('Key Result owner is required');
    }

    if (!target || isNaN(parseFloat(target))) {
      throw new Error('Valid target value is required');
    }

    // Verify objective exists
    const objective = await this.storage.getObjective(objectiveId);
    if (!objective) {
      throw new Error(`Objective with ID ${objectiveId} not found`);
    }

    // Create key result
    const keyResult = new KeyResult(
      objectiveId,
      title.trim(),
      description ? description.trim() : '',
      owner.trim(),
      target,
      unit
    );

    // Apply optional settings
    if (options.priority) keyResult.priority = options.priority;
    if (options.trackingType) keyResult.trackingType = options.trackingType;
    if (options.current) keyResult.current = parseFloat(options.current);

    // Save to storage
    const saved = await this.storage.saveKeyResult(keyResult);

    // Update objective progress
    await this.objectiveService.updateProgress(objectiveId);

    return saved;
  }

  async getKeyResult(id) {
    return await this.storage.getKeyResult(id);
  }

  async getAllKeyResults(filters = {}) {
    return await this.storage.getAllKeyResults(filters);
  }

  async getKeyResultsByObjective(objectiveId) {
    return await this.storage.getAllKeyResults({ objectiveId });
  }

  async updateKeyResult(id, updates) {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    const allowedFields = [
      'title', 'description', 'owner', 'target', 'current',
      'unit', 'status', 'priority', 'trackingType', 'assignees'
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

    const updated = await this.storage.updateKeyResult(id, validUpdates);

    // Update related objective progress
    await this.objectiveService.updateProgress(keyResult.objectiveId);

    return updated;
  }

  async updateProgress(id, value, type = 'current') {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    let newCurrent = keyResult.current;

    if (type === 'current') {
      newCurrent = Math.max(0, parseFloat(value));
    } else if (type === 'progress') {
      const progressPercent = Math.max(0, Math.min(100, parseFloat(value)));
      newCurrent = (progressPercent / 100) * keyResult.target;
    } else if (type === 'increment') {
      newCurrent = keyResult.current + parseFloat(value);
    }

    // Auto-complete if target reached
    let newStatus = keyResult.status;
    if (newCurrent >= keyResult.target && keyResult.status === 'active') {
      newStatus = 'completed';
    }

    const updated = await this.storage.updateKeyResult(id, {
      current: newCurrent,
      status: newStatus
    });

    // Update related objective progress
    await this.objectiveService.updateProgress(keyResult.objectiveId);

    return updated;
  }

  async deleteKeyResult(id) {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    const deleted = await this.storage.deleteKeyResult(id);

    if (deleted) {
      // Update related objective progress
      await this.objectiveService.updateProgress(keyResult.objectiveId);
    }

    return deleted;
  }

  async addMilestone(id, description, value, date = new Date()) {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    const milestones = keyResult.milestones || [];
    milestones.push({
      id: Date.now(),
      description,
      value: parseFloat(value),
      date,
      createdAt: new Date()
    });

    milestones.sort((a, b) => a.value - b.value);

    return await this.storage.updateKeyResult(id, { milestones });
  }

  async getProgressStatus(id) {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    const percentage = (keyResult.current / keyResult.target) * 100;
    
    if (percentage >= 100) return 'completed';
    if (percentage >= 75) return 'on-track';
    if (percentage >= 50) return 'at-risk';
    return 'behind';
  }

  async getKeyResultsByOwner(owner) {
    return await this.storage.getAllKeyResults({ owner });
  }

  async getKeyResultsByStatus(status) {
    return await this.storage.getAllKeyResults({ status });
  }

  async getAtRiskKeyResults() {
    const allKeyResults = await this.storage.getAllKeyResults({ status: 'active' });
    return allKeyResults.filter(kr => {
      const percentage = (kr.current / kr.target) * 100;
      return percentage < 50;
    });
  }

  async getCompletedKeyResults() {
    return await this.storage.getAllKeyResults({ status: 'completed' });
  }

  async searchKeyResults(query) {
    const results = await this.storage.search(query, 'keyresults');
    return results.keyResults;
  }

  async getKeyResultStats(id) {
    const keyResult = await this.storage.getKeyResult(id);
    if (!keyResult) {
      throw new Error(`Key Result with ID ${id} not found`);
    }

    const objective = await this.storage.getObjective(keyResult.objectiveId);
    const progressPercentage = (keyResult.current / keyResult.target) * 100;

    return {
      keyResult: keyResult,
      objective: objective,
      progressPercentage: Math.round(progressPercentage),
      status: this.getProgressStatusSync(keyResult),
      remainingToTarget: keyResult.target - keyResult.current,
      nextMilestone: keyResult.milestones?.find(m => m.value > keyResult.current) || null
    };
  }

  getProgressStatusSync(keyResult) {
    const percentage = (keyResult.current / keyResult.target) * 100;
    
    if (percentage >= 100) return 'completed';
    if (percentage >= 75) return 'on-track';
    if (percentage >= 50) return 'at-risk';
    return 'behind';
  }
}

module.exports = KeyResultService;