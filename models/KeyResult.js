class KeyResult {
  constructor(objectiveId, title, description, owner, target, unit = 'percent') {
    this.id = this.generateId();
    this.objectiveId = objectiveId;
    this.title = title;
    this.description = description;
    this.owner = owner;
    this.assignees = [owner];
    this.target = parseFloat(target);
    this.current = 0;
    this.unit = unit;
    this.status = 'active'; // active, completed, cancelled, blocked
    this.priority = 'medium';
    this.trackingType = 'increase'; // increase, decrease, maintain
    this.milestones = []; // Array of milestone objects
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.createdBy = owner;
  }

  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  }

  updateProgress(value, type = 'current') {
    if (type === 'current') {
      this.current = Math.max(0, parseFloat(value));
    } else if (type === 'progress') {
      const progressPercent = Math.max(0, Math.min(100, parseFloat(value)));
      this.current = (progressPercent / 100) * this.target;
    }
    this.updatedAt = new Date();
    
    // Auto-complete if target reached
    if (this.current >= this.target && this.status === 'active') {
      this.status = 'completed';
    }
  }

  getProgressPercentage() {
    if (this.target === 0) return 0;
    return Math.min(100, Math.round((this.current / this.target) * 100));
  }

  getProgressStatus() {
    const percentage = this.getProgressPercentage();
    if (percentage >= 100) return 'completed';
    if (percentage >= 75) return 'on-track';
    if (percentage >= 50) return 'at-risk';
    return 'behind';
  }

  addMilestone(description, value, date = new Date()) {
    this.milestones.push({
      id: Date.now(),
      description,
      value: parseFloat(value),
      date,
      createdAt: new Date()
    });
    this.milestones.sort((a, b) => a.value - b.value);
    this.updatedAt = new Date();
  }

  getNextMilestone() {
    return this.milestones.find(m => m.value > this.current);
  }

  updateField(field, value) {
    if (this.hasOwnProperty(field) && field !== 'id' && field !== 'createdAt') {
      if (field === 'target') {
        this.target = parseFloat(value);
      } else {
        this[field] = value;
      }
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  addAssignee(user) {
    if (!this.assignees.includes(user)) {
      this.assignees.push(user);
      this.updatedAt = new Date();
    }
  }

  isOnTrack() {
    return this.getProgressStatus() === 'on-track' || this.getProgressStatus() === 'completed';
  }

  toSummary() {
    return {
      id: this.id,
      objectiveId: this.objectiveId,
      title: this.title,
      owner: this.owner,
      progress: this.getProgressPercentage(),
      current: this.current,
      target: this.target,
      unit: this.unit,
      status: this.getProgressStatus()
    };
  }
}

module.exports = KeyResult;