/**
 * CSV Exporter — converts lead array to CSV string
 */

'use strict';

const COLUMNS = [
  { key: 'fullName',    header: 'Full Name' },
  { key: 'email',       header: 'Email' },
  { key: 'phone',       header: 'Phone' },
  { key: 'company',     header: 'Company' },
  { key: 'status',      header: 'Status' },
  { key: 'source',      header: 'Source' },
  { key: 'priority',    header: 'Priority' },
  { key: 'assignedTo',  header: 'Assigned To' },
  { key: 'createdBy',   header: 'Created By' },
  { key: 'dealValue',   header: 'Deal Value ($)' },
  { key: 'message',     header: 'Message' },
  { key: 'tags',        header: 'Tags' },
  { key: 'noteCount',   header: 'Notes' },
  { key: 'createdAt',   header: 'Created At' },
  { key: 'updatedAt',   header: 'Updated At' },
];

const escape = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

const formatValue = (lead, key) => {
  const val = lead[key];
  switch (key) {
    case 'assignedTo': return val?.name || val || '';
    case 'createdBy':  return val?.name || val || '';
    case 'tags':       return Array.isArray(val) ? val.join('; ') : '';
    case 'noteCount':  return Array.isArray(lead.notes) ? lead.notes.length : 0;
    case 'createdAt':
    case 'updatedAt':  return val ? new Date(val).toISOString().replace('T', ' ').slice(0, 19) : '';
    case 'dealValue':  return val ?? '';
    default:           return val ?? '';
  }
};

const generateCSV = (leads) => {
  const header = COLUMNS.map((c) => escape(c.header)).join(',');
  const rows = leads.map((lead) =>
    COLUMNS.map((c) => escape(formatValue(lead, c.key))).join(',')
  );
  return [header, ...rows].join('\r\n');
};

module.exports = { generateCSV };
