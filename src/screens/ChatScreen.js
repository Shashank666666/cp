import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useEncryption } from '../context/EncryptionContext';
import { API_URL } from '../config/constants';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, token, socket } = useAuth();
  const { encryptMessage, decryptMessage } = useEncryption();
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: contact.username });
    loadMessages();
    setupSocketListeners();
  }, [contact]);

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on('message', async (data) => {
      if (data.senderId === contact.id) {
        try {
          const senderAddress = `${data.senderId}.device`;
          const decryptedMessage = await decryptMessage(data.encryptedMessage, senderAddress);
          
          const message = {
            id: data.id,
            text: decryptedMessage,
            senderId: data.senderId,
            timestamp: data.timestamp,
            isEncrypted: true
          };
          
          setMessages(prev => [...prev, message]);
        } catch (error) {
          console.error('Error decrypting message:', error);
        }
      }
    });
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages/${contact.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const decryptedMessages = await Promise.all(
          data.messages.map(async (msg) => {
            if (msg.senderId !== user.id) {
              try {
                const senderAddress = `${msg.senderId}.device`;
                const decryptedText = await decryptMessage(msg.encryptedMessage, senderAddress);
                return {
                  ...msg,
                  text: decryptedText,
                  isEncrypted: true
                };
              } catch (error) {
                console.error('Error decrypting stored message:', error);
                return {
                  ...msg,
                  text: '[Decryption failed]',
                  isEncrypted: false
                };
              }
            } else {
              return {
                ...msg,
                text: msg.plainText,
                isEncrypted: true
              };
            }
          })
        );
        setMessages(decryptedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsLoading(true);
    try {
      const recipientAddress = `${contact.id}.device`;
      const encryptedMessage = await encryptMessage(newMessage, recipientAddress);

      const messageData = {
        recipientId: contact.id,
        encryptedMessage,
        plainText: newMessage
      };

      socket.emit('send_message', messageData);
      
      const message = {
        id: Date.now().toString(),
        text: newMessage,
        senderId: user.id,
        timestamp: new Date().toISOString(),
        isEncrypted: true
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.senderId === user.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownText : styles.otherText
          ]}>
            {item.text}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          {item.isEncrypted && (
            <Text style={styles.encryptedIndicator}>🔒</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          contentContainerStyle={styles.messagesList}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || isLoading) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || isLoading}
        >
          <Text style={styles.sendButtonText}>
            {isLoading ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    position: 'relative',
  },
  ownBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownText: {
    color: 'white',
  },
  otherText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  encryptedIndicator: {
    fontSize: 10,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatScreen;
