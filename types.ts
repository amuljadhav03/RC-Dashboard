
export interface DashboardData {
  headers: string[];
  rows: Record<string, any>[];
}

export interface Insight {
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface DashboardInsights {
  summary: string;
  keyInsights: Insight[];
  recommendations: string[];
}
