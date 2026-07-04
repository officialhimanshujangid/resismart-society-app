import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text, Avatar, Divider } from 'react-native-paper';
import { useAuth } from '../../../src/context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../src/constants/colors';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const MENU_ITEMS = [
  {
    key: 'blocks',
    label: 'Block Management',
    icon: 'office-building' as const,
    onPress: () => router.push('/(app)/blocks'),
  },
  {
    key: 'billing',
    label: 'Billing & Subscription',
    icon: 'credit-card-outline' as const,
    onPress: () => router.push('/(app)/(tabs)/billing'),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'cog-outline' as const,
    onPress: () => {},
  },
  {
    key: 'help',
    label: 'Help & Support',
    icon: 'help-circle-outline' as const,
    onPress: () => {},
  },
];

export default function MoreScreen() {
  const { user, profile, logout } = useAuth();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>More</Text>
        </View>

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <Avatar.Text
            size={56}
            label={user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
            style={styles.avatar}
            color="#fff"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileRole}>
              {profile?.tenantType === 'society' ? 'Society' : 'Shop'} · {profile?.role || 'Member'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Menu Items ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            {MENU_ITEMS.map((item, i) => (
              <React.Fragment key={item.key}>
                {i > 0 && <Divider style={styles.divider} />}
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <MaterialCommunityIcons name={item.icon} size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={logout}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: Colors.error + '15' }]}>
                <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.error }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── App version ── */}
        <Text style={styles.version}>Resismart Society · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 32 },

  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: 14,
  },
  avatar: { backgroundColor: Colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  profileRole: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDisabled, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },

  // Menu card
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  divider: { backgroundColor: Colors.divider, height: 1, marginHorizontal: 16 },

  version: { fontSize: 12, color: Colors.textDisabled, textAlign: 'center', marginTop: 8 },
});
