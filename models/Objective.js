class Objective {
  constructor(title, description, owner, dueDate = null) {
    this.id = this.generateId();
    this.title = title;
    this.description = description;
    this.owner = owner;
    this.assignees = [owner];
    this.dueDate = dueDate;
    this.status = 'active'; // active, completed, cancelled, draft
    this.progress = 0;
    this.priority = 'medium'; // low, medium, high, critical
    this.category = null; // business, technical, personal, etc.
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.createdBy = owner;
  }

  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  }

  updateField(field, value) {
    if (this.hasOwnProperty(field) && field !== 'id' && field !== 'createdAt') {
      this[field] = value;
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

  removeAssignee(user) {
    const index = this.assignees.indexOf(user);
    if (index > -1) {
      this.assignees.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  setStatus(status) {
    const validStatuses = ['active', 'completed', 'cancelled', 'draft'];
    if (validStatuses.includes(status)) {
      this.status = status;
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  isOverdue() {
    if (!this.dueDate || this.dueDate === 'Not set') return false;
    return new Date() > new Date(this.dueDate);
  }

  getDaysUntilDue() {
    if (!this.dueDate || this.dueDate === 'Not set') return null;
    const diff = new Date(this.dueDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  toSummary() {
    return {
      id: this.id,
      title: this.title,
      owner: this.owner,
      status: this.status,
      progress: this.progress,
      dueDate: this.dueDate,
      isOverdue: this.isOverdue()
    };
  }
}

module.exports = Objective;