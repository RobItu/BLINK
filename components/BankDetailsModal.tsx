// components/BankDetailsModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BankDetails } from '../services/BankStorageService';

interface BankDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (bankDetails: BankDetails) => void;
}

export const BankDetailsModal: React.FC<BankDetailsModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  // Pre-loaded default values (grey text that becomes black when edited)
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bankAddress: {
      country: 'US',
      bankName: 'SAN FRANSISCO',
    },
    billingDetails: {
      postalCode: '01234',
      district: 'MA',
      line1: '100 Money Street',
      country: 'US',
      city: 'Boston',
      name: 'Satoshi Nakamoto',
    },
    routingNumber: '121000248',
    accountNumber: '12340010',
  });

  // Track which fields have been edited (to change from grey to black)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  const handleFieldChange = (field: string, value: string) => {
    setEditedFields(prev => new Set(prev).add(field));
    
    // Update nested object based on field path
    if (field.startsWith('bankAddress.')) {
      const key = field.split('.')[1];
      setBankDetails(prev => ({
        ...prev,
        bankAddress: { ...prev.bankAddress, [key]: value }
      }));
    } else if (field.startsWith('billingDetails.')) {
      const key = field.split('.')[1];
      setBankDetails(prev => ({
        ...prev,
        billingDetails: { ...prev.billingDetails, [key]: value }
      }));
    } else {
      setBankDetails(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = () => {
    onSave(bankDetails);
    onClose();
  };

  const getTextColor = (field: string) => {
    return editedFields.has(field) ? '#000' : '#999';
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Bank Account Details</Text>
              <Text style={styles.subtitle}>Required for fiat payments</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Personal Information */}
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={[styles.textInput, { color: getTextColor('billingDetails.name') }]}
                  value={bankDetails.billingDetails.name}
                  onChangeText={(value) => handleFieldChange('billingDetails.name', value)}
                  placeholder="Account holder name"
                  placeholderTextColor="#ccc"
                />
              </View>

              {/* Address Information */}
              <Text style={styles.sectionTitle}>Address</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Street Address</Text>
                <TextInput
                  style={[styles.textInput, { color: getTextColor('billingDetails.line1') }]}
                  value={bankDetails.billingDetails.line1}
                  onChangeText={(value) => handleFieldChange('billingDetails.line1', value)}
                  placeholder="Street address"
                  placeholderTextColor="#ccc"
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={[styles.textInput, { color: getTextColor('billingDetails.city') }]}
                    value={bankDetails.billingDetails.city}
                    onChangeText={(value) => handleFieldChange('billingDetails.city', value)}
                    placeholder="City"
                    placeholderTextColor="#ccc"
                  />
                </View>
                
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={[styles.textInput, { color: getTextColor('billingDetails.district') }]}
                    value={bankDetails.billingDetails.district}
                    onChangeText={(value) => handleFieldChange('billingDetails.district', value)}
                    placeholder="State"
                    placeholderTextColor="#ccc"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Postal Code</Text>
                  <TextInput
                    style={[styles.textInput, { color: getTextColor('billingDetails.postalCode') }]}
                    value={bankDetails.billingDetails.postalCode}
                    onChangeText={(value) => handleFieldChange('billingDetails.postalCode', value)}
                    placeholder="ZIP code"
                    placeholderTextColor="#ccc"
                  />
                </View>
                
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Country</Text>
                  <TextInput
                    style={[styles.textInput, { color: getTextColor('billingDetails.country') }]}
                    value={bankDetails.billingDetails.country}
                    onChangeText={(value) => handleFieldChange('billingDetails.country', value)}
                    placeholder="Country"
                    placeholderTextColor="#ccc"
                  />
                </View>
              </View>

              {/* Bank Information */}
              <Text style={styles.sectionTitle}>Bank Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={[styles.textInput, { color: getTextColor('bankAddress.bankName') }]}
                  value={bankDetails.bankAddress.bankName}
                  onChangeText={(value) => handleFieldChange('bankAddress.bankName', value)}
                  placeholder="Bank name"
                  placeholderTextColor="#ccc"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  style={[styles.textInput, { color: getTextColor('accountNumber') }]}
                  value={bankDetails.accountNumber}
                  onChangeText={(value) => handleFieldChange('accountNumber', value)}
                  placeholder="Account number"
                  placeholderTextColor="#ccc"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Routing Number</Text>
                <TextInput
                  style={[styles.textInput, { color: getTextColor('routingNumber') }]}
                  value={bankDetails.routingNumber}
                  onChangeText={(value) => handleFieldChange('routingNumber', value)}
                  placeholder="Routing number"
                  placeholderTextColor="#ccc"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '85%',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});