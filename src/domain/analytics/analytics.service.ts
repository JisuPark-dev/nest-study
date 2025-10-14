import { Injectable } from '@nestjs/common';
import {
  AnalyticsRepository,
  SalesAnalyticsResult,
  CustomerLTVResult,
  InventoryAnalysisResult,
  TopCustomer,
} from './repository/analytics.repository';

// Export for controller compatibility
export type SalesAnalytics = SalesAnalyticsResult;

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async getAdvancedSalesAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<SalesAnalytics> {
    return this.analyticsRepository.findSalesAnalytics(startDate, endDate);
  }

  async getCustomerLifetimeValue(): Promise<CustomerLTVResult[]> {
    return this.analyticsRepository.findCustomerLifetimeValues();
  }

  async getAdvancedInventoryAnalysis(): Promise<InventoryAnalysisResult[]> {
    return this.analyticsRepository.findInventoryAnalysis();
  }

  async getTopCustomersByRegion(
    region: string,
    limit: number = 10,
  ): Promise<TopCustomer[]> {
    return this.analyticsRepository.findTopCustomersByRegion(region, limit);
  }
}
