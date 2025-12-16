import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, I18nManager, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });

    return (
      <View style={styles.rightActions}>
        <Animated.View style={[styles.actionContainer, { transform: [{ translateX: trans }] }]}>
          <RectButton
            style={styles.deleteButton}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
          </RectButton>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightActions: {
    width: 80,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  actionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 4,
    marginRight: 8,
  },
  deleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
