import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, Divider, Surface } from 'react-native-paper';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { router } from 'expo-router';

export default function Sidebar(props: any) {
  const { user, profile, logout } = useAuth();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      {/* Profile Section */}
      <Surface style={styles.profileSection} elevation={0}>
        <Avatar.Text
          size={56}
          label={user?.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
          style={styles.avatar}
          color="#fff"
        />
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.role}>
          {profile?.tenantType === 'SOCIETY' ? 'Society' : 'Shop'} · {profile?.role || 'Member'}
        </Text>
        
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={() => {
            props.navigation.closeDrawer();
            // TODO: Navigate to Edit Profile
          }}
        >
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </Surface>

      <Divider style={styles.divider} />

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            props.navigation.closeDrawer();
            router.push('/(app)/(tabs)/billing');
          }}
        >
          <MaterialCommunityIcons name="credit-card-outline" size={24} color={Colors.textPrimary} />
          <Text style={styles.menuItemText}>Billing & Subscription</Text>
        </TouchableOpacity>

        {/* Placeholder items */}
        <TouchableOpacity style={styles.menuItem} onPress={() => props.navigation.closeDrawer()}>
          <MaterialCommunityIcons name="cog-outline" size={24} color={Colors.textPrimary} />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => props.navigation.closeDrawer()}>
          <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.textPrimary} />
          <Text style={styles.menuItemText}>Help & Support</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <Divider style={styles.divider} />
      <TouchableOpacity
        style={[styles.menuItem, styles.logoutItem]}
        onPress={() => {
          props.navigation.closeDrawer();
          logout();
        }}
      >
        <MaterialCommunityIcons name="logout" size={24} color={Colors.error} />
        <Text style={[styles.menuItemText, { color: Colors.error }]}>Log Out</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0, // Let SafeArea handle it if needed
  },
  profileSection: {
    padding: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: Colors.primary,
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  role: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  editProfileBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editProfileText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  divider: {
    backgroundColor: Colors.divider,
    height: 1,
  },
  menuContainer: {
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginLeft: 16,
  },
  logoutItem: {
    marginHorizontal: 12,
    marginBottom: 24,
  },
});
