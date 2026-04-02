import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// THE BIG REVEAL — step/18
export default function RevealScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>THE REVEAL</Text>
      <Text style={styles.sub}>step/18</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.accent, fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  sub: { color: colors.textSecondary, marginTop: 8 },
})
