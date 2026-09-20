# CrossCurrent Events Platform

A full-stack event management platform built to handle event registration, administration, payments, and attendee management.

The project is structured as separate frontend and backend applications, with PostgreSQL as the primary data store and Nginx providing the production-facing reverse proxy.

(note: this code is provided for portfolio review only. Please see the LICENSE file for restrictions on use.)

## Architecture

```text
┌──────────────────────┐
│      Next.js         │
│   React Frontend     │
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│        Nginx         │
│  Reverse Proxy / TLS │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│       Express        │
│    TypeScript API    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      PostgreSQL      │
│       + Prisma       │
└──────────────────────┘
```

The application is containerized with Docker Compose.

## What it does

The platform supports workflows for both attendees and administrators, including:

* Event registration
* Registration management
* User authentication
* Payment processing
* Manual payment status management
* Early-bird registration handling
* Registration search, filtering, and sorting
* Attendee/registrant profile access
* Parent information associated with registrations
* Email delivery
* File uploads
* Data export

The administrative side is designed around the operational workflows required to manage registrations rather than treating the application as a simple CRUD interface.

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* React Hook Form
* Zod
* Tailwind CSS
* Radix/shadcn UI components

### Backend

* Node.js
* Express
* TypeScript
* Prisma
* PostgreSQL
* JWT
* bcrypt

### Integrations

* Stripe
* Resend
* ExcelJS

### Infrastructure

* Docker
* Docker Compose
* Nginx
* HTTPS / TLS

## Engineering Highlights

### Registration and payment state

Registration is not treated as a single boolean state.

The platform distinguishes between different payment and registration conditions, including Stripe payments, manually marked payments, and early-bird eligibility.

This allows administrative workflows to reflect how registrations are actually handled rather than forcing every case through the automated payment flow.

### Administrative workflows

The admin experience includes tools for working with potentially large registration lists:

* Search
* Filtering
* Sorting
* Profile navigation
* Payment status management
* Early-bird management

These workflows have been iterated alongside the underlying data model as requirements evolved.

### Production-oriented architecture

The application separates concerns between:

* the frontend
* the API
* the database
* the reverse proxy

Docker Compose provides a reproducible environment while Nginx handles the public-facing HTTP/HTTPS layer.

## Repository Structure

```text
.
├── frontend/       # Next.js application
├── backend/        # Express API
├── nginx/          # Reverse proxy configuration
├── config/         # Environment configuration
├── data/           # PostgreSQL persistent data
└── docker-compose.yml
```

## Running Locally

### Prerequisites

* Docker
* Docker Compose

### Start the application

```bash
docker compose up --build
```

The individual services can also be developed independently when working on the frontend or backend.

### Environment

The application expects environment configuration for the database, backend services, Nginx, and external integrations.

Do not commit production credentials or API keys to the repository.

## Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

The exact environment variables required by each service should be configured using the files under `config/`.

## Project Status

This is an actively developed application. Recent work has focused on improving administrative registration workflows, payment handling, early-bird logic, filtering, and registration data management.

## Why this project exists

CrossCurrent is an example of building software around evolving operational requirements: the architecture and data model have to support the workflows that emerge as the application is actually used.

That makes the project less about demonstrating a particular framework and more about designing, implementing, and maintaining a real application across the frontend, backend, database, and infrastructure layers.
