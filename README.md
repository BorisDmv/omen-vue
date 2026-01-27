
# Omen Chat App

A modern real-time chat application built with Vue 3, Vite, and WebSockets.

## Features
- Real-time messaging with WebSocket support
- Optimistic UI for instant message feedback
- User authentication (JWT-based)
- Responsive design for desktop and mobile
- Chat history and friend list
- Modern, clean UI with Tailwind CSS

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+ recommended)

### Project Setup
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Type Check
```bash
npm run type-check
```

### Build for Production
```bash
npm run build
```

### Lint and Fix
```bash
npm run lint
```

## Recommended Tools
- [VS Code](https://code.visualstudio.com/) + [Vue Volar Extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Vue.js Devtools](https://devtools.vuejs.org/)

## Configuration
- Environment variables and API endpoints can be configured in `.env` files.
- WebSocket server URL is auto-detected for local/production.

## Folder Structure
- `src/components/` — Vue components (ChatArea, Sidebar, etc.)
- `src/services/` — API and WebSocket logic
- `src/views/` — Main app views
- `src/stores/` — Pinia stores
- `src/assets/` — Static assets and styles

## License
MIT
