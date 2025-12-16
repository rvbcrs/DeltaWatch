import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    View as RNView,
    ScrollView,
    StyleSheet,
    TouchableOpacity
} from 'react-native';

interface HealthStatus {
  server: string;
  database: string;
  browser?: string;
}

export default function SettingsScreen() {
  const { isAuthenticated, logout, serverUrl, user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      await api.initialize();
      const data = await api.getHealth();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkHealth();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        },
      ]
    );
  };

  const handleOpenWebApp = () => {
    if (serverUrl) {
      Linking.openURL(serverUrl);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="settings-outline" size={48} color="#30363d" />
          <Text style={styles.message}>Login to access settings</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <RNView style={[styles.iconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="person" size={18} color="#60a5fa" />
              </RNView>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{user?.email || 'Unknown'}</Text>
              </View>
            </View>
            <RNView style={styles.divider} />
            <View style={styles.row}>
              <RNView style={[styles.iconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <Ionicons name="server" size={18} color="#4ade80" />
              </RNView>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Server</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{serverUrl}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Server Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVER STATUS</Text>
          <View style={styles.card}>
            {loadingHealth ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#8b949e" />
                <Text style={styles.loadingText}>Checking server...</Text>
              </View>
            ) : health ? (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Server</Text>
                  <RNView style={[styles.statusBadge, { backgroundColor: health.server === 'ok' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <RNView style={[styles.statusDot, { backgroundColor: health.server === 'ok' ? '#22c55e' : '#ef4444' }]} />
                    <Text style={[styles.statusText, { color: health.server === 'ok' ? '#4ade80' : '#f87171' }]}>
                      {health.server === 'ok' ? 'Online' : 'Offline'}
                    </Text>
                  </RNView>
                </View>
                <RNView style={styles.divider} />
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Database</Text>
                  <RNView style={[styles.statusBadge, { backgroundColor: health.database === 'connected' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                    <RNView style={[styles.statusDot, { backgroundColor: health.database === 'connected' ? '#22c55e' : '#ef4444' }]} />
                    <Text style={[styles.statusText, { color: health.database === 'connected' ? '#4ade80' : '#f87171' }]}>
                      {health.database === 'connected' ? 'Connected' : 'Disconnected'}
                    </Text>
                  </RNView>
                </View>
                {health.browser && (
                  <>
                    <RNView style={styles.divider} />
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Browser</Text>
                      <RNView style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                        <RNView style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                        <Text style={[styles.statusText, { color: '#4ade80' }]}>{health.browser}</Text>
                      </RNView>
                    </View>
                  </>
                )}
              </>
            ) : (
              <TouchableOpacity style={styles.retryRow} onPress={checkHealth}>
                <Ionicons name="refresh" size={18} color="#8b949e" />
                <Text style={styles.retryText}>Tap to check status</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          
          <TouchableOpacity style={styles.actionCard} onPress={handleOpenWebApp}>
            <RNView style={[styles.iconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Ionicons name="globe" size={18} color="#c084fc" />
            </RNView>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Open Web App</Text>
              <Text style={styles.actionSubtitle}>Full settings & monitor editor</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={checkHealth}>
            <RNView style={[styles.iconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="pulse" size={18} color="#60a5fa" />
            </RNView>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Refresh Status</Text>
              <Text style={styles.actionSubtitle}>Check server connection</Text>
            </View>
            <Ionicons name="refresh" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#f87171" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>DeltaWatch Mobile v1.0.0</Text>
          <Text style={styles.footerSubtext}>Website Change Monitor</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  message: {
    color: '#8b949e',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#238636',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  rowLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  rowValue: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#21262d',
    marginLeft: 62,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
    backgroundColor: 'transparent',
  },
  loadingText: {
    color: '#8b949e',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'transparent',
  },
  statusLabel: {
    color: '#c9d1d9',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  retryText: {
    color: '#8b949e',
    fontSize: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 8,
    gap: 12,
  },
  actionContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  actionSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    gap: 8,
  },
  logoutText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'transparent',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  footerSubtext: {
    color: '#484f58',
    fontSize: 11,
    marginTop: 2,
  },
});
