/**
 * Tab Navigator — 5-tab bottom nav matching the LastNite UI design.
 * Tabs: Home | Events | [Camera FAB] | Feed | Profile
 *
 * Camera is a center FAB that pushes to the camera screen rather than
 * being a true tab — implemented as a custom tab button.
 */

import { Tabs } from 'expo-router'
import { router } from 'expo-router'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, borderRadius } from '@/lib/design'

// ─── Tab icon component ───────────────────────────────────────────────────────

function TabIcon({
  symbol,
  label,
  focused,
}: {
  symbol: string
  label: string
  focused: boolean
}) {
  return (
    <View style={icon.wrap}>
      <Text
        style={[
          icon.symbol,
          { color: focused ? colors.primary : colors.textTertiary },
        ]}
      >
        {symbol}
      </Text>
      <Text
        style={[
          icon.label,
          { color: focused ? colors.primary : colors.textTertiary },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const icon = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  symbol: { fontSize: 22 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
})

// ─── Camera FAB tab button ────────────────────────────────────────────────────

function CameraTabButton() {
  const insets = useSafeAreaInsets()
  return (
    <View style={fab.container}>
      <TouchableOpacity
        style={fab.btn}
        onPress={() => router.push('/(app)/events/join' as never)}
        activeOpacity={0.85}
      >
        <Text style={fab.icon}>📸</Text>
      </TouchableOpacity>
    </View>
  )
}

const fab = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  icon: { fontSize: 24 },
})

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(31, 29, 51, 0.92)',
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          // Rounded top corners
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          position: 'absolute',
          // subtle top glow
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.1,
          shadowRadius: 24,
          elevation: 20,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🎟" label="Events" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          tabBarButton: () => <CameraTabButton />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="✨" label="Feed" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
