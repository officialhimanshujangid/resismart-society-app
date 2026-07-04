import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Appbar, Text, FAB, Portal, Dialog, TextInput, Button, ActivityIndicator, IconButton, Chip } from 'react-native-paper';
import { Colors } from '../../../src/constants/colors';
import { apiClient as api } from '../../../src/api/axios';
import { router } from 'expo-router';

interface Flat {
  _id: string;
  number: string;
  blockName: string;
  status: string;
  ownerUserId?: { name: string; email: string };
}

interface Block {
  _id: string;
  name: string;
}

export default function FlatsScreen() {
  const [flats, setFlats] = useState<Flat[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [number, setNumber] = useState('');
  const [blockId, setBlockId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const fetchFlats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/societies/flats');
      setFlats(res.data.flats || []);
    } catch (error) {
      console.log('Failed to fetch flats', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await api.get('/societies/blocks');
      setBlocks(res.data.blocks || []);
      if (res.data.blocks?.length > 0) setBlockId(res.data.blocks[0]._id);
    } catch (error) {
      console.log('Failed to fetch blocks', error);
    }
  };

  useEffect(() => {
    fetchBlocks();
    fetchFlats();
  }, []);

  const openModal = () => {
    setNumber('');
    if (blocks.length > 0) setBlockId(blocks[0]._id);
    setOwnerName('');
    setOwnerEmail('');
    setVisible(true);
  };

  const closeModal = () => setVisible(false);

  const handleSubmit = async () => {
    if (!number.trim() || !blockId) return Alert.alert('Error', 'Flat number and block are required');
    setSubmitting(true);
    try {
      const block = blocks.find(b => b._id === blockId);
      await api.post('/societies/flats', {
        number: number.trim(),
        blockName: block?.name,
        blockId,
        ownerName: ownerName.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
      });
      closeModal();
      fetchFlats();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save flat');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Flat }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/flat/${item._id}` as any)}
    >
      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>{item.number}</Text>
          <Chip
            style={{ backgroundColor: item.status === 'VACANT' ? Colors.surface : Colors.primary + '15' }}
            textStyle={{ fontSize: 10, color: item.status === 'VACANT' ? Colors.textDisabled : Colors.primary, fontWeight: '700' }}
          >
            {item.status.replace('_', ' ')}
          </Chip>
        </View>
        <Text style={styles.cardSubtitle}>{item.blockName} Block</Text>
        <Text style={styles.ownerText}>
          {item.ownerUserId ? `${item.ownerUserId.name} (${item.ownerUserId.email})` : 'Vacant'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textDisabled} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <Appbar.Header style={{ backgroundColor: Colors.surface, elevation: 0 }}>
        <Appbar.Content title="Flats Directory" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={flats}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No flats found.</Text>}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openModal}
        color="#fff"
      />

      <Portal>
        <Dialog visible={visible} onDismiss={closeModal} style={styles.dialog}>
          <Dialog.Title>Add Flat</Dialog.Title>
          <Dialog.Content>
            {blocks.length === 0 ? (
              <Text style={{color: Colors.error, marginBottom: 10}}>Please add a Block first in settings.</Text>
            ) : null}
            <TextInput
              label="Flat Number *"
              mode="outlined"
              value={number}
              onChangeText={setNumber}
              style={styles.input}
              activeOutlineColor={Colors.primary}
            />
            {blocks.length > 0 && (
              <Text style={{marginBottom: 10, fontSize: 12, color: Colors.textSecondary}}>Block selected: {blocks.find(b => b._id === blockId)?.name}</Text>
            )}
            <Text style={{marginTop: 10, marginBottom: 4, fontSize: 13, fontWeight: 'bold'}}>Primary Owner (Optional)</Text>
            <TextInput
              label="Owner Name"
              mode="outlined"
              value={ownerName}
              onChangeText={setOwnerName}
              style={styles.input}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              label="Owner Email"
              mode="outlined"
              keyboardType="email-address"
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              style={styles.input}
              activeOutlineColor={Colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeModal} textColor={Colors.textSecondary}>Cancel</Button>
            <Button onPress={handleSubmit} textColor={Colors.primary} loading={submitting} disabled={blocks.length === 0}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  list: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 50, color: Colors.textDisabled },
  card: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cardContent: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary },
  ownerText: { fontSize: 12, color: Colors.textDisabled, marginTop: 4 },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  dialog: { backgroundColor: Colors.surface, borderRadius: 16 },
  input: { marginBottom: 12, backgroundColor: Colors.surface, height: 44, fontSize: 14 },
});
