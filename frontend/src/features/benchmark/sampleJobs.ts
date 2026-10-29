import type { Job } from '../../types'

// Made-up postings, so every benchmark run uses the same inputs and spends no JSearch request.
export const SAMPLE_JOBS: Job[] = [
  {
    id: 'bench-backend',
    title: 'Backend Engineer Intern',
    company: 'Northwind Logistics',
    location: 'Columbus, OH',
    description:
      'Build and test REST APIs in Python (FastAPI) backed by PostgreSQL. Deploy services on AWS (Lambda, S3). ' +
      'Write unit tests and take part in code reviews. Familiarity with Docker is a plus.',
    url: '',
    company_logo: '',
  },
  {
    id: 'bench-frontend',
    title: 'Frontend Developer (New Grad)',
    company: 'Brightline Health',
    location: 'Remote',
    description:
      'Build accessible React + TypeScript interfaces for a patient portal. Work with designers on a component ' +
      'library, write tests with Vitest, and integrate with GraphQL APIs. WCAG experience preferred.',
    url: '',
    company_logo: '',
  },
  {
    id: 'bench-data',
    title: 'Data Analyst Intern',
    company: 'Scarlet Analytics',
    location: 'Cleveland, OH',
    description:
      'Analyze product usage with SQL and Python (pandas). Build dashboards in Tableau and present findings to ' +
      'product managers. Basic statistics (A/B tests, regression) required.',
    url: '',
    company_logo: '',
  },
  {
    id: 'bench-ml',
    title: 'Machine Learning Engineer',
    company: 'Lumen Robotics',
    location: 'Pittsburgh, PA',
    description:
      '3+ years building ML systems in production. Train and deploy PyTorch models for computer vision, own ' +
      'data pipelines on GCP, and optimize inference on edge devices. MS in CS or related field preferred.',
    url: '',
    company_logo: '',
  },
  {
    id: 'bench-pm',
    title: 'Associate Product Manager',
    company: 'Harbor Fintech',
    location: 'Chicago, IL',
    description:
      'Own the roadmap for a mobile payments feature: write specs, prioritize with engineering, and track ' +
      'metrics. Strong communication required; a technical background (CS degree or coding experience) is a plus.',
    url: '',
    company_logo: '',
  },
]
