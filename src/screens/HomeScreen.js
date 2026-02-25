import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Button
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useEncryption } from '../context/EncryptionContext';
import { API_URL } from '../config/constants';

const HomeScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, token, socket } = useAuth();
  const { getPublicKeyBundle, processPreKeyBundle } = useEncryption();

  useEffect(() => {
    loadContacts();
    setupSocketListeners();
  }, []);

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on('new_message', (data) => {
      console.log('New message received:', data);
    });

    socket.on('contact_request', (data) => {
      console.log('Contact request received:', data);
      Alert.alert(
        'New Contact Request',
        `${data.fromUsername} wants to connect with you`,
        [
          { text: 'Decline', style: 'cancel' },
          { 
            text: 'Accept', 
            onPress: () => handleContactRequest(data.fromUserId, true)
          }
        ]
      );
    });
  };

  const loadContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const addContact = async () => {
    if (!newContactUsername.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/contacts/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newContactUsername }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await establishSecureSession(data.contact);
        setContacts([...contacts, data.contact]);
        setShowAddContact(false);
        setNewContactUsername('');
        Alert.alert('Success', 'Contact added successfully');
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact');
    } finally {
      setIsLoading(false);
    }
  };

  const establishSecureSession = async (contact) => {
    try {
      const publicKeyBundle = await getPublicKeyBundle();
      
      const response = await fetch(`${API_URL}/api/keys/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactId: contact.id,
          publicKeyBundle
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.recipientKeys) {
        const recipientAddress = `${contact.id}.device`;
        await processPreKeyBundle(data.recipientKeys, recipientAddress);
        console.log('Secure session established with', contact.username);
      }
    } catch (error) {
      console.error('Error establishing secure session:', error);
    }
  };

  const handleContactRequest = async (contactId, accept) => {
    try {
      const response = await fetch(`${API_URL}/api/contacts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ contactId, accept }),
      });

      if (response.ok) {
        loadContacts();
      }
    } catch (error) {
      console.error('Error handling contact request:', error);
    }
  };

  const openChat = (contact) => {
    navigation.navigate('Chat', { contact });
  };

  const renderContact = ({ item }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => openChat(item)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.username}</Text>
        <Text style={styles.contactStatus}>
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
      <View style={styles.encryptedIndicator}>
        <Text style={styles.encryptedText}>🔒</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddContact(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        style={styles.contactsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubtext}>
              Add a contact to start messaging
            </Text>
          </View>
        }
      />

      <Modal
        visible={showAddContact}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Contact</Text>
            <Button
              title="Cancel"
              onPress={() => setShowAddContact(false)}
            />
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={newContactUsername}
              onChangeText={setNewContactUsername}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={addContact}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Adding...' : 'Add Contact'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  contactStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  encryptedIndicator: {
    marginLeft: 10,
  },
  encryptedText: {
    fontSize: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
