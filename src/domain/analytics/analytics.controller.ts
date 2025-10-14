import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  ParseDatePipe,
  BadRequestException,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AnalyticsService, SalesAnalytics } from './analytics.service';
import {
  CustomerLTVResult,
  InventoryAnalysisResult,
  TopCustomer,
} from './repository/analytics.repository';

@Controller('analytics')
@UseInterceptors(CacheInterceptor)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales-analytics')
  async getSalesAnalytics(
    @Query('startDate', ParseDatePipe) startDate?: Date,
    @Query('endDate', ParseDatePipe) endDate?: Date,
  ): Promise<SalesAnalytics> {
    if (!startDate || !endDate) {
      // 기본값: 지난 30일
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.analyticsService.getAdvancedSalesAnalytics(startDate, endDate);
  }

  @Get('customer-lifetime-value')
  async getCustomerLifetimeValue(): Promise<CustomerLTVResult[]> {
    return this.analyticsService.getCustomerLifetimeValue();
  }

  @Get('inventory-analysis')
  async getInventoryAnalysis(): Promise<InventoryAnalysisResult[]> {
    return this.analyticsService.getAdvancedInventoryAnalysis();
  }

  @Get('top-customers-by-region')
  async getTopCustomersByRegion(
    @Query('region') region: string,
    @Query('limit') limit?: number,
  ): Promise<TopCustomer[]> {
    if (!region) {
      throw new BadRequestException('Region parameter is required');
    }
    return this.analyticsService.getTopCustomersByRegion(region, limit || 10);
  }

  @Get('complex-demo')
  async getComplexDemo() {
    // 여러 복잡한 쿼리를 조합한 데모 엔드포인트
    const [salesData, customerLTV, inventoryAnalysis] = await Promise.all([
      this.analyticsService.getAdvancedSalesAnalytics(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일 전
        new Date(),
      ),
      this.analyticsService.getCustomerLifetimeValue(),
      this.analyticsService.getAdvancedInventoryAnalysis(),
    ]);

    return {
      summary: {
        totalRevenue: salesData.totalRevenue,
        totalCustomers: customerLTV.length,
        topCustomerValue: customerLTV[0]?.total_spent || 0,
        averageOrderValue: salesData.averageOrderValue,
      },
      salesAnalytics: salesData,
      topCustomersByLTV: customerLTV.slice(0, 10),
      recentInventoryTrends: inventoryAnalysis.slice(0, 7),
    };
  }
}
