/**
 * Database Seeder
 * Run: npm run seed
 * Populates DB with admin user + sample leads + activities
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Inline model requires to avoid circular issues
const User = require('../models/User');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Converted', 'Closed'];
const SOURCES  = ['Website', 'Referral', 'LinkedIn', 'Email Campaign', 'Cold Call', 'Trade Show'];

const sampleLeads = [
  { fullName: 'Amara Okonkwo',    email: 'amara@technova.io',         company: 'TechNova Inc',        phone: '+1 (400) 555-0101', source: 'LinkedIn',       status: 'Qualified',     priority: 'High',   dealValue: 12000, message: 'Interested in enterprise plan for 200 seats.' },
  { fullName: 'James Whitfield',  email: 'james@greenfield.co',       company: 'Greenfield Corp',     phone: '+1 (401) 555-0102', source: 'Referral',       status: 'Contacted',     priority: 'Medium', dealValue: 4500,  message: 'Replacing existing CRM, needs migration support.' },
  { fullName: 'Sofia Reyes',      email: 'sofia@atlas-solutions.com', company: 'Atlas Solutions',     phone: '+1 (402) 555-0103', source: 'Website',        status: 'New',           priority: 'Medium', dealValue: null,  message: 'Curious about the startup plan.' },
  { fullName: 'Liam Chen',        email: 'liam@bluewave.io',          company: 'BlueWave LLC',        phone: '+1 (403) 555-0104', source: 'Email Campaign', status: 'Proposal Sent', priority: 'High',   dealValue: 28000, message: 'Evaluating for Q3 rollout across 5 departments.' },
  { fullName: 'Priya Nair',       email: 'priya@summit.co',           company: 'Summit Dynamics',     phone: '+1 (404) 555-0105', source: 'Trade Show',     status: 'Converted',     priority: 'High',   dealValue: 15000, message: 'Met at SaaS Summit. Very interested in annual plan.' },
  { fullName: 'Marcus Webb',      email: 'marcus@orbit.systems',      company: 'Orbit Systems',       phone: '+1 (405) 555-0106', source: 'Cold Call',      status: 'Closed',        priority: 'Low',    dealValue: null,  message: 'Not the right time, revisit next year.' },
  { fullName: 'Hana Suzuki',      email: 'hana@vertexlabs.jp',        company: 'Vertex Labs',         phone: '+1 (406) 555-0107', source: 'LinkedIn',       status: 'New',           priority: 'Medium', dealValue: null,  message: 'Expanding to US market, needs team collaboration tools.' },
  { fullName: 'Tyler Brooks',     email: 'tyler@cedar-analytics.com', company: 'Cedar Analytics',     phone: '+1 (407) 555-0108', source: 'Referral',       status: 'Contacted',     priority: 'High',   dealValue: 9000,  message: 'Referred by Priya Nair at Summit Dynamics.' },
  { fullName: 'Elena Voronova',   email: 'elena@streamline.eu',       company: 'Streamline Co',       phone: '+1 (408) 555-0109', source: 'Website',        status: 'Qualified',     priority: 'Medium', dealValue: 6000,  message: 'Needs white-label option for reselling.' },
  { fullName: 'Raj Patel',        email: 'raj@primedge.in',           company: 'PrimeEdge',           phone: '+1 (409) 555-0110', source: 'Email Campaign', status: 'New',           priority: 'Low',    dealValue: null,  message: 'Annual contract inquiry, budget pending approval.' },
  { fullName: 'Mei-Lin Zhang',    email: 'meilin@fusiontech.cn',      company: 'FusionTech',          phone: '+1 (410) 555-0111', source: 'Trade Show',     status: 'Qualified',     priority: 'High',   dealValue: 22000, message: 'Looking for CRM with Mandarin localisation support.' },
  { fullName: 'Carlos Mendoza',   email: 'carlos@novabuild.mx',       company: 'NovaBuild',           phone: '+1 (411) 555-0112', source: 'Cold Call',      status: 'Contacted',     priority: 'Medium', dealValue: 5000,  message: 'Construction firm, 50 reps needing mobile-first CRM.' },
];

const seed = async () => {
  try {
    await connectDB();
    console.log('\n🌱  Starting NexusCRM database seed...\n');

    // Wipe existing data
    await Promise.all([
      User.deleteMany({}),
      Lead.deleteMany({}),
      Activity.deleteMany({}),
    ]);
    console.log('✅  Cleared existing collections');

    // ── Create users ──────────────────────────────────────────────────────────
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234!';
    const admin = await User.create({
      name:     process.env.SEED_ADMIN_NAME  || 'Admin User',
      email:    process.env.SEED_ADMIN_EMAIL || 'admin@nexuscrm.io',
      password: adminPassword,
      role:     'admin',
    });

    const reps = await User.insertMany([
      { name: 'Alice Johnson', email: 'alice@nexuscrm.io', password: 'Rep@1234!', role: 'sales_rep' },
      { name: 'Bob Martinez',  email: 'bob@nexuscrm.io',   password: 'Rep@1234!', role: 'sales_rep' },
      { name: 'Carol Lee',     email: 'carol@nexuscrm.io', password: 'Rep@1234!', role: 'manager'   },
      { name: 'David Kim',     email: 'david@nexuscrm.io', password: 'Rep@1234!', role: 'sales_rep' },
    ]);
    console.log(`✅  Created admin + ${reps.length} team members`);

    // ── Create leads spread over last 6 months ────────────────────────────────
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const leads = await Lead.insertMany(
      sampleLeads.map((l, i) => ({
        ...l,
        createdBy:  admin._id,
        assignedTo: reps[i % reps.length]._id,
        tags: i % 3 === 0 ? ['hot-lead'] : i % 3 === 1 ? ['follow-up'] : [],
        notes: i < 4
          ? [{
              content: 'Initial discovery call completed. Prospect is evaluating 2-3 vendors.',
              createdBy: admin._id,
              createdByName: admin.name,
              createdAt: new Date(now - (10 - i) * 14 * DAY + DAY),
            }]
          : [],
        createdAt: new Date(now - (12 - i) * 14 * DAY),
        updatedAt: new Date(now - i * 2 * DAY),
      }))
    );
    console.log(`✅  Created ${leads.length} sample leads`);

    // ── Seed activity log ─────────────────────────────────────────────────────
    const activities = leads.map((l) => ({
      action:          'lead_created',
      description:     `Lead created: ${l.fullName} from ${l.company}`,
      performedBy:     admin._id,
      performedByName: admin.name,
      lead:            l._id,
      leadName:        l.fullName,
      createdAt:       l.createdAt,
    }));

    // Add a few status-change activities
    activities.push(
      {
        action: 'lead_status_changed',
        description: `Status changed: Priya Nair — Qualified → Converted`,
        performedBy: reps[0]._id,
        performedByName: reps[0].name,
        lead: leads[4]._id,
        leadName: leads[4].fullName,
        metadata: { from: 'Qualified', to: 'Converted' },
        createdAt: new Date(now - 5 * DAY),
      },
      {
        action: 'note_added',
        description: `Note added to lead: Liam Chen`,
        performedBy: reps[1]._id,
        performedByName: reps[1].name,
        lead: leads[3]._id,
        leadName: leads[3].fullName,
        createdAt: new Date(now - 3 * DAY),
      }
    );

    await Activity.insertMany(activities);
    console.log(`✅  Activity log seeded (${activities.length} entries)`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉  Seed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin credentials:');
    console.log(`    Email   : ${admin.email}`);
    console.log(`    Password: ${adminPassword}`);
    console.log('  Sales rep credentials (all same password):');
    reps.forEach((r) => console.log(`    ${r.email}  /  Rep@1234!`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
