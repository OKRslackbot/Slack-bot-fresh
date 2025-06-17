class MemoryStorage {
  constructor() {
    this.objectives = new Map();
    this.keyResults = new Map();
    this.users = new Map();
    this.settings = new Map();
  }

  // === OBJECTIVES ===
  
  async saveObjective(objective) {
    this.objectives.set(objective.id, { ...objective });
    return objective;
  }

  async getObjective(id) {
    return this.objectives.get(id) || null;
  }

  async getAllObjectives(filters = {}) {
    let results = Array.from(this.objectives.values());
    
    if (filters.status) {
      results = results.filter(obj => obj.status === filters.status);
    }
    
    if (filters.owner) {
      results = results.filter(obj => 
        obj.owner === filters.owner || obj.assignees.includes(filters.owner)
      );
    }
    
    if (filters.category) {
      results = results.filter(obj => obj.category === filters.category);
    }
    
    return results;
  }

  async updateObjective(id, updates) {
    const objective = this.objectives.get(id);
    if (!objective) return null;
    
    const updated = { ...objective, ...updates, updatedAt: new Date() };
    this.objectives.set(id, updated);
    return updated;
  }

  async deleteObjective(id) {
    const objective = this.objectives.get(id);
    if (!objective) return false;
    
    this.objectives.delete(id);
    
    // Also delete related key results
    const relatedKRs = Array.from(this.keyResults.values())
      .filter(kr => kr.objectiveId === id);
    
    relatedKRs.forEach(kr => this.keyResults.delete(kr.id));
    
    return true;
  }

  // === KEY RESULTS ===
  
  async saveKeyResult(keyResult) {
    this.keyResults.set(keyResult.id, { ...keyResult });
    return keyResult;
  }

  async getKeyResult(id) {
    return this.keyResults.get(id) || null;
  }

  async getAllKeyResults(filters = {}) {
    let results = Array.from(this.keyResults.values());
    
    if (filters.objectiveId) {
      results = results.filter(kr => kr.objectiveId === filters.objectiveId);
    }
    
    if (filters.owner) {
      results = results.filter(kr => 
        kr.owner === filters.owner || kr.assignees.includes(filters.owner)
      );
    }
    
    if (filters.status) {
      results = results.filter(kr => kr.status === filters.status);
    }
    
    return results;
  }

  async updateKeyResult(id, updates) {
    const keyResult = this.keyResults.get(id);
    if (!keyResult) return null;
    
    const updated = { ...keyResult, ...updates, updatedAt: new Date() };
    this.keyResults.set(id, updated);
    return updated;
  }

  async deleteKeyResult(id) {
    const keyResult = this.keyResults.get(id);
    if (!keyResult) return false;
    
    this.keyResults.delete(id);
    return true;
  }

  // === ANALYTICS ===
  
  async getObjectiveProgress(objectiveId) {
    const keyResults = await this.getAllKeyResults({ objectiveId });
    
    if (keyResults.length === 0) return 0;
    
    const totalProgress = keyResults.reduce((sum, kr) => {
      const progress = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
      return sum + Math.min(progress, 100);
    }, 0);
    
    return Math.round(totalProgress / keyResults.length);
  }

  async getTeamProgress(owner = null) {
    const objectives = await this.getAllObjectives(owner ? { owner } : {});
    const keyResults = await this.getAllKeyResults(owner ? { owner } : {});
    
    return {
      totalObjectives: objectives.length,
      activeObjectives: objectives.filter(obj => obj.status === 'active').length,
      completedObjectives: objectives.filter(obj => obj.status === 'completed').length,
      totalKeyResults: keyResults.length,
      completedKeyResults: keyResults.filter(kr => kr.status === 'completed').length,
      averageProgress: objectives.length > 0 ? 
        Math.round(objectives.reduce((sum, obj) => sum + obj.progress, 0) / objectives.length) : 0
    };
  }

  // === UTILITY ===
  
  async getStats() {
    return {
      objectivesCount: this.objectives.size,
      keyResultsCount: this.keyResults.size,
      usersCount: this.users.size
    };
  }

  async clear() {
    this.objectives.clear();
    this.keyResults.clear();
    this.users.clear();
    this.settings.clear();
  }

  // === SEARCH ===
  
  async search(query, type = 'all') {
    const results = { objectives: [], keyResults: [] };
    const searchTerm = query.toLowerCase();
    
    if (type === 'all' || type === 'objectives') {
      results.objectives = Array.from(this.objectives.values())
        .filter(obj => 
          obj.title.toLowerCase().includes(searchTerm) ||
          obj.description.toLowerCase().includes(searchTerm)
        );
    }
    
    if (type === 'all' || type === 'keyresults') {
      results.keyResults = Array.from(this.keyResults.values())
        .filter(kr => 
          kr.title.toLowerCase().includes(searchTerm) ||
          kr.description.toLowerCase().includes(searchTerm)
        );
    }
    
    return results;
  }
}

module.exports = MemoryStorage;