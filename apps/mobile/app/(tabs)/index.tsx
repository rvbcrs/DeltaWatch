import { SwipeableRow } from '@/components/SwipeableRow';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { api, Monitor } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    View as RNView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { timeAgo, getStatusColor } from '@deltawatch/shared';

// History sparkline component matching web UI
function HistorySparkline({ history }: { history?: Array<{ status: string }> }) {
  const bars = Array(10).fill(null);
  const historyLength = Math.min(history?.length || 0, 10);

  return (
    <RNView style={styles.sparkline}>
      {bars.map((_, i) => {
        // History is sorted newest-first, we want newest on the LEFT
        // So bar index 0 (leftmost) should show history[0] (newest)
        // And bar index 9 (rightmost) should show history[9] (oldest) or empty
        const record = i < historyLength && history ? history[i] : null;
        
        const color = record ? getStatusColor(record.status as 'unchanged' | 'changed' | 'error') : '#21262d';
        
        return <RNView key={i} style={[styles.sparklineBar, { backgroundColor: color }]} />;
      })}
    </RNView>
  );
}

// Type badge component matching web UI
function TypeBadge({ type, selector }: { type: string; selector: string }) {
  let label = 'TEXT';
  let bgColor = 'rgba(34, 197, 94, 0.2)';
  let textColor = '#4ade80';
  let borderColor = 'rgba(34, 197, 94, 0.3)';

  if (type === 'visual') {
    label = 'VISUAL';
    bgColor = 'rgba(59, 130, 246, 0.2)';
    textColor = '#60a5fa';
    borderColor = 'rgba(59, 130, 246, 0.3)';
  } else if (selector === 'body') {
    label = 'FULL PAGE';
    bgColor = 'rgba(168, 85, 247, 0.2)';
    textColor = '#c084fc';
    borderColor = 'rgba(168, 85, 247, 0.3)';
  }

  return (
    <RNView style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </RNView>
  );
}

export default function MonitorsScreen() {
  const { isAuthenticated } = useAuth();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMonitors = useCallback(async () => {
    try {
      await api.initialize();
      const data = await api.getMonitors();
      setMonitors(data);
    } catch (error) {
      console.error('Failed to fetch monitors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMonitors();
    }
  }, [isAuthenticated, fetchMonitors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMonitors();
    setRefreshing(false);
  };

  const handleCheck = async (monitorId: number) => {
    if (checkingId) return;
    setCheckingId(monitorId);
    try {
      await api.triggerCheck(monitorId);
      await fetchMonitors();
    } catch (error) {
      Alert.alert('Error', 'Check failed');
    } finally {
      setCheckingId(null);
    }
  };

  const handleToggleStatus = async (monitor: Monitor) => {
    try {
      setMonitors(monitors.map(m => 
        m.id === monitor.id ? { ...m, active: !m.active } : m
      ));
      await api.toggleMonitorStatus(monitor.id, !monitor.active);
    } catch (error) {
      Alert.alert('Error', 'Failed to update');
      fetchMonitors();
    }
  };

  const handleDelete = (monitor: Monitor) => {
    Alert.alert(
      'Delete Monitor',
      `Are you sure you want to delete "${monitor.name || 'this monitor'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setMonitors(monitors.filter(m => m.id !== monitor.id));
              await api.deleteMonitor(monitor.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete');
              fetchMonitors();
            }
          }
        },
      ]
    );
  };

  // Filter monitors by search query
  const filteredMonitors = monitors.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (m.name || '').toLowerCase().includes(query) || 
           m.url.toLowerCase().includes(query);
  });

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0d1117', '#161b22']} style={styles.gradient}>
          <View style={styles.loginPrompt}>
            <RNView style={styles.iconContainer}>
              <Ionicons name="pulse" size={48} color="#238636" />
            </RNView>
            <Text style={styles.welcomeTitle}>DeltaWatch</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to monitor your websites</Text>
            <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/login')}>
              <LinearGradient colors={['#238636', '#2ea043']} style={styles.signInGradient}>
                <Text style={styles.signInText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#238636" />
      </View>
    );
  }

  const renderMonitor = ({ item }: { item: Monitor }) => (
    <SwipeableRow onDelete={() => handleDelete(item)}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        style={styles.card}
        onPress={() => router.push(`/monitor/${item.id}`)}
      >
        <View style={styles.cardRow}>
          {/* Left side: Thumbnail for visual monitors */}
          {item.type === 'visual' && (
            <RNView style={styles.thumbnail}>
              {item.last_screenshot ? (
                <Image 
                  source={{ uri: `${api.getServerUrl()}/static/screenshots/${item.last_screenshot.split('/').pop()}` }}
                  style={styles.thumbnailImage}
                />
              ) : (
                <RNView style={styles.noImage}>
                  <Text style={styles.noImageText}>No img</Text>
                </RNView>
              )}
            </RNView>
          )}

          {/* Middle: Content */}
          <View style={styles.cardContent}>
            {/* Badges row */}
            <View style={styles.badgesRow}>
              <TypeBadge type={item.type} selector={item.selector} />
              <RNView style={styles.intervalBadge}>
                <Text style={styles.intervalText}>{item.interval}</Text>
              </RNView>
            </View>

            {/* Title with unread badge */}
            <View style={styles.titleRow}>
              <Text style={styles.monitorName} numberOfLines={1}>
                {item.name || new URL(item.url).hostname}
              </Text>
              {(item.unread_count ?? 0) > 0 && (
                <RNView style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {(item.unread_count ?? 0) > 9 ? '9+' : item.unread_count}
                  </Text>
                </RNView>
              )}
            </View>

            {/* URL */}
            <Text style={styles.url} numberOfLines={1}>
              {item.url}
            </Text>
          </View>
        </View>

        {/* Bottom row: History + Status + Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <HistorySparkline history={item.history} />
            <View style={styles.statusRow}>
              <RNView style={[styles.statusDot, { backgroundColor: item.active ? '#22c55e' : '#6b7280' }]} />
              <Text style={styles.lastCheck}>{timeAgo(item.last_check)}</Text>
            </View>
          </View>

          {/* Action buttons - matching web UI */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleCheck(item.id)}
              disabled={checkingId === item.id}
            >
              {checkingId === item.id ? (
                <ActivityIndicator size="small" color="#9ca3af" />
              ) : (
                <Ionicons name="refresh" size={16} color="#9ca3af" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionBtn, 
                !item.active ? styles.playBtn : styles.pauseBtn
              ]}
              onPress={() => handleToggleStatus(item)}
            >
              <Ionicons 
                name={item.active ? 'pause' : 'play'} 
                size={16} 
                color={item.active ? '#fb923c' : '#4ade80'} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableRow>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deltas</Text>
        <Text style={styles.headerCount}>{monitors.length}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek monitors..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredMonitors}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMonitor}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#238636" />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pulse-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>Nog geen deltas</Text>
            <Text style={styles.emptySubtext}>Voeg monitors toe via de web app</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#8b949e',
    marginBottom: 32,
  },
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  signInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerCount: {
    fontSize: 14,
    color: '#238636',
    fontWeight: '600',
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#21262d',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 10,
  },
  list: {
    padding: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 16,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  thumbnail: {
    width: 80,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#21262d',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#6b7280',
    fontSize: 10,
  },
  cardContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  intervalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  intervalText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fca5a5',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  monitorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  url: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: 'transparent',
  },
  footerLeft: {
    backgroundColor: 'transparent',
  },
  sparkline: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  sparklineBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastCheck: {
    fontSize: 12,
    color: '#8b949e',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#21262d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  pauseBtn: {
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8b949e',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
});
