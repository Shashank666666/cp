import React, { createContext, useState, useContext, useEffect } from 'react';
import * as CryptoJS from 'crypto-js';
import { SecureStore } from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

const EncryptionContext = createContext();

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
};

export const EncryptionProvider = ({ children }) => {
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeEncryption();
  }, []);

  const initializeEncryption = async () => {
    try {
      let storedKey = await SecureStore.getItemAsync('encryptionKey');
      
      if (!storedKey) {
        const key = CryptoJS.lib.WordArray.random(256/8).toString();
        await SecureStore.setItemAsync('encryptionKey', key);
        setEncryptionKey(key);
      } else {
        setEncryptionKey(storedKey);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing encryption:', error);
    }
  };

  const encryptMessage = async (message, recipientAddress) => {
    if (!isInitialized || !encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(message, encryptionKey).toString();
      
      return {
        type: 1,
        body: encrypted
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  };

  const decryptMessage = async (encryptedMessage, senderAddress) => {
    if (!isInitialized || !encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage.body, encryptionKey);
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plaintext) {
        throw new Error('Decryption failed - invalid key or corrupted data');
      }
      
      return plaintext;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  };

  const processPreKeyBundle = async (preKeyBundle, recipientAddress) => {
    console.log('Simplified encryption - pre-key bundle processing not needed');
    return true;
  };

  const getPublicKeyBundle = async () => {
    if (!isInitialized) {
      throw new Error('Encryption not initialized');
    }

    return {
      registrationId: 12345,
      identityKey: 'demo-identity-key',
      preKeyId: 1,
      preKeyPublic: 'demo-pre-key',
      signedPreKeyId: 1,
      signedPreKeyPublic: 'demo-signed-pre-key',
      signedPreKeySignature: 'demo-signature'
    };
  };

  const value = {
    isInitialized,
    encryptionKey,
    encryptMessage,
    decryptMessage,
    processPreKeyBundle,
    getPublicKeyBundle
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};
