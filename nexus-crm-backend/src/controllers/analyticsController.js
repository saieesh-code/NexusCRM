/**
 * Analytics Controller
 * Dashboard metrics, charts, pipeline insights
 */

'use strict';

const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { LEAD_STATUSES, LEAD_SOURCES } = require('../models/Lead');

// ─── GET /api/v1/analytics/dashboard ─────────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const baseFilter = req.user.role === 'sales_rep'
      ? { assignedTo: req.user._id }
      : {};

    const [
      totalLeads,
      statusCounts,
      sourceCounts,
      monthlyLeads,
      recentLeads,
      recentActivities,
    ] = await Promise.all([
      // Total count
      Lead.countDocuments(baseFilter),

      // Per-status counts
      Lead.aggregate([
        { $match: { isDeleted: { $ne: true }, ...baseFilter } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Per-source counts
      Lead.aggregate([
        { $match: { isDeleted: { $ne: true }, ...baseFilter } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Monthly leads — last 6 months
      Lead.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            createdAt: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 5, 1)),
            },
            ...baseFilter,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Latest 5 leads
      Lead.find(baseFilter)
        .sort('-createdAt')
        .limit(5)
        .populate('assignedTo', 'name email')
        .lean(),

      // Recent activities
      Activity.find({})
        .sort('-createdAt')
        .limit(10)
        .populate('performedBy', 'name avatar')
        .lean(),
    ]);

    // Map status counts to object
    const statusMap = {};
    LEAD_STATUSES.forEach((s) => (statusMap[s] = 0));
    statusCounts.forEach((s) => (statusMap[s._id] = s.count));

    // Fill missing months with 0
    const monthlyData = buildMonthlyData(monthlyLeads, 6);

    // Conversion rate
    const converted = statusMap['Converted'] || 0;
    const conversionRate = totalLeads > 0
      ? Math.round((converted / totalLeads) * 100 * 10) / 10
      : 0;

    // Top source
    const topSource = sourceCounts[0]?._id || null;

    // Deal value metrics
    const dealMetrics = await Lead.aggregate([
      { $match: { isDeleted: { $ne: true }, status: 'Converted', dealValue: { $ne: null } } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$dealValue' },
          avgValue: { $avg: '$dealValue' },
          count: { $sum: 1 },
        },
      },
    ]);

    const deals = dealMetrics[0] || { totalValue: 0, avgValue: 0, count: 0 };

    res.json({
      success: true,
      data: {
        summary: {
          total: totalLeads,
          new: statusMap['New'],
          contacted: statusMap['Contacted'],
          qualified: statusMap['Qualified'],
          proposalSent: statusMap['Proposal Sent'],
          converted: statusMap['Converted'],
          closed: statusMap['Closed'],
          inPipeline: totalLeads - statusMap['Converted'] - statusMap['Closed'],
          conversionRate,
          topSource,
          totalDealValue: Math.round(deals.totalValue),
          avgDealValue: Math.round(deals.avgValue),
        },
        statusDistribution: statusMap,
        sourceDistribution: sourceCounts,
        monthlyTrend: monthlyData,
        recentLeads,
        recentActivities,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/funnel ─────────────────────────────────────────────
exports.getFunnel = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { isDeleted: { $ne: true } };
    if (startDate) match.createdAt = { $gte: new Date(startDate) };
    if (endDate) match.createdAt = { ...match.createdAt, $lte: new Date(endDate) };

    const counts = await Lead.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const funnel = {};
    LEAD_STATUSES.forEach((s) => (funnel[s] = 0));
    counts.forEach((c) => (funnel[c._id] = c.count));

    // Calculate drop-off rates
    const stages = LEAD_STATUSES.map((status, i) => ({
      status,
      count: funnel[status],
      dropOff: i > 0 && funnel[LEAD_STATUSES[i - 1]] > 0
        ? Math.round((1 - funnel[status] / funnel[LEAD_STATUSES[i - 1]]) * 100)
        : 0,
    }));

    res.json({ success: true, data: stages });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/rep-performance ────────────────────────────────────
exports.getRepPerformance = async (req, res, next) => {
  try {
    const performance = await Lead.aggregate([
      { $match: { isDeleted: { $ne: true }, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] },
          },
          totalDealValue: {
            $sum: { $ifNull: ['$dealValue', 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'rep',
        },
      },
      { $unwind: { path: '$rep', preserveNullAndEmpty: true } },
      {
        $project: {
          name: '$rep.name',
          email: '$rep.email',
          total: 1,
          converted: 1,
          conversionRate: {
            $round: [
              { $multiply: [{ $divide: ['$converted', { $max: ['$total', 1] }] }, 100] },
              1,
            ],
          },
          totalDealValue: 1,
        },
      },
      { $sort: { converted: -1 } },
    ]);

    res.json({ success: true, data: performance });
  } catch (err) {
    next(err);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMonthlyData(aggregated, months) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const found = aggregated.find(
      (d) => d._id.year === year && d._id.month === month
    );

    result.push({
      year,
      month,
      label: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
      count: found ? found.count : 0,
    });
  }

  return result;
}
