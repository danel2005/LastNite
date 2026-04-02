import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/lib/design'

// Placeholder — full profile setup in step/03-backend-auth
export default function ProfileSetupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile Setup — step/03</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.text, fontSize: 16 },
})
