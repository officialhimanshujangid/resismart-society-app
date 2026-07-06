import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Appbar, Text, FAB, Portal, Dialog, TextInput, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { Colors } from '../../src/constants/colors';
import { apiClient as api } from '../../src/api/axios';
import { router } from 'expo-router';

interface Block {
  _id: string;
  name: string;
  totalFloors?: number;
  blockType?: string;
}

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [blockType, setBlockType] = useState('');

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/societies/blocks');
      setBlocks(res.data.blocks);
    } catch (error) {
      console.log('Failed to fetch blocks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const openModal = (block?: Block) => {
    if (block) {
      setEditingId(block._id);
      setName(block.name);
      setTotalFloors(block.totalFloors?.toString() || '');
      setBlockType(block.blockType || '');
    } else {
      setEditingId(null);
      setName('');
      setTotalFloors('');
      setBlockType('');
    }
    setVisible(true);
  };

  const closeModal = () => setVisible(false);

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Block name is required');
    setSubmitting(true);
    try {
      const payload: any = { name: name.trim() };
      if (totalFloors) payload.totalFloors = parseInt(totalFloors, 10);
      if (blockType) payload.blockType = blockType.trim();

      if (editingId) {
        await api.put(`/societies/blocks/${editingId}`, payload);
      } else {
        await api.post('/societies/blocks', payload);
      }
      closeModal();
      fetchBlocks();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save block');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, blockName: string) => {
    Alert.alert('Delete Block', `Are you sure you want to delete ${blockName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/societies/blocks/${id}`);
          fetchBlocks();
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.error || 'Failed to delete block');
        }
      }}
    ]);
  };

  const renderItem = ({ item }: { item: Block }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>
          Type: {item.blockType || 'N/A'} • Floors: {item.totalFloors || 'N/A'}
        </Text>
      </View>
      <View style={styles.actions}>
        <IconButton icon="pencil-outline" size={20} iconColor={Colors.primary} onPress={() => openModal(item)} />
        <IconButton icon="trash-can-outline" size={20} iconColor={Colors.error} onPress={() => handleDelete(item._id, item.name)} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Appbar.Header style={{ backgroundColor: Colors.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Block Management" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No blocks found. Add one below.</Text>}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => openModal()}
        color="#fff"
      />

      <Portal>
        <Dialog visible={visible} onDismiss={closeModal} style={styles.dialog}>
          <Dialog.Title style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>
            {editingId ? 'Edit Block' : 'Add Block'}
          </Dialog.Title>
          <Dialog.Content>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TextInput
                  label="Block Name *"
                  mode="outlined"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.textPrimary}
                  theme={{ colors: { onSurfaceVariant: Colors.textSecondary } }}
                />
                <TextInput
                  label="Total Floors"
                  mode="outlined"
                  keyboardType="numeric"
                  value={totalFloors}
                  onChangeText={setTotalFloors}
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.textPrimary}
                  theme={{ colors: { onSurfaceVariant: Colors.textSecondary } }}
                />
                <TextInput
                  label="Block Type (e.g. Residential)"
                  mode="outlined"
                  value={blockType}
                  onChangeText={setBlockType}
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.textPrimary}
                  theme={{ colors: { onSurfaceVariant: Colors.textSecondary } }}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeModal} textColor={Colors.textSecondary}>Cancel</Button>
            <Button onPress={handleSubmit} textColor={Colors.primary} loading={submitting} labelStyle={{ fontWeight: 'bold' }}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

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
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row' },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  dialog: { backgroundColor: Colors.surface, borderRadius: 16 },
  input: { marginBottom: 12, backgroundColor: Colors.surface },
});
