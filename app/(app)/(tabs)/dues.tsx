import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

import { Colors } from '../../../src/constants/colors';
import { Appbar } from 'react-native-paper';

export default function DuesScreen() {
  return (
    <View style={styles.root}>
      <Appbar.Header style={{ backgroundColor: Colors.surface, elevation: 0 }}>
        <Appbar.Content title="Dues" titleStyle={styles.headerTitle} />
      </Appbar.Header>
      <View style={styles.container}>
        <Text style={styles.text}>Dues content goes here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
