# Flag Finder Frontend

A modern Angular application for flag identification and authentication.

## Features

- **User Authentication**: Secure login system with JWT tokens
- **Modern UI**: Clean, responsive design with Material Design components
- **Password Management**: Forgot password and reset functionality
- **Email Verification**: Account verification system
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: Angular 17
- **UI Components**: Angular Material
- **Styling**: SCSS with modern CSS features
- **Authentication**: JWT-based with refresh token support

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ff-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:4200`

### Build

To build the application for production:

```bash
npm run build
```

## API Configuration

The application is configured to connect to the authentication API at:
- **Development**: `http://localhost:8080/api/v1/`
- **Production**: `http://localhost:8080/api/v1/`

## Authentication Endpoints

- **Login**: `POST /api/v1/auth/authenticate`
- **Refresh Token**: `POST /api/v1/auth/refresh-token`
- **User Info**: `GET /api/v1/users/user`

## Project Structure

```
src/
├── app/
│   ├── login/                    # Login components
│   ├── services/
│   │   ├── auth/                # Authentication services
│   │   ├── reset-password/      # Password reset functionality
│   │   └── forgotten-password/  # Forgot password functionality
│   └── app.component.*          # Main app component
├── environments/                 # Environment configuration
└── styles.scss                  # Global styles
```

## Development

### Code Style

- Follow Angular style guide
- Use TypeScript strict mode
- Implement proper error handling
- Write unit tests for components and services

### Testing

Run the test suite:

```bash
npm test
```

## License

This project is licensed under the MIT License.
