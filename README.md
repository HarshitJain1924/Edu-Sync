# EduSync - AI-Powered Education Platform

## Project Overview

EduSync is a comprehensive education platform that revolutionizes learning through AI-powered content generation, real-time collaboration, and gamified learning experiences. The platform connects students, teachers, and administrators in a seamless ecosystem designed to enhance educational outcomes through modern web technologies.

### Key Features

- **AI Content Generation**: Automatically generate quizzes and flashcards from video content using Google Gemini AI
- **Role-Based Dashboards**: Customized interfaces for students, teachers, and administrators
- **Real-Time Study Rooms**: WebRTC-powered video conferencing for collaborative learning
- **Interactive Games**: Brain-training games including Sudoku, Memory Game, Typing Test, and more
- **Video Library**: Comprehensive video learning platform with progress tracking
- **Analytics Dashboard**: Track student performance, engagement metrics, and learning progress
- **Flashcard System**: AI-generated and custom flashcards for effective revision
- **Quiz Platform**: Interactive quizzes with instant feedback and scoring

<!-- ## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5fdfc547-66e6-4655-a141-6f791c824258) and start prompting.

Changes made via Lovable will be committed automatically to this repo. -->

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Tech Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **React Router** - Client-side routing
- **Lucide React** - Icon library

### Backend & Services
- **Supabase** - Backend as a Service
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication & authorization
  - Edge Functions (Deno runtime)
  - Real-time subscriptions
- **Google Gemini AI** - AI content generation (gemini-2.0-flash model)
- **WebRTC** - Peer-to-peer video conferencing

### Database Schema
- **profiles** - User profile information
- **user_roles** - Role-based access control (student/teacher/admin)
- **quiz_sets** - Quiz collections
- **quiz_questions** - Individual quiz questions
- **flashcard_sets** - Flashcard collections
- **flashcards** - Individual flashcards
- **user_progress** - Track quiz completion and scores
- **videos** - Video library content
- **video_progress** - Track video watch progress
- **study_rooms** - Virtual study room management
- **sessions** - Live session scheduling and tracking

<!-- ## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5fdfc547-66e6-4655-a141-6f791c824258) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain) -->

## Project Structure

```
edu-sync-future-main/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── games/        # Game components
│   │   ├── home/         # Home page sections
│   │   └── video/        # Video player components
│   ├── pages/            # Route pages
│   │   ├── admin/        # Admin dashboard pages
│   │   ├── teacher/      # Teacher dashboard pages
│   │   └── games/        # Game pages
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── integrations/     # External service integrations
├── supabase/
│   ├── functions/        # Edge Functions
│   │   ├── generate-quiz/
│   │   └── generate-flashcards/
│   └── migrations/       # Database migrations
└── public/               # Static assets
```

## Key Features Breakdown

### For Students
- Access video library with AI-generated study materials
- Take interactive quizzes with instant feedback
- Study with flashcards (AI-generated or custom)
- Join live study rooms for collaborative learning
- Play educational games for brain training
- Track personal progress and performance
- View analytics and learning statistics

### For Teachers
- Create and manage study rooms
- Upload educational videos
- Generate AI-powered quizzes and flashcards from video content
- View student performance and engagement metrics
- Track quiz scores and completion rates
- Manage class activities and sessions
- Access comprehensive analytics dashboard

### For Administrators
- Manage users and roles
- System-wide analytics and reporting
- Monitor platform usage and performance
- Configure system settings
- User management and moderation

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Supabase CLI
- Google Gemini API key

### Installation

```sh
# Clone the repository
git clone https://github.com/HarshitJain1924/edu-sync-future.git

# Navigate to project directory
cd edu-sync-future-main

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase and API keys to .env

# Start development server
npm run dev
```

### Database Setup

```sh
# Initialize Supabase
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push migrations to database
supabase db push

# Deploy Edge Functions
supabase functions deploy generate-quiz
supabase functions deploy generate-flashcards
```

## Current Improvements & Recent Updates

### ✅ Completed Features
- AI quiz and flashcard generation using Gemini 2.0 Flash
- Automatic role-based dashboard routing after login
- Quiz results now saved to database for analytics
- Teacher dashboard displays real student data
- Profile photo display in sidebar
- Delete account functionality with confirmation
- Enhanced student performance tracking
- RLS policies for data security
- Real-time quiz progress tracking

### 🔧 Recent Fixes
- Fixed React Hooks order compliance issues
- Resolved database schema mismatches (topic field, quiz_id column)
- Fixed Gemini API quota issues by switching models
- Corrected content_type for quiz tracking (quiz_set)
- Added teacher access to view student progress
- Improved error handling and loading states

## Future Improvements & Ideas

### High Priority
- [ ] **Advanced Analytics Dashboard**
  - Detailed performance graphs and charts
  - Learning trend analysis over time
  - Comparative analytics (class averages, percentiles)
  - Export reports as PDF/CSV

- [ ] **Enhanced AI Features**
  - AI-powered study recommendations
  - Personalized learning paths based on performance
  - Automated difficulty adjustment for quizzes
  - Voice-to-text for quiz/flashcard creation
  - AI tutoring chatbot

- [ ] **Mobile Application**
  - React Native mobile app
  - Offline mode for content access
  - Push notifications for sessions and deadlines
  - Mobile-optimized study experience

- [ ] **Collaboration Features**
  - Real-time collaborative note-taking
  - Screen sharing in study rooms
  - Whiteboard for visual explanations
  - Group quiz competitions
  - Peer review system

### Medium Priority
- [ ] **Content Management**
  - Rich text editor for notes
  - Upload PDF, PPT, and document conversion
  - Annotation tools for videos
  - Bookmark and highlight important sections
  - Content versioning and history

- [ ] **Gamification Enhancements**
  - XP and leveling system
  - Achievements and badges
  - Leaderboards (class, school, global)
  - Daily challenges and streaks
  - Rewards and incentives

- [ ] **Assessment Tools**
  - Timed exams with proctoring
  - Question bank management
  - Randomized question ordering
  - Essay/subjective question grading
  - Plagiarism detection

- [ ] **Communication**
  - Direct messaging between users
  - Discussion forums per topic
  - Announcement system
  - Email notifications
  - Calendar integration

### Low Priority / Nice to Have
- [ ] **Accessibility**
  - Screen reader optimization
  - Keyboard navigation improvements
  - High contrast themes
  - Text-to-speech for content
  - Multiple language support (i18n)

- [ ] **Integration & APIs**
  - Google Classroom integration
  - Microsoft Teams integration
  - LMS (Moodle, Canvas) compatibility
  - Calendar sync (Google, Outlook)
  - Third-party authentication (Google, Microsoft)

- [ ] **Advanced Features**
  - Virtual lab environments
  - Code playground for programming courses
  - 3D model viewer for science/engineering
  - Interactive simulations
  - AR/VR learning experiences

- [ ] **Performance & Optimization**
  - Progressive Web App (PWA) support
  - Image optimization and lazy loading
  - CDN for video content delivery
  - Redis caching layer
  - Database query optimization

- [ ] **Security & Compliance**
  - Two-factor authentication
  - Session management improvements
  - Data encryption at rest
  - GDPR compliance tools
  - Audit logging system

- [ ] **Teacher Tools**
  - Attendance tracking
  - Grade book management
  - Assignment submission system
  - Rubric creator for assessments
  - Parent portal for progress tracking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is part of a capstone project for educational purposes.

## Contact

For questions or support, please contact the development team through the GitHub repository.