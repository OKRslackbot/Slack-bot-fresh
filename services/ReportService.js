class ReportService {
  constructor(storage, objectiveService, keyResultService) {
    this.storage = storage;
    this.objectiveService = objectiveService;
    this.keyResultService = keyResultService;
  }

  async generateOverallReport(filters = {}) {
    const objectives = await this.storage.getAllObjectives(filters);
    const keyResults = await this.storage.getAllKeyResults(filters);

    if (objectives.length === 0) {
      return {
        message: 'No objectives found for the specified criteria.',
        summary: null,
        details: []
      };
    }

    // Calculate overall statistics
    const stats = this.calculateOverallStats(objectives, keyResults);
    
    // Generate detailed breakdown
    const details = await this.generateDetailedBreakdown(objectives, keyResults);

    return {
      generatedAt: new Date(),
      filters: filters,
      summary: stats,
      details: details,
      recommendations: this.generateRecommendations(stats, objectives, keyResults)
    };
  }

  calculateOverallStats(objectives, keyResults) {
    const activeObjectives = objectives.filter(obj => obj.status === 'active');
    const completedObjectives = objectives.filter(obj => obj.status === 'completed');
    const activeKeyResults = keyResults.filter(kr => kr.status === 'active');
    const completedKeyResults = keyResults.filter(kr => kr.status === 'completed');

    // Calculate average progress
    const totalProgress = objectives.reduce((sum, obj) => sum + (obj.progress || 0), 0);
    const averageProgress = objectives.length > 0 ? Math.round(totalProgress / objectives.length) : 0;

    // Calculate key result progress
    const totalKRProgress = keyResults.reduce((sum, kr) => {
      const progress = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
      return sum + Math.min(progress, 100);
    }, 0);
    const averageKRProgress = keyResults.length > 0 ? Math.round(totalKRProgress / keyResults.length) : 0;

    return {
      totalObjectives: objectives.length,
      activeObjectives: activeObjectives.length,
      completedObjectives: completedObjectives.length,
      objectiveCompletionRate: objectives.length > 0 ? 
        Math.round((completedObjectives.length / objectives.length) * 100) : 0,
      
      totalKeyResults: keyResults.length,
      activeKeyResults: activeKeyResults.length,
      completedKeyResults: completedKeyResults.length,
      keyResultCompletionRate: keyResults.length > 0 ? 
        Math.round((completedKeyResults.length / keyResults.length) * 100) : 0,
      
      averageObjectiveProgress: averageProgress,
      averageKeyResultProgress: averageKRProgress,
      
      healthScore: this.calculateHealthScore(averageProgress, averageKRProgress, objectives.length, keyResults.length)
    };
  }

  calculateHealthScore(objProgress, krProgress, objCount, krCount) {
    if (objCount === 0) return 0;
    
    let score = 0;
    
    // Weight by progress (40%)
    score += (objProgress + krProgress) / 2 * 0.4;
    
    // Weight by volume (30%) - having key results is good
    const krPerObj = krCount / objCount;
    const volumeScore = Math.min(krPerObj / 3, 1) * 100; // Ideal: 3 KRs per objective
    score += volumeScore * 0.3;
    
    // Weight by completion rate (30%)
    score += ((objProgress + krProgress) / 2) * 0.3;
    
    return Math.round(score);
  }

  async generateDetailedBreakdown(objectives, keyResults) {
    const breakdown = [];

    for (const objective of objectives) {
      const objectiveKRs = keyResults.filter(kr => kr.objectiveId === objective.id);
      const progress = await this.storage.getObjectiveProgress(objective.id);
      
      const objectiveData = {
        objective: {
          id: objective.id,
          title: objective.title,
          owner: objective.owner,
          status: objective.status,
          progress: progress,
          dueDate: objective.dueDate,
          isOverdue: objective.dueDate && objective.dueDate !== 'Not set' ? 
            new Date() > new Date(objective.dueDate) : false
        },
        keyResults: objectiveKRs.map(kr => ({
          id: kr.id,
          title: kr.title,
          owner: kr.owner,
          progress: Math.round((kr.current / kr.target) * 100),
          current: kr.current,
          target: kr.target,
          unit: kr.unit,
          status: this.keyResultService.getProgressStatusSync(kr)
        })),
        keyResultsCount: objectiveKRs.length,
        completedKeyResults: objectiveKRs.filter(kr => kr.status === 'completed').length,
        atRiskKeyResults: objectiveKRs.filter(kr => {
          const progress = (kr.current / kr.target) * 100;
          return progress < 50;
        }).length
      };

      breakdown.push(objectiveData);
    }

    return breakdown.sort((a, b) => b.objective.progress - a.objective.progress);
  }

  generateRecommendations(stats, objectives, keyResults) {
    const recommendations = [];

    // Progress-based recommendations
    if (stats.averageObjectiveProgress < 30) {
      recommendations.push({
        type: 'warning',
        title: 'Low Overall Progress',
        message: 'Team progress is below 30%. Consider reviewing objectives for feasibility and resources.',
        action: 'Review objective scope and timeline'
      });
    }

    // Volume recommendations
    const krPerObj = stats.totalKeyResults / (stats.totalObjectives || 1);
    if (krPerObj < 2) {
      recommendations.push({
        type: 'info',
        title: 'Add More Key Results',
        message: `Average of ${krPerObj.toFixed(1)} key results per objective. Consider adding 2-4 measurable outcomes per objective.`,
        action: 'Add more specific, measurable key results'
      });
    }

    // Overdue objectives
    const overdueObjectives = objectives.filter(obj => 
      obj.dueDate && obj.dueDate !== 'Not set' && new Date() > new Date(obj.dueDate)
    );
    if (overdueObjectives.length > 0) {
      recommendations.push({
        type: 'urgent',
        title: 'Overdue Objectives',
        message: `${overdueObjectives.length} objectives are past their due date.`,
        action: 'Review and update timelines or mark as completed'
      });
    }

    // Completion rate recommendations
    if (stats.keyResultCompletionRate > stats.objectiveCompletionRate + 20) {
      recommendations.push({
        type: 'success',
        title: 'Strong Execution',
        message: 'Key result completion rate exceeds objective completion. Great execution!',
        action: 'Consider marking completed objectives as done'
      });
    }

    return recommendations;
  }

  async generateTeamReport(owner) {
    const objectives = await this.storage.getAllObjectives({ owner });
    const keyResults = await this.storage.getAllKeyResults({ owner });

    return {
      owner: owner,
      generatedAt: new Date(),
      summary: this.calculateOverallStats(objectives, keyResults),
      objectives: objectives.map(obj => obj.toSummary?.() || obj),
      keyResults: keyResults.map(kr => kr.toSummary?.() || kr),
      upcomingDeadlines: await this.objectiveService.getUpcomingDeadlines(),
      atRiskItems: await this.keyResultService.getAtRiskKeyResults()
    };
  }

  async generateProgressReport(timeframe = '30d') {
    // This would integrate with historical data in a real implementation
    const objectives = await this.storage.getAllObjectives({ status: 'active' });
    const keyResults = await this.storage.getAllKeyResults({ status: 'active' });

    const progressData = {
      timeframe: timeframe,
      generatedAt: new Date(),
      objectives: objectives.length,
      keyResults: keyResults.length,
      avgProgress: this.calculateOverallStats(objectives, keyResults).averageObjectiveProgress,
      trends: {
        // In a real implementation, this would show progress over time
        message: 'Progress tracking requires historical data storage'
      }
    };

    return progressData;
  }

  formatReportForSlack(report) {
    let message = `📊 **OKR REPORT**\n`;
    message += `📅 Generated: ${report.generatedAt.toLocaleDateString()}\n\n`;

    if (report.summary) {
      const s = report.summary;
      message += `📈 **SUMMARY:**\n`;
      message += `• Objectives: ${s.activeObjectives}/${s.totalObjectives} active (${s.objectiveCompletionRate}% completed)\n`;
      message += `• Key Results: ${s.activeKeyResults}/${s.totalKeyResults} active (${s.keyResultCompletionRate}% completed)\n`;
      message += `• Average Progress: ${s.averageObjectiveProgress}%\n`;
      message += `• Health Score: ${s.healthScore}/100\n\n`;
    }

    if (report.details && report.details.length > 0) {
      message += `🎯 **TOP OBJECTIVES:**\n`;
      report.details.slice(0, 5).forEach(item => {
        const statusEmoji = item.objective.progress >= 75 ? '🟢' : 
                          item.objective.progress >= 50 ? '🟡' : '🔴';
        message += `${statusEmoji} ${item.objective.title} (${item.objective.progress}%)\n`;
      });
      message += `\n`;
    }

    if (report.recommendations && report.recommendations.length > 0) {
      message += `💡 **RECOMMENDATIONS:**\n`;
      report.recommendations.slice(0, 3).forEach(rec => {
        const emoji = rec.type === 'urgent' ? '🚨' : 
                     rec.type === 'warning' ? '⚠️' : 
                     rec.type === 'success' ? '✅' : 'ℹ️';
        message += `${emoji} ${rec.title}: ${rec.message}\n`;
      });
    }

    return message;
  }
}

module.exports = ReportService;