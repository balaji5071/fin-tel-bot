import { executeGroqChat } from './groq.client.js';
import { logger } from '../../utils/logger.js';

export class ResponseGeneratorService {
  /**
   * Synthesize a warm, professional, human-like executive financial assistant response
   * using the exact pre-calculated data from database & backend logic.
   *
   * @param {Object} params
   * @param {string} params.userMessage - What the user said
   * @param {string} [params.intent] - Primary intent or message_type
   * @param {Object} params.backendData - Calculated data directly from DB/business logic
   * @param {string} [params.userName='there'] - Name of the user
   * @returns {Promise<string>}
   */
  static async generateResponse({ userMessage, intent = 'financial_events', backendData, userName = 'there', user = null }) {
    if (backendData.error) {
      return `⚠️ ${backendData.error}`;
    }

    if (backendData.actionResult?.error) {
      return `⚠️ ${backendData.actionResult.error}`;
    }

    if (backendData.queryResults?.error) {
      return `⚠️ ${backendData.queryResults.error}`;
    }

    if (backendData.requiresConfirmation) {
      return (
        `⚠️ *WARNING: CRITICAL DESTRUCTIVE ACTION*\n\n` +
        `This action will permanently delete all financial records.\n\n` +
        `Reply exactly:\n` +
        `\`CONFIRM RESET\`\n\n` +
        `before execution. No deletion will occur without this confirmation.`
      );
    }

    if (backendData.resetExecuted) {
      return `🗑️ *${backendData.message}*`;
    }

    // Bypass Groq LLM completely when deterministic route matched
    if (backendData.isDeterministic) {
      logger.info('Bypassing Groq LLM: Deterministic route matched');
      return this.fallbackFormat(backendData);
    }

    try {
      const userRole = user?.role || 'EMPLOYEE';
      const isExecutive = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

      const systemPrompt = `You are a professional AI Financial Employee speaking with ${userName}.

CURRENT USER CONTEXT:
- Name: ${userName}
- User Role: ${userRole}
- Department: ${user?.department || 'General'}

CRITICAL ROLE & PERMISSION RULES:
1. ${userName} is currently an ${userRole}.
2. CAN THIS USER SET BUDGETS? ${isExecutive ? 'YES (User is an Admin/Super Admin).' : 'ABSOLUTELY NOT. Setting company or department budgets requires ADMIN or SUPER_ADMIN access. If this user asks to set a budget, asks if they can set a budget, or asks who can set the budget, you MUST inform them that they are an Employee and only Admins/Super Admins can set budgets. NEVER offer to set a budget for an Employee.'}
3. CAN THIS USER MAKE THEMSELVES OR OTHERS ADMIN? ABSOLUTELY NOT. The bot cannot grant admin permissions. Only Super Admins can promote users via the /addadmin command.
4. CAN THIS USER VIEW EXECUTIVE / FOUNDER DATA? ${userRole !== 'EMPLOYEE' ? 'YES (User has manager/admin privileges).' : 'NO. Ordinary Employees can only see their own logged expenses. Company-wide founder dashboards, bank runway, and team spend rankings are restricted to Managers and Admins.'}
5. IF ASKED "WHO AM I": Tell them directly: they are ${userName}, registered as an ${userRole} in the ${user?.department || 'General'} department.
6. MANDATORY CURRENCY INSTRUCTION:
   - The company's currency is strictly Indian Rupees (INR, ₹).
   - ALL monetary amounts MUST ALWAYS use the Rupee symbol ₹ (e.g. ₹500, ₹2,000, ₹50,000).
   - NEVER EVER use dollar signs ($), USD, or any other currency symbol.
7. FINANCIAL INTEGRITY: All pre-computed numbers in BACKEND_CALCULATED_DATA are 100% authoritative. YOU MUST NEVER INVENT, ALTER, OR RECALCULATE ANY NUMBERS.
8. Return ONLY the final conversational message text in a JSON object with key "reply".`;

      const userPrompt = `USER_MESSAGE: "${userMessage}"
CURRENCY: Indian Rupees (INR, ₹) - Prefix all monetary figures with ₹. Never use $.
BACKEND_CALCULATED_DATA: ${JSON.stringify(backendData, null, 2)}

Respond with JSON: { "reply": "Your natural human-like response here" }`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const rawResponse = await executeGroqChat({
        messages,
        jsonMode: true,
        temperature: 0.2,
        max_tokens: 1200,
      });

      const parsed = JSON.parse(rawResponse);
      if (parsed.reply) {
        // Enforce Rupee currency symbol if model inadvertently generated $
        return parsed.reply.replace(/\$(\d[\d,]*)/g, '₹$1');
      }
    } catch (error) {
      logger.warn(`AI Response Generation failed, falling back to deterministic template: ${error.message}`);
    }

    // High-quality deterministic fallback if Groq call fails
    return this.fallbackFormat(backendData);
  }

  /**
   * Deterministic fallback response formatter
   */
  static fallbackFormat(data) {
    // 1. Multi-event mutations
    if (data.hasMutations) {
      let msg = `I've recorded:\n`;

      if (data.recordedIncomes && data.recordedIncomes.length > 0) {
        msg += `\n*Income*\n`;
        data.recordedIncomes.forEach((i) => {
          msg += `• ₹${i.amount?.toLocaleString('en-IN')} - ${i.description || i.source}\n`;
        });
      }

      if (data.recordedExpenses && data.recordedExpenses.length > 0) {
        msg += `\n*Expense*\n`;
        data.recordedExpenses.forEach((e) => {
          msg += `• ₹${e.amount?.toLocaleString('en-IN')} - ${e.note || e.category}\n`;
        });
      }

      const sign = data.netImpact >= 0 ? '+' : '-';
      msg += `\n*Net impact:*\n${sign}₹${Math.abs(data.netImpact || 0).toLocaleString('en-IN')}`;

      if (data.queryResults?.balance) {
        msg += `\n\n*Current Balance:* ₹${data.queryResults.balance.currentBalance?.toLocaleString('en-IN')}`;
      }

      return msg;
    }

    // 2. Balance query
    if (data.currentBalance !== undefined || data.queryResults?.balance) {
      const b = data.queryResults?.balance || data;
      return (
        `💰 *Current Company Balance: ₹${b.currentBalance?.toLocaleString('en-IN')}*\n\n` +
        `• Opening Balance: ₹${b.openingBalance?.toLocaleString('en-IN')}\n` +
        `• Total Income: ₹${b.totalIncome?.toLocaleString('en-IN')}\n` +
        `• Total Expenses: ₹${b.totalExpenses?.toLocaleString('en-IN')}`
      );
    }

    // 3. Admin Count query
    if (data.queryResults?.adminCount) {
      const a = data.queryResults.adminCount;
      let msg = `👑 *Company Administrators (${a.totalAdmins})*\n\n`;
      msg += `• *Super Admins:* ${a.superAdminCount}\n`;
      msg += `• *Admins:* ${a.adminCount}\n`;
      msg += `• *Total Administrators:* ${a.totalAdmins}\n\n`;

      if (a.admins && a.admins.length > 0) {
        msg += `📋 *Administrators List:*\n`;
        a.admins.forEach((admin) => {
          msg += `• ${admin.name} (${admin.username}) - \`${admin.role}\` (${admin.department})\n`;
        });
      }
      return msg;
    }

    // 4. Employee Count query
    if (data.queryResults?.employeeCount) {
      const e = data.queryResults.employeeCount;
      let msg = `👥 *Company Organization Overview*\n\n`;
      msg += `• *Total Employees:* ${e.totalEmployees}\n`;
      msg += `• *Total Company Members:* ${e.totalUsers}\n\n`;

      msg += `🏢 *Role Breakdown:*\n`;
      msg += `• Employees: ${e.breakdown.employees}\n`;
      msg += `• Managers: ${e.breakdown.managers}\n`;
      msg += `• Administrators: ${e.breakdown.admins}\n\n`;

      if (e.employees && e.employees.length > 0) {
        msg += `📋 *Employees List:*\n`;
        e.employees.forEach((emp) => {
          msg += `• ${emp.name} (${emp.username}) - ${emp.department}\n`;
        });
      }
      return msg;
    }

    // 5. Top Spender query
    if (data.queryResults?.topSpender) {
      const s = data.queryResults.topSpender;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[s.month] || 'Current Month'} ${s.year}`;

      if (!s.hasSpender) {
        return `🏆 *Top Spender (${monthLabel})*\n\n${s.message}`;
      }

      const top = s.topSpender;
      let msg = `🏆 *Top Spender This Month (${monthLabel})*\n\n`;
      msg += `• *Top Spender:* ${top.user.name} (${top.user.username})\n`;
      msg += `• *Role:* \`${top.user.role}\`\n`;
      msg += `• *Total Spent:* ₹${top.totalSpent.toLocaleString('en-IN')} (${top.percentage}% of company spend)\n`;
      msg += `• *Transactions:* ${top.count}\n`;
      if (top.topCategory) {
        msg += `• *Top Category:* ${top.topCategory.category} (₹${top.topCategory.amount.toLocaleString('en-IN')})\n`;
      }
      msg += `\n`;

      if (s.allSpenders && s.allSpenders.length > 0) {
        msg += `📊 *Team Spending Leaderboard:*\n`;
        s.allSpenders.forEach((sp, idx) => {
          msg += `${idx + 1}. ${sp.user.name} (${sp.user.username}) - ₹${sp.totalSpent.toLocaleString('en-IN')} (${sp.count} tx, ${sp.percentage}%)\n`;
        });
      }
      return msg;
    }

    // 6. Top Department query
    if (data.queryResults?.topDepartment) {
      const d = data.queryResults.topDepartment;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[d.month] || 'Current Month'} ${d.year}`;

      if (!d.hasSpending) {
        return `🏢 *Top Spending Department (${monthLabel})*\n\n${d.message}`;
      }

      let msg = `🏢 *Top Spending Department (${monthLabel})*\n\n`;
      msg += `• *Department:* ${d.topDepartment}\n`;
      msg += `• *Total Spent:* ₹${d.amount.toLocaleString('en-IN')} (${d.percentage}% of company expenses)\n`;
      msg += `• *Transactions:* ${d.count}\n\n`;

      if (d.allDepartments && d.allDepartments.length > 0) {
        msg += `📊 *Department Breakdown:*\n`;
        d.allDepartments.forEach((dept) => {
          msg += `• ${dept.department}: ₹${dept.amount.toLocaleString('en-IN')} (${dept.percentage}%, ${dept.count} tx)\n`;
        });
      }
      return msg;
    }

    // 7. Employee Expenses query
    if (data.queryResults?.employeeExpenses) {
      const e = data.queryResults.employeeExpenses;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[e.month] || 'Current Month'} ${e.year}`;

      if (!e.found) {
        let msg = `👤 *Employee Spending: ${e.targetName}*\n\n`;
        msg += `No employee named "${e.targetName}" was found in the company records.\n\n`;
        msg += `• *Recorded Expenses:* ₹0\n\n`;
        if (e.availableUsers && e.availableUsers.length > 0) {
          msg += `📋 *Active Team Members:*\n`;
          e.availableUsers.forEach((u) => {
            msg += `• ${u.name} (${u.username}) - \`${u.role}\`\n`;
          });
        }
        return msg;
      }

      let msg = `👤 *Employee Spending: ${e.user.name}*\n\n`;
      msg += `• *Role:* \`${e.user.role}\`\n`;
      msg += `• *Department:* ${e.user.department}\n`;
      msg += `• *Total Spent (${monthLabel}):* ₹${e.totalSpent.toLocaleString('en-IN')}\n`;
      msg += `• *Transactions:* ${e.count}\n\n`;

      if (e.categoryBreakdown && e.categoryBreakdown.length > 0) {
        msg += `📊 *Category Breakdown:*\n`;
        e.categoryBreakdown.forEach((c) => {
          msg += `• ${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${c.percentage}%)\n`;
        });
        msg += `\n`;
      }

      if (e.expenses && e.expenses.length > 0) {
        msg += `📝 *Recent Transactions:*\n`;
        e.expenses.forEach((tx) => {
          msg += `• ₹${tx.amount.toLocaleString('en-IN')} - ${tx.note || tx.category}\n`;
        });
      }
      return msg;
    }

    // 8. Company Budget query
    if (data.queryResults?.companyBudget) {
      const b = data.queryResults.companyBudget;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[b.month] || 'Current Month'} ${b.year}`;

      let msg = `💳 *Company Budget Status (${monthLabel})*\n\n`;
      if (b.hasBudget) {
        msg += `• *Budget Target:* ₹${b.budgetAmount.toLocaleString('en-IN')}\n`;
        msg += `• *Total Spent:* ₹${b.spentAmount.toLocaleString('en-IN')}\n`;
        const remSign = b.remainingBudget >= 0 ? '' : '-';
        msg += `• *Remaining Budget:* ${remSign}₹${Math.abs(b.remainingBudget).toLocaleString('en-IN')}\n`;
        msg += `• *Budget Usage:* ${b.percentageUsed.toFixed(1)}%\n\n`;
        if (b.percentageUsed >= 100) {
          msg += `⚠️ *Alert:* The company budget has been completely exhausted!\n\n`;
        } else if (b.percentageUsed >= 90) {
          msg += `⚠️ *Warning:* Over 90% of the monthly budget has been consumed.\n\n`;
        }
      } else {
        msg += `⚠️ *No company budget has been configured for ${monthLabel} yet.*\n\n`;
        msg += `• *Current Total Spent:* ₹${b.spentAmount.toLocaleString('en-IN')}\n\n`;
      }

      if (b.canUserSetBudget) {
        msg += `ℹ️ _You have Admin rights. Set budget using: \`Set budget to <amount>\`_`;
      }
      return msg;
    }

    // 9. Monthly Expenses query
    if (data.queryResults?.monthlyExpenses) {
      const m = data.queryResults.monthlyExpenses;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[m.month] || 'Current Month'} ${m.year}`;

      let msg = `📉 *Company Monthly Expenses (${monthLabel})*\n\n`;
      msg += `• *Total Expenses:* ₹${m.totalSpent.toLocaleString('en-IN')}\n`;
      msg += `• *Transactions:* ${m.count}\n\n`;

      if (m.categoryBreakdown && m.categoryBreakdown.length > 0) {
        msg += `📊 *Category Breakdown:*\n`;
        m.categoryBreakdown.forEach((c) => {
          const pct = m.totalSpent > 0 ? ((c.amount / m.totalSpent) * 100).toFixed(1) : '0.0';
          msg += `• ${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${pct}%)\n`;
        });
      }
      return msg;
    }

    // 10. Monthly Income query
    if (data.queryResults?.monthlyIncome) {
      const inc = data.queryResults.monthlyIncome;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[inc.month] || 'Current Month'} ${inc.year}`;

      let msg = `📈 *Company Monthly Income (${monthLabel})*\n\n`;
      msg += `• *Total Income Inflow:* ₹${inc.totalIncome.toLocaleString('en-IN')}\n`;
      msg += `• *Transactions:* ${inc.count}\n\n`;

      if (inc.sourceBreakdown && inc.sourceBreakdown.length > 0) {
        msg += `📊 *Sources Breakdown:*\n`;
        inc.sourceBreakdown.forEach((s) => {
          const pct = inc.totalIncome > 0 ? ((s.amount / inc.totalIncome) * 100).toFixed(1) : '0.0';
          msg += `• ${s.source}: ₹${s.amount.toLocaleString('en-IN')} (${pct}%)\n`;
        });
      }
      return msg;
    }

    // 11. Department Expenses query
    if (data.queryResults?.departmentExpenses) {
      const d = data.queryResults.departmentExpenses;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[d.month] || 'Current Month'} ${d.year}`;

      let msg = `🏢 *Department Expenses (${monthLabel})*\n\n`;
      if (d.targetDepartment) {
        msg += `• *Department:* ${d.targetDepartment}\n`;
        if (d.matchedDepartment) {
          msg += `• *Total Spent:* ₹${d.matchedDepartment.amount.toLocaleString('en-IN')}\n`;
          msg += `• *Transactions:* ${d.matchedDepartment.count}\n`;
          msg += `• *Company Share:* ${d.matchedDepartment.percentage}%\n`;
        } else {
          msg += `• *Total Spent:* ₹0\n`;
          msg += `No expenses recorded for department "${d.targetDepartment}".\n`;
        }
      } else {
        msg += `• *Total Spent Across Departments:* ₹${d.totalSpent.toLocaleString('en-IN')}\n`;
        msg += `• *Active Departments:* ${d.departmentCount}\n\n`;

        if (d.departments && d.departments.length > 0) {
          msg += `📊 *Department Breakdown:*\n`;
          d.departments.forEach((dept) => {
            msg += `• ${dept.department}: ₹${dept.amount.toLocaleString('en-IN')} (${dept.percentage}%, ${dept.count} tx)\n`;
          });
        }
      }
      return msg;
    }

    // 12. Vendor Expenses query
    if (data.queryResults?.vendorExpenses) {
      const v = data.queryResults.vendorExpenses;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[v.month] || 'Current Month'} ${v.year}`;

      let msg = `🏪 *Vendor Expenses (${monthLabel})*\n\n`;
      if (v.found === false) {
        msg += `No expenses recorded for vendor "${v.vendorName}".\n`;
        msg += `• *Total Spent:* ₹0\n`;
        return msg;
      }

      msg += `• *Total Vendor Expenses:* ₹${v.totalSpent.toLocaleString('en-IN')}\n`;
      msg += `• *Transactions:* ${v.count}\n\n`;

      if (v.vendorBreakdown && v.vendorBreakdown.length > 0) {
        msg += `📊 *Vendor Breakdown:*\n`;
        v.vendorBreakdown.forEach((vb) => {
          msg += `• ${vb.name}: ₹${vb.amount.toLocaleString('en-IN')} (${vb.count} tx)\n`;
        });
      }
      return msg;
    }

    // 3. Destructive confirmation
    if (data.requiresConfirmation) {
      return data.confirmationWarning;
    }

    if (data.resetExecuted) {
      return `🗑️ *${data.message}*`;
    }

    // Error handling
    if (data.actionResult?.error) {
      return `⚠️ ${data.actionResult.error}`;
    }
    if (data.queryResults?.error) {
      return `⚠️ ${data.queryResults.error}`;
    }

    // Profile query
    if (data.queryResults?.profile || data.actionResult?.userProfile) {
      const p = data.queryResults?.profile || data.actionResult?.userProfile;
      return (
        `👤 *Employee Profile*\n\n` +
        `• *Name:* ${p.name}\n` +
        `• *Username:* @${p.username || 'n/a'}\n` +
        `• *Role:* \`${p.role}\`\n` +
        `• *Department:* ${p.department}\n\n` +
        `ℹ️ _${p.roleDescription}_`
      );
    }

    // Role elevation inquiry
    if (data.queryResults?.roleElevation || data.actionResult?.roleElevation) {
      const r = data.queryResults?.roleElevation || data.actionResult?.roleElevation;
      let msg = `🔒 *Admin Access Policy*\n\n${r.message}\n\n`;
      if (r.admins && r.admins.length > 0) {
        msg += `👑 *Authorized Administrators to contact:*\n`;
        r.admins.forEach((a) => {
          msg += `• ${a}\n`;
        });
      }
      return msg;
    }

    // Budget updated confirmation
    if (data.actionResult?.budgetUpdated) {
      return `✅ *Monthly Budget Updated!*\n\nNew budget set to ₹${data.actionResult.amount?.toLocaleString('en-IN')}.`;
    }

    // Own expenses summary for normal employees
    if (data.queryResults?.ownSummary) {
      const s = data.queryResults.ownSummary;
      let msg = `📊 *Your Expenses This Month (${s.userName})*\n\n`;
      msg += `💰 *Your Total Spending:* ₹${s.totalSpent?.toLocaleString('en-IN')}\n`;
      msg += `🔢 *Your Transactions:* ${s.count}\n\n`;
      if (s.expenses && s.expenses.length > 0) {
        msg += `📝 *Your Recent Items:*\n`;
        s.expenses.forEach((e) => {
          msg += `• [${e.date}] ₹${e.amount?.toLocaleString('en-IN')} - ${e.note || e.category}\n`;
        });
        msg += `\n`;
      }
      msg += `ℹ️ _${s.message}_`;
      return msg;
    }

    // Budget status query
    if (data.queryResults?.budget) {
      const b = data.queryResults.budget;
      let msg = `💳 *Monthly Budget Status*\n\n`;
      if (b.hasBudget) {
        msg += `🎯 *Budget Target:* ₹${b.budgetAmount?.toLocaleString('en-IN')}\n`;
        msg += `💸 *Total Spent:* ₹${b.spentAmount?.toLocaleString('en-IN')}\n`;
        msg += `📊 *Usage:* ${b.percentageUsed?.toFixed(1)}%\n\n`;
      } else {
        msg += `⚠️ *No company budget has been set for this month yet.*\n\n`;
      }
      if (b.roleNotice) {
        msg += `ℹ️ _${b.roleNotice}_`;
      }
      return msg;
    }

    if (data.actionResult) {
      if (data.actionResult.deleted) {
        return `✅ Removed transaction #${data.actionResult.id} (₹${data.actionResult.amount?.toLocaleString('en-IN')} for ${data.actionResult.category}).`;
      }
      if (data.actionResult.updated) {
        return `✅ Updated transaction #${data.actionResult.id}. New amount: ₹${data.actionResult.newAmount?.toLocaleString('en-IN')}.`;
      }
      if (data.actionResult.generalQuestion) {
        return (
          `👋 I am your AI Financial Employee!\n\n` +
          `Here is what you can ask or tell me:\n` +
          `• *Check Balance:* "What is our balance?"\n` +
          `• *Record Expenses:* "Spent 500 on petrol" or "Petrol 500, Lunch 300"\n` +
          `• *Record Income:* "Received 50,000 from client"\n` +
          `• *View Reports:* "How much did we spend this month?"\n` +
          `• *Budget Status:* "What is our budget status?"\n` +
          `• *Voice Notes:* Send a voice note anytime!`
        );
      }
    }

    return data.message || 'Got it. Your financial records are up to date.';
  }
}
