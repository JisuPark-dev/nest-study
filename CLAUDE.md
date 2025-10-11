# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS application with Redis caching and TypeORM PostgreSQL integration. The project uses TypeScript and follows standard NestJS architectural patterns.

## Development Commands

### Running the Application
- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode with hot-reload
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start production build

### Building and Testing
- `npm run build` - Build the application
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

### Code Quality
- `npm run lint` - Run ESLint and fix issues
- `npm run format` - Format code with Prettier

### Testing a Single File
- `npm test -- path/to/file.spec.ts` - Run specific test file
- `npm test -- --testNamePattern="test name"` - Run tests matching pattern

## Architecture Overview

### Module Structure
The application follows NestJS modular architecture:
- `AppModule` - Root module that imports all feature modules
- Feature modules include controllers, services, and entities
- Each module is self-contained with its own dependencies

### Database Integration
- Uses TypeORM with PostgreSQL
- Entity definitions use decorators for database mapping
- Database configuration is environment-based

### Caching Strategy
- Redis integration for caching through NestJS cache manager
- Cache interceptors for automatic HTTP response caching
- Service-level caching for database queries
- Cache invalidation on data mutations

### Key Dependencies
- **@nestjs/typeorm** - Database ORM integration
- **@nestjs/cache-manager** - Caching abstraction
- **cache-manager-redis-store** - Redis cache store
- **class-validator** & **class-transformer** - DTO validation and transformation

### Environment Configuration
The application uses environment variables for configuration:
- Database connection (PostgreSQL)
- Redis connection settings
- Application port and host

### Testing Approach
- Unit tests use Jest with NestJS testing utilities
- E2E tests use Supertest for HTTP testing
- Mock providers for isolated unit testing
- Test database configuration for integration tests