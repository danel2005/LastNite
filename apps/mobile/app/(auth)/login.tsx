import { View, Text, StyleSheet } from 'react-native'
import { colors, typography } from '@/lib/design'

// Placeholder — full auth implementation in step/03-backend-auth
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>LastNite</Text>
      <Text style={styles.subtitle}>The night remembers everything.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 8,
  },
})
