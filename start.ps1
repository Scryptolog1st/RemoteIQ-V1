# PowerShell Script to Scaffold the RemoteIQ Frontend Project
#
# Description:
# This script creates the complete directory structure and all necessary files
# for Phase F0 of the RemoteIQ project. It populates each file with the
# specified content.
#
# Usage:
# 1. Save this script as "create-remoteiq-scaffold.ps1".
# 2. Open a PowerShell terminal.
# 3. Navigate to the directory where you want to create the project.
# 4. Run the script: .\create-remoteiq-scaffold.ps1

# --- Script Start ---

# Define the root project directory name
$projectName = "remoteiq-frontend"

# Check if the directory already exists
if (Test-Path -Path $projectName) {
    Write-Host "Directory '$projectName' already exists. Please remove it or choose a different location." -ForegroundColor Yellow
    exit
}

Write-Host "Creating project directory: $projectName" -ForegroundColor Green
New-Item -ItemType Directory -Name $projectName | Out-Null
Set-Location -Path $projectName

# Create subdirectories
Write-Host "Creating subdirectories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Name "app" | Out-Null
New-Item -ItemType Directory -Name "components" | Out-Null
New-Item -ItemType Directory -Name "lib" | Out-Null
New-Item -ItemType Directory -Name "styles" | Out-Null

# --- File Content Definitions ---
# Using single-quoted here-strings (@'...'@) to treat all content literally
# and avoid issues with PowerShell escape characters like the backtick (`).

# README.md
$readmeContent = @'
# RemoteIQ - Frontend

This repository contains the frontend application for RemoteIQ, a next-generation Remote Monitoring & Management (RMM) platform.

## Phase F0: Scaffold & Hardening

This initial commit establishes the foundational scaffold for the project.

### Tech Stack

* **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
* **Linting:** [ESLint](https://eslint.org/)
* **Formatting:** [Prettier](https://prettier.io/)
* **Package Manager:** [pnpm](https://pnpm.io/)

### Getting Started

1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run the Development Server:**
    ```bash
    pnpm dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Scripts

* `pnpm dev`: Starts the development server.
* `pnpm build`: Creates a production build.
* `pnpm start`: Starts the production server.
* `pnpm lint`: Runs ESLint to check for code quality issues.

### Definition of Done (DoD) Checklist - F0

- [x] App Router scaffold initialized.
- [x] TypeScript configured with strict mode and path aliases.
- [x] Tailwind CSS and `shadcn/ui` configured.
- [x] Design tokens foundation laid in `tailwind.config.ts`.
- [x] Global layout with `ThemeProvider` for dark/light modes established.
- [x] Base accessibility standards considered in root layout.
- [x] ESLint and Prettier configured for code quality.
- [x] CI-ready scripts (`lint`, `build`) are present in `package.json`.
'@

# package.json
$packageJsonContent = @'
{
  "name": "remoteiq-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.379.0",
    "next": "15.0.0-rc.0",
    "next-themes": "^0.3.0",
    "react": "19.0.0-rc-f994737d14-20240522",
    "react-dom": "19.0.0-rc-f994737d14-20240522",
    "tailwind-merge": "^2.3.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.19",
    "eslint": "^8",
    "eslint-config-next": "15.0.0-rc.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
'@

# tsconfig.json
$tsconfigJsonContent = @'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'@

# next.config.mjs
$nextConfigContent = @'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add any Next.js specific configurations here in the future.
  // For F0, the default configuration is sufficient.
};

export default nextConfig;
'@

# tailwind.config.ts
$tailwindConfigContent = @'
import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // RemoteIQ Semantic Colors
        status: {
            healthy: 'hsl(var(--status-healthy))',
            warning: 'hsl(var(--status-warning))',
            critical: 'hsl(var(--status-critical))',
            info: 'hsl(var(--status-info))',
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
'@

# postcss.config.js
$postcssConfigContent = @'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
'@

# .eslintrc.json
$eslintrcContent = @'
{
  "extends": "next/core-web-vitals"
}
'@

# .prettierrc
$prettierrcContent = @'
{
  "semi": true,
  "tabWidth": 2,
  "printWidth": 100,
  "singleQuote": false,
  "trailingComma": "es5",
  "jsxSingleQuote": false,
  "bracketSpacing": true
}
'@

# styles/globals.css
$globalsCssContent = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    --radius: 0.5rem;
    
    /* RemoteIQ Semantic Colors */
    --status-healthy: 142.1 76.2% 36.3%; /* Green */
    --status-warning: 45.4 93.4% 47.5%;  /* Amber */
    --status-critical: 0 72.2% 50.6%;    /* Red */
    --status-info: 217.2 91.2% 59.8%;    /* Blue */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    
    /* RemoteIQ Semantic Colors */
    --status-healthy: 142.1 70.6% 45.3%;
    --status-warning: 45.4 93.4% 52.5%;
    --status-critical: 0 62.8% 50.6%;
    --status-info: 217.2 91.2% 64.8%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
'@

# lib/utils.ts
$utilsTsContent = @'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
'@

# components/theme-provider.tsx
$themeProviderContent = @'
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
'@

# app/layout.tsx
$layoutTsxContent = @'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RemoteIQ",
  description: "Next-Generation Remote Monitoring & Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
'@

# app/page.tsx
$pageTsxContent = @'
import { Terminal } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-24">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Terminal className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Welcome to RemoteIQ
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Phase F0: Scaffold & Hardening is complete. The project foundation is ready.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 rounded-md bg-status-healthy/10 px-3 py-1 text-sm font-medium text-status-healthy">
                <span className="h-2 w-2 rounded-full bg-status-healthy"></span>
                Healthy
            </div>
            <div className="flex items-center gap-2 rounded-md bg-status-warning/10 px-3 py-1 text-sm font-medium text-status-warning">
                <span className="h-2 w-2 rounded-full bg-status-warning"></span>
                Warning
            </div>
            <div className="flex items-center gap-2 rounded-md bg-status-critical/10 px-3 py-1 text-sm font-medium text-status-critical">
                <span className="h-2 w-2 rounded-full bg-status-critical"></span>
                Critical
            </div>
            <div className="flex items-center gap-2 rounded-md bg-status-info/10 px-3 py-1 text-sm font-medium text-status-info">
                <span className="h-2 w-2 rounded-full bg-status-info"></span>
                Info
            </div>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
            Next up: Phase F1 - Design System & Dashboard.
        </p>
      </div>
    </main>
  );
}
'@

# --- File Creation ---

Write-Host "Creating project files..." -ForegroundColor Cyan

# Root files
Set-Content -Path "README.md" -Value $readmeContent
Set-Content -Path "package.json" -Value $packageJsonContent
Set-Content -Path "tsconfig.json" -Value $tsconfigJsonContent
Set-Content -Path "next.config.mjs" -Value $nextConfigContent
Set-Content -Path "tailwind.config.ts" -Value $tailwindConfigContent
Set-Content -Path "postcss.config.js" -Value $postcssConfigContent
Set-Content -Path ".eslintrc.json" -Value $eslintrcContent
Set-Content -Path ".prettierrc" -Value $prettierrcContent

# Subdirectory files
Set-Content -Path "styles/globals.css" -Value $globalsCssContent
Set-Content -Path "lib/utils.ts" -Value $utilsTsContent
Set-Content -Path "components/theme-provider.tsx" -Value $themeProviderContent
Set-Content -Path "app/layout.tsx" -Value $layoutTsxContent
Set-Content -Path "app/page.tsx" -Value $pageTsxContent

# --- Final Instructions ---
Write-Host ""
Write-Host "Project scaffolding complete!" -ForegroundColor Green
Write-Host "---------------------------------"
Write-Host "Next steps:"
Write-Host "1. Navigate into the new project directory:" -ForegroundColor Yellow
Write-Host "   cd $projectName"
Write-Host "2. Install dependencies using pnpm:" -ForegroundColor Yellow
Write-Host "   pnpm install"
Write-Host "3. Start the development server:" -ForegroundColor Yellow
Write-Host "   pnpm dev"
Write-Host ""

# Return to the original directory
Set-Location -Path ".."

# --- Script End ---

