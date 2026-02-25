# Secure Messenger - End-to-End Encrypted Mobile Messaging

A secure mobile messaging application built with React Native that provides end-to-end encryption using the Signal Protocol library.

## Features

### 🔒 Security Features
- **End-to-End Encryption**: All messages are encrypted using the Signal Protocol
- **Perfect Forward Secrecy**: Session keys are generated for each message exchange
- **Identity Verification**: Users can verify contact identities through key fingerprints
- **Secure Key Storage**: Encryption keys are stored securely using Expo SecureStore
- **No Server Access to Plain Text**: Server only stores encrypted messages

### 📱 Core Features
- Real-time messaging with WebSocket connections
- Contact management system
- User authentication with JWT tokens
- Message history and synchronization
- Beautiful, modern UI with React Native
- Cross-platform support (iOS, Android, Web)

## Architecture

### Client-Side (React Native)
- **Frontend**: React Native with Expo
- **Navigation**: React Navigation
- **Encryption**: libsignal-protocol-javascript
- **Real-time**: Socket.io client
- **Secure Storage**: Expo SecureStore

### Server-Side (Node.js)
- **Backend**: Express.js with Socket.io
- **Database**: SQLite for development (easily migratable to PostgreSQL)
- **Authentication**: JWT with bcrypt password hashing
- **Security**: Helmet, CORS, rate limiting

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Android Studio / Xcode (for mobile development)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd secure-messenger
   ```

2. **Install client dependencies**
   ```bash
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Start the server**
   ```bash
   cd server
   npm start
   ```

5. **Start the mobile app**
   ```bash
   npm start
   ```

6. **Run on device/simulator**
   ```bash
   npm run android    # For Android
   npm run ios        # For iOS
   npm run web        # For web
   ```

## Security Implementation

### Signal Protocol Integration

The app implements the Signal Protocol for end-to-end encryption:

1. **Key Generation**: Each user generates:
   - Identity key pair (long-term)
   - Registration ID
   - Pre-keys (one-time use)
   - Signed pre-keys (rotating)

2. **Session Establishment**: 
   - Pre-key bundles are exchanged through the server
   - Double Ratchet algorithm ensures forward secrecy
   - X3DH protocol for initial key exchange

3. **Message Encryption**:
   - AES-256 in CBC mode for message content
   - HMAC-SHA256 for message authentication
   - Chain keys for message ordering

### Security Best Practices

- **Secure Key Storage**: All cryptographic keys are stored in device secure storage
- **Certificate Pinning**: HTTPS connections use certificate pinning
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **SQL Injection Prevention**: Parameterized queries for database operations

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Contacts
- `GET /api/contacts` - Get user contacts
- `POST /api/contacts/add` - Add new contact

### Key Exchange
- `POST /api/keys/exchange` - Exchange public keys

### Messages
- `GET /api/messages/:contactId` - Get message history

## WebSocket Events

### Client to Server
- `send_message` - Send encrypted message

### Server to Client
- `message` - Receive encrypted message
- `contact_request` - Receive contact request

## Development

### Environment Variables

Create a `.env` file in the server directory:

```env
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
NODE_ENV=development
```

### Database Setup

The app uses SQLite for development. The database schema is automatically created on first run.

For production, consider migrating to PostgreSQL:

1. Install PostgreSQL adapter
2. Update database connection
3. Run migration scripts

### Testing

```bash
# Run client tests
npm test

# Run server tests
cd server
npm test
```

## Production Deployment

### Security Considerations

1. **Environment Variables**: Use strong, unique secrets
2. **Database**: Use PostgreSQL with connection pooling
3. **HTTPS**: Enforce HTTPS in production
4. **Monitoring**: Implement logging and monitoring
5. **Backup**: Regular database backups

### Deployment Steps

1. **Build the app**:
   ```bash
   expo build:android
   expo build:ios
   ```

2. **Deploy server**:
   - Use Docker containers
   - Set up reverse proxy (nginx)
   - Configure SSL certificates
   - Set up monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Audit

This application has been designed with security in mind. However, for production use:

1. Conduct a professional security audit
2. Implement penetration testing
3. Regular security updates
4. Monitor for vulnerabilities

## Support

For issues and questions:
- Create an issue on GitHub
- Review the documentation
- Check existing issues

## Acknowledgments

- Signal Protocol by Open Whisper Systems
- React Native team
- Expo team
- libsignal-protocol-javascript contributors
