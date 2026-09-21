import { logger } from '../utils/logger.js';
import { RecurringExpenseService } from './recurring.service.js';
import { SmartAlertService } from './smartAlert.service.js';
import { ReportingService } from './reporting.service.js';
import { NotificationService } from './notification.service.js';

let intervalId = null;

export class SchedulerService {
  /**
   * Start background task scheduler loop
   */
  static startScheduler() {
    logger.info('⏰ Starting background scheduler service (Recurring, Automated Reports & Smart Alerts)...');

    // Run initial check after 10 seconds startup
    setTimeout(() => {
      this.runTasks();
    }, 10000);

    // Run task loop every 1 hour (3600000 ms)
    intervalId = setInterval(() => {
      this.runTasks();
    }, 3600000);
  }

  /**
   * Execute scheduled tasks
   */
  static async runTasks() {
    try {
      logger.info('🔄 Running background scheduler jobs...');

      // 1. Process due recurring expenses
      await RecurringExpenseService.processDueRecurringExpenses();

      // 2. Check smart anomaly alerts
      await SmartAlertService.checkAnomalies();

      // 3. Automated daily check (if 9 AM)
      const currentHour = new Date().getHours();
      if (currentHour === 9) {
        await this.sendDailyAutomatedSummary();
      }

    } catch (error) {
      logger.error('Error executing background scheduler tasks:', error);
    }
  }

  /**
   * Send automated daily summary report to managers/admins
   */
  static async sendDailyAutomatedSummary() {
    try {
      const founderData = await ReportingService.getFounderDashboard();

      const fmtYesterday = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
        founderData.yesterdaySpend
      );
      const fmtSpent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
        founderData.monthlySpend
      );
      const fmtProjected = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
        founderData.projectedSpend
      );

      const reportMsg =
        `🌅 *Automated Daily Leadership Digest*\n\n` +
        `💸 *Yesterday Spend:* ${fmtYesterday}\n` +
        `📅 *Current Month Total:* ${fmtSpent}\n` +
        `📈 *Projected Month-End Spend:* ${fmtProjected}\n` +
        `🔋 *Estimated Cash Runway:* ${founderData.runwayMonths} months\n\n` +
        `Use \`/founder\` or \`/monthly\` for details.`;

      await NotificationService.broadcastToRoles(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], 'AUTOMATED_REPORT', reportMsg);
    } catch (error) {
      logger.error('Failed to send automated daily summary:', error);
    }
  }

  static stopScheduler() {
    if (intervalId) {
      clearInterval(intervalId);
      logger.info('Scheduler service stopped.');
    }
  }
}
