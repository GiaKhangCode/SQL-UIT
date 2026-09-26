# SQL-UIT Frontend

A modern React frontend for the SQL-UIT application, built with Vite, TypeScript, React Router, and CodeMirror.

## Prerequisites

Before running the frontend, ensure you have:
- **Node.js 18+** installed
- **npm** (comes with Node.js)
- The **SQL-UIT Backend** running on `http://127.0.0.1:8000` (see the backend README for instructions).

## Installation & Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

Vite will start the development server, usually at `http://127.0.0.1:5174/`. 

### API Connection (Proxy)
You do **not** need to configure `.env` variables for the API URL in development. 
The project uses Vite's proxy feature (configured in `vite.config.ts`) to automatically forward all requests starting with `/api` to `http://127.0.0.1:8000`. This avoids CORS issues and simplifies local development.

## Project Structure & Architecture

Unlike the initial mockup phase, this frontend is **fully integrated with the live FastAPI backend**. 

- **API Client (`src/services/apiClient.ts`)**: Handles all HTTP requests, automatically attaching the JWT `Authorization` header if a user is logged in.
- **Authentication (`src/services/authService.ts`)**: Connects to the real backend login/registration endpoints. The JWT token is securely saved in `localStorage`.
- **Student API (`src/services/studentApi.ts`)**: Handles fetching problems, submitting SQL queries for grading, and retrieving dashboard statistics.
- **Teacher API (`src/services/teacherService.ts`)**: Handles instructor-facing features like reviewing submissions, managing classes, and creating assignments.
- **Admin API (`src/services/adminService.ts`)**: Handles platform-wide management features.

## Available Scripts

- `npm run dev`: Starts the local development server.
- `npm run build`: Compiles TypeScript and builds the production bundle into the `dist/` folder.
- `npm run test`: Runs TypeScript type-checking (`tsc --noEmit`).

## Testing the Application

Once both the backend and frontend are running, you can log in using the demo accounts created by the backend's seed script:
- **Student:** `student@demo.local` / `password123`
- **Instructor:** `instructor@demo.local` / `password123`
- **Admin:** `admin@demo.local` / `password123`
