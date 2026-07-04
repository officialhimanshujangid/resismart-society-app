import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Appbar, Text, ActivityIndicator, Button, Portal, Dialog, TextInput, IconButton, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../../src/constants/colors';
import { apiClient as api } from '../../../src/api/axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Resident {
  _id: string;
  userId: { _id: string; name: string; email: string; phone?: string };
  relationship: string;
  isOwner: boolean;
}

export default function FlatDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [flat, setFlat] = useState<any>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('FAMILY_MEMBER');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [flatRes, resRes] = await Promise.all([
        api.get(`/societies/flats/${id}`),
        api.get(`/societies/flats/${id}/residents`)
      ]);
      setFlat(flatRes.data.flat);
      setResidents(resRes.data.residents);
    } catch (error) {
      console.log('Failed to fetch flat details', error);
      Alert.alert('Error', 'Failed to load flat details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddResident = async () => {
    if (!name.trim() || !email.trim()) return Alert.alert('Error', 'Name and email are required');
    setSubmitting(true);
    try {
      await api.post(`/societies/flats/${id}/residents`, {
        name, email, phone, relationship
      });
      setVisible(false);
      setName(''); setEmail(''); setPhone(''); setRelationship('FAMILY_MEMBER');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add resident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveResident = (resId: string, resName: string, isOwner: boolean) => {
    if (isOwner) return Alert.alert('Notice', 'Cannot remove primary owner from this view.');
    Alert.alert('Remove Resident', `Are you sure you want to remove ${resName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/societies/residents/${resId}`);
          fetchData();
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.error || 'Failed to remove resident');
        }
      }}
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!flat) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text>Flat not found.</Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Appbar.Header style={{ backgroundColor: Colors.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={`Flat ${flat.number}`} titleStyle={styles.headerTitle} subtitle={`${flat.blockName} Block`} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Flat Details</Text>
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Status</Text>
            <Chip style={{ backgroundColor: Colors.primary + '15' }} textStyle={{ color: Colors.primary, fontSize: 12 }}>
              {flat.status.replace('_', ' ')}
            </Chip>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{flat.fullAddress || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Primary Owner</Text>
            <View>
              <Text style={styles.value}>{flat.ownerUserId?.name || 'Vacant'}</Text>
              {flat.ownerUserId && <Text style={styles.subValue}>{flat.ownerUserId.email}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.cardHeader}>Residents ({residents.length})</Text>
          <Button mode="text" textColor={Colors.primary} onPress={() => setVisible(true)}>+ Add</Button>
        </View>

        {residents.map((r) => (
          <View key={r._id} style={styles.residentCard}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={r.isOwner ? "shield-account" : "account"} size={24} color={r.isOwner ? Colors.primary : Colors.textSecondary} />
            </View>
            <View style={styles.residentInfo}>
              <Text style={styles.residentName}>{r.userId?.name}</Text>
              <Text style={styles.residentRole}>{r.relationship.replace('_', ' ')}</Text>
            </View>
            {!r.isOwner && (
              <IconButton icon="trash-can-outline" iconColor={Colors.error} size={20} onPress={() => handleRemoveResident(r._id, r.userId?.name, r.isOwner)} />
            )}
          </View>
        ))}
      </ScrollView>

      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)} style={styles.dialog}>
          <Dialog.Title>Add Resident</Dialog.Title>
          <Dialog.Content>
            <View style={styles.roleToggle}>
              <Button 
                mode={relationship === 'FAMILY_MEMBER' ? 'contained' : 'outlined'}
                onPress={() => setRelationship('FAMILY_MEMBER')}
                style={styles.toggleBtn}
                buttonColor={relationship === 'FAMILY_MEMBER' ? Colors.primary : undefined}
              >
                Family
              </Button>
              <Button 
                mode={relationship === 'TENANT' ? 'contained' : 'outlined'}
                onPress={() => setRelationship('TENANT')}
                style={styles.toggleBtn}
                buttonColor={relationship === 'TENANT' ? Colors.primary : undefined}
              >
                Tenant
              </Button>
            </View>

            <TextInput label="Name *" mode="outlined" value={name} onChangeText={setName} style={styles.input} activeOutlineColor={Colors.primary} />
            <TextInput label="Email *" mode="outlined" value={email} onChangeText={setEmail} keyboardType="email-address" style={styles.input} activeOutlineColor={Colors.primary} />
            <TextInput label="Phone" mode="outlined" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} activeOutlineColor={Colors.primary} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)} textColor={Colors.textSecondary}>Cancel</Button>
            <Button onPress={handleAddResident} textColor={Colors.primary} loading={submitting}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cardHeader: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  divider: { marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  label: { fontSize: 13, color: Colors.textDisabled, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, textAlign: 'right' },
  subValue: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  
  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  residentInfo: { flex: 1 },
  residentName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  residentRole: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },

  dialog: { backgroundColor: Colors.surface, borderRadius: 16 },
  roleToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: { flex: 1 },
  input: { marginBottom: 12, backgroundColor: Colors.surface, height: 44, fontSize: 14 },
});
