import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SalesAnalyticsResult {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topCustomers: TopCustomer[];
  regionStats: RegionStats[];
  monthlyTrends: MonthlyTrend[];
}

export interface TopCustomer {
  userId: number;
  userName: string;
  userEmail: string;
  totalSpent: number;
  orderCount: number;
}

export interface RegionStats {
  region: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  orderCount: number;
  newCustomers: number;
}

export interface CustomerLTVResult {
  user_id: number;
  name: string;
  email: string;
  cohort_month: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  customer_lifetime_days: number;
  monthly_value: number;
  median_order_value: number;
  order_value_stddev: number;
  customer_segment: 'High Value' | 'Medium Value' | 'Regular' | 'New';
  value_rank: number;
}

export interface InventoryAnalysisResult {
  order_date: string;
  day_name: string;
  order_count: number;
  daily_revenue: number;
  total_items_sold: number;
  day_over_day_change_pct: number;
  seven_day_moving_avg: number;
  performance_vs_trend: 'Above Average' | 'Below Average';
  period_type: 'Weekend' | 'Weekday';
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findSalesAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<SalesAnalyticsResult> {
    const query = `
      WITH customer_metrics AS (
        SELECT 
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as total_spent,
          AVG(o.total_amount) as avg_order_value,
          MIN(o.created_at) as first_order_date,
          MAX(o.created_at) as last_order_date,
          ROW_NUMBER() OVER (ORDER BY SUM(o.total_amount) DESC) as spending_rank
        FROM users u
        INNER JOIN orders o ON u.id = o.user_id
        WHERE o.created_at BETWEEN $1 AND $2
          AND o.status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY u.id, u.name, u.email
      ),
      regional_stats AS (
        SELECT 
          COALESCE(o.customer_region, 'Unknown') as region,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as revenue,
          AVG(o.total_amount) as avg_order_value,
          COUNT(DISTINCT o.user_id) as unique_customers,
          RANK() OVER (ORDER BY SUM(o.total_amount) DESC) as revenue_rank
        FROM orders o
        WHERE o.created_at BETWEEN $1 AND $2
          AND o.status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY o.customer_region
      ),
      monthly_trends AS (
        SELECT 
          TO_CHAR(o.created_at, 'YYYY-MM') as month,
          SUM(o.total_amount) as revenue,
          COUNT(o.id) as order_count,
          COUNT(DISTINCT CASE 
            WHEN first_time_customers.user_id IS NOT NULL 
            THEN o.user_id 
            END) as new_customers
        FROM orders o
        LEFT JOIN (
          SELECT 
            user_id,
            MIN(created_at) as first_order_date
          FROM orders
          WHERE status IN ('confirmed', 'shipped', 'delivered')
          GROUP BY user_id
        ) first_time_customers ON o.user_id = first_time_customers.user_id 
          AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', first_time_customers.first_order_date)
        WHERE o.created_at BETWEEN $1 AND $2
          AND o.status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
        ORDER BY month
      ),
      overall_metrics AS (
        SELECT 
          SUM(total_amount) as total_revenue,
          COUNT(*) as total_orders,
          AVG(total_amount) as average_order_value
        FROM orders
        WHERE created_at BETWEEN $1 AND $2
          AND status IN ('confirmed', 'shipped', 'delivered')
      )
      SELECT 
        json_build_object(
          'totalRevenue', COALESCE(om.total_revenue, 0),
          'totalOrders', COALESCE(om.total_orders, 0),
          'averageOrderValue', COALESCE(om.average_order_value, 0),
          'topCustomers', COALESCE(
            json_agg(
              json_build_object(
                'userId', cm.user_id,
                'userName', cm.user_name,
                'userEmail', cm.user_email,
                'totalSpent', cm.total_spent,
                'orderCount', cm.order_count
              ) ORDER BY cm.spending_rank
            ) FILTER (WHERE cm.spending_rank <= 10), 
            '[]'::json
          ),
          'regionStats', COALESCE(
            (SELECT json_agg(
              json_build_object(
                'region', region,
                'revenue', revenue,
                'orderCount', order_count,
                'avgOrderValue', avg_order_value
              ) ORDER BY revenue_rank
            ) FROM regional_stats),
            '[]'::json
          ),
          'monthlyTrends', COALESCE(
            (SELECT json_agg(
              json_build_object(
                'month', month,
                'revenue', revenue,
                'orderCount', order_count,
                'newCustomers', new_customers
              ) ORDER BY month
            ) FROM monthly_trends),
            '[]'::json
          )
        ) as analytics
      FROM overall_metrics om
      LEFT JOIN customer_metrics cm ON cm.spending_rank <= 10
      GROUP BY om.total_revenue, om.total_orders, om.average_order_value;
    `;

    const result = await this.dataSource.query(query, [startDate, endDate]);
    return (
      result[0]?.analytics || {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        topCustomers: [],
        regionStats: [],
        monthlyTrends: [],
      }
    );
  }

  async findCustomerLifetimeValues(): Promise<CustomerLTVResult[]> {
    const query = `
      WITH customer_cohorts AS (
        SELECT 
          user_id,
          DATE_TRUNC('month', MIN(created_at)) as cohort_month,
          MIN(created_at) as first_order_date
        FROM orders
        WHERE status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY user_id
      ),
      customer_orders AS (
        SELECT 
          o.user_id,
          o.created_at,
          o.total_amount,
          cc.cohort_month,
          EXTRACT(EPOCH FROM (o.created_at - cc.first_order_date)) / (24 * 60 * 60) as days_since_first_order,
          ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at) as order_sequence
        FROM orders o
        INNER JOIN customer_cohorts cc ON o.user_id = cc.user_id
        WHERE o.status IN ('confirmed', 'shipped', 'delivered')
      ),
      ltv_calculations AS (
        SELECT 
          co.user_id,
          u.name,
          u.email,
          TO_CHAR(co.cohort_month, 'YYYY-MM') as cohort_month,
          COUNT(*) as total_orders,
          SUM(co.total_amount) as total_spent,
          AVG(co.total_amount) as avg_order_value,
          MAX(co.days_since_first_order) as customer_lifetime_days,
          CASE 
            WHEN MAX(co.days_since_first_order) > 0 
            THEN SUM(co.total_amount) / (MAX(co.days_since_first_order) / 30.0)
            ELSE SUM(co.total_amount)
          END as monthly_value,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY co.total_amount) as median_order_value,
          COALESCE(STDDEV(co.total_amount), 0) as order_value_stddev
        FROM customer_orders co
        INNER JOIN users u ON co.user_id = u.id
        GROUP BY co.user_id, u.name, u.email, co.cohort_month
      )
      SELECT 
        user_id,
        name,
        email,
        cohort_month,
        total_orders,
        total_spent,
        avg_order_value,
        customer_lifetime_days,
        monthly_value,
        median_order_value,
        order_value_stddev,
        CASE 
          WHEN total_orders >= 5 AND monthly_value > 100 THEN 'High Value'
          WHEN total_orders >= 3 AND monthly_value > 50 THEN 'Medium Value'
          WHEN total_orders >= 2 THEN 'Regular'
          ELSE 'New'
        END as customer_segment,
        RANK() OVER (ORDER BY total_spent DESC) as value_rank
      FROM ltv_calculations
      ORDER BY total_spent DESC;
    `;

    return this.dataSource.query(query);
  }

  async findInventoryAnalysis(): Promise<InventoryAnalysisResult[]> {
    const query = `
      WITH daily_order_patterns AS (
        SELECT 
          DATE(created_at) as order_date,
          EXTRACT(DOW FROM created_at) as day_of_week,
          COUNT(*) as order_count,
          SUM(total_amount) as daily_revenue,
          SUM(item_count) as total_items_sold,
          LAG(COUNT(*)) OVER (ORDER BY DATE(created_at)) as prev_day_orders
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
          AND status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY DATE(created_at), EXTRACT(DOW FROM created_at)
      ),
      trend_analysis AS (
        SELECT 
          order_date,
          day_of_week,
          CASE day_of_week
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
          END as day_name,
          order_count,
          daily_revenue,
          total_items_sold,
          CASE 
            WHEN prev_day_orders IS NOT NULL AND prev_day_orders > 0
            THEN ((order_count - prev_day_orders)::float / prev_day_orders) * 100
            ELSE 0
          END as day_over_day_change,
          AVG(order_count) OVER (
            ORDER BY order_date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
          ) as seven_day_avg,
          CASE
            WHEN order_count > AVG(order_count) OVER (
              ORDER BY order_date 
              ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) THEN 'Above Average'
            ELSE 'Below Average'
          END as performance_vs_trend
        FROM daily_order_patterns
      )
      SELECT 
        TO_CHAR(order_date, 'YYYY-MM-DD') as order_date,
        day_name,
        order_count,
        daily_revenue,
        total_items_sold,
        ROUND(day_over_day_change, 2) as day_over_day_change_pct,
        ROUND(seven_day_avg, 2) as seven_day_moving_avg,
        performance_vs_trend,
        CASE 
          WHEN day_of_week IN (0, 6) THEN 'Weekend'
          ELSE 'Weekday'
        END as period_type
      FROM trend_analysis
      ORDER BY order_date DESC
      LIMIT 30;
    `;

    return this.dataSource.query(query);
  }

  async findTopCustomersByRegion(
    region: string,
    limit: number = 10,
  ): Promise<TopCustomer[]> {
    const query = `
      SELECT 
        u.id as "userId",
        u.name as "userName", 
        u.email as "userEmail",
        SUM(o.total_amount) as "totalSpent",
        COUNT(o.id) as "orderCount"
      FROM users u
      INNER JOIN orders o ON u.id = o.user_id
      WHERE o.customer_region = $1
        AND o.status IN ('confirmed', 'shipped', 'delivered')
      GROUP BY u.id, u.name, u.email
      ORDER BY "totalSpent" DESC
      LIMIT $2;
    `;

    return this.dataSource.query(query, [region, limit]);
  }
}
