import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    View as RNView,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';

export default function LoginScreen() {
  const { login, setServerUrl, serverUrl } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(serverUrl || '');
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(!serverUrl);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    if (!server) {
      Alert.alert('Error', 'Please configure server URL');
      return;
    }

    setLoading(true);
    try {
      setServerUrl(server);
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0d1117', '#161b22', '#0d1117']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.header}>
              <RNView style={styles.logoContainer}>
                <Ionicons name="pulse" size={40} color="#238636" />
              </RNView>
              <Text style={styles.title}>DeltaWatch</Text>
              <Text style={styles.subtitle}>Website Change Monitor</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Server Config */}
              {showServerConfig ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Server URL</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="server-outline" size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={server}
                      onChangeText={setServer}
                      placeholder="https://your-server.com"
                      placeholderTextColor="#4b5563"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.toggleLink}
                    onPress={() => setShowServerConfig(false)}
                  >
                    <Text style={styles.toggleLinkText}>Hide</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.serverPreview}
                  onPress={() => setShowServerConfig(true)}
                >
                  <RNView style={styles.serverPreviewIcon}>
                    <Ionicons name="server-outline" size={16} color="#238636" />
                  </RNView>
                  <Text style={styles.serverPreviewText} numberOfLines={1}>
                    {server || 'Configure Server'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </TouchableOpacity>
              )}

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#4b5563"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#4b5563"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons 
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                      size={18} 
                      color="#6b7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={loading ? ['#1a4d2e', '#1a4d2e'] : ['#238636', '#2ea043']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account? Sign up on the web.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
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
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'transparent',
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#161b22',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  inputGroup: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  label: {
    color: '#c9d1d9',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 4,
  },
  toggleLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  toggleLinkText: {
    color: '#238636',
    fontSize: 13,
    fontWeight: '500',
  },
  serverPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  serverPreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverPreviewText: {
    flex: 1,
    color: '#8b949e',
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    backgroundColor: 'transparent',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 13,
  },
});
