/*
 * Demo seed. Creates three fictional agencies with clearly different data so
 * tenant isolation is easy to verify in the UI:
 *   - BrightWave Digital  (active)
 *   - NorthStar Creative  (active)
 *   - Pixel Harbor Studio (suspended)
 *
 * Every account uses the password DEMO_PASSWORD. Dates are relative to "today"
 * so overdue / due-soon states always look realistic.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PrismaClient,
  type ActivityVisibility,
  type AgencyPlan,
  type FeedbackStatus,
  type MilestoneStatus,
  type Prisma,
  type Priority,
  type ProjectStatus,
  type Role,
  type TaskStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { makeMockupPng, makePdf, makeText } from './demoFiles';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Demo@12345';
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
const bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 12;

const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
/** Date-only value `offset` days from today. */
const day = (offset: number) => new Date(today.getTime() + offset * DAY);
/** Timestamp `offset` days from today at `hour` UTC, never in the future. */
const at = (offset: number, hour = 10) =>
  new Date(Math.min(today.getTime() + offset * DAY + hour * HOUR, now.getTime() - 5 * 60_000));

// ----- Seed data types ---------------------------------------------------------

interface TeamSeed {
  key: string;
  name: string;
  email: string;
  role: Extract<Role, 'AGENCY_ADMIN' | 'AGENCY_MEMBER'>;
  jobTitle: string;
}
interface ClientSeed {
  key: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  portalUser?: { key: string; name: string; email: string };
}
interface MilestoneSeed {
  name: string;
  status: MilestoneStatus;
  due: number;
  description?: string;
}
interface TaskSeed {
  title: string;
  milestone?: string;
  status: TaskStatus;
  priority?: Priority;
  assignee?: string;
  due?: number;
  clientVisible?: boolean;
  description?: string;
  comments?: { author: string; content: string; daysAgo: number }[];
}
interface MeetingSeed {
  title: string;
  daysAgo: number;
  clientVisible: boolean;
  notes: string;
  summary?: string;
}
interface FeedbackSeed {
  title: string;
  description: string;
  submittedBy: string;
  status: FeedbackStatus;
  daysAgo: number;
  comments?: { author: string; content: string; daysAgo: number }[];
}
interface FileSeed {
  name: string;
  uploadedBy: string;
  clientVisible: boolean;
  daysAgo: number;
  content: Buffer;
  mimeType: string;
}
interface ProjectSeed {
  name: string;
  client: string;
  manager: string;
  status: ProjectStatus;
  priority: Priority;
  start: number;
  due: number;
  createdDaysAgo: number;
  description: string;
  milestones: MilestoneSeed[];
  tasks: TaskSeed[];
  meetings?: MeetingSeed[];
  feedback?: FeedbackSeed[];
  files?: FileSeed[];
}
interface AgencySeed {
  name: string;
  slug: string;
  contactEmail: string;
  phone: string;
  website: string;
  plan: AgencyPlan;
  suspended?: { daysAgo: number; reason: string };
  createdDaysAgo: number;
  team: TeamSeed[];
  clients: ClientSeed[];
  projects: ProjectSeed[];
}

// ----- Demo data -----------------------------------------------------------------

const pdf = (title: string, ...lines: string[]) => ({ content: makePdf(title, lines), mimeType: 'application/pdf' });
const csv = (...lines: string[]) => ({ content: makeText(lines), mimeType: 'text/csv' });
const txt = (...lines: string[]) => ({ content: makeText(lines), mimeType: 'text/plain' });
const png = (accent: [number, number, number]) => ({ content: makeMockupPng(accent), mimeType: 'image/png' });

const brightwave: AgencySeed = {
  name: 'BrightWave Digital',
  slug: 'brightwave-digital',
  contactEmail: 'hello@brightwave-demo.com',
  phone: '+1 555 0100',
  website: 'https://brightwave-demo.com',
  plan: 'GROWTH',
  createdDaysAgo: 120,
  team: [
    {
      key: 'maya',
      name: 'Maya Chen',
      email: 'agencyadmin@brightwave-demo.com',
      role: 'AGENCY_ADMIN',
      jobTitle: 'Founder & Creative Director',
    },
    {
      key: 'leo',
      name: 'Leo Martins',
      email: 'team@brightwave-demo.com',
      role: 'AGENCY_MEMBER',
      jobTitle: 'Project Manager',
    },
    {
      key: 'priya',
      name: 'Priya Nair',
      email: 'priya@brightwave-demo.com',
      role: 'AGENCY_MEMBER',
      jobTitle: 'Senior Developer',
    },
    { key: 'sam', name: 'Sam Ortiz', email: 'sam@brightwave-demo.com', role: 'AGENCY_MEMBER', jobTitle: 'UI Designer' },
  ],
  clients: [
    {
      key: 'acme',
      companyName: 'Acme Corporation',
      contactName: 'Jordan Blake',
      email: 'client@acme-demo.com',
      phone: '+1 555 0142',
      notes: 'Prefers weekly status emails on Fridays. Decision maker for design sign-off is Jordan.',
      portalUser: { key: 'jordan', name: 'Jordan Blake', email: 'client@acme-demo.com' },
    },
    {
      key: 'umbrella',
      companyName: 'Umbrella Health',
      contactName: 'Riley Park',
      email: 'client@umbrella-demo.com',
      phone: '+1 555 0177',
      notes: 'Healthcare client: all deliverables need an accessibility review (WCAG 2.2 AA).',
      portalUser: { key: 'riley', name: 'Riley Park', email: 'client@umbrella-demo.com' },
    },
    {
      key: 'summit',
      companyName: 'Summit Outdoor Co.',
      contactName: 'Alex Rivera',
      email: 'alex@summit-outdoor-demo.com',
      phone: '+1 555 0190',
      notes: 'Seasonal retailer. Launch must land before the winter catalogue.',
    },
  ],
  projects: [
    {
      name: 'Website Redesign',
      client: 'acme',
      manager: 'leo',
      status: 'ACTIVE',
      priority: 'HIGH',
      start: -40,
      due: 28,
      createdDaysAgo: 42,
      description:
        'Full redesign of acmecorp.example: new information architecture, design system, responsive build on a headless CMS and a product catalogue.',
      milestones: [
        {
          name: 'Planning',
          status: 'COMPLETED',
          due: -30,
          description: 'Discovery, stakeholder interviews and sitemap.',
        },
        { name: 'Design', status: 'COMPLETED', due: -12, description: 'Wireframes, visual design system and mockups.' },
        { name: 'Development', status: 'IN_PROGRESS', due: 10, description: 'Responsive build and CMS integration.' },
        { name: 'Testing', status: 'PENDING', due: 18 },
        { name: 'Client Review', status: 'PENDING', due: 22 },
        { name: 'Launch', status: 'PENDING', due: 28 },
      ],
      tasks: [
        { title: 'Stakeholder interviews', milestone: 'Planning', status: 'COMPLETED', assignee: 'leo', due: -33 },
        { title: 'Sitemap & content inventory', milestone: 'Planning', status: 'COMPLETED', assignee: 'leo', due: -30 },
        {
          title: 'Homepage wireframes',
          milestone: 'Design',
          status: 'COMPLETED',
          assignee: 'sam',
          due: -20,
          priority: 'HIGH',
        },
        { title: 'Visual design system', milestone: 'Design', status: 'COMPLETED', assignee: 'sam', due: -12 },
        {
          title: 'Approve homepage mockups',
          milestone: 'Design',
          status: 'COMPLETED',
          due: -10,
          clientVisible: true,
          description: 'Client sign-off on the final homepage and product page mockups.',
        },
        {
          title: 'Build responsive homepage',
          milestone: 'Development',
          status: 'IN_PROGRESS',
          assignee: 'priya',
          due: -2,
          priority: 'HIGH',
          comments: [
            {
              author: 'priya',
              content: 'Hero and navigation are done. Waiting on final product copy for the feature grid.',
              daysAgo: 2,
            },
            {
              author: 'leo',
              content: 'Chasing Acme for the copy today. Please use placeholder copy so QA can start.',
              daysAgo: 1,
            },
          ],
        },
        {
          title: 'Implement CMS integration',
          milestone: 'Development',
          status: 'TODO',
          assignee: 'priya',
          due: -1,
          priority: 'URGENT',
        },
        { title: 'Product listing pages', milestone: 'Development', status: 'IN_PROGRESS', assignee: 'priya', due: 6 },
        {
          title: 'Provide final product copy',
          milestone: 'Development',
          status: 'TODO',
          due: 3,
          clientVisible: true,
          priority: 'HIGH',
          description: 'Acme to send final marketing copy for the homepage feature grid and 12 product pages.',
        },
        { title: 'Cross-browser QA', milestone: 'Testing', status: 'TODO', due: 18 },
      ],
      meetings: [
        {
          title: 'Project kickoff',
          daysAgo: 38,
          clientVisible: true,
          notes:
            'Attendees: Jordan (Acme), Maya, Leo. Goals: modernise brand, improve lead conversion, make product catalogue editable by Acme. Agreed 6 milestones. Jordan owns content sign-off. Budget approved.',
          summary:
            'We kicked off the Website Redesign and agreed on goals: a modern brand presence, higher lead conversion and a catalogue Acme can edit.\n\nKey decisions:\n- Six milestones from Planning to Launch\n- Jordan Blake signs off on content\n\nAction items:\n- BrightWave to deliver sitemap within two weeks',
        },
        {
          title: 'Design review',
          daysAgo: 11,
          clientVisible: true,
          notes:
            'Walked through homepage + product mockups. Jordan approved with minor tweaks to hero imagery. Pricing table requested.',
          summary:
            'Homepage and product page mockups were approved with minor tweaks to hero imagery.\n\nKey decisions:\n- Mockups approved\n\nAction items:\n- Explore a pricing comparison table (tracked as feedback)',
        },
        {
          title: 'Internal sprint sync',
          daysAgo: 2,
          clientVisible: false,
          notes:
            'INTERNAL: Priya is overloaded; CMS integration slipping. Consider moving product listing pages to Sam. Do not share revised estimate with client yet.',
        },
      ],
      feedback: [
        {
          title: 'Homepage hero image feels generic',
          description:
            'The stock photo in the hero does not represent our products. Could we use photography from our factory instead?',
          submittedBy: 'jordan',
          status: 'OPEN',
          daysAgo: 2,
        },
        {
          title: 'Add a pricing comparison table',
          description:
            'Customers keep asking how our three plans differ. A comparison table on the pricing page would help.',
          submittedBy: 'jordan',
          status: 'IN_PROGRESS',
          daysAgo: 9,
          comments: [
            {
              author: 'leo',
              content: 'Great idea. Sam is designing a comparison component; we will share a draft this week.',
              daysAgo: 8,
            },
            { author: 'jordan', content: 'Thanks! Please include the enterprise tier as well.', daysAgo: 7 },
          ],
        },
      ],
      files: [
        {
          name: 'Website-Sitemap-v2.pdf',
          uploadedBy: 'leo',
          clientVisible: true,
          daysAgo: 29,
          ...pdf('Acme Website Sitemap v2', 'Home', 'Products (12 pages)', 'Pricing', 'About', 'Contact'),
        },
        { name: 'Homepage-Mockup.png', uploadedBy: 'sam', clientVisible: true, daysAgo: 12, ...png([37, 99, 235]) },
        {
          name: 'Internal-Estimate.csv',
          uploadedBy: 'maya',
          clientVisible: false,
          daysAgo: 41,
          ...csv('phase,hours,rate', 'Planning,40,120', 'Design,90,120', 'Development,220,130', 'QA,50,110'),
        },
        {
          name: 'Product-Copy-Draft.txt',
          uploadedBy: 'jordan',
          clientVisible: true,
          daysAgo: 1,
          ...txt('Acme product copy draft', '', 'Industrial widgets built to last.'),
        },
      ],
    },
    {
      name: 'SEO Campaign',
      client: 'acme',
      manager: 'maya',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      start: -20,
      due: 60,
      createdDaysAgo: 21,
      description: 'Six-month organic growth campaign: technical fixes, keyword strategy and content optimisation.',
      milestones: [
        { name: 'Technical Audit', status: 'COMPLETED', due: -12 },
        { name: 'Keyword Strategy', status: 'IN_PROGRESS', due: 5 },
        { name: 'Content Optimization', status: 'PENDING', due: 35 },
        { name: 'Reporting', status: 'PENDING', due: 60 },
      ],
      tasks: [
        {
          title: 'Technical SEO audit',
          milestone: 'Technical Audit',
          status: 'COMPLETED',
          assignee: 'priya',
          due: -14,
        },
        {
          title: 'Competitor keyword research',
          milestone: 'Keyword Strategy',
          status: 'COMPLETED',
          assignee: 'maya',
          due: -6,
        },
        {
          title: 'Keyword-to-page mapping',
          milestone: 'Keyword Strategy',
          status: 'IN_PROGRESS',
          assignee: 'maya',
          due: -3,
        },
        {
          title: 'Rewrite meta titles & descriptions',
          milestone: 'Content Optimization',
          status: 'TODO',
          assignee: 'leo',
          due: 10,
        },
        { title: 'Blog content calendar', milestone: 'Content Optimization', status: 'TODO', due: 14 },
        {
          title: 'Monthly ranking report',
          milestone: 'Reporting',
          status: 'TODO',
          assignee: 'maya',
          due: 30,
          clientVisible: true,
        },
      ],
      feedback: [
        {
          title: "Can we target 'industrial widgets'?",
          description: 'Our sales team says most leads search for "industrial widgets". Can this be a primary keyword?',
          submittedBy: 'jordan',
          status: 'IN_REVIEW',
          daysAgo: 4,
          comments: [
            {
              author: 'maya',
              content: 'Checking search volume and difficulty now. We will confirm in the keyword report.',
              daysAgo: 3,
            },
          ],
        },
      ],
    },
    {
      name: 'Patient Portal UX Audit',
      client: 'umbrella',
      manager: 'leo',
      status: 'ACTIVE',
      priority: 'HIGH',
      start: -25,
      due: 9,
      createdDaysAgo: 26,
      description:
        'Usability and accessibility audit of the Umbrella Health patient portal with prioritised recommendations.',
      milestones: [
        { name: 'Research', status: 'COMPLETED', due: -15 },
        { name: 'Usability Testing', status: 'COMPLETED', due: -4 },
        { name: 'Recommendations', status: 'IN_PROGRESS', due: 7 },
      ],
      tasks: [
        { title: 'Heuristic evaluation', milestone: 'Research', status: 'COMPLETED', assignee: 'sam', due: -17 },
        {
          title: 'Recruit test participants',
          milestone: 'Usability Testing',
          status: 'COMPLETED',
          assignee: 'leo',
          due: -10,
        },
        {
          title: 'Run usability sessions',
          milestone: 'Usability Testing',
          status: 'COMPLETED',
          assignee: 'sam',
          due: -4,
        },
        { title: 'Synthesize findings', milestone: 'Recommendations', status: 'IN_PROGRESS', assignee: 'sam', due: 4 },
        {
          title: 'Recommendations deck',
          milestone: 'Recommendations',
          status: 'TODO',
          assignee: 'leo',
          due: 8,
          priority: 'HIGH',
        },
      ],
      meetings: [
        {
          title: 'Usability findings readout',
          daysAgo: 3,
          clientVisible: true,
          notes: 'Shared top 5 findings. Riley concerned about button contrast and appointment booking flow.',
          summary:
            'We presented the top usability findings. The appointment booking flow and button contrast are the highest priorities.\n\nAction items:\n- BrightWave to include mobile findings in the final deck',
        },
      ],
      feedback: [
        {
          title: 'Contrast on appointment buttons',
          description: 'Some patients reported that the grey appointment buttons are hard to read.',
          submittedBy: 'riley',
          status: 'RESOLVED',
          daysAgo: 15,
          comments: [
            {
              author: 'sam',
              content: 'Updated to meet WCAG AA (4.8:1 contrast). Included in the audit appendix.',
              daysAgo: 13,
            },
          ],
        },
        {
          title: 'Include mobile findings in the deck',
          description: 'Most of our patients use phones. Please add a dedicated section for mobile issues.',
          submittedBy: 'riley',
          status: 'OPEN',
          daysAgo: 1,
        },
      ],
      files: [
        {
          name: 'Usability-Findings-Summary.pdf',
          uploadedBy: 'sam',
          clientVisible: true,
          daysAgo: 3,
          ...pdf(
            'Patient Portal - Findings',
            '1. Booking flow has 7 steps',
            '2. Button contrast below AA',
            '3. Session timeout too short',
          ),
        },
      ],
    },
    {
      name: 'Brand Refresh',
      client: 'umbrella',
      manager: 'sam',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      start: -90,
      due: -30,
      createdDaysAgo: 92,
      description: 'Refreshed logo, palette and typography for Umbrella Health.',
      milestones: [
        { name: 'Discovery', status: 'COMPLETED', due: -80 },
        { name: 'Design', status: 'COMPLETED', due: -50 },
        { name: 'Handover', status: 'COMPLETED', due: -31 },
      ],
      tasks: [
        { title: 'Brand discovery workshop', milestone: 'Discovery', status: 'COMPLETED', assignee: 'maya', due: -82 },
        { title: 'Logo refinements', milestone: 'Design', status: 'COMPLETED', assignee: 'sam', due: -55 },
        { title: 'Accessible colour palette', milestone: 'Design', status: 'COMPLETED', assignee: 'sam', due: -50 },
        { title: 'Brand guidelines handover', milestone: 'Handover', status: 'COMPLETED', assignee: 'sam', due: -31 },
      ],
    },
    {
      name: 'E-commerce Launch',
      client: 'summit',
      manager: 'priya',
      status: 'ACTIVE',
      priority: 'URGENT',
      start: -60,
      due: -3,
      createdDaysAgo: 61,
      description: 'Launch of the Summit Outdoor online store with 1,200 SKUs, payments and shipping rules.',
      milestones: [
        { name: 'Platform Setup', status: 'COMPLETED', due: -40 },
        { name: 'Catalog Migration', status: 'IN_PROGRESS', due: -10 },
        { name: 'Payments & Shipping', status: 'PENDING', due: -4 },
        { name: 'Launch', status: 'PENDING', due: -3 },
      ],
      tasks: [
        {
          title: 'Store platform setup',
          milestone: 'Platform Setup',
          status: 'COMPLETED',
          assignee: 'priya',
          due: -42,
        },
        { title: 'Theme customization', milestone: 'Platform Setup', status: 'COMPLETED', assignee: 'sam', due: -38 },
        {
          title: 'Migrate 1,200 SKUs',
          milestone: 'Catalog Migration',
          status: 'IN_PROGRESS',
          assignee: 'priya',
          due: -8,
          priority: 'URGENT',
        },
        {
          title: 'Configure payment gateway',
          milestone: 'Payments & Shipping',
          status: 'TODO',
          assignee: 'priya',
          due: -4,
          priority: 'HIGH',
        },
        { title: 'Shipping rules by region', milestone: 'Payments & Shipping', status: 'TODO', due: -1 },
        { title: 'Launch checklist', milestone: 'Launch', status: 'TODO', assignee: 'leo', due: 2 },
      ],
      meetings: [
        {
          title: 'Launch risk review',
          daysAgo: 1,
          clientVisible: false,
          notes:
            'Catalogue migration 60% done. Payment gateway blocked on Summit providing merchant account details. Launch date will slip ~2 weeks.',
        },
      ],
      files: [
        {
          name: 'SKU-Migration-Tracker.csv',
          uploadedBy: 'priya',
          clientVisible: false,
          daysAgo: 5,
          ...csv('batch,skus,status', '1,400,done', '2,400,in progress', '3,400,not started'),
        },
      ],
    },
  ],
};

const northstar: AgencySeed = {
  name: 'NorthStar Creative',
  slug: 'northstar-creative',
  contactEmail: 'studio@northstar-demo.com',
  phone: '+44 20 7946 0000',
  website: 'https://northstar-demo.com',
  plan: 'ENTERPRISE',
  createdDaysAgo: 95,
  team: [
    {
      key: 'daniel',
      name: 'Daniel Okafor',
      email: 'agencyadmin@northstar-demo.com',
      role: 'AGENCY_ADMIN',
      jobTitle: 'Managing Director',
    },
    {
      key: 'sofia',
      name: 'Sofia Rossi',
      email: 'team@northstar-demo.com',
      role: 'AGENCY_MEMBER',
      jobTitle: 'Brand Strategist',
    },
    {
      key: 'kenji',
      name: 'Kenji Watanabe',
      email: 'kenji@northstar-demo.com',
      role: 'AGENCY_MEMBER',
      jobTitle: 'Motion Designer',
    },
  ],
  clients: [
    {
      key: 'globex',
      companyName: 'Globex Industries',
      contactName: 'Casey Morgan',
      email: 'client@globex-demo.com',
      phone: '+44 20 7946 0101',
      notes: 'Rebrand ahead of an investor day. Board approval needed for the final logo.',
      portalUser: { key: 'casey', name: 'Casey Morgan', email: 'client@globex-demo.com' },
    },
    {
      key: 'initech',
      companyName: 'Initech Software',
      contactName: 'Taylor Reed',
      email: 'client@initech-demo.com',
      phone: '+44 20 7946 0155',
      notes: 'SaaS product launch. Video must be ready for the conference keynote.',
      portalUser: { key: 'taylor', name: 'Taylor Reed', email: 'client@initech-demo.com' },
    },
  ],
  projects: [
    {
      name: 'Brand Identity',
      client: 'globex',
      manager: 'sofia',
      status: 'ACTIVE',
      priority: 'HIGH',
      start: -30,
      due: 20,
      createdDaysAgo: 31,
      description: 'New brand identity for Globex: positioning, logo, colour, typography and brand guidelines.',
      milestones: [
        { name: 'Discovery', status: 'COMPLETED', due: -22 },
        { name: 'Concepts', status: 'COMPLETED', due: -8 },
        { name: 'Refinement', status: 'IN_PROGRESS', due: 5 },
        { name: 'Brand Guidelines', status: 'PENDING', due: 20 },
      ],
      tasks: [
        { title: 'Brand workshop', milestone: 'Discovery', status: 'COMPLETED', assignee: 'sofia', due: -27 },
        { title: 'Competitor brand audit', milestone: 'Discovery', status: 'COMPLETED', assignee: 'sofia', due: -22 },
        { title: 'Logo concepts (3 routes)', milestone: 'Concepts', status: 'COMPLETED', assignee: 'kenji', due: -9 },
        { title: 'Colour palette', milestone: 'Refinement', status: 'IN_PROGRESS', assignee: 'kenji', due: 2 },
        { title: 'Typography system', milestone: 'Refinement', status: 'TODO', assignee: 'sofia', due: 6 },
        {
          title: 'Choose final logo direction',
          milestone: 'Refinement',
          status: 'TODO',
          due: 3,
          clientVisible: true,
          priority: 'HIGH',
          description: 'Globex board to pick one of the three logo routes.',
        },
        { title: 'Brand guidelines PDF', milestone: 'Brand Guidelines', status: 'TODO', assignee: 'sofia', due: 18 },
      ],
      meetings: [
        {
          title: 'Brand workshop',
          daysAgo: 28,
          clientVisible: true,
          notes: 'Values: bold, trustworthy, global. Audience: investors and enterprise buyers.',
          summary:
            'We defined the Globex brand values (bold, trustworthy, global) and primary audiences (investors and enterprise buyers).',
        },
        {
          title: 'Concept presentation',
          daysAgo: 8,
          clientVisible: true,
          notes: 'Presented three logo routes. Casey leaning towards route B but concerned it is too corporate.',
          summary:
            'Three logo routes were presented. Globex will choose a final direction with its board.\n\nAction items:\n- Globex to confirm the final logo direction',
        },
        {
          title: 'Internal creative review',
          daysAgo: 3,
          clientVisible: false,
          notes: 'INTERNAL: Kenji needs two more days on palette. Budget 15% over on concepts phase.',
        },
      ],
      feedback: [
        {
          title: 'Logo concept B feels too corporate',
          description: 'We like the structure of concept B but it feels a bit cold. Can we explore warmer colours?',
          submittedBy: 'casey',
          status: 'IN_REVIEW',
          daysAgo: 6,
          comments: [
            {
              author: 'sofia',
              content: 'Kenji is exploring two warmer palettes for route B. Expect them on Thursday.',
              daysAgo: 5,
            },
          ],
        },
        {
          title: 'Add brand voice guidelines',
          description: 'Could the guidelines include a tone-of-voice section for our marketing team?',
          submittedBy: 'casey',
          status: 'OPEN',
          daysAgo: 2,
        },
      ],
      files: [
        {
          name: 'Brand-Concepts-Presentation.pdf',
          uploadedBy: 'sofia',
          clientVisible: true,
          daysAgo: 8,
          ...pdf('Globex Brand Concepts', 'Route A - Horizon', 'Route B - Meridian', 'Route C - Orbit'),
        },
        {
          name: 'Globex-Budget-Tracking.csv',
          uploadedBy: 'daniel',
          clientVisible: false,
          daysAgo: 20,
          ...csv('phase,budget,spent', 'Discovery,8000,7600', 'Concepts,12000,13800'),
        },
      ],
    },
    {
      name: 'Marketing Website',
      client: 'globex',
      manager: 'daniel',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      start: -10,
      due: 45,
      createdDaysAgo: 11,
      description: 'Marketing website to launch the new Globex brand.',
      milestones: [
        { name: 'Planning', status: 'IN_PROGRESS', due: 5 },
        { name: 'Design', status: 'PENDING', due: 20 },
        { name: 'Build', status: 'PENDING', due: 38 },
        { name: 'Launch', status: 'PENDING', due: 45 },
      ],
      tasks: [
        { title: 'Moodboard', milestone: 'Planning', status: 'COMPLETED', assignee: 'kenji', due: -5 },
        { title: 'Content strategy', milestone: 'Planning', status: 'IN_PROGRESS', assignee: 'sofia', due: 4 },
        { title: 'Site architecture', milestone: 'Planning', status: 'TODO', assignee: 'daniel', due: 7 },
        { title: 'Hosting & domain setup', milestone: 'Build', status: 'TODO', due: 20 },
        {
          title: 'Share product photography',
          milestone: 'Planning',
          status: 'TODO',
          due: -1,
          clientVisible: true,
          description: 'Globex to share high-resolution product photography for the website.',
        },
      ],
    },
    {
      name: 'Product Launch Video',
      client: 'initech',
      manager: 'kenji',
      status: 'ACTIVE',
      priority: 'HIGH',
      start: -15,
      due: 12,
      createdDaysAgo: 16,
      description: '90-second animated launch video for the Initech keynote.',
      milestones: [
        { name: 'Script', status: 'COMPLETED', due: -8 },
        { name: 'Storyboard', status: 'IN_PROGRESS', due: 1 },
        { name: 'Animation', status: 'PENDING', due: 9 },
        { name: 'Delivery', status: 'PENDING', due: 12 },
      ],
      tasks: [
        { title: 'Script draft', milestone: 'Script', status: 'COMPLETED', assignee: 'sofia', due: -9 },
        { title: 'Voiceover casting', milestone: 'Script', status: 'COMPLETED', assignee: 'kenji', due: -6 },
        { title: 'Storyboard frames', milestone: 'Storyboard', status: 'IN_PROGRESS', assignee: 'kenji', due: -1 },
        { title: 'Animatic', milestone: 'Animation', status: 'TODO', assignee: 'kenji', due: 5 },
        { title: 'Final render & captions', milestone: 'Delivery', status: 'TODO', assignee: 'kenji', due: 11 },
      ],
      meetings: [
        {
          title: 'Video kickoff',
          daysAgo: 14,
          clientVisible: true,
          notes: 'Keynote on stage in 4 weeks. Must work without sound (captions).',
          summary: 'Kickoff for the launch video. It must work without sound, so captions are included.',
        },
      ],
      feedback: [
        {
          title: 'Can the video include captions?',
          description: 'The keynote hall is loud; please make sure the video works without sound.',
          submittedBy: 'taylor',
          status: 'RESOLVED',
          daysAgo: 12,
          comments: [
            { author: 'kenji', content: 'Yes - burned-in captions are now part of the final render.', daysAgo: 11 },
          ],
        },
      ],
      files: [
        {
          name: 'Video-Script-v3.txt',
          uploadedBy: 'sofia',
          clientVisible: true,
          daysAgo: 8,
          ...txt('Initech Launch Video - Script v3', '', 'Scene 1: The problem.', 'Scene 2: Meet Initech.'),
        },
      ],
    },
  ],
};

const pixelHarbor: AgencySeed = {
  name: 'Pixel Harbor Studio',
  slug: 'pixel-harbor-studio',
  contactEmail: 'hi@pixelharbor-demo.com',
  phone: '+61 2 5550 1234',
  website: 'https://pixelharbor-demo.com',
  plan: 'STARTER',
  createdDaysAgo: 60,
  suspended: { daysAgo: 5, reason: 'Subscription payment overdue - account under review' },
  team: [
    {
      key: 'morgan',
      name: 'Morgan Lee',
      email: 'agencyadmin@pixelharbor-demo.com',
      role: 'AGENCY_ADMIN',
      jobTitle: 'Studio Lead',
    },
  ],
  clients: [
    {
      key: 'harbor',
      companyName: 'Harbor Coffee Roasters',
      contactName: 'Jamie Fox',
      email: 'client@harborcoffee-demo.com',
      phone: '+61 2 5550 9876',
      notes: 'Small roastery, packaging refresh.',
      portalUser: { key: 'jamie', name: 'Jamie Fox', email: 'client@harborcoffee-demo.com' },
    },
  ],
  projects: [
    {
      name: 'Menu & Packaging Design',
      client: 'harbor',
      manager: 'morgan',
      status: 'ACTIVE',
      priority: 'LOW',
      start: -30,
      due: 15,
      createdDaysAgo: 31,
      description: 'New café menu boards and coffee bag packaging.',
      milestones: [
        { name: 'Concepts', status: 'COMPLETED', due: -15 },
        { name: 'Final Artwork', status: 'IN_PROGRESS', due: 10 },
      ],
      tasks: [
        { title: 'Packaging concepts', milestone: 'Concepts', status: 'COMPLETED', assignee: 'morgan', due: -16 },
        { title: 'Menu board layout', milestone: 'Final Artwork', status: 'IN_PROGRESS', assignee: 'morgan', due: 5 },
        { title: 'Print-ready files', milestone: 'Final Artwork', status: 'TODO', assignee: 'morgan', due: 12 },
      ],
    },
  ],
};

// ----- Seeding helpers -------------------------------------------------------------

async function resetDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.supportSession.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.feedbackComment.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();
  await prisma.agency.updateMany({ data: { ownerId: null } });
  await prisma.agencyMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.agency.deleteMany();
}

async function resetUploads() {
  await mkdir(uploadDir, { recursive: true });
  const stored = await readdir(uploadDir);
  const managed = /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;
  await Promise.all(
    stored.filter((name) => managed.test(name)).map((name) => rm(path.join(uploadDir, name), { force: true })),
  );
}

type ActivityRow = Prisma.ActivityLogCreateManyInput;

async function seedAgency(seed: AgencySeed, superAdminId: string, passwordHash: string) {
  const activities: ActivityRow[] = [];
  const log = (row: Omit<ActivityRow, 'actorType'> & { actorType?: ActivityRow['actorType'] }) =>
    activities.push({ actorType: 'USER', visibility: 'INTERNAL', ...row });

  const users = new Map<string, string>();
  const agencyCreatedAt = at(-seed.createdDaysAgo, 9);

  // Owner first (agency.ownerId references a user)
  const [ownerSeed, ...otherTeam] = seed.team;
  const owner = await prisma.user.create({
    data: {
      name: ownerSeed.name,
      email: ownerSeed.email,
      passwordHash,
      role: ownerSeed.role,
      createdAt: agencyCreatedAt,
      lastLoginAt: at(-1, 8),
    },
  });
  users.set(ownerSeed.key, owner.id);

  const agency = await prisma.agency.create({
    data: {
      name: seed.name,
      slug: seed.slug,
      contactEmail: seed.contactEmail,
      phone: seed.phone,
      website: seed.website,
      plan: seed.plan,
      status: seed.suspended ? 'SUSPENDED' : 'ACTIVE',
      suspendedAt: seed.suspended ? at(-seed.suspended.daysAgo, 14) : null,
      ownerId: owner.id,
      createdAt: agencyCreatedAt,
      members: { create: { userId: owner.id, jobTitle: ownerSeed.jobTitle, createdAt: agencyCreatedAt } },
    },
  });
  const agencyId = agency.id;

  log({
    agencyId,
    actorId: superAdminId,
    actorType: 'SUPER_ADMIN',
    eventType: 'agency.created',
    entityType: 'agency',
    entityId: agencyId,
    metadata: { agencyName: seed.name, plan: seed.plan },
    createdAt: agencyCreatedAt,
  });
  log({
    agencyId,
    actorId: superAdminId,
    actorType: 'SUPER_ADMIN',
    eventType: 'user.created',
    entityType: 'user',
    entityId: owner.id,
    metadata: { name: owner.name, role: owner.role },
    createdAt: agencyCreatedAt,
  });

  for (const [index, member] of otherTeam.entries()) {
    const createdAt = at(-seed.createdDaysAgo + 2 + index, 11);
    const user = await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        passwordHash,
        role: member.role,
        createdAt,
        lastLoginAt: at(-index - 1, 9),
        membership: { create: { agencyId, jobTitle: member.jobTitle, createdAt } },
      },
    });
    users.set(member.key, user.id);
    log({
      agencyId,
      actorId: owner.id,
      eventType: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { name: user.name, role: user.role },
      createdAt,
    });
  }

  const clients = new Map<string, { id: string; companyName: string }>();
  for (const [index, clientSeed] of seed.clients.entries()) {
    const createdAt = at(-seed.createdDaysAgo + 5 + index * 3, 12);
    const client = await prisma.client.create({
      data: {
        agencyId,
        companyName: clientSeed.companyName,
        contactName: clientSeed.contactName,
        email: clientSeed.email,
        phone: clientSeed.phone,
        notes: clientSeed.notes,
        createdAt,
      },
    });
    clients.set(clientSeed.key, client);
    log({
      agencyId,
      actorId: owner.id,
      eventType: 'client.created',
      entityType: 'client',
      entityId: client.id,
      metadata: { companyName: client.companyName },
      createdAt,
    });

    if (clientSeed.portalUser) {
      const portalUser = await prisma.user.create({
        data: {
          name: clientSeed.portalUser.name,
          email: clientSeed.portalUser.email,
          passwordHash,
          role: 'CLIENT',
          clientId: client.id,
          createdAt,
          lastLoginAt: at(-2, 15),
        },
      });
      users.set(clientSeed.portalUser.key, portalUser.id);
      log({
        agencyId,
        actorId: owner.id,
        eventType: 'user.created',
        entityType: 'user',
        entityId: portalUser.id,
        metadata: { name: portalUser.name, role: 'CLIENT', companyName: client.companyName },
        createdAt,
      });
    }
  }

  const userId = (key: string) => {
    const id = users.get(key);
    if (!id) throw new Error(`Unknown seed user "${key}" in ${seed.name}`);
    return id;
  };

  let fileCount = 0;
  for (const projectSeed of seed.projects) {
    const client = clients.get(projectSeed.client)!;
    const createdAt = at(-projectSeed.createdDaysAgo, 10);
    const project = await prisma.project.create({
      data: {
        agencyId,
        clientId: client.id,
        name: projectSeed.name,
        description: projectSeed.description,
        startDate: day(projectSeed.start),
        dueDate: day(projectSeed.due),
        status: projectSeed.status,
        priority: projectSeed.priority,
        managerId: userId(projectSeed.manager),
        completedAt: projectSeed.status === 'COMPLETED' ? at(projectSeed.due - 1, 16) : null,
        createdAt,
      },
    });
    const projectId = project.id;
    const managerId = userId(projectSeed.manager);
    log({
      agencyId,
      projectId,
      actorId: managerId,
      eventType: 'project.created',
      entityType: 'project',
      entityId: projectId,
      visibility: 'CLIENT',
      metadata: { projectName: project.name },
      createdAt,
    });
    if (projectSeed.status === 'COMPLETED') {
      log({
        agencyId,
        projectId,
        actorId: managerId,
        eventType: 'project.status_changed',
        entityType: 'project',
        entityId: projectId,
        visibility: 'CLIENT',
        metadata: { projectName: project.name, from: 'ACTIVE', to: 'COMPLETED' },
        createdAt: at(projectSeed.due - 1, 16),
      });
    }

    const milestones = new Map<string, string>();
    for (const [index, milestoneSeed] of projectSeed.milestones.entries()) {
      const completedAt = milestoneSeed.status === 'COMPLETED' ? at(milestoneSeed.due, 15) : null;
      const milestone = await prisma.milestone.create({
        data: {
          agencyId,
          projectId,
          name: milestoneSeed.name,
          description: milestoneSeed.description ?? null,
          dueDate: day(milestoneSeed.due),
          status: milestoneSeed.status,
          order: index + 1,
          completedAt,
          createdAt,
        },
      });
      milestones.set(milestoneSeed.name, milestone.id);
      if (completedAt) {
        log({
          agencyId,
          projectId,
          actorId: managerId,
          eventType: 'milestone.completed',
          entityType: 'milestone',
          entityId: milestone.id,
          visibility: 'CLIENT',
          metadata: { title: milestone.name, from: 'IN_PROGRESS', to: 'COMPLETED' },
          createdAt: completedAt,
        });
      }
    }

    for (const [index, taskSeed] of projectSeed.tasks.entries()) {
      const due = taskSeed.due ?? null;
      const completedAt = taskSeed.status === 'COMPLETED' ? at((due ?? -1) - 1, 14) : null;
      const task = await prisma.task.create({
        data: {
          agencyId,
          projectId,
          milestoneId: taskSeed.milestone ? (milestones.get(taskSeed.milestone) ?? null) : null,
          title: taskSeed.title,
          description: taskSeed.description ?? null,
          assigneeId: taskSeed.assignee ? userId(taskSeed.assignee) : null,
          createdById: managerId,
          status: taskSeed.status,
          priority: taskSeed.priority ?? 'MEDIUM',
          dueDate: due === null ? null : day(due),
          clientVisible: taskSeed.clientVisible ?? false,
          completedAt,
          createdAt: new Date(createdAt.getTime() + (index + 1) * HOUR),
        },
      });
      if (taskSeed.clientVisible) {
        log({
          agencyId,
          projectId,
          actorId: managerId,
          eventType: 'task.created',
          entityType: 'task',
          entityId: task.id,
          visibility: 'CLIENT',
          metadata: { title: task.title, projectName: project.name },
          createdAt: new Date(createdAt.getTime() + (index + 1) * HOUR),
        });
      }
      if (completedAt) {
        log({
          agencyId,
          projectId,
          actorId: task.assigneeId ?? managerId,
          eventType: 'task.completed',
          entityType: 'task',
          entityId: task.id,
          visibility: task.clientVisible ? 'CLIENT' : 'INTERNAL',
          metadata: { title: task.title, projectName: project.name, from: 'IN_PROGRESS', to: 'COMPLETED' },
          createdAt: completedAt,
        });
      }
      for (const comment of taskSeed.comments ?? []) {
        const commentAt = at(-comment.daysAgo, 13);
        await prisma.taskComment.create({
          data: {
            agencyId,
            taskId: task.id,
            userId: userId(comment.author),
            content: comment.content,
            createdAt: commentAt,
          },
        });
        log({
          agencyId,
          projectId,
          actorId: userId(comment.author),
          eventType: 'task.comment_added',
          entityType: 'task',
          entityId: task.id,
          metadata: { title: task.title },
          createdAt: commentAt,
        });
      }
    }

    for (const meetingSeed of projectSeed.meetings ?? []) {
      const meetingDate = at(-meetingSeed.daysAgo, 15);
      const meeting = await prisma.meeting.create({
        data: {
          agencyId,
          projectId,
          title: meetingSeed.title,
          meetingDate,
          notes: meetingSeed.notes,
          summary: meetingSeed.summary ?? null,
          clientVisible: meetingSeed.clientVisible,
          createdById: managerId,
          createdAt: meetingDate,
        },
      });
      const visibility: ActivityVisibility = meeting.clientVisible ? 'CLIENT' : 'INTERNAL';
      log({
        agencyId,
        projectId,
        actorId: managerId,
        eventType: 'meeting.created',
        entityType: 'meeting',
        entityId: meeting.id,
        visibility,
        metadata: { title: meeting.title, projectName: project.name },
        createdAt: meetingDate,
      });
    }

    for (const feedbackSeed of projectSeed.feedback ?? []) {
      const submittedAt = at(-feedbackSeed.daysAgo, 11);
      const feedback = await prisma.feedback.create({
        data: {
          agencyId,
          projectId,
          title: feedbackSeed.title,
          description: feedbackSeed.description,
          submittedById: userId(feedbackSeed.submittedBy),
          status: feedbackSeed.status,
          createdAt: submittedAt,
        },
      });
      log({
        agencyId,
        projectId,
        actorId: userId(feedbackSeed.submittedBy),
        eventType: 'feedback.submitted',
        entityType: 'feedback',
        entityId: feedback.id,
        visibility: 'CLIENT',
        metadata: { title: feedback.title, projectName: project.name },
        createdAt: submittedAt,
      });
      if (feedbackSeed.status !== 'OPEN') {
        log({
          agencyId,
          projectId,
          actorId: managerId,
          eventType: 'feedback.status_changed',
          entityType: 'feedback',
          entityId: feedback.id,
          visibility: 'CLIENT',
          metadata: { title: feedback.title, from: 'OPEN', to: feedbackSeed.status },
          createdAt: new Date(submittedAt.getTime() + 20 * HOUR),
        });
      }
      for (const comment of feedbackSeed.comments ?? []) {
        const commentAt = at(-comment.daysAgo, 16);
        await prisma.feedbackComment.create({
          data: {
            agencyId,
            feedbackId: feedback.id,
            userId: userId(comment.author),
            content: comment.content,
            createdAt: commentAt,
          },
        });
        log({
          agencyId,
          projectId,
          actorId: userId(comment.author),
          eventType: 'feedback.comment_added',
          entityType: 'feedback',
          entityId: feedback.id,
          visibility: 'CLIENT',
          metadata: { title: feedback.title },
          createdAt: commentAt,
        });
      }
    }

    for (const fileSeed of projectSeed.files ?? []) {
      const extension = path.extname(fileSeed.name).toLowerCase();
      const storageName = `${randomUUID()}${extension}`;
      await writeFile(path.join(uploadDir, storageName), fileSeed.content);
      const uploadedAt = at(-fileSeed.daysAgo, 12);
      const file = await prisma.projectFile.create({
        data: {
          agencyId,
          projectId,
          uploadedById: userId(fileSeed.uploadedBy),
          originalName: fileSeed.name,
          storageName,
          mimeType: fileSeed.mimeType,
          size: fileSeed.content.length,
          clientVisible: fileSeed.clientVisible,
          createdAt: uploadedAt,
        },
      });
      fileCount += 1;
      log({
        agencyId,
        projectId,
        actorId: file.uploadedById,
        eventType: 'file.uploaded',
        entityType: 'file',
        entityId: file.id,
        visibility: file.clientVisible ? 'CLIENT' : 'INTERNAL',
        metadata: { title: file.originalName, projectName: project.name },
        createdAt: uploadedAt,
      });
    }
  }

  if (seed.suspended) {
    log({
      agencyId,
      actorId: superAdminId,
      actorType: 'SUPER_ADMIN',
      eventType: 'agency.suspended',
      entityType: 'agency',
      entityId: agencyId,
      metadata: { agencyName: seed.name, reason: seed.suspended.reason },
      createdAt: at(-seed.suspended.daysAgo, 14),
    });
  }

  await prisma.activityLog.createMany({ data: activities });
  return {
    agencyId,
    users: users.size,
    projects: seed.projects.length,
    files: fileCount,
    activities: activities.length,
  };
}

async function main() {
  if (process.env.SEED_ONLY_IF_EMPTY === 'true' && (await prisma.user.count()) > 0) {
    console.info('Database already contains data; skipping demo seed.');
    return;
  }

  console.info('Seeding AppZex demo data...');
  await resetDatabase();
  await resetUploads();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, bcryptRounds);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Platform Admin',
      email: 'superadmin@appzex-demo.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      createdAt: at(-150, 9),
    },
  });

  const results = [];
  for (const seed of [brightwave, northstar, pixelHarbor]) {
    results.push({ name: seed.name, ...(await seedAgency(seed, superAdmin.id, passwordHash)) });
  }

  // A past (ended) support session, so the audit trail is visible in the UI.
  const brightwaveId = results[0].agencyId;
  const sessionStart = at(-6, 10);
  const session = await prisma.supportSession.create({
    data: {
      superAdminId: superAdmin.id,
      agencyId: brightwaveId,
      reason: 'Customer asked for help configuring client portal access',
      startedAt: sessionStart,
      expiresAt: new Date(sessionStart.getTime() + HOUR),
      endedAt: new Date(sessionStart.getTime() + 14 * 60_000),
    },
  });
  await prisma.activityLog.createMany({
    data: [
      {
        agencyId: brightwaveId,
        actorId: superAdmin.id,
        actorType: 'SUPER_ADMIN',
        eventType: 'support.session_started',
        entityType: 'support_session',
        entityId: session.id,
        metadata: { agencyName: brightwave.name, readOnly: true, reason: session.reason },
        createdAt: sessionStart,
      },
      {
        agencyId: brightwaveId,
        actorId: superAdmin.id,
        actorType: 'SUPER_ADMIN',
        eventType: 'support.session_ended',
        entityType: 'support_session',
        entityId: session.id,
        metadata: { agencyName: brightwave.name, durationMinutes: 14 },
        createdAt: session.endedAt!,
      },
    ],
  });

  console.table(results.map(({ agencyId: _id, ...row }) => row));
  console.info(`Done. All demo accounts use the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
