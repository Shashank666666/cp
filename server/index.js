const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const validator = require('validator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const db = new sqlite3.Database('./messenger.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    registration_id INTEGER,
    identity_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (contact_id) REFERENCES users (id),
    UNIQUE(user_id, contact_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    encrypted_message TEXT NOT NULL,
    plain_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users (id),
    FOREIGN KEY (recipient_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pre_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS signed_pre_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

const generateUserId = () => {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    if (!validator.isLength(username, { min: 3, max: 30 })) {
      return res.status(400).json({ message: 'Username must be 3-30 characters' });
    }

    if (!validator.isLength(password, { min: 6 })) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (user) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = generateUserId();

      db.run(
        'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
        [userId, username, passwordHash],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating user' });
          }

          const token = jwt.sign(
            { id: userId, username },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
            message: 'User created successfully',
            token,
            user: { id: userId, username }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username }
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/contacts', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT u.id, u.username 
     FROM contacts c 
     JOIN users u ON c.contact_id = u.id 
     WHERE c.user_id = ?`,
    [userId],
    (err, contacts) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({ contacts });
    }
  );
});

app.post('/api/contacts/add', authenticateToken, (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;

  if (!username) {
    return res.status(400).json({ message: 'Username required' });
  }

  db.get('SELECT id, username FROM users WHERE username = ?', [username], (err, contact) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!contact) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (contact.id === userId) {
      return res.status(400).json({ message: 'Cannot add yourself as a contact' });
    }

    const contactId = 'contact_' + Math.random().toString(36).substr(2, 9) + Date.now();

    db.run(
      'INSERT INTO contacts (id, user_id, contact_id) VALUES (?, ?, ?)',
      [contactId, userId, contact.id],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ message: 'Contact already exists' });
          }
          return res.status(500).json({ message: 'Error adding contact' });
        }

        res.json({
          message: 'Contact added successfully',
          contact: { id: contact.id, username: contact.username }
        });
      }
    );
  });
});

app.post('/api/keys/exchange', authenticateToken, (req, res) => {
  const { contactId, publicKeyBundle } = req.body;
  const userId = req.user.id;

  if (!contactId || !publicKeyBundle) {
    return res.status(400).json({ message: 'Contact ID and public key bundle required' });
  }

  db.get(
    'SELECT * FROM users WHERE id = ?',
    [contactId],
    (err, contact) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      db.all(
        'SELECT * FROM pre_keys WHERE user_id = ? LIMIT 1',
        [contactId],
        (err, preKeys) => {
          if (err) {
            return res.status(500).json({ message: 'Database error' });
          }

          db.all(
            'SELECT * FROM signed_pre_keys WHERE user_id = ? LIMIT 1',
            [contactId],
            (err, signedPreKeys) => {
              if (err) {
                return res.status(500).json({ message: 'Database error' });
              }

              const recipientKeys = {
                registrationId: contact.registration_id,
                identityKey: contact.identity_key,
                preKeyId: preKeys[0]?.key_id,
                preKeyPublic: preKeys[0]?.public_key,
                signedPreKeyId: signedPreKeys[0]?.key_id,
                signedPreKeyPublic: signedPreKeys[0]?.public_key,
                signedPreKeySignature: signedPreKeys[0]?.signature
              };

              res.json({
                message: 'Key exchange successful',
                recipientKeys
              });
            }
          );
        }
      );
    }
  );
});

app.get('/api/messages/:contactId', authenticateToken, (req, res) => {
  const { contactId } = req.params;
  const userId = req.user.id;

  db.all(
    `SELECT * FROM messages 
     WHERE (sender_id = ? AND recipient_id = ?) 
        OR (sender_id = ? AND recipient_id = ?)
     ORDER BY timestamp ASC`,
    [userId, contactId, contactId, userId],
    (err, messages) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({ messages });
    }
  );
});

const connectedUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.username} connected`);
  connectedUsers.set(socket.userId, socket);

  socket.on('send_message', (data) => {
    const { recipientId, encryptedMessage, plainText } = data;
    const messageId = 'msg_' + Math.random().toString(36).substr(2, 9) + Date.now();

    db.run(
      'INSERT INTO messages (id, sender_id, recipient_id, encrypted_message, plain_text) VALUES (?, ?, ?, ?, ?)',
      [messageId, socket.userId, recipientId, JSON.stringify(encryptedMessage), plainText],
      (err) => {
        if (err) {
          console.error('Error saving message:', err);
          return;
        }

        const recipientSocket = connectedUsers.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit('message', {
            id: messageId,
            senderId: socket.userId,
            encryptedMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
    );
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.username} disconnected`);
    connectedUsers.delete(socket.userId);
  });
});

server.listen(PORT, () => {
  console.log(`Secure Messenger Server running on port ${PORT}`);
});
