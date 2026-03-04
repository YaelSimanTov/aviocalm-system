# AvioCalm Frontend - Strict Component Structure

## Folder Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── login-form/
│   │   │   ├── index.js              # Export file
│   │   │   ├── login-form.jsx         # React component
│   │   │   └── login-form.css         # Component-specific styles
│   │   └── nav-bar/                   # Future component
│   ├── pages/
│   │   ├── login-page.jsx             # Login page component
│   │   └── owner-dashboard.jsx        # Owner dashboard page
│   ├── context/
│   │   └── auth-context.js            # Authentication context
│   ├── utils/
│   │   └── api.js                     # API utility functions
│   ├── App.jsx                        # Main App component
│   ├── main.jsx                       # Entry point
│   └── index.css                      # Global styles
├── tests/                             # All test files (dedicated folder)
├── .env                               # Environment variables
├── vite.config.js                     # Vite configuration
├── tailwind.config.js                 # Tailwind CSS config
├── postcss.config.js                  # PostCSS config
└── package.json                       # Dependencies and scripts
```

## Component Organization Rules

### 1. Component Folder Structure
Every component must follow this pattern:
```
src/components/ComponentName/
├── index.js          # Clean export file
├── ComponentName.jsx # React component code
└── ComponentName.css # Component-specific styles
```

### 2. File Extensions
- **React Components**: `.jsx` extension
- **Styles**: `.css` extension  
- **Utilities/Context**: `.js` extension
- **Pages**: `.jsx` extension

### 3. Import Patterns
```javascript
// Clean component import (using index.js)
import { LoginForm } from '../components/login-form';

// Direct import (alternative)
import { LoginForm } from '../components/login-form/login-form';

// Page imports
import { LoginPage } from '../pages/login-page';
import { OwnerDashboard } from '../pages/owner-dashboard';

// Context/Utils imports
import { useAuth } from '../context/auth-context';
import { api } from '../utils/api';
```

### 4. Testing Structure
All test files should be placed in `/tests` folder:
```
tests/
├── components/
│   ├── login-form.test.js
│   └── nav-bar.test.js
├── pages/
│   ├── login-page.test.js
│   └── owner-dashboard.test.js
└── utils/
    └── api.test.js
```

## CSS Architecture

### Component-Specific CSS
Each component has its own CSS file using BEM-like naming:
```css
.login-form { /* Component block */ }
.login-form__input { /* Element */ }
.login-form__input--error { /* Modifier */ }
```

### Global Styles
- `index.css` contains global styles and Tailwind imports
- Component CSS files use `@apply` directives for Tailwind classes

## Environment Configuration

### Frontend (.env)
```env
VITE_API_BASE_URL=/api
VITE_APP_NAME=AvioCalm
VITE_APP_VERSION=1.0.0
```

### Backend (.env)
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/aviocalm
JWT_SECRET=AvioCalm_Secure_2026
```

## API Integration

### Vite Proxy Configuration
```javascript
// vite.config.js
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}
```

### API Utility
Centralized API functions in `src/utils/api.js` with:
- Standardized error handling
- JWT token management
- Consistent response format

## Current Implementation Status

✅ **Completed**:
- Component folder structure
- Login form component with CSS
- Page components (.jsx)
- Authentication context
- API utility
- Environment configuration
- Vite proxy setup

🔄 **Ready for Testing**:
- Login functionality
- Authentication flow
- Component styling

📋 **Next Steps**:
- Add navigation bar component
- Create test files in /tests
- Implement routing
- Add form validation enhancements
